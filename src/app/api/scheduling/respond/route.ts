import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { notifyCallAccepted, notifyCallDeclined, notifyCallCounterProposed } from '@/lib/scheduling-notifications';
import { createEvent, isNylasConfigured } from '@/lib/nylas';
import type { UnifiedEvent, ProposedTime, SchedulingStatus, EventScheduledJob, EventJobType, CoachAvailability, NylasGrant, ClientCoachingData } from '@/types';

/**
 * POST /api/scheduling/respond
 * Respond to a call proposal (accept, decline, or counter-propose)
 * 
 * Body:
 * - eventId: string - The event ID to respond to
 * - action: 'accept' | 'decline' | 'counter' - The response action
 * - selectedTimeId?: string - ID of the accepted proposed time (for accept)
 * - counterTimes?: Array<{ startDateTime: string, endDateTime: string }> - Counter-proposal times
 * - message?: string - Optional message with response
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, action, selectedTimeId, counterTimes, message } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    if (!action || !['accept', 'decline', 'counter'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be one of: accept, decline, counter' },
        { status: 400 }
      );
    }

    // Get the event
    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const event = eventDoc.data() as UnifiedEvent;

    // Verify user is a participant
    if (!event.attendeeIds.includes(userId)) {
      return NextResponse.json(
        { error: 'You are not a participant of this event' },
        { status: 403 }
      );
    }

    // Verify user is not the proposer (can't respond to your own proposal)
    if (event.proposedBy === userId) {
      return NextResponse.json(
        { error: 'You cannot respond to your own proposal' },
        { status: 400 }
      );
    }

    // Verify event is in a state that can be responded to
    if (event.schedulingStatus !== 'proposed' && event.schedulingStatus !== 'counter_proposed') {
      return NextResponse.json(
        { error: `Cannot respond to event with status: ${event.schedulingStatus}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let updateData: Partial<UnifiedEvent> = {
      updatedAt: now,
    };

    if (action === 'accept') {
      // Find the accepted time slot
      if (!selectedTimeId && event.proposedTimes && event.proposedTimes.length > 1) {
        return NextResponse.json(
          { error: 'Selected time ID is required when multiple times are proposed' },
          { status: 400 }
        );
      }

      const selectedTime = selectedTimeId 
        ? event.proposedTimes?.find(t => t.id === selectedTimeId)
        : event.proposedTimes?.[0];

      if (!selectedTime) {
        return NextResponse.json(
          { error: 'Selected time not found' },
          { status: 400 }
        );
      }

      // Update event with confirmed time
      updateData = {
        ...updateData,
        schedulingStatus: 'confirmed',
        status: 'confirmed',
        startDateTime: selectedTime.startDateTime,
        endDateTime: selectedTime.endDateTime,
        confirmedAt: now,
        proposedTimes: event.proposedTimes?.map(t => ({
          ...t,
          status: t.id === selectedTime.id ? 'accepted' : 'declined',
        })),
      };

      // Create reminder jobs for the confirmed event
      await createReminderJobs(eventRef.id, {
        ...event,
        ...updateData,
      } as UnifiedEvent);

      // Sync to external calendar if enabled
      if (event.organizationId) {
        try {
          await syncEventToNylas(eventRef.id, {
            ...event,
            ...updateData,
          } as UnifiedEvent);
        } catch (syncErr) {
          console.error('[SCHEDULING_RESPOND] Failed to sync to Nylas:', syncErr);
          // Don't fail the request if sync fails
        }
      }

      // Sync confirmed 1-on-1 coaching calls to clientCoachingData.nextCall
      // This ensures the /my-coach page shows the upcoming call
      if (event.eventType === 'coaching_1on1' && event.organizationId) {
        try {
          await syncToClientCoachingData({
            ...event,
            ...updateData,
            startDateTime: selectedTime.startDateTime,
            endDateTime: selectedTime.endDateTime,
          } as UnifiedEvent);
        } catch (syncErr) {
          console.error('[SCHEDULING_RESPOND] Failed to sync to clientCoachingData:', syncErr);
          // Don't fail the request if sync fails
        }
      }

    } else if (action === 'decline') {
      updateData = {
        ...updateData,
        schedulingStatus: 'declined',
        status: 'draft', // Not active
        proposedTimes: event.proposedTimes?.map(t => ({
          ...t,
          status: 'declined' as const,
        })),
        schedulingNotes: message ? `${event.schedulingNotes || ''}\n\nDeclined: ${message}`.trim() : event.schedulingNotes,
      };

    } else if (action === 'counter') {
      // Validate counter times
      if (!counterTimes || !Array.isArray(counterTimes) || counterTimes.length === 0) {
        return NextResponse.json(
          { error: 'Counter-proposal times are required' },
          { status: 400 }
        );
      }

      // Create new proposed times
      const formattedCounterTimes: ProposedTime[] = counterTimes.map((time: { startDateTime: string; endDateTime: string }, index: number) => ({
        id: `counter_${Date.now()}_${index}`,
        startDateTime: new Date(time.startDateTime).toISOString(),
        endDateTime: new Date(time.endDateTime).toISOString(),
        proposedBy: userId,
        proposedAt: now,
        status: 'pending' as const,
      }));

      // Mark old times as declined, add new counter times
      updateData = {
        ...updateData,
        schedulingStatus: 'counter_proposed',
        proposedBy: userId, // Now the counter-proposer
        proposedTimes: [
          ...(event.proposedTimes?.map(t => ({ ...t, status: 'declined' as const })) || []),
          ...formattedCounterTimes,
        ],
        // Update event time to first counter-proposal
        startDateTime: formattedCounterTimes[0].startDateTime,
        endDateTime: formattedCounterTimes[0].endDateTime,
        schedulingNotes: message ? `${event.schedulingNotes || ''}\n\nCounter-proposal: ${message}`.trim() : event.schedulingNotes,
      };
    }

    await eventRef.update(updateData);

    // Get updated event
    const updatedDoc = await eventRef.get();
    const updatedEvent = updatedDoc.data() as UnifiedEvent;

    // Send notification about response
    try {
      if (action === 'accept') {
        await notifyCallAccepted(updatedEvent, userId);
      } else if (action === 'decline') {
        await notifyCallDeclined(updatedEvent, userId);
      } else if (action === 'counter') {
        await notifyCallCounterProposed(updatedEvent, userId);
      }
    } catch (notifyErr) {
      console.error('[SCHEDULING_RESPOND] Failed to send notification:', notifyErr);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      event: updatedEvent,
      success: true,
      action,
      message: action === 'accept' 
        ? 'Call confirmed!' 
        : action === 'decline' 
        ? 'Call declined' 
        : 'Counter-proposal sent',
    });
  } catch (error) {
    console.error('[SCHEDULING_RESPOND] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Create reminder jobs for a confirmed event
 */
async function createReminderJobs(eventId: string, event: UnifiedEvent) {
  const startTime = new Date(event.startDateTime);
  const now = new Date();

  const jobTypes: Array<{ type: EventJobType; hoursBeforeOrLabel: number | string }> = [
    { type: 'notification_24h', hoursBeforeOrLabel: 24 },
    { type: 'notification_1h', hoursBeforeOrLabel: 1 },
    { type: 'email_24h', hoursBeforeOrLabel: 24 },
  ];

  const batch = adminDb.batch();

  for (const { type, hoursBeforeOrLabel } of jobTypes) {
    const hoursBefore = typeof hoursBeforeOrLabel === 'number' ? hoursBeforeOrLabel : 0;
    const scheduledTime = new Date(startTime.getTime() - hoursBefore * 60 * 60 * 1000);
    
    // Only create job if it's in the future
    if (scheduledTime > now) {
      const jobId = `${eventId}_${type}`;
      const jobRef = adminDb.collection('eventScheduledJobs').doc(jobId);
      
      const jobData: EventScheduledJob = {
        id: jobId,
        eventId,
        jobType: type,
        scheduledTime: scheduledTime.toISOString(),
        eventTitle: event.title,
        eventDateTime: event.startDateTime,
        eventTimezone: event.timezone,
        eventLocation: event.locationLabel,
        eventType: event.eventType,
        scope: event.scope,
        organizationId: event.organizationId,
        hostUserId: event.hostUserId,
        hostName: event.hostName,
        clientUserId: event.attendeeIds.find(id => id !== event.hostUserId),
        executed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      batch.set(jobRef, jobData);
    }
  }

  await batch.commit();
}

/**
 * Sync a confirmed event to the coach's external calendar via Nylas
 */
async function syncEventToNylas(eventId: string, event: UnifiedEvent) {
  // Check if Nylas is configured
  if (!isNylasConfigured) {
    console.log('[SCHEDULING_RESPOND] Nylas not configured, skipping sync');
    return;
  }

  if (!event.organizationId) {
    console.log('[SCHEDULING_RESPOND] No organization ID, skipping Nylas sync');
    return;
  }

  // Get coach availability settings
  const availabilityDoc = await adminDb
    .collection('coach_availability')
    .doc(event.organizationId)
    .get();

  if (!availabilityDoc.exists) {
    console.log('[SCHEDULING_RESPOND] No availability settings, skipping Nylas sync');
    return;
  }

  const availability = availabilityDoc.data() as CoachAvailability;

  // Check if calendar sync is enabled
  if (!availability.pushEventsToCalendar || !availability.nylasGrantId) {
    console.log('[SCHEDULING_RESPOND] Calendar sync not enabled, skipping');
    return;
  }

  // Get the Nylas grant for the coach
  // Grant is stored per org+user, we need to find it by grant ID
  const grantsQuery = await adminDb
    .collection('nylas_grants')
    .where('grantId', '==', availability.nylasGrantId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (grantsQuery.empty) {
    console.log('[SCHEDULING_RESPOND] No active Nylas grant found');
    return;
  }

  const grant = grantsQuery.docs[0].data() as NylasGrant;

  if (!grant.calendarId) {
    console.log('[SCHEDULING_RESPOND] No calendar ID in grant');
    return;
  }

  // Convert event times to Unix timestamps
  const startTime = Math.floor(new Date(event.startDateTime).getTime() / 1000);
  const endTime = event.endDateTime
    ? Math.floor(new Date(event.endDateTime).getTime() / 1000)
    : startTime + (event.durationMinutes || 60) * 60;

  // Get participant emails
  const participantEmails: Array<{ email: string; name?: string }> = [];
  for (const attendeeId of event.attendeeIds) {
    if (attendeeId !== event.hostUserId) {
      const userDoc = await adminDb.collection('users').doc(attendeeId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const email = userData?.email || userData?.primaryEmail;
        const name = userData?.firstName && userData?.lastName
          ? `${userData.firstName} ${userData.lastName}`
          : userData?.name;
        if (email) {
          participantEmails.push({ email, name });
        }
      }
    }
  }

  // Create the event in Nylas
  const result = await createEvent(
    grant.grantId,
    grant.calendarId,
    {
      title: event.title,
      description: event.description,
      location: event.meetingLink || event.locationLabel,
      startTime,
      endTime,
      participants: participantEmails,
    }
  );

  // Update the event with Nylas sync info
  await adminDb.collection('events').doc(eventId).update({
    nylasEventId: result.id,
    syncedToNylas: true,
    nylasCalendarId: grant.calendarId,
    // If Nylas auto-created a conference link, use it
    ...(result.conferenceUrl && !event.meetingLink ? { meetingLink: result.conferenceUrl } : {}),
    updatedAt: new Date().toISOString(),
  });

  console.log(`[SCHEDULING_RESPOND] Synced event ${eventId} to Nylas: ${result.id}`);
}

/**
 * Sync a confirmed coaching call to clientCoachingData.nextCall
 * This keeps the legacy /my-coach page in sync with the new scheduling system
 */
async function syncToClientCoachingData(event: UnifiedEvent) {
  if (!event.organizationId || event.eventType !== 'coaching_1on1') {
    return;
  }

  // Find the client (attendee who is not the host)
  const clientUserId = event.attendeeIds.find(id => id !== event.hostUserId);
  if (!clientUserId) {
    console.log('[SCHEDULING_RESPOND] No client found in attendees, skipping clientCoachingData sync');
    return;
  }

  // Document ID format for clientCoachingData: ${organizationId}_${userId}
  const coachingDocId = `${event.organizationId}_${clientUserId}`;
  const coachingRef = adminDb.collection('clientCoachingData').doc(coachingDocId);
  const coachingDoc = await coachingRef.get();

  // Only update if the document exists (coach has set up coaching for this client)
  if (!coachingDoc.exists) {
    // Try legacy format without org prefix
    const legacyRef = adminDb.collection('clientCoachingData').doc(clientUserId);
    const legacyDoc = await legacyRef.get();

    if (!legacyDoc.exists) {
      console.log(`[SCHEDULING_RESPOND] No clientCoachingData found for ${clientUserId}, skipping sync`);
      return;
    }

    // Update legacy document
    await legacyRef.update({
      nextCall: {
        datetime: event.startDateTime,
        timezone: event.timezone || 'America/New_York',
        location: event.meetingLink || event.locationLabel || 'Video Call',
        title: event.title,
      },
      updatedAt: new Date().toISOString(),
    });

    console.log(`[SCHEDULING_RESPOND] Synced to legacy clientCoachingData for ${clientUserId}`);
    return;
  }

  // Update the coaching data with the next call info
  await coachingRef.update({
    nextCall: {
      datetime: event.startDateTime,
      timezone: event.timezone || 'America/New_York',
      location: event.meetingLink || event.locationLabel || 'Video Call',
      title: event.title,
    },
    updatedAt: new Date().toISOString(),
  });

  console.log(`[SCHEDULING_RESPOND] Synced to clientCoachingData for ${coachingDocId}`);
}

