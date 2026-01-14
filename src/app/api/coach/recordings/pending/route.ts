/**
 * Check for Pending Recordings API
 *
 * Returns any in-progress recording for a given context:
 * - Cohort mode: cohortId + weekId
 * - 1:1 mode: clientUserId (+ optional enrollmentId)
 *
 * Used to show processing status when coach returns to a page.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UserRole, OrgRole, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/coach/recordings/pending
 *
 * Query params (provide one of these combinations):
 * - cohortId + weekId: For cohort/group mode
 * - clientUserId (+ optional enrollmentId): For 1:1 mode
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

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

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohortId');
    const weekId = searchParams.get('weekId');
    const clientUserId = searchParams.get('clientUserId');
    const enrollmentId = searchParams.get('enrollmentId');

    // Need either cohort context or client context
    if (!cohortId && !clientUserId) {
      return NextResponse.json(
        { error: 'Either cohortId+weekId or clientUserId is required' },
        { status: 400 }
      );
    }

    const recordingsRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('uploaded_recordings');

    // Include 'failed' status to show errors on page refresh
    const statusesToCheck = ['uploaded', 'transcribing', 'summarizing', 'failed'];

    let pendingQuery;

    if (cohortId && weekId) {
      // Cohort mode: query by cohortId + weekId
      pendingQuery = await recordingsRef
        .where('cohortId', '==', cohortId)
        .where('weekId', '==', weekId)
        .where('status', 'in', statusesToCheck)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    } else if (clientUserId) {
      // 1:1 mode: query by clientUserId (and optionally enrollmentId)
      let query = recordingsRef
        .where('clientUserId', '==', clientUserId)
        .where('status', 'in', statusesToCheck);

      if (enrollmentId) {
        query = query.where('programEnrollmentId', '==', enrollmentId);
      }

      pendingQuery = await query
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    } else {
      return NextResponse.json({ pendingRecording: null });
    }

    if (pendingQuery.empty) {
      return NextResponse.json({ pendingRecording: null });
    }

    const doc = pendingQuery.docs[0];
    const data = doc.data();

    // For failed recordings, only show if failed within the last hour
    // (to avoid showing old failures forever)
    if (data.status === 'failed') {
      const updatedAt = data.updatedAt?.toDate?.();
      if (updatedAt) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (updatedAt < oneHourAgo) {
          return NextResponse.json({ pendingRecording: null });
        }
      }
    }

    return NextResponse.json({
      pendingRecording: {
        id: doc.id,
        status: data.status,
        fileName: data.fileName,
        error: data.processingError || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('[PENDING_RECORDINGS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
