import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { UnifiedEvent } from '@/types';

/**
 * GET /api/events/[eventId]/has-next-call
 *
 * Check if there's a future scheduled call for the same program.
 * Used to conditionally show "Until next call" option in fill week UI.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;

    // Get the event to extract programId and cohortId
    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    if (!event.programId) {
      return NextResponse.json({ hasNextCall: false });
    }

    // Query for next call in the same program
    const now = new Date();
    let query = adminDb
      .collection('events')
      .where('programId', '==', event.programId)
      .where('startDateTime', '>', now.toISOString())
      .where('status', '==', 'confirmed')
      .orderBy('startDateTime', 'asc')
      .limit(1) as FirebaseFirestore.Query;

    // If this is a cohort event, filter by cohortId too
    if (event.cohortId) {
      query = adminDb
        .collection('events')
        .where('programId', '==', event.programId)
        .where('cohortId', '==', event.cohortId)
        .where('startDateTime', '>', now.toISOString())
        .where('status', '==', 'confirmed')
        .orderBy('startDateTime', 'asc')
        .limit(1);
    }

    const snapshot = await query.get();
    const hasNextCall = !snapshot.empty;
    const nextCallDate = hasNextCall
      ? snapshot.docs[0].data().startDateTime
      : undefined;

    return NextResponse.json({ hasNextCall, nextCallDate });
  } catch (error) {
    console.error('[has-next-call] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
