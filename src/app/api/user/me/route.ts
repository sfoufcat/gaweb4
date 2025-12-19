import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { FirebaseUser } from '@/types';

/**
 * GET /api/user/me
 * Fetches the current user's data from Firebase server-side
 * This is more secure than client-side Firestore reads
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Fetch user data from Firebase using Admin SDK
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // User document doesn't exist yet (might be first login)
      return NextResponse.json({
        exists: false,
        userId,
      });
    }

    const userData = userDoc.data() as FirebaseUser;

    // Extract goal data from user document (goals are stored in the users collection)
    let activeGoal = null;
    if (userData.goal && userData.goalTargetDate) {
      // Use user-entered progress (stored as goalProgress), default to 0
      const progressPercentage = userData.goalProgress ?? 0;

      activeGoal = {
        goal: userData.goal,
        targetDate: userData.goalTargetDate,
        progress: {
          percentage: progressPercentage,
        },
      };
    }

    return NextResponse.json({
      exists: true,
      user: userData,
      goal: activeGoal,
    });

  } catch (error) {
    console.error('[USER_ME_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * PATCH /api/user/me
 * Updates the current user's profile information
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    
    // Allowed profile fields to update
    const allowedFields = [
      'name',
      'avatarUrl',
      'location',
      'profession',
      'company',
      'bio',
      'interests',
      'instagramHandle',
      'linkedinHandle',
      'twitterHandle',
      'websiteUrl',
      'phoneNumber',
      'onboardingStatus',
      'hasCompletedOnboarding',
      'hasCompletedHomeTutorial', // Home page tutorial completion
      'onboarding', // Quiz answers from onboarding flow
      'billing', // Stripe billing information
      'timezone', // IANA timezone for notification scheduling (auto-detected from browser)
    ];

    // Filter only allowed fields from the request
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // Always update the updatedAt timestamp
    updateData.updatedAt = new Date().toISOString();

    // Track quiz start when user enters the quiz flow (workday is first quiz question)
    // Only set if not already set to avoid overwriting on subsequent visits
    const quizStartStatuses = ['workday', 'obstacles', 'business_stage', 'goal_impact', 'support_needs'];
    if (body.onboardingStatus && quizStartStatuses.includes(body.onboardingStatus)) {
      // Check if quizStarted is already set
      const userRef = adminDb.collection('users').doc(userId);
      const currentDoc = await userRef.get();
      const currentData = currentDoc.data();
      
      if (!currentData?.quizStarted) {
        updateData.quizStarted = true;
        updateData.quizStartedAt = new Date().toISOString();
        console.log('[USER_ME] Tracking quiz start for user:', userId);
      }
    }

    // Update the user document
    const userRef = adminDb.collection('users').doc(userId);
    await userRef.set(updateData, { merge: true });

    // Fetch and return updated user data
    const updatedDoc = await userRef.get();
    const updatedUserData = updatedDoc.data() as FirebaseUser;

    return NextResponse.json({
      success: true,
      user: updatedUserData,
    });

  } catch (error) {
    console.error('[USER_UPDATE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

