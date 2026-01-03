import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { FirebaseUser } from '@/types';

/**
 * GET /api/user/[userId]
 * Fetches another user's profile data (public information only)
 * 
 * MULTI-TENANCY: Goal data is fetched from org_memberships, not users collection
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // MULTI-TENANCY: Get org context for goal scoping
    const organizationId = await getEffectiveOrgId();

    const { userId: targetUserId } = await params;

    // Fetch user data from Firebase using Admin SDK (profile info only)
    const userRef = adminDb.collection('users').doc(targetUserId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }

    const userData = userDoc.data() as FirebaseUser;

    // Fetch Clerk user for profile image and email fallback
    let clerkImageUrl = '';
    let clerkEmail = '';
    try {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(targetUserId);
      clerkImageUrl = clerkUser.imageUrl || '';
      clerkEmail = clerkUser.emailAddresses[0]?.emailAddress || '';
    } catch (err) {
      console.error('Failed to fetch Clerk user data:', err);
    }

    // MULTI-TENANCY: Extract org-scoped data from org_memberships only
    // Goals, identity, bio are org-scoped to prevent cross-organization data leakage
    let activeGoal = null;
    let orgGoalHistory = null;
    let orgIdentity = userData.identity;
    let orgBio = userData.bio;
    
    if (organizationId) {
      const membershipSnapshot = await adminDb.collection('org_memberships')
        .where('userId', '==', targetUserId)
        .where('organizationId', '==', organizationId)
        .limit(1)
        .get();
      
      if (!membershipSnapshot.empty) {
        const memberData = membershipSnapshot.docs[0].data();
        
        // Extract goal data
        if (memberData?.goal && memberData?.goalTargetDate) {
          const today = new Date();
          const targetDate = new Date(memberData.goalTargetDate);
          const startDate = new Date(memberData.goalSetAt || memberData.createdAt || userData.createdAt);
          
          const totalDays = Math.ceil((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const progressPercentage = totalDays > 0 ? Math.min(Math.round((daysPassed / totalDays) * 100), 100) : 0;

          activeGoal = {
            goal: memberData.goal,
            targetDate: memberData.goalTargetDate,
            progress: {
              percentage: memberData.goalProgress ?? progressPercentage,
            },
          };
        }
        
        // Extract other org-scoped data
        orgGoalHistory = memberData?.goalHistory || null;
        orgIdentity = memberData?.identity || userData.identity;
        orgBio = memberData?.bio || userData.bio;
      }
    }
    // Note: No fallback to userData.goal - this would leak goals across organizations

    // Return public profile data (exclude sensitive information)
    // Use Clerk image as fallback if Firebase doesn't have one
    const profileImageUrl = userData.avatarUrl || userData.imageUrl || clerkImageUrl;
    
    const publicProfile: Partial<FirebaseUser> = {
      id: userData.id,
      firstName: userData.firstName,
      lastName: userData.lastName,
      name: userData.name,
      imageUrl: profileImageUrl,
      avatarUrl: userData.avatarUrl || profileImageUrl,
      location: userData.location,
      profession: userData.profession,
      company: userData.company,
      bio: orgBio,
      interests: userData.interests,
      identity: orgIdentity,
      instagramHandle: userData.instagramHandle,
      linkedinHandle: userData.linkedinHandle,
      twitterHandle: userData.twitterHandle,
      websiteUrl: userData.websiteUrl,
      // Optionally include phone/email based on privacy settings
      // For now, we'll include them if they exist
      // Use Clerk email as fallback if Firebase doesn't have one
      phoneNumber: userData.phoneNumber,
      email: userData.email || clerkEmail,
      // Weekly reflection public focus
      publicFocus: userData.publicFocus,
      publicFocusUpdatedAt: userData.publicFocusUpdatedAt,
      // Goal history for accomplished goals - org-scoped
      goalHistory: orgGoalHistory,
    };

    return NextResponse.json({
      exists: true,
      user: publicProfile,
      goal: activeGoal,
      isOwnProfile: currentUserId === targetUserId,
    });

  } catch (error) {
    console.error('[USER_PROFILE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

