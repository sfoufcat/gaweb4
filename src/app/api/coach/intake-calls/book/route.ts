import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { IntakeCallConfig, CoachAvailability, UnifiedEvent, IntakeBookingToken } from '@/types';
import { createZoomMeeting } from '@/lib/integrations/zoom';
import { createGoogleMeetMeeting } from '@/lib/integrations/google-meet';
import { sendBrandedIntakeConfirmation, sendIntakeNotificationToCoach, createIntakeNotificationForCoach } from '@/lib/intake-notifications';
import { StreamClient } from '@stream-io/node-sdk';

/**
 * POST /api/coach/intake-calls/book
 * Coach-initiated intake call booking
 *
 * This endpoint is used when a coach schedules an intake call directly,
 * picking the time themselves (vs. prospect self-booking via funnel/public link).
 *
 * Body:
 * - intakeConfigId: string (required)
 * - prospectName: string (required)
 * - prospectEmail: string (required)
 * - prospectPhone?: string (optional)
 * - customFields?: Record<string, string> (optional)
 * - startDateTime: ISO string (required)
 * - endDateTime: ISO string (required)
 * - timezone: string (required - prospect's timezone)
 */
export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 });
    }

    const body = await req.json();

    const {
      intakeConfigId,
      prospectName,
      prospectEmail,
      prospectPhone,
      customFields,
      startDateTime,
      endDateTime,
      timezone: prospectTimezone,
    } = body;

    // Validate required fields
    if (!intakeConfigId) {
      return NextResponse.json({ error: 'intakeConfigId is required' }, { status: 400 });
    }

    if (!startDateTime || !endDateTime) {
      return NextResponse.json({ error: 'Start and end time are required' }, { status: 400 });
    }

    if (!prospectName?.trim()) {
      return NextResponse.json({ error: 'Prospect name is required' }, { status: 400 });
    }

    if (!prospectEmail?.trim()) {
      return NextResponse.json({ error: 'Prospect email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(prospectEmail.trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Get intake config
    const configDoc = await adminDb.collection('intake_call_configs').doc(intakeConfigId).get();

    if (!configDoc.exists) {
      return NextResponse.json({ error: 'Intake config not found' }, { status: 404 });
    }

    const config = { id: configDoc.id, ...configDoc.data() } as IntakeCallConfig;

    // Verify config belongs to this org
    if (config.organizationId !== orgId) {
      return NextResponse.json({ error: 'Intake config not found' }, { status: 404 });
    }

    // Get current user (coach) info
    const clerkUser = await currentUser();
    const hostName = clerkUser?.firstName
      ? `${clerkUser.firstName}${clerkUser.lastName ? ' ' + clerkUser.lastName : ''}`
      : 'Coach';
    const coachEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;

    // Get availability for timezone info
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(orgId)
      .get();

    const availability = availabilityDoc.exists
      ? (availabilityDoc.data() as CoachAvailability)
      : null;

    const coachTimezone = availability?.timezone || 'America/New_York';

    // Verify slot is still available (check for conflicts)
    const slotStart = new Date(startDateTime);
    const slotEnd = new Date(endDateTime);

    const conflictingSnapshot = await adminDb
      .collection('events')
      .where('organizationId', '==', orgId)
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
        const result = await createZoomMeeting(orgId, {
          topic: `${config.name} with ${prospectName.trim()}`,
          startTime: startDateTime,
          duration: config.duration,
          timezone: coachTimezone,
          agenda: config.description || `Intake call with ${prospectName.trim()}`,
        });
        meetingUrl = result.meetingUrl;
        externalMeetingId = result.meetingId;
      } catch (err) {
        console.warn('[COACH_INTAKE_BOOK] Failed to create Zoom meeting:', err);
      }
    } else if (config.meetingProvider === 'google_meet') {
      try {
        const result = await createGoogleMeetMeeting(orgId, {
          summary: `${config.name} with ${prospectName.trim()}`,
          startTime: startDateTime,
          endTime: endDateTime,
          timezone: coachTimezone,
          description: config.description || `Intake call with ${prospectName.trim()}`,
        });
        meetingUrl = result.meetingUrl;
        externalMeetingId = result.eventId;
      } catch (err) {
        console.warn('[COACH_INTAKE_BOOK] Failed to create Google Meet:', err);
      }
    } else if (config.meetingProvider === 'manual') {
      meetingUrl = config.manualMeetingUrl;
    }
    // Note: in_app provider doesn't need meetingUrl - the join link will be generated
    // after the event is created using the eventId

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

      organizationId: orgId,

      isRecurring: false,

      createdByUserId: userId,
      hostUserId: userId,
      hostName,
      isCoachLed: true,

      intakeCallConfigId: config.id,
      intakeData: customFields || {},
      prospectEmail: prospectEmail.toLowerCase().trim(),
      prospectName: prospectName.trim(),
      prospectPhone: prospectPhone?.trim() || undefined,

      attendeeIds: [],
      sendChatReminders: false,

      createdAt: now,
      updatedAt: now,
    };

    const eventRef = await adminDb.collection('events').add(eventData);

    // For in_app calls, create the Stream Video call
    let streamVideoCallId: string | undefined;
    if (config.meetingProvider === 'in_app') {
      streamVideoCallId = `intake_${eventRef.id}`;

      // Create the call on Stream's servers
      const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
      const apiSecret = process.env.STREAM_API_SECRET;

      if (apiKey && apiSecret) {
        try {
          const streamClient = new StreamClient(apiKey, apiSecret);
          const call = streamClient.video.call('default', streamVideoCallId);

          await call.create({
            data: {
              created_by_id: userId,
              custom: {
                eventId: eventRef.id,
                organizationId: orgId,
                callType: 'intake',
              },
            },
          });

          console.log(`[COACH_INTAKE_BOOK] Created Stream Video call: ${streamVideoCallId}`);
        } catch (streamErr) {
          console.error(`[COACH_INTAKE_BOOK] Failed to create Stream call:`, streamErr);
          // Continue anyway - call can be created when first person joins
        }
      }

      await eventRef.update({ streamVideoCallId });
      console.log(`[COACH_INTAKE_BOOK] Set in-app call ID: ${streamVideoCallId}`);
    }

    // Create booking token for cancel/reschedule links
    const tokenData: Omit<IntakeBookingToken, 'id'> = {
      eventId: eventRef.id,
      intakeCallConfigId: config.id,
      prospectEmail: prospectEmail.toLowerCase().trim(),
      expiresAt: new Date(slotStart.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
    };

    const tokenRef = await adminDb.collection('intake_booking_tokens').add(tokenData);
    await eventRef.update({ bookingTokenId: tokenRef.id });

    // Get org branding for email
    let orgBranding: { name?: string; logoUrl?: string } = {};
    try {
      const orgBrandingDoc = await adminDb.collection('organization_branding').doc(orgId).get();
      if (orgBrandingDoc.exists) {
        orgBranding = orgBrandingDoc.data() as typeof orgBranding;
      }
    } catch (err) {
      console.warn('[COACH_INTAKE_BOOK] Failed to fetch org branding:', err);
    }

    // Get org slug for booking links
    let orgSlug = orgId;
    try {
      const orgSettingsDoc = await adminDb.collection('organization_settings').doc(orgId).get();
      if (orgSettingsDoc.exists) {
        const settings = orgSettingsDoc.data();
        if (settings?.slug) {
          orgSlug = settings.slug;
        }
      }
    } catch (err) {
      console.warn('[COACH_INTAKE_BOOK] Failed to fetch org settings:', err);
    }

    // Send email notifications (don't await - let it run in background)
    const createdEvent = { id: eventRef.id, ...eventData } as UnifiedEvent;

    // Send branded confirmation to prospect
    sendBrandedIntakeConfirmation({
      event: createdEvent,
      config,
      prospectName: prospectName.trim(),
      prospectEmail: prospectEmail.toLowerCase().trim(),
      prospectTimezone: prospectTimezone || coachTimezone,
      coachName: hostName,
      organizationId: orgId,
      bookingTokenId: tokenRef.id,
      orgBranding,
      orgSlug,
    }).catch(err => {
      console.error('[COACH_INTAKE_BOOK] Failed to send prospect confirmation:', err);
    });

    // Send notification to coach
    sendIntakeNotificationToCoach({
      event: createdEvent,
      config,
      prospectName: prospectName.trim(),
      prospectEmail: prospectEmail.toLowerCase().trim(),
      coachName: hostName,
      coachEmail,
      organizationId: orgId,
      bookingTokenId: tokenRef.id,
    }).catch(err => {
      console.error('[COACH_INTAKE_BOOK] Failed to send coach notification:', err);
    });

    // Create in-app notification for coach
    createIntakeNotificationForCoach({
      coachUserId: userId,
      type: 'intake_call_booked',
      prospectName: prospectName.trim(),
      configName: config.name,
      startDateTime,
      organizationId: orgId,
      eventId: eventRef.id,
    }).catch(err => {
      console.error('[COACH_INTAKE_BOOK] Failed to create in-app notification:', err);
    });

    console.log(`[COACH_INTAKE_BOOK] Created intake call ${eventRef.id} for ${prospectEmail}`);

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
      calendarInviteSent: true,
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_INTAKE_BOOK_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
