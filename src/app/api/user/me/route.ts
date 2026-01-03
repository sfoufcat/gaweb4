import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { syncUserToStream } from '@/lib/stream-server';
import type { FirebaseUser } from '@/types';

/**
 * GET /api/user/me
 * Fetches the current user's data from Firebase server-side
 * This is more secure than client-side Firestore reads
 * 
 * MULTI-TENANCY: Also fetches org-specific data from org_memberships
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain
    const organizationId = await getEffectiveOrgId();

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
    // Note: org_memberships are created with auto-generated IDs, so we must query by fields
    let orgMembershipData: Record<string, unknown> | null = null;
    if (organizationId) {
      const membershipSnapshot = await adminDb
        .collection('org_memberships')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .limit(1)
        .get();
      
      if (!membershipSnapshot.empty) {
        orgMembershipData = membershipSnapshot.docs[0].data() || null;
      }
    }

    // Extract goal data - ONLY from org_memberships for multi-tenant isolation
    // Goals are org-scoped and should never leak from legacy users collection
    let activeGoal = null;
    
    // Only return goal if we have org context AND org_memberships has goal data
    if (organizationId && orgMembershipData?.goal && orgMembershipData?.goalTargetDate) {
      const progressPercentage = (orgMembershipData.goalProgress as number) ?? 0;
      activeGoal = {
        goal: orgMembershipData.goal,
        targetDate: orgMembershipData.goalTargetDate,
        progress: {
          percentage: progressPercentage,
        },
      };
    }
    // Note: No fallback to userData.goal - this would leak goals across organizations

    // Merge user data with org-specific data
    // IMPORTANT: Goal fields should ONLY come from org_memberships for multi-tenant isolation
    // We explicitly exclude goal fields from userData to prevent cross-org leakage
    const { goal: _legacyGoal, goalTargetDate: _legacyTargetDate, goalProgress: _legacyProgress, goalSetAt: _legacySetAt, goalCompleted: _legacyCompleted, goalCompletedAt: _legacyCompletedAt, goalIsAISuggested: _legacyAISuggested, ...safeUserData } = userData;
    
    const mergedUserData = {
      ...safeUserData,
      // Only include org-scoped goal data if we have org context
      ...(organizationId && orgMembershipData && {
        // Org-specific profile fields (no fallback to userData for goals)
        bio: orgMembershipData.bio || userData.bio,
        identity: orgMembershipData.identity || userData.identity,
        goal: orgMembershipData.goal || null,
        goalTargetDate: orgMembershipData.goalTargetDate || null,
        goalProgress: orgMembershipData.goalProgress ?? null,
        weeklyFocus: orgMembershipData.weeklyFocus,
        onboardingStatus: orgMembershipData.onboardingStatus || userData.onboardingStatus,
        hasCompletedOnboarding: orgMembershipData.hasCompletedOnboarding ?? userData.hasCompletedOnboarding,
      }),
    };

    // Check if org has an enabled onboarding flow for new users
    let orgOnboardingEnabled = false;
    if (organizationId) {
      try {
        const flowSnapshot = await adminDb
          .collection('org_onboarding_flows')
          .where('organizationId', '==', organizationId)
          .where('enabled', '==', true)
          .limit(1)
          .get();
        
        orgOnboardingEnabled = !flowSnapshot.empty;
      } catch (error) {
        console.warn('[USER_ME] Failed to check org onboarding flow:', error);
      }
    }

    return NextResponse.json({
      exists: true,
      user: mergedUserData,
      goal: activeGoal,
      orgOnboardingEnabled,
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

    // When 'name' is provided, also parse and save firstName/lastName
    // This ensures comment author names display correctly
    if (updateData.name && typeof updateData.name === 'string') {
      const nameParts = (updateData.name as string).trim().split(/\s+/);
      updateData.firstName = nameParts[0] || '';
      updateData.lastName = nameParts.slice(1).join(' ') || '';
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

    // Always sync user to Stream Chat after profile update
    // This ensures chat/feed shows updated name and avatar
    try {
      // Get latest Clerk user data for their current imageUrl
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      
      await syncUserToStream(userId, {
        name: updatedUserData.name,
        firstName: clerkUser.firstName || updatedUserData.firstName,
        lastName: clerkUser.lastName || updatedUserData.lastName,
        imageUrl: clerkUser.imageUrl, // Clerk's current profile image
        avatarUrl: updatedUserData.avatarUrl, // Firebase's avatar (if set)
      });
    } catch (streamError) {
      // Non-fatal: log but don't fail the request
      console.error('[USER_ME] Failed to sync to Stream:', streamError);
    }

    return NextResponse.json({
      success: true,
      user: updatedUserData,
    });

  } catch (error) {
    console.error('[USER_UPDATE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

