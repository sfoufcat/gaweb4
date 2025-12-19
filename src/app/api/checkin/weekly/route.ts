import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { summarizeWeeklyFocus } from '@/lib/anthropic';
import type { WeeklyReflectionCheckIn } from '@/types';

// Get the week identifier (Monday of the current week)
function getWeekId(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// GET - Fetch current week's reflection
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId') || getWeekId();

    const checkInRef = adminDb.collection('users').doc(userId).collection('weeklyReflections').doc(weekId);
    const checkInDoc = await checkInRef.get();

    if (!checkInDoc.exists) {
      return NextResponse.json({ checkIn: null });
    }

    return NextResponse.json({ checkIn: { id: checkInDoc.id, ...checkInDoc.data() } });
  } catch (error) {
    console.error('Error fetching weekly reflection:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch weekly reflection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Start a new weekly reflection
export async function POST(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weekId = getWeekId();
    const checkInRef = adminDb.collection('users').doc(userId).collection('weeklyReflections').doc(weekId);
    const existingDoc = await checkInRef.get();

    // If check-in already exists, return it
    if (existingDoc.exists) {
      return NextResponse.json({ checkIn: { id: existingDoc.id, ...existingDoc.data() } });
    }

    // Get user's current goal progress
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const currentProgress = userData?.goalProgress || 0;

    const now = new Date().toISOString();
    const newCheckIn: Omit<WeeklyReflectionCheckIn, 'id'> = {
      date: weekId,
      userId,
      onTrackStatus: 'not_sure',
      progress: currentProgress,
      previousProgress: currentProgress,
      createdAt: now,
      updatedAt: now,
    };

    await checkInRef.set(newCheckIn);

    return NextResponse.json({ checkIn: { id: weekId, ...newCheckIn } }, { status: 201 });
  } catch (error) {
    console.error('Error creating weekly reflection:', error);
    const message = error instanceof Error ? error.message : 'Failed to create weekly reflection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update weekly reflection progress
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();
    const weekId = getWeekId();
    const checkInRef = adminDb.collection('users').doc(userId).collection('weeklyReflections').doc(weekId);
    const existingDoc = await checkInRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json({ error: 'Weekly reflection not found' }, { status: 404 });
    }

    const existingData = existingDoc.data() as WeeklyReflectionCheckIn;
    const updatedData: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // If marking as completed, set completedAt
    if (updates.completedAt === true) {
      updatedData.completedAt = new Date().toISOString();
      delete updatedData.completedAt; // Remove the boolean flag
      
      // Save to reflections collection for goal page
      const progressChange = (existingData.progress || 0) - (existingData.previousProgress || 0);
      const reflectionData = {
        userId,
        goalId: `${userId}_goal`,
        type: 'weekly',
        date: weekId,
        weekEndDate: new Date().toISOString().split('T')[0],
        progressChange,
        onTrackStatus: existingData.onTrackStatus || 'not_sure',
        whatWentWell: existingData.whatWentWell || '',
        biggestObstacles: existingData.biggestObstacles || '',
        nextWeekPlan: existingData.nextWeekPlan || '',
        publicFocus: existingData.publicFocus || updates.publicFocus || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to reflections subcollection
      await adminDb
        .collection('users')
        .doc(userId)
        .collection('reflections')
        .doc(`weekly_${weekId}`)
        .set(reflectionData);

      // Update user's publicFocus field for profile display
      const focusText = existingData.publicFocus || updates.publicFocus;
      if (focusText) {
        // Generate AI summary for the weekly focus
        const { summary: focusSummary } = await summarizeWeeklyFocus(focusText);
        
        await adminDb.collection('users').doc(userId).update({
          publicFocus: focusText,
          publicFocusSummary: focusSummary,
          publicFocusUpdatedAt: new Date().toISOString(),
        });
      }

      // Update completedAt in weeklyReflections
      updatedData.completedAt = new Date().toISOString();
    }

    // If updating progress, also update user's goalProgress
    if (typeof updates.progress === 'number') {
      await adminDb.collection('users').doc(userId).update({
        goalProgress: updates.progress,
      });
    }

    // If marking goal as complete
    if (updates.goalCompleted === true) {
      updatedData.goalCompleted = true;
      updatedData.completedAt = new Date().toISOString();
      
      // Mark the goal as completed in user document
      await adminDb.collection('users').doc(userId).update({
        goalProgress: 100,
        goalCompletedAt: new Date().toISOString(),
        goalCompleted: true,
      });
    }

    await checkInRef.update(updatedData);
    const updatedDoc = await checkInRef.get();

    return NextResponse.json({ checkIn: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error) {
    console.error('Error updating weekly reflection:', error);
    const message = error instanceof Error ? error.message : 'Failed to update weekly reflection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}













