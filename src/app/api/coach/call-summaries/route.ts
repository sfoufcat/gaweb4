/**
 * Call Summaries API
 *
 * List call summaries for the organization.
 * Supports filtering by client, program, and date range.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UserRole, OrgRole, ClerkPublicMetadata, CallSummary } from '@/types';

/**
 * GET /api/coach/call-summaries
 *
 * Query params:
 * - clientUserId: Filter by client
 * - programId: Filter by program
 * - programEnrollmentId: Filter by enrollment
 * - status: Filter by status (processing, completed, failed)
 * - limit: Number of results (default 50)
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
    const clientUserId = searchParams.get('clientUserId');
    const programId = searchParams.get('programId');
    const programEnrollmentId = searchParams.get('programEnrollmentId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query
    let query = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('call_summaries')
      .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

    if (clientUserId) {
      query = query.where('clientUserId', '==', clientUserId);
    }

    if (programId) {
      query = query.where('programId', '==', programId);
    }

    if (programEnrollmentId) {
      query = query.where('programEnrollmentId', '==', programEnrollmentId);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.limit(limit);

    const snapshot = await query.get();

    const summaries: CallSummary[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CallSummary[];

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error('[CALL_SUMMARIES_API] Error listing summaries:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
