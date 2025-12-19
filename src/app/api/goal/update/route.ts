import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Helper function to complete a goal and move it to history
 */
async function completeGoal(userId: string, userRef: FirebaseFirestore.DocumentReference) {
  const now = new Date().toISOString();
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  if (!userData?.goal) {
    return null;
  }

  // Build completed goal history entry
  const goalHistoryEntry = {
    goal: userData.goal,
    targetDate: userData.goalTargetDate,
    setAt: userData.goalSetAt || now,
    archivedAt: null, // Not archived, completed
    progress: 100,
    completedAt: now,
  };

  // Get existing history
  const goalHistory = userData.goalHistory || [];
  goalHistory.push(goalHistoryEntry);

  // Clear current goal and save to history
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
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const userRef = adminDb.collection('users').doc(userId);

    // If progress is 100% or explicit complete flag, complete the goal
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

    // Update user document
    await userRef.set(updateData, { merge: true });

    // Fetch updated data
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
 */
export async function POST(_req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();

    // Get current goal data
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

    // Build archived goal history entry (completedAt is null = archived, not completed)
    const goalHistoryEntry = {
      goal: userData.goal,
      targetDate: userData.goalTargetDate,
      setAt: userData.goalSetAt || now,
      archivedAt: now,
      progress: userData.goalProgress || 0,
      completedAt: null, // null means archived, not completed
    };

    // Get existing history
    const goalHistory = userData.goalHistory || [];
    goalHistory.push(goalHistoryEntry);

    // Clear current goal and save to history
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
