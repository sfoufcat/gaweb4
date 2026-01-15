/**
 * Admin API: Recompute Activity Status
 *
 * POST /api/admin/recompute-activity
 *
 * Manually recompute and update activity status for a user.
 * Used to fix missing activity status fields on org_memberships.
 *
 * Body: { userId: string, organizationId: string }
 *
 * Requires super_admin role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateClientActivityStatus } from '@/lib/analytics/activity';

export async function POST(request: NextRequest) {
  try {
    const { userId: adminUserId, sessionClaims } = await auth();

    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for super_admin role
    const role = (sessionClaims?.publicMetadata as Record<string, unknown>)?.role;
    if (role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: super_admin required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, organizationId } = body;

    if (!userId || !organizationId) {
      return NextResponse.json(
        { error: 'userId and organizationId are required' },
        { status: 400 }
      );
    }

    // Recompute activity status
    await updateClientActivityStatus(organizationId, userId);

    return NextResponse.json({
      success: true,
      message: `Recomputed activity status for user ${userId} in org ${organizationId}`,
    });
  } catch (error) {
    console.error('[ADMIN_RECOMPUTE_ACTIVITY] Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
