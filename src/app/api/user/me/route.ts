import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { FirebaseUser, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/user/me
 * Fetches the current user's data from Firebase server-side
 * This is more secure than client-side Firestore reads
 * 
 * MULTI-TENANCY: Also fetches org-specific data from org_memberships
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

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

    // Try to get org-specific data if we have an organizationId
    let orgMembershipData: Record<string, unknown> | null = null;
    if (organizationId) {
      const membershipDoc = await adminDb
        .collection('org_memberships')
        .doc(`${organizationId}_${userId}`)
        .get();
      
      if (membershipDoc.exists) {
        orgMembershipData = membershipDoc.data() || null;
      }
    }

    // Extract goal data - prioritize org_memberships, fallback to users collection
    let activeGoal = null;
    
    // First check org_memberships for org-scoped goal
    if (orgMembershipData?.goal && orgMembershipData?.targetDate) {
      const progressPercentage = (orgMembershipData.goalProgress as number) ?? 0;
      activeGoal = {
        goal: orgMembershipData.goal,
        targetDate: orgMembershipData.targetDate,
        progress: {
          percentage: progressPercentage,
        },
      };
    } 
    // Fallback to legacy users collection goal
    else if (userData.goal && userData.goalTargetDate) {
      const progressPercentage = userData.goalProgress ?? 0;
      activeGoal = {
        goal: userData.goal,
        targetDate: userData.goalTargetDate,
        progress: {
          percentage: progressPercentage,
        },
      };
    }

    // Merge user data with org-specific data (org data overrides base user data)
    const mergedUserData = {
      ...userData,
      ...(orgMembershipData && {
        // Org-specific profile fields
        bio: orgMembershipData.bio || userData.bio,
        identity: orgMembershipData.identity || userData.identity,
        goal: orgMembershipData.goal || userData.goal,
        goalTargetDate: orgMembershipData.targetDate || userData.goalTargetDate,
        goalProgress: orgMembershipData.goalProgress ?? userData.goalProgress,
        weeklyFocus: orgMembershipData.weeklyFocus,
        onboardingStatus: orgMembershipData.onboardingStatus || userData.onboardingStatus,
        hasCompletedOnboarding: orgMembershipData.hasCompletedOnboarding ?? userData.hasCompletedOnboarding,
      }),
    };

    return NextResponse.json({
      exists: true,
      user: mergedUserData,
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

