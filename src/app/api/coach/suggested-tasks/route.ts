/**
 * Suggested Tasks API
 *
 * List suggested tasks from call summaries pending coach review.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UserRole, OrgRole, ClerkPublicMetadata, SuggestedTask } from '@/types';

/**
 * GET /api/coach/suggested-tasks
 *
 * Query params:
 * - status: Filter by status (pending_review, approved, rejected, assigned)
 * - clientUserId: Filter by client
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
    const status = searchParams.get('status');
    const clientUserId = searchParams.get('clientUserId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query
    let query = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('suggested_tasks')
      .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

    if (status) {
      query = query.where('status', '==', status);
    }

    if (clientUserId) {
      query = query.where('userId', '==', clientUserId);
    }

    query = query.limit(limit);

    const snapshot = await query.get();

    const tasks: SuggestedTask[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as SuggestedTask[];

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('[SUGGESTED_TASKS_API] Error listing tasks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
