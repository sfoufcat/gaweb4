import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { batchResolveActivity, type ActivityResult } from '@/lib/analytics/activity';
import type { ClientCoachingData, UserRole, FirebaseUser } from '@/types';

interface ClientActivityScore {
  status: 'thriving' | 'active' | 'inactive';
  atRisk: boolean;
  lastActivityAt: string | null;
  daysActiveInPeriod: number;
}

/**
 * GET /api/coaching/clients
 * Fetches all coaching clients for a coach
 * 
 * - For coach: Returns only clients where coachId === currentUser.id
 * - For admin/super_admin: Returns ALL coaching clients
 * - Now includes activity scores for each client
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get role from session claims
    const role = (sessionClaims?.publicMetadata as { role?: UserRole })?.role;

    // Check if user can access coach dashboard
    if (!canAccessCoachDashboard(role)) {
      return NextResponse.json({ error: 'Coach, Admin, or Super Admin access required' }, { status: 403 });
    }

    // Get organization ID for activity score calculation
    const organizationId = await getEffectiveOrgId();

    let clientsQuery;

    if (role === 'coach') {
      // Coach: only fetch clients assigned to them
      clientsQuery = adminDb.collection('clientCoachingData').where('coachId', '==', userId);
    } else {
      // Admin/Super Admin: fetch all coaching clients
      clientsQuery = adminDb.collection('clientCoachingData');
    }

    const clientsSnapshot = await clientsQuery.get();
    const clients: (Omit<ClientCoachingData, 'privateNotes'> & { 
      user?: Partial<FirebaseUser>;
      activityScore?: ClientActivityScore;
    })[] = [];

    // Fetch user details for each client
    const userIds = clientsSnapshot.docs.map(doc => doc.data().userId);
    const userDocs = await Promise.all(
      userIds.map(id => adminDb.collection('users').doc(id).get())
    );

    const userMap = new Map<string, Partial<FirebaseUser>>();
    userDocs.forEach(doc => {
      if (doc.exists) {
        const userData = doc.data() as FirebaseUser;
        userMap.set(doc.id, {
          id: doc.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          imageUrl: userData.imageUrl,
          timezone: userData.timezone,
        });
      }
    });

    // Fetch activity scores for all clients in batch
    let activityMap = new Map<string, ActivityResult>();
    if (organizationId && userIds.length > 0) {
      try {
        activityMap = await batchResolveActivity(organizationId, userIds);
      } catch (err) {
        console.warn('[COACHING_CLIENTS] Failed to fetch activity scores:', err);
      }
    }

    clientsSnapshot.forEach((doc) => {
      // Use destructuring to exclude privateNotes from the response
      const rawData = { id: doc.id, ...doc.data() } as ClientCoachingData;
      const { privateNotes: _notes, ...data } = rawData;
      
      // Get activity score for this client
      const activityResult = activityMap.get(data.userId);
      const activityScore: ClientActivityScore | undefined = activityResult ? {
        status: activityResult.status,
        atRisk: activityResult.atRisk,
        lastActivityAt: activityResult.activitySignals.lastActivityAt?.toISOString() || null,
        daysActiveInPeriod: activityResult.activitySignals.daysActiveInPeriod,
      } : undefined;
      
      clients.push({
        ...data,
        user: userMap.get(data.userId),
        activityScore,
      } as Omit<ClientCoachingData, 'privateNotes'> & { 
        user?: Partial<FirebaseUser>;
        activityScore?: ClientActivityScore;
      });
    });

    // Sort by activity status first (at-risk and inactive first), then by start date
    clients.sort((a, b) => {
      // Priority order: at-risk > inactive > active > thriving
      const getPriority = (client: typeof clients[0]) => {
        if (client.activityScore?.atRisk) return 0;
        if (client.activityScore?.status === 'inactive') return 1;
        if (client.activityScore?.status === 'active') return 2;
        if (client.activityScore?.status === 'thriving') return 3;
        return 4; // No activity data
      };
      
      const priorityDiff = getPriority(a) - getPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Within same priority, sort by start date (newest first)
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('[COACHING_CLIENTS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}









