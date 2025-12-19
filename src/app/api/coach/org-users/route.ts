import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { UserRole, UserTier, CoachingStatus } from '@/types';

interface FirebaseUserData {
  tier?: UserTier;
  coaching?: {
    status?: CoachingStatus;
  };
  invitedBy?: string;
  inviteCode?: string;
  invitedAt?: string;
}

interface ClerkUserMetadata {
  role?: UserRole;
  organizationId?: string;
  coaching?: boolean;
  coachingStatus?: CoachingStatus;
}

/**
 * GET /api/coach/org-users
 * Fetches all users belonging to the coach's organization
 * 
 * Uses Clerk's Organization Membership API for proper multi-tenancy.
 * Falls back to publicMetadata filtering for backward compatibility.
 */
export async function GET() {
  try {
    // Check authorization and get organizationId
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_USERS] Fetching users for organization: ${organizationId}`);

    const client = await clerkClient();
    
    // Primary method: Use Clerk's Organization Membership API
    // This gets actual org members (the proper way)
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
      limit: 500,
    });

    // Get user IDs from memberships
    const memberUserIds = memberships.data
      .map(m => m.publicUserData?.userId)
      .filter((id): id is string => !!id);

    // Fetch full user data for members
    let orgUsers: Awaited<ReturnType<typeof client.users.getUserList>>['data'] = [];
    
    if (memberUserIds.length > 0) {
      // Fetch users in batches (Clerk may have limits)
      const { data: users } = await client.users.getUserList({
        userId: memberUserIds,
        limit: 500,
      });
      orgUsers = users;
    }

    // Fallback: Also include users with publicMetadata.organizationId for backward compatibility
    // This catches users who were assigned before the migration
    const { data: allUsers } = await client.users.getUserList({
      limit: 500,
      orderBy: '-created_at',
    });
    
    const metadataOrgUsers = allUsers.filter((user) => {
      const metadata = user.publicMetadata as ClerkUserMetadata;
      return metadata?.organizationId === organizationId && !memberUserIds.includes(user.id);
    });
    
    // Combine both sets (members + metadata-based, deduplicated)
    const combinedUsers = [...orgUsers, ...metadataOrgUsers];

    console.log(`[COACH_ORG_USERS] Found ${combinedUsers.length} users in organization ${organizationId} (${orgUsers.length} members + ${metadataOrgUsers.length} metadata-based)`);

    // Fetch tier, coaching, and referral data from Firebase for org users
    const userIds = combinedUsers.map(u => u.id);
    const firebaseUserData = new Map<string, FirebaseUserData>();
    
    if (userIds.length > 0) {
      // Batch fetch in chunks of 10 (Firestore 'in' query limit)
      for (let i = 0; i < userIds.length; i += 10) {
        const chunk = userIds.slice(i, i + 10);
        const snapshot = await adminDb
          .collection('users')
          .where('__name__', 'in', chunk)
          .get();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          firebaseUserData.set(doc.id, {
            tier: data.tier as UserTier | undefined,
            coaching: data.coaching,
            invitedBy: data.invitedBy,
            inviteCode: data.inviteCode,
            invitedAt: data.invitedAt,
          });
        });
      }
    }

    // Build a map of user IDs to names for inviter lookup
    const userIdToName = new Map<string, string>();
    combinedUsers.forEach((user) => {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User';
      userIdToName.set(user.id, name);
    });

    // Transform to our format
    const transformedUsers = combinedUsers.map((user) => {
      const fbData = firebaseUserData.get(user.id);
      const clerkMetadata = user.publicMetadata as ClerkUserMetadata;
      
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
        tier: fbData?.tier || 'free',
        coachingStatus: clerkMetadata?.coachingStatus || fbData?.coaching?.status || 'none',
        coaching: clerkMetadata?.coaching,
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
      totalCount: transformedUsers.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_USERS_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
