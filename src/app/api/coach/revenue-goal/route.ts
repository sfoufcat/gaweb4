import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { isDemoRequest } from '@/lib/demo-api';

/**
 * GET /api/coach/revenue-goal
 * Get the coach's revenue goal settings
 */
export async function GET() {
  try {
    // Demo mode: return mock data
    if (await isDemoRequest()) {
      return NextResponse.json({
        monthlyRevenueGoal: 10000,
        targetClients: 20,
        goalSetAt: new Date().toISOString(),
      });
    }

    const { userId, organizationId } = await requireCoachWithOrg();

    // Check org_settings first for org-level coach goal
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data();

    if (orgSettings?.monthlyRevenueGoal) {
      return NextResponse.json({
        monthlyRevenueGoal: orgSettings.monthlyRevenueGoal,
        targetClients: orgSettings.targetClients || null,
        goalSetAt: orgSettings.revenueGoalSetAt || null,
      });
    }

    // Fall back to user's membership goal data
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (!membershipSnapshot.empty) {
      const memberData = membershipSnapshot.docs[0].data();
      return NextResponse.json({
        monthlyRevenueGoal: memberData.monthlyRevenueGoal || null,
        targetClients: memberData.targetClients || null,
        goalSetAt: memberData.revenueGoalSetAt || null,
      });
    }

    return NextResponse.json({
      monthlyRevenueGoal: null,
      targetClients: null,
      goalSetAt: null,
    });
  } catch (error) {
    console.error('[REVENUE_GOAL_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch revenue goal';

    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/revenue-goal
 * Update the coach's revenue goal
 */
export async function PATCH(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    const { monthlyRevenueGoal, targetClients } = body;

    // Validate input
    if (monthlyRevenueGoal !== undefined && (typeof monthlyRevenueGoal !== 'number' || monthlyRevenueGoal < 0)) {
      return NextResponse.json(
        { error: 'Monthly revenue goal must be a non-negative number' },
        { status: 400 }
      );
    }

    if (targetClients !== undefined && targetClients !== null && (typeof targetClients !== 'number' || targetClients < 0)) {
      return NextResponse.json(
        { error: 'Target clients must be a non-negative number' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    if (monthlyRevenueGoal !== undefined) {
      updates.monthlyRevenueGoal = monthlyRevenueGoal;
      updates.revenueGoalSetAt = now;
    }

    if (targetClients !== undefined) {
      updates.targetClients = targetClients;
    }

    // Store in org_settings (org-level coach goal)
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);

    await settingsRef.set(updates, { merge: true });

    return NextResponse.json({
      success: true,
      monthlyRevenueGoal: monthlyRevenueGoal,
      targetClients: targetClients,
      goalSetAt: now,
    });
  } catch (error) {
    console.error('[REVENUE_GOAL_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update revenue goal';

    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
