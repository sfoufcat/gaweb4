import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { UnifiedEvent } from '@/types';

/**
 * POST /api/scheduling/cancel
 * Cancel a scheduled call
 * 
 * Body:
 * - eventId: string - The event ID to cancel
 * - reason?: string - Optional cancellation reason
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, reason } = body;

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
    if (!event.attendeeIds.includes(userId) && event.hostUserId !== userId) {
      return NextResponse.json(
        { error: 'You are not authorized to cancel this event' },
        { status: 403 }
      );
    }

    // Verify event is in a cancellable state
    const cancellableStatuses = ['proposed', 'pending_response', 'counter_proposed', 'confirmed'];
    if (event.schedulingStatus && !cancellableStatuses.includes(event.schedulingStatus)) {
      return NextResponse.json(
        { error: `Cannot cancel event with status: ${event.schedulingStatus}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update event status
    await eventRef.update({
      schedulingStatus: 'cancelled',
      status: 'completed', // Mark as no longer active
      schedulingNotes: reason 
        ? `${event.schedulingNotes || ''}\n\nCancelled: ${reason}`.trim() 
        : event.schedulingNotes,
      updatedAt: now,
    });

    // Delete any pending reminder jobs
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

    // TODO: Send cancellation notification to other participant
    // This will be implemented in the notifications phase

    return NextResponse.json({
      success: true,
      message: 'Event cancelled successfully',
    });
  } catch (error) {
    console.error('[SCHEDULING_CANCEL] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

