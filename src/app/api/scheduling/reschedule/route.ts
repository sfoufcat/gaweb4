import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { notifyCallRescheduled } from '@/lib/scheduling-notifications';
import type { UnifiedEvent, ProposedTime } from '@/types';

/**
 * POST /api/scheduling/reschedule
 * Reschedule a confirmed call
 *
 * Body:
 * - eventId: string - The event ID to reschedule
 * - proposedTimes: Array<{ startDateTime: string, endDateTime: string }> - New proposed times
 * - reason?: string - Optional reason for rescheduling
 * - confirmDirectly?: boolean - If true, update event directly without proposal
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, proposedTimes, reason, confirmDirectly = false } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    if (!proposedTimes || !Array.isArray(proposedTimes) || proposedTimes.length === 0) {
      return NextResponse.json(
        { error: 'At least one proposed time is required' },
        { status: 400 }
      );
    }

    // Validate proposed times format
    for (const time of proposedTimes) {
      if (!time.startDateTime || !time.endDateTime) {
        return NextResponse.json(
          { error: 'Each proposed time must have startDateTime and endDateTime' },
          { status: 400 }
        );
      }
      const start = new Date(time.startDateTime);
      const end = new Date(time.endDateTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format for proposed times' },
          { status: 400 }
        );
      }
      if (start >= end) {
        return NextResponse.json(
          { error: 'Start time must be before end time' },
          { status: 400 }
        );
      }
    }

    // Get the original event
    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const originalEvent = eventDoc.data() as UnifiedEvent;

    // Verify user is a participant
    if (!originalEvent.attendeeIds.includes(userId) && originalEvent.hostUserId !== userId) {
      return NextResponse.json(
        { error: 'You are not authorized to reschedule this event' },
        { status: 403 }
      );
    }

    // Verify event is confirmed (can only reschedule confirmed events)
    if (originalEvent.schedulingStatus !== 'confirmed') {
      return NextResponse.json(
        { error: `Can only reschedule confirmed events. Current status: ${originalEvent.schedulingStatus}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newTime = proposedTimes[0];
    const newStartDateTime = new Date(newTime.startDateTime).toISOString();
    const newEndDateTime = new Date(newTime.endDateTime).toISOString();

    // Delete any pending reminder jobs for the original event
    const jobsSnapshot = await adminDb
      .collection('eventScheduledJobs')
      .where('eventId', '==', eventId)
      .where('executed', '==', false)
      .get();

    const batch = adminDb.batch();
    jobsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIRM DIRECTLY: Update existing event in place
    // ═══════════════════════════════════════════════════════════════════════════
    if (confirmDirectly) {
      // Update the event directly with new time
      await eventRef.update({
        startDateTime: newStartDateTime,
        endDateTime: newEndDateTime,
        updatedAt: now,
        schedulingNotes: reason || originalEvent.schedulingNotes,
      });

      const updatedEvent: UnifiedEvent = {
        ...originalEvent,
        startDateTime: newStartDateTime,
        endDateTime: newEndDateTime,
        updatedAt: now,
        schedulingNotes: reason || originalEvent.schedulingNotes,
      };

      // Send notification to other participants
      try {
        await notifyCallRescheduled(updatedEvent, userId, reason);
      } catch (notifyErr) {
        console.error('[SCHEDULING_RESCHEDULE] Failed to send notification:', notifyErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Call rescheduled successfully',
        originalEventId: eventId,
        newEvent: updatedEvent,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROPOSE MODE: Create new event with proposed times (original 1:1 flow)
    // ═══════════════════════════════════════════════════════════════════════════

    // Mark original event as rescheduled
    await eventRef.update({
      schedulingStatus: 'rescheduled',
      status: 'completed',
      updatedAt: now,
    });

    // Create proposed time objects
    const formattedProposedTimes: ProposedTime[] = proposedTimes.map(
      (time: { startDateTime: string; endDateTime: string }, index: number) => ({
        id: `proposed_${Date.now()}_${index}`,
        startDateTime: new Date(time.startDateTime).toISOString(),
        endDateTime: new Date(time.endDateTime).toISOString(),
        proposedBy: userId,
        proposedAt: now,
        status: 'pending' as const,
      })
    );

    // Use the first proposed time as the initial event time
    const firstProposed = formattedProposedTimes[0];

    // Create new event with proposed times
    const newEventRef = adminDb.collection('events').doc();
    const newEventData: UnifiedEvent = {
      ...originalEvent,
      id: newEventRef.id,
      startDateTime: firstProposed.startDateTime,
      endDateTime: firstProposed.endDateTime,
      status: 'pending_approval',
      schedulingStatus: 'proposed',
      proposedBy: userId,
      proposedTimes: formattedProposedTimes,
      schedulingNotes: reason || originalEvent.schedulingNotes,
      rescheduledFromId: eventId,
      createdAt: now,
      updatedAt: now,
    };

    await newEventRef.set(newEventData);

    // Send notification to other participants
    try {
      await notifyCallRescheduled(newEventData, userId, reason);
    } catch (notifyErr) {
      console.error('[SCHEDULING_RESCHEDULE] Failed to send notification:', notifyErr);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Reschedule proposal sent',
      originalEventId: eventId,
      newEvent: newEventData,
    });
  } catch (error) {
    console.error('[SCHEDULING_RESCHEDULE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
