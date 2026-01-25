import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { notifyCallCancelled } from '@/lib/scheduling-notifications';
import { cancelFutureInstances } from '@/lib/event-recurrence';
import type { UnifiedEvent } from '@/types';

/**
 * POST /api/scheduling/cancel
 * Cancel a scheduled call
 *
 * Body:
 * - eventId: string - The event ID to cancel
 * - reason?: string - Optional cancellation reason
 * - scope?: 'single' | 'future' - For recurring events: cancel just this or all future
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, reason, scope = 'single' } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
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

    // Verify user is a participant or the host
    const attendeeIds = event.attendeeIds || [];
    if (!attendeeIds.includes(userId) && event.hostUserId !== userId) {
      return NextResponse.json(
        { error: 'You are not authorized to cancel this event' },
        { status: 403 }
      );
    }

    // Verify event is in a cancellable state (skip check if no schedulingStatus - e.g., community events)
    const cancellableStatuses = ['proposed', 'pending_response', 'counter_proposed', 'confirmed'];
    const nonCancellableStatuses = ['cancelled', 'completed'];
    if (event.schedulingStatus && nonCancellableStatuses.includes(event.schedulingStatus)) {
      return NextResponse.json(
        { error: `Cannot cancel event with status: ${event.schedulingStatus}` },
        { status: 400 }
      );
    }
    // Also check the status field for already canceled events
    if (event.status === 'canceled') {
      return NextResponse.json(
        { error: 'Event is already cancelled' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let cancelledCount = 1;

    // Handle "cancel all future" for recurring events
    if (scope === 'future') {
      // If this is a recurring parent event
      if (event.isRecurring) {
        const result = await cancelFutureInstances(eventId);
        cancelledCount = result.count;
        console.log(`[SCHEDULING_CANCEL] Cancelled ${cancelledCount} future instances of recurring event ${eventId}`);

        // Also mark the parent event as cancelled
        await eventRef.update({
          schedulingStatus: 'cancelled',
          status: 'canceled',
          updatedAt: now,
        });

        return NextResponse.json({
          success: true,
          message: `Cancelled ${cancelledCount} future event${cancelledCount > 1 ? 's' : ''} successfully`,
          cancelledCount,
          cancelledIds: result.cancelledIds,
        });
      }
      // If this is an instance of a recurring event
      else if (event.parentEventId) {
        // Cancel this instance and all future instances from this date forward
        const parentEventId = event.parentEventId;
        const fromDate = event.startDateTime;

        // Get all future instances (including this one)
        const futureInstancesSnapshot = await adminDb
          .collection('events')
          .where('parentEventId', '==', parentEventId)
          .where('startDateTime', '>=', fromDate)
          .get();

        const batch = adminDb.batch();
        futureInstancesSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            schedulingStatus: 'cancelled',
            status: 'canceled',
            schedulingNotes: reason
              ? `${doc.data().schedulingNotes || ''}\n\nCancelled: ${reason}`.trim()
              : doc.data().schedulingNotes,
            updatedAt: now,
          });
        });
        await batch.commit();
        cancelledCount = futureInstancesSnapshot.size;

        // Delete reminder jobs for all cancelled instances
        const instanceIds = futureInstancesSnapshot.docs.map(d => d.id);
        for (const instanceId of instanceIds) {
          const jobsSnapshot = await adminDb
            .collection('eventScheduledJobs')
            .where('eventId', '==', instanceId)
            .where('executed', '==', false)
            .get();
          const jobBatch = adminDb.batch();
          jobsSnapshot.docs.forEach(doc => jobBatch.delete(doc.ref));
          await jobBatch.commit();
        }

        console.log(`[SCHEDULING_CANCEL] Cancelled ${cancelledCount} instances from ${fromDate} forward`);

        // Send notification for the series cancellation
        try {
          await notifyCallCancelled(event, userId, reason);
        } catch (notifyErr) {
          console.error('[SCHEDULING_CANCEL] Failed to send notification:', notifyErr);
        }

        return NextResponse.json({
          success: true,
          message: `Cancelled ${cancelledCount} event${cancelledCount > 1 ? 's' : ''} successfully`,
          cancelledCount,
          cancelledIds: instanceIds,
        });
      }
    }

    // Update single event status
    await eventRef.update({
      schedulingStatus: 'cancelled',
      status: 'canceled',
      schedulingNotes: reason
        ? `${event.schedulingNotes || ''}\n\nCancelled: ${reason}`.trim()
        : event.schedulingNotes,
      updatedAt: now,
    });

    // Delete any pending reminder jobs for this event
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

    // Send cancellation notification to other participants
    try {
      await notifyCallCancelled(event, userId, reason);
    } catch (notifyErr) {
      console.error('[SCHEDULING_CANCEL] Failed to send notification:', notifyErr);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: scope === 'future' && cancelledCount > 1
        ? `Cancelled ${cancelledCount} events successfully`
        : 'Event cancelled successfully',
      cancelledCount,
      cancelledIds: [eventId],
    });
  } catch (error) {
    console.error('[SCHEDULING_CANCEL] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

