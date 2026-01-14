/**
 * Check for Pending Recordings API
 *
 * Returns any in-progress recording for a given cohort/week combination.
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
 * Query params:
 * - cohortId: Cohort ID to check
 * - weekId: Week ID to check
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

    if (!cohortId || !weekId) {
      return NextResponse.json({ error: 'cohortId and weekId are required' }, { status: 400 });
    }

    // Query for any in-progress recordings for this cohort/week
    const recordingsRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('uploaded_recordings');

    const pendingQuery = await recordingsRef
      .where('cohortId', '==', cohortId)
      .where('weekId', '==', weekId)
      .where('status', 'in', ['uploaded', 'transcribing', 'summarizing'])
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (pendingQuery.empty) {
      return NextResponse.json({ pendingRecording: null });
    }

    const doc = pendingQuery.docs[0];
    const data = doc.data();

    return NextResponse.json({
      pendingRecording: {
        id: doc.id,
        status: data.status,
        fileName: data.fileName,
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
