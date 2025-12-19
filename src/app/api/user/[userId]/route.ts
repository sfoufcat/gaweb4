import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { FirebaseUser } from '@/types';

/**
 * GET /api/user/[userId]
 * Fetches another user's profile data (public information only)
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

    const { userId: targetUserId } = await params;

    // Fetch user data from Firebase using Admin SDK
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

    // Extract goal data
    let activeGoal = null;
    if (userData.goal && userData.goalTargetDate) {
      const today = new Date();
      const targetDate = new Date(userData.goalTargetDate);
      const startDate = new Date(userData.goalSetAt || userData.createdAt);
      
      const totalDays = Math.ceil((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const progressPercentage = totalDays > 0 ? Math.min(Math.round((daysPassed / totalDays) * 100), 100) : 0;

      activeGoal = {
        goal: userData.goal,
        targetDate: userData.goalTargetDate,
        progress: {
          percentage: progressPercentage,
        },
      };
    }

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
      bio: userData.bio,
      interests: userData.interests,
      identity: userData.identity,
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
      // Goal history for accomplished goals
      goalHistory: userData.goalHistory,
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

