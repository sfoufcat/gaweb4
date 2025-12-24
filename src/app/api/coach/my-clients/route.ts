import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { ClerkPublicMetadata, OrgRole, CoachingStatus } from '@/types';

interface MyClient {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  coachingStatus: CoachingStatus;
  coachId: string | null;
  coachName: string | null;
  createdAt: string;
}

/**
 * GET /api/coach/my-clients
 * Fetches clients for an org coach:
 * - Users where coachId === currentUserId (1:1 coaching clients) - from Clerk publicMetadata
 * - Members of squads where the current user is the coach - from Firebase (relationship data)
 * 
 * All user data (coachingStatus, coachId, tier, etc.) comes from Clerk publicMetadata.
 * Only squad membership (relationship data) comes from Firebase.
 * 
 * Returns limited fields for read-only display
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get role and orgRole from session claims
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole as OrgRole | undefined;
    const organizationId = publicMetadata?.organizationId;

    // Check if user can access coach dashboard
    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    console.log(`[MY_CLIENTS] Fetching clients for coach: ${userId}`);

    const squadMemberUserIds = new Set<string>();
    const client = await clerkClient();

    // 1. Get squads where this user is the coach (relationship data from Firebase)
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('coachId', '==', userId)
      .get();

    const squadIds = squadsSnapshot.docs.map(doc => doc.id);
    console.log(`[MY_CLIENTS] Found ${squadIds.length} squads for coach ${userId}`);

    // 2. Get all members of those squads (relationship data from Firebase)
    if (squadIds.length > 0) {
      // Batch in chunks of 10 (Firestore 'in' query limit)
      for (let i = 0; i < squadIds.length; i += 10) {
        const chunk = squadIds.slice(i, i + 10);
        const membersSnapshot = await adminDb
          .collection('squadMembers')
          .where('squadId', 'in', chunk)
          .get();
        
        membersSnapshot.forEach((doc) => {
          const data = doc.data();
          // Don't include the coach themselves
          if (data.userId !== userId) {
            squadMemberUserIds.add(data.userId);
          }
        });
      }
    }

    // 3. Get current coach's name for display
    const currentCoach = await client.users.getUser(userId);
    const currentCoachName = `${currentCoach.firstName || ''} ${currentCoach.lastName || ''}`.trim() || 'Unknown';

    // 4. Fetch all users - either from org or by specific IDs
    // We need to find 1:1 coaching clients (coachId in Clerk metadata) + squad members
    let allClerkUsers: Awaited<ReturnType<typeof client.users.getUserList>>['data'] = [];
    
    if (organizationId) {
      // For org coaches, fetch all org members and filter
      const orgMembers = await client.organizations.getOrganizationMembershipList({
        organizationId,
        limit: 500,
      });
      
      const orgUserIds = orgMembers.data.map(m => m.publicUserData?.userId).filter(Boolean) as string[];
      const { data } = await client.users.getUserList({
        userId: orgUserIds,
        limit: 500,
      });
      allClerkUsers = data;
    } else if (squadMemberUserIds.size > 0) {
      // Fallback: just fetch squad members
      const { data } = await client.users.getUserList({
        userId: Array.from(squadMemberUserIds),
        limit: 500,
      });
      allClerkUsers = data;
    } else {
      allClerkUsers = [];
    }

    // 5. Filter and build client list - include users who:
    //    - Are in the coach's squads (squadMemberUserIds), OR
    //    - Have coachId === currentUserId in their Clerk publicMetadata (1:1 coaching)
    const users: MyClient[] = allClerkUsers
      .filter((user) => {
        if (user.id === userId) return false; // Exclude self
        const userMetadata = user.publicMetadata as ClerkPublicMetadata;
        const isSquadMember = squadMemberUserIds.has(user.id);
        const is1on1Client = userMetadata?.coachId === userId;
        return isSquadMember || is1on1Client;
      })
      .map((user) => {
        const clerkMetadata = user.publicMetadata as ClerkPublicMetadata;
        const userCoachId = clerkMetadata?.coachId || null;
        
        return {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User',
          imageUrl: user.imageUrl || '',
          coachingStatus: clerkMetadata?.coachingStatus || 'none',
          coachId: userCoachId,
          coachName: userCoachId === userId ? currentCoachName : null,
          createdAt: new Date(user.createdAt).toISOString(),
        };
      });

    console.log(`[MY_CLIENTS] Found ${users.length} unique clients for coach ${userId}`);

    // Sort by name
    users.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ 
      users,
      totalCount: users.length,
    });
  } catch (error) {
    console.error('[MY_CLIENTS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}


