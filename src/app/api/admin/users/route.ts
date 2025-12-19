import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/admin-utils-clerk';
import type { UserRole, UserTier, CoachingStatus } from '@/types';

interface FirebaseUserData {
  tier?: UserTier;
  coaching?: {
    status?: CoachingStatus;
  };
  // Referral tracking fields
  invitedBy?: string;
  inviteCode?: string;
  invitedAt?: string;
}

/**
 * GET /api/admin/users
 * Fetches all users from Clerk with tier and coaching data from Firebase (admin/super_admin only)
 */
export async function GET() {
  try {
    // Check authorization (throws if not admin)
    await requireAdmin();

    // Fetch all users from Clerk
    const client = await clerkClient();
    const { data: users, totalCount } = await client.users.getUserList({
      limit: 500, // Adjust as needed
      orderBy: '-created_at',
    });

    // Fetch tier, coaching, and referral data from Firebase for all users
    const firebaseUsersSnapshot = await adminDb.collection('users').get();
    const firebaseUserData = new Map<string, FirebaseUserData>();
    
    firebaseUsersSnapshot.forEach((doc) => {
      const data = doc.data();
      firebaseUserData.set(doc.id, {
        tier: data.tier as UserTier | undefined,
        coaching: data.coaching,
        invitedBy: data.invitedBy,
        inviteCode: data.inviteCode,
        invitedAt: data.invitedAt,
      });
    });

    // Build a map of user IDs to names for inviter lookup
    const userIdToName = new Map<string, string>();
    users.forEach((user) => {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User';
      userIdToName.set(user.id, name);
    });

    // Transform Clerk users to our format with tier, coaching, and referral data from Firebase + Clerk metadata
    const transformedUsers = users.map((user) => {
      const fbData = firebaseUserData.get(user.id);
      const clerkMetadata = user.publicMetadata as { 
        role?: UserRole; 
        coaching?: boolean;
        coachingStatus?: CoachingStatus;
      } | undefined;
      
      // Look up inviter name if user was invited
      const invitedByName = fbData?.invitedBy 
        ? userIdToName.get(fbData.invitedBy) || 'Unknown User'
        : null;
      
      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User',
        imageUrl: user.imageUrl || '',
        role: (clerkMetadata?.role as UserRole) || 'user',
        // Membership tier (not coaching - that's separate)
        tier: fbData?.tier || 'free',
        // Coaching status from new field (Clerk or Firebase), fallback to legacy flag
        coachingStatus: clerkMetadata?.coachingStatus || fbData?.coaching?.status || 'none',
        // Legacy coaching flag (for backward compatibility)
        coaching: clerkMetadata?.coaching,
        // Referral tracking
        invitedBy: fbData?.invitedBy || null,
        invitedByName,
        inviteCode: fbData?.inviteCode || null,
        invitedAt: fbData?.invitedAt || null,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString(),
      };
    });

    return NextResponse.json({ 
      users: transformedUsers,
      totalCount 
    });
  } catch (error) {
    console.error('[ADMIN_USERS_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}
