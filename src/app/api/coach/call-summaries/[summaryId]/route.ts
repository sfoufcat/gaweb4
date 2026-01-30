/**
 * Call Summary Detail API
 *
 * Get, update, and manage individual call summaries.
 */

// Allow up to 3 minutes for regeneration (AI summary generation can take time)
export const maxDuration = 180;

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { generateCallSummary } from '@/lib/ai/call-summary';
import type { UserRole, OrgRole, ClerkPublicMetadata, CallSummary } from '@/types';

interface RouteParams {
  params: Promise<{
    summaryId: string;
  }>;
}

/**
 * GET /api/coach/call-summaries/[summaryId]
 *
 * Get a single call summary with full details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId, sessionClaims } = await auth();
    const { summaryId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const doc = await adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('call_summaries')
      .doc(summaryId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    const summary: CallSummary = {
      id: doc.id,
      ...doc.data(),
    } as CallSummary;

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('[CALL_SUMMARY_API] Error getting summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/coach/call-summaries/[summaryId]
 *
 * Update a call summary (mark as reviewed, edit summary, etc.)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId, sessionClaims } = await auth();
    const { summaryId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    const { markReviewed, summary: summaryUpdate, actionItems, coachingNotes } = body;

    const summaryRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('call_summaries')
      .doc(summaryId);

    const doc = await summaryRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Mark as reviewed
    if (markReviewed) {
      updateData.reviewedByCoach = true;
      updateData.reviewedAt = FieldValue.serverTimestamp();
    }

    // Update summary text
    if (summaryUpdate) {
      updateData['summary.executive'] = summaryUpdate.executive ?? doc.data()?.summary?.executive;
      updateData['summary.keyDiscussionPoints'] = summaryUpdate.keyDiscussionPoints ?? doc.data()?.summary?.keyDiscussionPoints;
      updateData['summary.clientProgress'] = summaryUpdate.clientProgress;
      updateData['summary.challenges'] = summaryUpdate.challenges;
      updateData['summary.breakthroughs'] = summaryUpdate.breakthroughs;
    }

    // Update coaching notes
    if (coachingNotes !== undefined) {
      updateData['summary.coachingNotes'] = coachingNotes;
    }

    // Update action items
    if (actionItems) {
      updateData.actionItems = actionItems;
    }

    await summaryRef.update(updateData);

    // Fetch updated document
    const updatedDoc = await summaryRef.get();
    const updatedSummary: CallSummary = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as CallSummary;

    return NextResponse.json({ summary: updatedSummary });
  } catch (error) {
    console.error('[CALL_SUMMARY_API] Error updating summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/coach/call-summaries/[summaryId]
 *
 * Delete a call summary
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId, sessionClaims } = await auth();
    const { summaryId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const summaryRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('call_summaries')
      .doc(summaryId);

    const doc = await summaryRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    // Get eventId from summary to clear reference on event
    const summaryData = doc.data() as CallSummary;
    const eventId = summaryData?.eventId;

    // Delete associated suggested tasks
    const suggestedTasksSnapshot = await adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('suggested_tasks')
      .where('callSummaryId', '==', summaryId)
      .get();

    const batch = adminDb.batch();
    suggestedTasksSnapshot.docs.forEach((taskDoc) => {
      batch.delete(taskDoc.ref);
    });
    batch.delete(summaryRef);

    // Clear callSummaryId from event so dashboard/calendar don't show stale hasSummary
    if (eventId) {
      const eventRef = adminDb.collection('events').doc(eventId);
      batch.update(eventRef, { callSummaryId: FieldValue.delete() });
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CALL_SUMMARY_API] Error deleting summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/coach/call-summaries/[summaryId]
 *
 * Regenerate a failed or stuck call summary
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId, sessionClaims } = await auth();
    const { summaryId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (action !== 'regenerate') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get the existing summary
    const summaryRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('call_summaries')
      .doc(summaryId);

    const summaryDoc = await summaryRef.get();
    if (!summaryDoc.exists) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    const summaryData = summaryDoc.data() as CallSummary;

    // Only allow regeneration for failed or stuck (processing for too long) summaries
    const createdAt = summaryData.createdAt;
    const createdTime = typeof createdAt === 'object' && 'seconds' in createdAt
      ? (createdAt as { seconds: number }).seconds * 1000
      : new Date(createdAt as string).getTime();
    const ageMinutes = (Date.now() - createdTime) / (1000 * 60);

    // Allow regeneration if:
    // 1. Status is 'failed'
    // 2. Status is 'processing' and it's been more than 5 minutes (stuck)
    const canRegenerate =
      summaryData.status === 'failed' ||
      (summaryData.status === 'processing' && ageMinutes > 5);

    if (!canRegenerate) {
      return NextResponse.json(
        { error: 'Summary cannot be regenerated. It must be failed or stuck in processing for more than 5 minutes.' },
        { status: 400 }
      );
    }

    // Get the transcription
    const transcriptionId = summaryData.transcriptionId;
    if (!transcriptionId) {
      return NextResponse.json({ error: 'No transcription found for this summary' }, { status: 400 });
    }

    const transcriptionDoc = await adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('platform_transcriptions')
      .doc(transcriptionId)
      .get();

    if (!transcriptionDoc.exists) {
      return NextResponse.json({ error: 'Transcription not found' }, { status: 404 });
    }

    const transcription = transcriptionDoc.data();
    if (!transcription?.transcript) {
      return NextResponse.json({ error: 'Transcription has no content' }, { status: 400 });
    }

    // Update status to processing
    await summaryRef.update({
      status: 'processing',
      processingError: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Get context info for the summary generation
    const hostUserId = summaryData.hostUserId;
    let hostName = 'Coach';
    let clientName: string | undefined;
    let programName: string | undefined;

    // Get host name
    const hostDoc = await adminDb.collection('users').doc(hostUserId).get();
    if (hostDoc.exists) {
      hostName = hostDoc.data()?.displayName || 'Coach';
    }

    // Get client name
    if (summaryData.clientUserId) {
      const clientDoc = await adminDb.collection('users').doc(summaryData.clientUserId).get();
      if (clientDoc.exists) {
        clientName = clientDoc.data()?.displayName;
      }
    }

    // Get program name
    if (summaryData.programId) {
      const programDoc = await adminDb.collection('programs').doc(summaryData.programId).get();
      if (programDoc.exists) {
        programName = programDoc.data()?.title;
      }
    }

    try {
      // Generate summary
      const result = await generateCallSummary({
        transcript: transcription.transcript,
        durationSeconds: transcription.durationSeconds || summaryData.recordingDurationSeconds || 0,
        callType: 'coaching_1on1',
        hostName,
        clientName,
        programName,
      });

      // Update summary with results
      await summaryRef.update({
        summary: result.summary,
        actionItems: result.actionItems,
        followUpQuestions: result.followUpQuestions || [],
        status: 'completed',
        processingError: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Fetch updated document
      const updatedDoc = await summaryRef.get();
      const updatedSummary: CallSummary = {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      } as CallSummary;

      console.log(`[CALL_SUMMARY_API] Successfully regenerated summary ${summaryId}`);
      return NextResponse.json({ success: true, summary: updatedSummary });
    } catch (aiError) {
      const errorMessage = aiError instanceof Error ? aiError.message : 'AI generation failed';

      await summaryRef.update({
        status: 'failed',
        processingError: errorMessage,
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.error(`[CALL_SUMMARY_API] Failed to regenerate summary ${summaryId}:`, aiError);
      return NextResponse.json(
        { error: `Failed to regenerate summary: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[CALL_SUMMARY_API] Error regenerating summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
