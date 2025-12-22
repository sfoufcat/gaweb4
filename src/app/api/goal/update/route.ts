import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { ClerkPublicMetadata } from '@/types';

/**
 * Helper function to complete a goal and move it to history
 * MULTI-TENANCY: Updates org_membership if available, falls back to user doc
 */
async function completeGoalInMembership(
  memberRef: FirebaseFirestore.DocumentReference,
  memberData: FirebaseFirestore.DocumentData
) {
  const now = new Date().toISOString();

  if (!memberData?.goal) {
    return null;
  }

  const goalHistoryEntry = {
    goal: memberData.goal,
    targetDate: memberData.goalTargetDate,
    setAt: memberData.goalSetAt || now,
    archivedAt: null,
    progress: 100,
    completedAt: now,
  };

  const goalHistory = memberData.goalHistory || [];
  goalHistory.push(goalHistoryEntry);

  await memberRef.update({
    goal: null,
    goalTargetDate: null,
    goalSetAt: null,
    goalProgress: null,
    goalCompleted: null,
    goalCompletedAt: null,
    goalIsAISuggested: null,
    goalHistory: goalHistory,
    updatedAt: now,
  });

  return goalHistoryEntry;
}

/**
 * Legacy helper for user document
 */
async function completeGoal(userId: string, userRef: FirebaseFirestore.DocumentReference) {
  const now = new Date().toISOString();
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  if (!userData?.goal) {
    return null;
  }

  const goalHistoryEntry = {
    goal: userData.goal,
    targetDate: userData.goalTargetDate,
    setAt: userData.goalSetAt || now,
    archivedAt: null,
    progress: 100,
    completedAt: now,
  };

  const goalHistory = userData.goalHistory || [];
  goalHistory.push(goalHistoryEntry);

  await userRef.set(
    {
      goal: null,
      goalTargetDate: null,
      goalSetAt: null,
      goalProgress: null,
      goalCompleted: null,
      goalCompletedAt: null,
      goalIsAISuggested: null,
      goalHistory: goalHistory,
      updatedAt: now,
    },
    { merge: true }
  );

  return goalHistoryEntry;
}

/**
 * PATCH /api/goal/update
 * Updates the user's goal (title, targetDate, progress)
 * If progress reaches 100%, automatically completes the goal
 * 
 * MULTI-TENANCY: Goals are stored per-organization in org_memberships
 */
export async function PATCH(req: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await req.json();
    const { goal, targetDate, progress, completeGoal: shouldComplete } = body;

    // Validate input
    if (goal !== undefined && (typeof goal !== 'string' || goal.trim() === '')) {
      return NextResponse.json(
        { error: 'Goal must be a non-empty string' },
        { status: 400 }
      );
    }

    if (progress !== undefined && (typeof progress !== 'number' || progress < 0 || progress > 100)) {
      return NextResponse.json(
        { error: 'Progress must be a number between 0 and 100' },
        { status: 400 }
      );
    }

    // Try org_membership first (multi-tenancy)
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (!membershipSnapshot.empty) {
      const memberRef = membershipSnapshot.docs[0].ref;
      const memberData = membershipSnapshot.docs[0].data();

      // If progress is 100% or explicit complete flag, complete the goal
      if (progress === 100 || shouldComplete === true) {
        const completedGoal = await completeGoalInMembership(memberRef, memberData);
        
        if (!completedGoal) {
          return NextResponse.json(
            { error: 'No active goal to complete' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          completed: true,
          completedGoal,
        });
      }

      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (goal !== undefined) {
        updateData.goal = goal.trim();
      }

      if (targetDate !== undefined) {
        updateData.goalTargetDate = targetDate;
      }

      if (progress !== undefined) {
        updateData.goalProgress = progress;
      }

      await memberRef.update(updateData);

      const updatedDoc = await memberRef.get();
      const updatedData = updatedDoc.data();

      return NextResponse.json({
        success: true,
        goal: {
          goal: updatedData?.goal,
          targetDate: updatedData?.goalTargetDate,
          progress: updatedData?.goalProgress || 0,
        },
      });
    }

    // Legacy fallback: Use user document
    const userRef = adminDb.collection('users').doc(userId);

    if (progress === 100 || shouldComplete === true) {
      const completedGoal = await completeGoal(userId, userRef);
      
      if (!completedGoal) {
        return NextResponse.json(
          { error: 'No active goal to complete' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        completed: true,
        completedGoal,
      });
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    if (goal !== undefined) {
      updateData.goal = goal.trim();
    }

    if (targetDate !== undefined) {
      updateData.goalTargetDate = targetDate;
    }

    if (progress !== undefined) {
      updateData.goalProgress = progress;
    }

    await userRef.set(updateData, { merge: true });

    const updatedDoc = await userRef.get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      goal: {
        goal: updatedData?.goal,
        targetDate: updatedData?.goalTargetDate,
        progress: updatedData?.goalProgress || 0,
      },
    });
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json(
      { error: 'Failed to update goal' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goal/update
 * Archives the current goal (not completed, just abandoned/archived)
 * 
 * MULTI-TENANCY: Goals are stored per-organization in org_memberships
 */
export async function POST(_req: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Try org_membership first (multi-tenancy)
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (!membershipSnapshot.empty) {
      const memberRef = membershipSnapshot.docs[0].ref;
      const memberData = membershipSnapshot.docs[0].data();
      
      if (!memberData?.goal) {
        return NextResponse.json(
          { error: 'No active goal to archive' },
          { status: 400 }
        );
      }

      const goalHistoryEntry = {
        goal: memberData.goal,
        targetDate: memberData.goalTargetDate,
        setAt: memberData.goalSetAt || now,
        archivedAt: now,
        progress: memberData.goalProgress || 0,
        completedAt: null,
      };

      const goalHistory = memberData.goalHistory || [];
      goalHistory.push(goalHistoryEntry);

      await memberRef.update({
        goal: null,
        goalTargetDate: null,
        goalSetAt: null,
        goalProgress: null,
        goalCompleted: null,
        goalCompletedAt: null,
        goalIsAISuggested: null,
        goalHistory: goalHistory,
        updatedAt: now,
      });

      return NextResponse.json({
        success: true,
        archivedGoal: goalHistoryEntry,
      });
    }

    // Legacy fallback: Use user document
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    
    if (!userData?.goal) {
      return NextResponse.json(
        { error: 'No active goal to archive' },
        { status: 400 }
      );
    }

    const goalHistoryEntry = {
      goal: userData.goal,
      targetDate: userData.goalTargetDate,
      setAt: userData.goalSetAt || now,
      archivedAt: now,
      progress: userData.goalProgress || 0,
      completedAt: null,
    };

    const goalHistory = userData.goalHistory || [];
    goalHistory.push(goalHistoryEntry);

    await userRef.set(
      {
        goal: null,
        goalTargetDate: null,
        goalSetAt: null,
        goalProgress: null,
        goalCompleted: null,
        goalCompletedAt: null,
        goalIsAISuggested: null,
        goalHistory: goalHistory,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      archivedGoal: goalHistoryEntry,
    });
  } catch (error) {
    console.error('Error archiving goal:', error);
    return NextResponse.json(
      { error: 'Failed to archive goal' },
      { status: 500 }
    );
  }
}
