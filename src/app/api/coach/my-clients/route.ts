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
 * - Users where coachId === currentUserId (1:1 coaching clients)
 * - Members of squads where the current user is the coach
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

    // Check if user can access coach dashboard
    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    console.log(`[MY_CLIENTS] Fetching clients for coach: ${userId}`);

    const clientUserIds = new Set<string>();
    const client = await clerkClient();

    // 1. Get squads where this user is the coach
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('coachId', '==', userId)
      .get();

    const squadIds = squadsSnapshot.docs.map(doc => doc.id);
    console.log(`[MY_CLIENTS] Found ${squadIds.length} squads for coach ${userId}`);

    // 2. Get all members of those squads
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
            clientUserIds.add(data.userId);
          }
        });
      }
    }

    // 3. Get users where coachId === userId (1:1 coaching clients)
    const coachingClientsSnapshot = await adminDb
      .collection('users')
      .where('coachId', '==', userId)
      .get();
    
    coachingClientsSnapshot.forEach((doc) => {
      clientUserIds.add(doc.id);
    });

    console.log(`[MY_CLIENTS] Found ${clientUserIds.size} unique clients for coach ${userId}`);

    if (clientUserIds.size === 0) {
      return NextResponse.json({ 
        users: [],
        totalCount: 0,
      });
    }

    // 4. Fetch user details from Clerk
    const userIdsArray = Array.from(clientUserIds);
    const { data: clerkUsers } = await client.users.getUserList({
      userId: userIdsArray,
      limit: 500,
    });

    // 5. Fetch Firebase data for coaching status and coachId
    const firebaseData = new Map<string, { coachingStatus?: CoachingStatus; coachId?: string }>();
    
    // Batch fetch in chunks of 10
    for (let i = 0; i < userIdsArray.length; i += 10) {
      const chunk = userIdsArray.slice(i, i + 10);
      const snapshot = await adminDb
        .collection('users')
        .where('__name__', 'in', chunk)
        .get();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        firebaseData.set(doc.id, {
          coachingStatus: data.coaching?.status || 'none',
          coachId: data.coachId || null,
        });
      });
    }

    // 6. Get current coach's name for display
    const currentCoach = await client.users.getUser(userId);
    const currentCoachName = `${currentCoach.firstName || ''} ${currentCoach.lastName || ''}`.trim() || 'Unknown';

    // 7. Build client list with limited fields
    const users: MyClient[] = clerkUsers.map((user) => {
      const fbData = firebaseData.get(user.id);
      const clerkMetadata = user.publicMetadata as ClerkPublicMetadata;
      
      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User',
        imageUrl: user.imageUrl || '',
        coachingStatus: clerkMetadata?.coachingStatus || fbData?.coachingStatus || 'none',
        coachId: fbData?.coachId || null,
        coachName: fbData?.coachId === userId ? currentCoachName : null,
        createdAt: new Date(user.createdAt).toISOString(),
      };
    });

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
