import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { getTenantFromHeaders } from '@/lib/tenant';
import type { IntakeCallConfig, CoachAvailability, UnifiedEvent, IntakeBookingToken, OrgBranding, OrgSettings, Funnel } from '@/types';
import { createZoomMeeting } from '@/lib/integrations/zoom';
import { createGoogleMeetMeeting } from '@/lib/integrations/google-meet';
import { sendBrandedIntakeConfirmation, sendIntakeNotificationToCoach, createIntakeNotificationForCoach } from '@/lib/intake-notifications';
import { generateICS } from '@/lib/calendar-ics';
import { StreamClient } from '@stream-io/node-sdk';

interface RouteParams {
  params: Promise<{ orgSlug: string; funnelSlug: string }>;
}

/**
 * POST /api/public/intake/funnel/[orgSlug]/[funnelSlug]/book
 * Book an intake call via funnel slug
 *
 * Body:
 * - startDateTime: ISO string (required)
 * - endDateTime: ISO string (required)
 * - name: string (required)
 * - email: string (required)
 * - phone?: string
 * - customFields?: Record<string, unknown>
 * - timezone: string (required - user's timezone)
 *
 * This is a public endpoint - no authentication required
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { orgSlug, funnelSlug } = await params;
    const body = await req.json();

    const {
      startDateTime,
      endDateTime,
      name,
      email,
      phone,
      customFields,
      timezone: userTimezone,
    } = body;

    // Validate required fields
    if (!startDateTime || !endDateTime) {
      return NextResponse.json({ error: 'Start and end time are required' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Get tenant from middleware headers (handles dev-tenant cookie/param)
    const headersList = await headers();
    const tenant = getTenantFromHeaders(new Headers(headersList));
    if (!tenant) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const organizationId = tenant.organizationId;

    // Find funnel by slug and targetType
    const funnelsSnapshot = await adminDb
      .collection('funnels')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', funnelSlug)
      .where('targetType', '==', 'intake')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (funnelsSnapshot.empty) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    const funnelDoc = funnelsSnapshot.docs[0];
    const funnel = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

    if (!funnel.intakeConfigId) {
      return NextResponse.json({ error: 'Funnel missing intake config reference' }, { status: 500 });
    }

    // Find intake config by ID
    const configDocRef = await adminDb
      .collection('intake_call_configs')
      .doc(funnel.intakeConfigId)
      .get();

    if (!configDocRef.exists) {
      return NextResponse.json({ error: 'Intake config not found' }, { status: 404 });
    }

    const config = { id: configDocRef.id, ...configDocRef.data() } as IntakeCallConfig;

    // Validate required custom fields
    if (config.customFields) {
      for (const field of config.customFields) {
        if (field.required && (!customFields || !customFields[field.id])) {
          return NextResponse.json({
            error: `${field.label} is required`
          }, { status: 400 });
        }
      }
    }

    // Validate phone if required
    if (config.requirePhone && !phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Get coach info
    const coachesSnapshot = await adminDb
      .collection('users')
      .where('clerkOrganizationId', '==', organizationId)
      .where('role', 'in', ['super_coach', 'admin'])
      .limit(1)
      .get();

    let hostUserId = 'system';
    let hostName = orgSlug;

    if (!coachesSnapshot.empty) {
      const coachData = coachesSnapshot.docs[0].data();
      hostUserId = coachesSnapshot.docs[0].id;
      hostName = coachData.displayName || coachData.firstName || hostName;
    }

    // Get availability for timezone
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();

    const availability = availabilityDoc.exists
      ? (availabilityDoc.data() as CoachAvailability)
      : null;

    const coachTimezone = availability?.timezone || 'America/New_York';

    // Verify the slot is still available
    const slotStart = new Date(startDateTime);
    const slotEnd = new Date(endDateTime);

    // Check for conflicting events
    const conflictingSnapshot = await adminDb
      .collection('events')
      .where('organizationId', '==', organizationId)
      .where('startDateTime', '>=', new Date(slotStart.getTime() - 60 * 60 * 1000).toISOString())
      .where('startDateTime', '<=', new Date(slotEnd.getTime() + 60 * 60 * 1000).toISOString())
      .where('status', 'in', ['confirmed', 'pending_response', 'proposed'])
      .get();

    const buffer = availability?.bufferBetweenCalls || 15;
    const hasConflict = conflictingSnapshot.docs.some(doc => {
      const event = doc.data() as UnifiedEvent;
      const eventStart = new Date(event.startDateTime);
      const eventEnd = event.endDateTime
        ? new Date(event.endDateTime)
        : new Date(eventStart.getTime() + (event.durationMinutes || 60) * 60 * 1000);

      const bufferedStart = new Date(eventStart.getTime() - buffer * 60 * 1000);
      const bufferedEnd = new Date(eventEnd.getTime() + buffer * 60 * 1000);

      return (
        (slotStart >= bufferedStart && slotStart < bufferedEnd) ||
        (slotEnd > bufferedStart && slotEnd <= bufferedEnd)
      );
    });

    if (hasConflict) {
      return NextResponse.json({
        error: 'This time slot is no longer available. Please select another time.'
      }, { status: 409 });
    }

    // Create meeting link based on provider
    let meetingUrl: string | undefined;
    let externalMeetingId: string | undefined;

    if (config.meetingProvider === 'zoom') {
      try {
        const result = await createZoomMeeting(organizationId, {
          topic: `${config.name} with ${name}`,
          startTime: startDateTime,
          duration: config.duration,
          timezone: coachTimezone,
          agenda: config.description || `Intake call with ${name}`,
        });
        meetingUrl = result.meetingUrl;
        externalMeetingId = result.meetingId;
      } catch (err) {
        console.warn('Failed to create Zoom meeting:', err);
        // Continue without meeting link - coach can add manually
      }
    } else if (config.meetingProvider === 'google_meet') {
      try {
        const result = await createGoogleMeetMeeting(organizationId, {
          summary: `${config.name} with ${name}`,
          startTime: startDateTime,
          endTime: endDateTime,
          timezone: coachTimezone,
          description: config.description || `Intake call with ${name}`,
        });
        meetingUrl = result.meetingUrl;
        externalMeetingId = result.eventId;
      } catch (err) {
        console.warn('Failed to create Google Meet:', err);
        // Continue without meeting link
      }
    } else if (config.meetingProvider === 'manual') {
      meetingUrl = config.manualMeetingUrl;
    }

    const now = new Date().toISOString();

    // Create the event
    const eventData: Omit<UnifiedEvent, 'id'> = {
      title: config.name,
      description: config.description,
      startDateTime,
      endDateTime,
      timezone: coachTimezone,
      durationMinutes: config.duration,

      locationType: 'online',
      locationLabel: config.meetingProvider === 'zoom' ? 'Zoom' :
                     config.meetingProvider === 'google_meet' ? 'Google Meet' :
                     config.meetingProvider === 'in_app' ? 'In-app Call' : 'Online',
      meetingLink: meetingUrl,
      meetingProvider: config.meetingProvider === 'in_app' ? 'stream' : config.meetingProvider,
      externalMeetingId,

      eventType: 'intake_call',
      scope: 'private',
      participantModel: 'invite_only',
      approvalType: 'none',
      status: 'confirmed',

      organizationId,

      isRecurring: false,

      createdByUserId: 'public_booking',
      hostUserId,
      hostName,
      isCoachLed: true,

      // Intake-specific fields
      intakeCallConfigId: config.id,
      intakeData: customFields || {},
      prospectEmail: email.toLowerCase().trim(),
      prospectName: name.trim(),
      prospectPhone: phone || undefined,

      attendeeIds: [],
      sendChatReminders: false,

      createdAt: now,
      updatedAt: now,
    };

    const eventRef = await adminDb.collection('events').add(eventData);

    // For in_app calls, create the Stream Video call
    if (config.meetingProvider === 'in_app') {
      const streamVideoCallId = `intake_${eventRef.id}`;

      const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
      const apiSecret = process.env.STREAM_API_SECRET;

      if (apiKey && apiSecret) {
        try {
          const streamClient = new StreamClient(apiKey, apiSecret);
          const call = streamClient.video.call('default', streamVideoCallId);

          await call.create({
            data: {
              created_by_id: hostUserId,
              custom: {
                eventId: eventRef.id,
                organizationId,
                callType: 'intake',
              },
            },
          });

          console.log(`[PUBLIC_INTAKE_FUNNEL_BOOK] Created Stream Video call: ${streamVideoCallId}`);
        } catch (streamErr) {
          console.error(`[PUBLIC_INTAKE_FUNNEL_BOOK] Failed to create Stream call:`, streamErr);
          // Continue anyway - call can be created when coach joins
        }
      }

      await eventRef.update({ streamVideoCallId });
    }

    // Create booking token for cancel/reschedule
    const tokenData: Omit<IntakeBookingToken, 'id'> = {
      eventId: eventRef.id,
      intakeCallConfigId: config.id,
      prospectEmail: email.toLowerCase().trim(),
      expiresAt: new Date(slotStart.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 24h after call
      createdAt: now,
    };

    const tokenRef = await adminDb.collection('intake_booking_tokens').add(tokenData);

    // Update event with token ID
    await eventRef.update({ bookingTokenId: tokenRef.id });

    // Get coach email for notification
    let coachEmail: string | undefined;
    if (!coachesSnapshot.empty) {
      const coachData = coachesSnapshot.docs[0].data();
      coachEmail = coachData.email || coachData.primaryEmail;
    }

    // Fetch branding and settings for branded email
    const [brandingDoc, settingsDoc] = await Promise.all([
      adminDb.collection('org_branding').doc(organizationId).get(),
      adminDb.collection('org_settings').doc(organizationId).get(),
    ]);

    const branding = brandingDoc.exists ? (brandingDoc.data() as OrgBranding) : null;
    const settings = settingsDoc.exists ? (settingsDoc.data() as OrgSettings) : null;

    // Generate ICS calendar invite
    const icsContent = generateICS({
      eventId: eventRef.id,
      title: `${config.name} with ${hostName}`,
      description: config.description || `Intake call with ${hostName}`,
      startDateTime,
      endDateTime,
      meetingLink: meetingUrl,
      hostName,
      hostEmail: coachEmail,
      attendeeName: name.trim(),
      attendeeEmail: email.toLowerCase().trim(),
      organizerName: branding?.appTitle || hostName,
      organizerEmail: coachEmail,
    });

    // Send email notifications (don't await - let it run in background)
    const createdEvent = { id: eventRef.id, ...eventData } as UnifiedEvent;

    // Send branded confirmation to prospect
    sendBrandedIntakeConfirmation({
      event: createdEvent,
      config,
      prospectName: name.trim(),
      prospectEmail: email.toLowerCase().trim(),
      prospectTimezone: userTimezone || coachTimezone,
      coachName: hostName,
      coachEmail,
      organizationId,
      bookingTokenId: tokenRef.id,
      orgBranding: {
        name: branding?.appTitle || hostName,
        logoUrl: branding?.logoUrl || undefined,
        horizontalLogoUrl: branding?.horizontalLogoUrl || undefined,
        accentColor: branding?.colors?.accentLight || undefined,
        hidePoweredBy: settings?.hidePoweredByCoachful || false,
      },
      orgSlug,
      icsContent,
    }).catch(err => {
      console.error('[PUBLIC_INTAKE_FUNNEL_BOOK] Failed to send prospect notification:', err);
    });

    // Send notification to coach
    sendIntakeNotificationToCoach({
      event: createdEvent,
      config,
      prospectName: name.trim(),
      prospectEmail: email.toLowerCase().trim(),
      coachName: hostName,
      coachEmail,
      organizationId,
      bookingTokenId: tokenRef.id,
    }).catch(err => {
      console.error('[PUBLIC_INTAKE_FUNNEL_BOOK] Failed to send coach notification:', err);
    });

    // Create in-app notification for coach (only if we have a valid coach user ID)
    createIntakeNotificationForCoach({
      coachUserId: hostUserId,
      type: 'intake_call_booked',
      prospectName: name.trim(),
      configName: config.name,
      startDateTime,
      organizationId,
      eventId: eventRef.id,
    }).catch(err => {
      console.error('[PUBLIC_INTAKE_FUNNEL_BOOK] Failed to create in-app notification:', err);
    });

    return NextResponse.json({
      success: true,
      event: {
        id: eventRef.id,
        title: eventData.title,
        startDateTime: eventData.startDateTime,
        endDateTime: eventData.endDateTime,
        meetingUrl: eventData.meetingLink,
        timezone: eventData.timezone,
      },
      bookingToken: tokenRef.id,
      confirmationMessage: config.confirmationMessage || `Thanks for booking! We'll see you soon.`,
    }, { status: 201 });
  } catch (error) {
    console.error('[PUBLIC_INTAKE_FUNNEL_BOOK_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
