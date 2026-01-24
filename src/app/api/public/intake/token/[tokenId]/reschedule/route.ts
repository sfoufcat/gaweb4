import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { IntakeCallConfig, IntakeBookingToken, UnifiedEvent, CoachAvailability, OrgBranding, OrgSettings } from '@/types';
import { createZoomMeeting } from '@/lib/integrations/zoom';
import { createGoogleMeetMeeting } from '@/lib/integrations/google-meet';
import { sendIntakeRescheduleNotifications, createIntakeNotificationForCoach } from '@/lib/intake-notifications';
import { generateICS } from '@/lib/calendar-ics';

interface RouteParams {
  params: Promise<{ tokenId: string }>;
}

/**
 * POST /api/public/intake/token/[tokenId]/reschedule
 * Reschedule an intake call booking using token auth
 *
 * Body:
 * - startDateTime: ISO string (required - new start time)
 * - endDateTime: ISO string (required - new end time)
 * - timezone: string (required - user's timezone)
 *
 * This is a public endpoint - no authentication required
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { tokenId } = await params;
    const body = await req.json();
    const { startDateTime, endDateTime, timezone: userTimezone } = body;

    if (!tokenId) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!startDateTime || !endDateTime) {
      return NextResponse.json({ error: 'New start and end times are required' }, { status: 400 });
    }

    // Get token
    const tokenDoc = await adminDb.collection('intake_booking_tokens').doc(tokenId).get();

    if (!tokenDoc.exists) {
      return NextResponse.json({
        error: 'Invalid link',
        code: 'TOKEN_INVALID',
        message: 'This link is not valid. Please check your email for the correct link.'
      }, { status: 404 });
    }

    const token = { id: tokenDoc.id, ...tokenDoc.data() } as IntakeBookingToken;

    // Check if token is expired
    if (new Date(token.expiresAt) < new Date()) {
      return NextResponse.json({
        error: 'Link expired',
        code: 'TOKEN_EXPIRED',
        message: 'This link has expired. Please contact your coach to reschedule your booking.'
      }, { status: 410 });
    }

    // Get event
    const eventDoc = await adminDb.collection('events').doc(token.eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({
        error: 'Booking not found',
        code: 'EVENT_NOT_FOUND',
        message: 'This booking could not be found.'
      }, { status: 404 });
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;
    const oldStartDateTime = event.startDateTime;

    // Check if event is already cancelled
    if (event.schedulingStatus === 'cancelled' || event.status === 'canceled') {
      return NextResponse.json({
        error: 'Already cancelled',
        code: 'EVENT_CANCELLED',
        message: 'This appointment has already been cancelled and cannot be rescheduled.'
      }, { status: 410 });
    }

    // Check if event is in the past
    if (new Date(event.startDateTime) < new Date()) {
      return NextResponse.json({
        error: 'Event passed',
        code: 'EVENT_PAST',
        message: 'This appointment has already taken place and cannot be rescheduled.'
      }, { status: 410 });
    }

    // Get intake config
    const configDoc = await adminDb.collection('intake_call_configs').doc(token.intakeCallConfigId).get();

    if (!configDoc.exists) {
      return NextResponse.json({
        error: 'Configuration not found',
        code: 'CONFIG_NOT_FOUND',
        message: 'The booking configuration could not be found.'
      }, { status: 404 });
    }

    const config = { id: configDoc.id, ...configDoc.data() } as IntakeCallConfig;

    // Check if rescheduling is allowed
    if (config.allowReschedule === false) {
      return NextResponse.json({
        error: 'Rescheduling not allowed',
        code: 'RESCHEDULE_DISABLED',
        message: 'Self-service rescheduling is not available for this booking. Please contact your coach directly.'
      }, { status: 403 });
    }

    // Check deadline (same as cancellation deadline)
    const cancelDeadlineHours = config.cancelDeadlineHours ?? 24;
    const eventStart = new Date(event.startDateTime);
    const deadlineTime = new Date(eventStart.getTime() - cancelDeadlineHours * 60 * 60 * 1000);

    if (new Date() >= deadlineTime) {
      return NextResponse.json({
        error: 'Past deadline',
        code: 'PAST_DEADLINE',
        message: `Changes must be made at least ${cancelDeadlineHours} hours before the appointment. Please contact your coach directly.`
      }, { status: 403 });
    }

    // Validate new slot times
    const newSlotStart = new Date(startDateTime);
    const newSlotEnd = new Date(endDateTime);

    if (newSlotStart < new Date()) {
      return NextResponse.json({
        error: 'Invalid time',
        code: 'SLOT_PAST',
        message: 'Cannot reschedule to a time in the past.'
      }, { status: 400 });
    }

    if (newSlotEnd <= newSlotStart) {
      return NextResponse.json({
        error: 'Invalid time',
        code: 'SLOT_INVALID',
        message: 'End time must be after start time.'
      }, { status: 400 });
    }

    // Get availability settings
    let availability: CoachAvailability | null = null;
    if (event.organizationId) {
      const availabilityDoc = await adminDb
        .collection('coach_availability')
        .doc(event.organizationId)
        .get();
      availability = availabilityDoc.exists
        ? (availabilityDoc.data() as CoachAvailability)
        : null;
    }

    const buffer = availability?.bufferBetweenCalls || 15;
    const coachTimezone = availability?.timezone || event.timezone || 'America/New_York';

    // Check for conflicting events (excluding current event)
    const conflictingSnapshot = await adminDb
      .collection('events')
      .where('organizationId', '==', event.organizationId)
      .where('startDateTime', '>=', new Date(newSlotStart.getTime() - 60 * 60 * 1000).toISOString())
      .where('startDateTime', '<=', new Date(newSlotEnd.getTime() + 60 * 60 * 1000).toISOString())
      .where('status', 'in', ['confirmed', 'pending_response', 'proposed'])
      .get();

    const hasConflict = conflictingSnapshot.docs.some(doc => {
      // Skip the current event
      if (doc.id === event.id) return false;

      const otherEvent = doc.data() as UnifiedEvent;
      const otherStart = new Date(otherEvent.startDateTime);
      const otherEnd = otherEvent.endDateTime
        ? new Date(otherEvent.endDateTime)
        : new Date(otherStart.getTime() + (otherEvent.durationMinutes || 60) * 60 * 1000);

      const bufferedStart = new Date(otherStart.getTime() - buffer * 60 * 1000);
      const bufferedEnd = new Date(otherEnd.getTime() + buffer * 60 * 1000);

      return (
        (newSlotStart >= bufferedStart && newSlotStart < bufferedEnd) ||
        (newSlotEnd > bufferedStart && newSlotEnd <= bufferedEnd)
      );
    });

    if (hasConflict) {
      return NextResponse.json({
        error: 'Slot unavailable',
        code: 'SLOT_UNAVAILABLE',
        message: 'This time slot is no longer available. Please select another time.'
      }, { status: 409 });
    }

    // Create new meeting link if needed
    let meetingUrl = event.meetingLink;
    let externalMeetingId = event.externalMeetingId;

    // For Zoom and Google Meet, we should create new meetings
    // (In a production app, you'd also want to delete/cancel the old meeting)
    if (config.meetingProvider === 'zoom') {
      try {
        const result = await createZoomMeeting(event.organizationId || '', {
          topic: `${config.name} with ${event.prospectName || 'Guest'}`,
          startTime: startDateTime,
          duration: config.duration,
          timezone: coachTimezone,
          agenda: config.description || `Intake call with ${event.prospectName || 'Guest'}`,
        });
        meetingUrl = result.meetingUrl;
        externalMeetingId = result.meetingId;
      } catch (err) {
        console.warn('[INTAKE_RESCHEDULE] Failed to create new Zoom meeting:', err);
        // Keep old meeting link as fallback
      }
    } else if (config.meetingProvider === 'google_meet') {
      try {
        const result = await createGoogleMeetMeeting(event.organizationId || '', {
          summary: `${config.name} with ${event.prospectName || 'Guest'}`,
          startTime: startDateTime,
          endTime: endDateTime,
          timezone: coachTimezone,
          description: config.description || `Intake call with ${event.prospectName || 'Guest'}`,
        });
        meetingUrl = result.meetingUrl;
        externalMeetingId = result.eventId;
      } catch (err) {
        console.warn('[INTAKE_RESCHEDULE] Failed to create new Google Meet:', err);
        // Keep old meeting link as fallback
      }
    }

    const now = new Date().toISOString();

    // Update the event with new times
    await adminDb.collection('events').doc(event.id).update({
      startDateTime,
      endDateTime,
      meetingLink: meetingUrl,
      externalMeetingId,
      rescheduledAt: now,
      rescheduledFromTime: oldStartDateTime,
      updatedAt: now,
    });

    // Update token expiry to 24h after new call time
    const newTokenExpiry = new Date(newSlotStart.getTime() + 24 * 60 * 60 * 1000).toISOString();
    await adminDb.collection('intake_booking_tokens').doc(tokenId).update({
      expiresAt: newTokenExpiry,
    });

    // Update any scheduled reminder jobs
    const jobsSnapshot = await adminDb
      .collection('eventScheduledJobs')
      .where('eventId', '==', event.id)
      .get();

    // Delete old jobs (new ones will be created by the reminder system)
    const deletePromises = jobsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    // Get coach info for email
    let coachEmail: string | null = null;
    let coachName = event.hostName || 'Coach';

    if (event.hostUserId && event.hostUserId !== 'system' && event.hostUserId !== 'public_booking') {
      const coachDoc = await adminDb.collection('users').doc(event.hostUserId).get();
      if (coachDoc.exists) {
        const coachData = coachDoc.data();
        coachEmail = coachData?.email || coachData?.primaryEmail || null;
        coachName = coachData?.displayName || coachData?.firstName || coachName;
      }
    }

    // Fallback: get coach email from organization's admin/super_coach
    if (!coachEmail && event.organizationId) {
      const coachesSnapshot = await adminDb
        .collection('users')
        .where('clerkOrganizationId', '==', event.organizationId)
        .where('role', 'in', ['super_coach', 'admin'])
        .limit(1)
        .get();

      if (!coachesSnapshot.empty) {
        const coachData = coachesSnapshot.docs[0].data();
        coachEmail = coachData?.email || coachData?.primaryEmail || null;
        if (!coachName || coachName === 'Coach') {
          coachName = coachData?.displayName || coachData?.firstName || coachName;
        }
      }
    }

    // Fetch branding and settings for branded email
    const [brandingDoc, settingsDoc, subscriptionSnapshot] = await Promise.all([
      adminDb.collection('org_branding').doc(event.organizationId || '').get(),
      adminDb.collection('org_settings').doc(event.organizationId || '').get(),
      adminDb
        .collection('coach_subscriptions')
        .where('organizationId', '==', event.organizationId || '')
        .where('status', 'in', ['active', 'trialing'])
        .limit(1)
        .get(),
    ]);

    const branding = brandingDoc.exists ? (brandingDoc.data() as OrgBranding) : null;
    const settings = settingsDoc.exists ? (settingsDoc.data() as OrgSettings) : null;
    const plan = subscriptionSnapshot.empty
      ? 'starter'
      : (subscriptionSnapshot.docs[0].data().tier as 'starter' | 'pro' | 'scale') || 'starter';

    const orgBranding = {
      name: branding?.appTitle || coachName,
      logoUrl: branding?.logoUrl || undefined,
      horizontalLogoUrl: branding?.horizontalLogoUrl || undefined,
      accentColor: branding?.colors?.accentLight,
      hidePoweredBy: settings?.hidePoweredByCoachful || false,
      plan,
    };

    // Send reschedule notifications
    const updatedEvent = {
      ...event,
      startDateTime,
      endDateTime,
      meetingLink: meetingUrl,
    } as UnifiedEvent;

    // Generate ICS calendar invite for the new time
    const icsContent = generateICS({
      eventId: event.id,
      title: `${config.name} with ${coachName}`,
      description: config.description || `Intake call with ${coachName}`,
      startDateTime,
      endDateTime,
      meetingLink: meetingUrl,
      hostName: coachName,
      hostEmail: coachEmail || undefined,
      attendeeName: event.prospectName || 'Guest',
      attendeeEmail: event.prospectEmail || token.prospectEmail,
      organizerName: orgBranding.name || coachName,
      organizerEmail: coachEmail || undefined,
    });

    sendIntakeRescheduleNotifications({
      event: updatedEvent,
      config,
      prospectName: event.prospectName || 'Guest',
      prospectEmail: event.prospectEmail || token.prospectEmail,
      prospectTimezone: userTimezone,
      coachName,
      coachEmail: coachEmail || undefined,
      organizationId: event.organizationId || '',
      oldStartDateTime,
      newStartDateTime: startDateTime,
      newEndDateTime: endDateTime,
      bookingTokenId: tokenId,
      orgBranding,
      icsContent,
    }).catch((err: unknown) => {
      console.error('[INTAKE_RESCHEDULE] Failed to send notifications:', err);
    });

    // Create in-app notification for coach
    createIntakeNotificationForCoach({
      coachUserId: event.hostUserId || '',
      type: 'intake_call_rescheduled',
      prospectName: event.prospectName || 'Guest',
      configName: config.name,
      startDateTime, // Use the new start time
      organizationId: event.organizationId || '',
      eventId: event.id,
    }).catch((err: unknown) => {
      console.error('[INTAKE_RESCHEDULE] Failed to create in-app notification:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Your appointment has been rescheduled.',
      event: {
        id: event.id,
        title: event.title,
        startDateTime,
        endDateTime,
        meetingUrl,
        timezone: event.timezone,
      },
    });
  } catch (error) {
    console.error('[PUBLIC_INTAKE_RESCHEDULE_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
