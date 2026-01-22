import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { isDemoRequest } from '@/lib/demo-api';

/**
 * GET /api/coach/revenue-goal
 * Get the coach's revenue goal settings
 *
 * Returns deadline-based goal data:
 * - revenueGoal: target amount
 * - revenueGoalDeadline: ISO date string for deadline
 * - revenueGoalStartDate: ISO date string for when tracking started
 * - goalAchievedCelebrated: whether confetti has been shown for this goal
 */
export async function GET() {
  try {
    // Demo mode: return mock data
    if (await isDemoRequest()) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return NextResponse.json({
        revenueGoal: 10000,
        revenueGoalDeadline: thirtyDaysFromNow.toISOString().split('T')[0],
        revenueGoalStartDate: thirtyDaysAgo.toISOString().split('T')[0],
        goalSetAt: thirtyDaysAgo.toISOString(),
        goalAchievedCelebrated: false,
        // Legacy fields for backwards compatibility
        monthlyRevenueGoal: 10000,
        targetClients: null,
      });
    }

    const { organizationId } = await requireCoachWithOrg();

    // Check org_settings for org-level coach goal
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data();

    if (orgSettings?.revenueGoal || orgSettings?.monthlyRevenueGoal) {
      return NextResponse.json({
        // New deadline-based fields
        revenueGoal: orgSettings.revenueGoal || orgSettings.monthlyRevenueGoal || null,
        revenueGoalDeadline: orgSettings.revenueGoalDeadline || null,
        revenueGoalStartDate: orgSettings.revenueGoalStartDate || null,
        goalSetAt: orgSettings.revenueGoalSetAt || null,
        goalAchievedCelebrated: orgSettings.goalAchievedCelebrated || false,
        // Legacy fields for backwards compatibility
        monthlyRevenueGoal: orgSettings.revenueGoal || orgSettings.monthlyRevenueGoal || null,
        targetClients: orgSettings.targetClients || null,
      });
    }

    return NextResponse.json({
      revenueGoal: null,
      revenueGoalDeadline: null,
      revenueGoalStartDate: null,
      goalSetAt: null,
      goalAchievedCelebrated: false,
      monthlyRevenueGoal: null,
      targetClients: null,
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
 *
 * Accepts:
 * - revenueGoal: target amount
 * - revenueGoalDeadline: ISO date string for deadline
 * - goalAchievedCelebrated: mark celebration as shown
 */
export async function PATCH(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    const { revenueGoal, revenueGoalDeadline, goalAchievedCelebrated } = body;

    // Validate input
    if (revenueGoal !== undefined && (typeof revenueGoal !== 'number' || revenueGoal < 0)) {
      return NextResponse.json(
        { error: 'Revenue goal must be a non-negative number' },
        { status: 400 }
      );
    }

    if (revenueGoalDeadline !== undefined && revenueGoalDeadline !== null) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(revenueGoalDeadline)) {
        return NextResponse.json(
          { error: 'Deadline must be in YYYY-MM-DD format' },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    // Setting a new goal
    if (revenueGoal !== undefined) {
      updates.revenueGoal = revenueGoal;
      updates.monthlyRevenueGoal = revenueGoal; // Legacy field for backwards compatibility
      updates.revenueGoalSetAt = now;
      updates.revenueGoalStartDate = today;
      updates.goalAchievedCelebrated = false; // Reset celebration flag for new goal

      if (revenueGoalDeadline !== undefined) {
        updates.revenueGoalDeadline = revenueGoalDeadline;
      }
    }

    // Just updating the celebration flag
    if (goalAchievedCelebrated !== undefined) {
      updates.goalAchievedCelebrated = goalAchievedCelebrated;
    }

    // Store in org_settings (org-level coach goal)
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);

    await settingsRef.set(updates, { merge: true });

    // Fetch and return updated data
    const updatedDoc = await settingsRef.get();
    const updatedSettings = updatedDoc.data();

    return NextResponse.json({
      success: true,
      revenueGoal: updatedSettings?.revenueGoal || null,
      revenueGoalDeadline: updatedSettings?.revenueGoalDeadline || null,
      revenueGoalStartDate: updatedSettings?.revenueGoalStartDate || null,
      goalSetAt: updatedSettings?.revenueGoalSetAt || null,
      goalAchievedCelebrated: updatedSettings?.goalAchievedCelebrated || false,
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
