import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { autoFillWeekFromSummary } from '@/lib/ai/call-summary';
import type { UnifiedEvent, ProgramEnrollment } from '@/types';

/**
 * POST /api/events/[eventId]/fill-week-from-summary
 *
 * Trigger auto-fill of program week(s) from an event's call summary.
 * Requires the event to have a summaryId and program context.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const body = await request.json();
    const { fillTarget = 'until_call' } = body as { fillTarget?: 'current' | 'next' | 'until_call' };

    // Get the event
    const eventDoc = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('events')
      .doc(eventId)
      .get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    // Validate event has summary
    if (!event.callSummaryId) {
      return NextResponse.json({ error: 'Event has no summary' }, { status: 400 });
    }

    // Validate event has program context
    if (!event.programId) {
      return NextResponse.json({ error: 'Event is not linked to a program' }, { status: 400 });
    }

    if (!event.instanceId) {
      return NextResponse.json({ error: 'Event has no program instance' }, { status: 400 });
    }

    // Get enrollment if this is an individual program
    let enrollment: ProgramEnrollment | undefined;
    if (event.enrollmentId) {
      const enrollmentDoc = await adminDb
        .collection('program_enrollments')
        .doc(event.enrollmentId)
        .get();
      if (enrollmentDoc.exists) {
        enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;
      }
    }

    // Calculate week index from event date and enrollment start
    let weekIndex = 0;
    if (enrollment?.startedAt) {
      const startDate = new Date(enrollment.startedAt);
      const eventDate = new Date(event.startTime!);
      const daysSinceStart = Math.floor((eventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      weekIndex = Math.floor(daysSinceStart / 7);
    }

    // Call auto-fill
    const result = await autoFillWeekFromSummary(orgId, event.callSummaryId, {
      programId: event.programId,
      instanceId: event.instanceId,
      weekIndex,
      autoFillTarget: fillTarget,
      cohortId: event.cohortId,
      enrollment,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to fill week' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      daysUpdated: result.daysUpdated,
      weeksUpdated: result.weeksUpdated,
    });
  } catch (error) {
    console.error('[fill-week-from-summary] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
