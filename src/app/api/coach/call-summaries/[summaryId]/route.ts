/**
 * Call Summary Detail API
 *
 * Get, update, and manage individual call summaries.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
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
