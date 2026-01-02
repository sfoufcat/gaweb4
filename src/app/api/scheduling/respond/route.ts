import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { notifyCallAccepted, notifyCallDeclined, notifyCallCounterProposed } from '@/lib/scheduling-notifications';
import type { UnifiedEvent, ProposedTime, SchedulingStatus, EventScheduledJob, EventJobType } from '@/types';

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

