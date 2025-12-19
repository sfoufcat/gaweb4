import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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

    // Get existing user data to preserve history
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const existingData = userDoc.data() || {};

    // Build goal history
    const goalHistory = existingData.goalHistory || [];
    if (existingData.goal) {
      // Add previous goal to history
      goalHistory.push({
        goal: existingData.goal,
        targetDate: existingData.goalTargetDate,
        setAt: existingData.goalSetAt || now,
        completedAt: null,
      });
    }

    // Update user document with new goal and advance onboarding status
    await userRef.set(
      {
        goal: trimmedGoal,
        goalTargetDate: targetDate,
        goalSetAt: now,
        goalIsAISuggested: isAISuggested || false,
        goalHistory: goalHistory,
        onboardingStatus: 'goal_impact', // Move to post-goal questions
        updatedAt: now,
      },
      { merge: true }
    );

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





