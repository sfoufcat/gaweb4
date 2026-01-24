import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { IntakeCallConfig, CoachAvailability, UnifiedEvent, IntakeBookingToken, FlowSession, OrgBranding, OrgSettings } from '@/types';
import { createZoomMeeting } from '@/lib/integrations/zoom';
import { createGoogleMeetMeeting } from '@/lib/integrations/google-meet';
import { sendBrandedIntakeConfirmation, sendIntakeNotificationToCoach } from '@/lib/intake-notifications';
import { generateICS } from '@/lib/calendar-ics';

/**
 * POST /api/funnel/scheduling/book
 * Book an intake call from within a funnel
 *
 * Body:
 * - flowSessionId: string (required)
 * - intakeCallConfigId: string (required)
 * - startDateTime: ISO string (required)
 * - endDateTime: ISO string (required)
 * - name: string (required)
 * - email: string (required)
 * - timezone: string (required)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      flowSessionId,
      intakeCallConfigId,
      startDateTime,
      endDateTime,
      name,
      email,
      timezone: userTimezone,
    } = body;

    // Validate required fields
    if (!flowSessionId) {
      return NextResponse.json({ error: 'flowSessionId is required' }, { status: 400 });
    }

    if (!intakeCallConfigId) {
      return NextResponse.json({ error: 'intakeCallConfigId is required' }, { status: 400 });
    }

    if (!startDateTime || !endDateTime) {
      return NextResponse.json({ error: 'Start and end time are required' }, { status: 400 });
    }

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Get flow session
    const sessionDoc = await adminDb.collection('flow_sessions').doc(flowSessionId).get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Flow session not found' }, { status: 404 });
    }

    const session = { id: sessionDoc.id, ...sessionDoc.data() } as FlowSession;

    // Get intake config
    const configDoc = await adminDb.collection('intake_call_configs').doc(intakeCallConfigId).get();

    if (!configDoc.exists) {
      return NextResponse.json({ error: 'Intake config not found' }, { status: 404 });
    }

    const config = { id: configDoc.id, ...configDoc.data() } as IntakeCallConfig;

    if (!config.isActive) {
      return NextResponse.json({ error: 'Intake call is not active' }, { status: 400 });
    }

    const organizationId = config.organizationId;

    // Get coach info
    const coachesSnapshot = await adminDb
      .collection('users')
      .where('clerkOrganizationId', '==', organizationId)
      .where('role', 'in', ['super_coach', 'admin'])
      .limit(1)
      .get();

    let hostUserId = 'system';
    let hostName = 'Coach';

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

    // Verify slot is still available
    const slotStart = new Date(startDateTime);
    const slotEnd = new Date(endDateTime);

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

    // Create meeting link
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

      createdByUserId: 'funnel_booking',
      hostUserId,
      hostName,
      isCoachLed: true,

      intakeCallConfigId: config.id,
      intakeData: {},
      prospectEmail: email.toLowerCase().trim(),
      prospectName: name.trim(),
      funnelSessionId: flowSessionId,

      attendeeIds: [],
      sendChatReminders: false,

      createdAt: now,
      updatedAt: now,
    };

    const eventRef = await adminDb.collection('events').add(eventData);

    // Create booking token
    const tokenData: Omit<IntakeBookingToken, 'id'> = {
      eventId: eventRef.id,
      intakeCallConfigId: config.id,
      prospectEmail: email.toLowerCase().trim(),
      expiresAt: new Date(slotStart.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
    };

    const tokenRef = await adminDb.collection('intake_booking_tokens').add(tokenData);
    await eventRef.update({ bookingTokenId: tokenRef.id });

    // Update flow session with scheduled call data
    await adminDb.collection('flow_sessions').doc(flowSessionId).update({
      'data.scheduledCall': {
        eventId: eventRef.id,
        startDateTime,
        endDateTime,
        meetingUrl: meetingUrl || null,
      },
      updatedAt: now,
    });

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

    // Get org slug for branded email links
    const domainDoc = await adminDb
      .collection('org_domains')
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();
    const orgSlug = domainDoc.empty ? '' : domainDoc.docs[0].data().subdomain || '';

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
      console.error('[FUNNEL_SCHEDULING_BOOK] Failed to send prospect notification:', err);
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
      console.error('[FUNNEL_SCHEDULING_BOOK] Failed to send coach notification:', err);
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
    }, { status: 201 });
  } catch (error) {
    console.error('[FUNNEL_SCHEDULING_BOOK_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
