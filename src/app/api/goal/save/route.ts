import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { ClerkPublicMetadata } from '@/types';

/**
 * POST /api/goal/save
 * Saves a new goal for the user
 * 
 * MULTI-TENANCY: Goals are stored per-organization in org_memberships
 */
export async function POST(req: Request) {
  try {
    // Check authentication
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // MULTI-TENANCY: Get effective org ID
    const organizationId = await getEffectiveOrgId();

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Get the goal and target date from request body
    const { goal, targetDate, isAISuggested } = await req.json();

    if (!goal || typeof goal !== 'string') {
      return NextResponse.json(
        { error: 'Goal is required' },
        { status: 400 }
      );
    }

    if (!targetDate || typeof targetDate !== 'string') {
      return NextResponse.json(
        { error: 'Target date is required' },
        { status: 400 }
      );
    }

    const trimmedGoal = goal.trim();
    const now = new Date().toISOString();

    // Get org_membership to update (multi-tenancy)
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (!membershipSnapshot.empty) {
      // Update org_membership with new goal
      const memberRef = membershipSnapshot.docs[0].ref;
      const memberData = membershipSnapshot.docs[0].data();
      
      // Build goal history
      const goalHistory = memberData.goalHistory || [];
      if (memberData.goal) {
        goalHistory.push({
          goal: memberData.goal,
          targetDate: memberData.goalTargetDate,
          setAt: memberData.goalSetAt || now,
          completedAt: null,
        });
      }

      await memberRef.update({
        goal: trimmedGoal,
        goalTargetDate: targetDate,
        goalSetAt: now,
        goalIsAISuggested: isAISuggested || false,
        goalHistory: goalHistory,
        goalCompleted: false,
        goalProgress: 0,
        onboardingStatus: 'goal_impact',
        updatedAt: now,
      });
    } else {
      // Legacy fallback: Update user document
      const userRef = adminDb.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const existingData = userDoc.data() || {};

      const goalHistory = existingData.goalHistory || [];
      if (existingData.goal) {
        goalHistory.push({
          goal: existingData.goal,
          targetDate: existingData.goalTargetDate,
          setAt: existingData.goalSetAt || now,
          completedAt: null,
        });
      }

      await userRef.set(
        {
          goal: trimmedGoal,
          goalTargetDate: targetDate,
          goalSetAt: now,
          goalIsAISuggested: isAISuggested || false,
          goalHistory: goalHistory,
          onboardingStatus: 'goal_impact',
          updatedAt: now,
        },
        { merge: true }
      );
    }

    return NextResponse.json({
      success: true,
      goal: trimmedGoal,
      targetDate: targetDate,
      setAt: now,
    });
  } catch (error) {
    console.error('Error saving goal:', error);
    return NextResponse.json(
      { error: 'Failed to save goal' },
      { status: 500 }
    );
  }
}





