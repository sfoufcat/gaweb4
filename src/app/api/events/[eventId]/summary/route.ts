import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { CallSummary, UnifiedEvent } from '@/types';

/**
 * GET /api/events/[eventId]/summary
 *
 * Get the call summary associated with an event.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;

    // Try org-scoped events first, then global events
    let event: UnifiedEvent | null = null;

    if (orgId) {
      const orgEventDoc = await adminDb
        .collection('organizations')
        .doc(orgId)
        .collection('events')
        .doc(eventId)
        .get();

      if (orgEventDoc.exists) {
        event = { id: orgEventDoc.id, ...orgEventDoc.data() } as UnifiedEvent;
      }
    }

    if (!event) {
      const globalEventDoc = await adminDb
        .collection('events')
        .doc(eventId)
        .get();

      if (globalEventDoc.exists) {
        event = { id: globalEventDoc.id, ...globalEventDoc.data() } as UnifiedEvent;
      }
    }

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.callSummaryId) {
      return NextResponse.json({ error: 'Event has no summary' }, { status: 404 });
    }

    // Fetch the summary - try org-scoped first, then global
    let summary: CallSummary | null = null;
    const eventOrgId = event.organizationId || orgId;

    if (eventOrgId) {
      const orgSummaryDoc = await adminDb
        .collection('organizations')
        .doc(eventOrgId)
        .collection('call_summaries')
        .doc(event.callSummaryId)
        .get();

      if (orgSummaryDoc.exists) {
        summary = { id: orgSummaryDoc.id, ...orgSummaryDoc.data() } as CallSummary;
      }
    }

    if (!summary) {
      const globalSummaryDoc = await adminDb
        .collection('call_summaries')
        .doc(event.callSummaryId)
        .get();

      if (globalSummaryDoc.exists) {
        summary = { id: globalSummaryDoc.id, ...globalSummaryDoc.data() } as CallSummary;
      }
    }

    if (!summary) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('[event-summary] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
