import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { ClientCoachingData, UserRole, FirebaseUser } from '@/types';

interface ClientActivityScore {
  status: 'thriving' | 'active' | 'inactive';
  atRisk: boolean;
  lastActivityAt: string | null;
  daysActiveInPeriod: number;
}

interface ClientResponse extends Omit<ClientCoachingData, 'privateNotes'> {
  user?: Partial<FirebaseUser>;
  activityScore?: ClientActivityScore;
}

/**
 * GET /api/coaching/clients
 * Fetches coaching clients for a coach with optimized data loading.
 *
 * Query params:
 * - limit: Number of clients to return (default: 50, max: 100)
 * - cursor: Pagination cursor (startDate of last item)
 * - status: Filter by activity status ('thriving' | 'active' | 'inactive' | 'at-risk')
 *
 * Performance optimizations:
 * 1. Uses denormalized data from clientCoachingData when available
 * 2. Falls back to fetching from users/org_memberships only for uncached clients
 * 3. Supports cursor-based pagination for large client lists
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (sessionClaims?.publicMetadata as { role?: UserRole })?.role;

    if (!canAccessCoachDashboard(role)) {
      return NextResponse.json({ error: 'Coach, Admin, or Super Admin access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    const { searchParams } = new URL(request.url);

    // Pagination params
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const cursor = searchParams.get('cursor');
    const statusFilter = searchParams.get('status') as 'thriving' | 'active' | 'inactive' | 'at-risk' | null;

    // Build base query
    let clientsQuery: FirebaseFirestore.Query = adminDb.collection('clientCoachingData');

    if (role === 'coach') {
      clientsQuery = clientsQuery.where('coachId', '==', userId);
    }

    // Add organization filter if available
    if (organizationId) {
      clientsQuery = clientsQuery.where('organizationId', '==', organizationId);
    }

    // Order by startDate for consistent pagination
    clientsQuery = clientsQuery.orderBy('startDate', 'desc');

    // Apply cursor for pagination
    if (cursor) {
      clientsQuery = clientsQuery.startAfter(cursor);
    }

    // Fetch one extra to determine if there's a next page
    clientsQuery = clientsQuery.limit(limit + 1);

    const clientsSnapshot = await clientsQuery.get();
    const hasNextPage = clientsSnapshot.docs.length > limit;
    const docs = hasNextPage ? clientsSnapshot.docs.slice(0, limit) : clientsSnapshot.docs;

    // Separate clients into those with cached data and those without
    const clientsWithCache: ClientResponse[] = [];
    const clientsMissingUserData: string[] = []; // userIds that need fetching
    const clientsMissingActivityData: string[] = [];

    for (const doc of docs) {
      const rawData = { id: doc.id, ...doc.data() } as ClientCoachingData;
      const { privateNotes: _notes, ...data } = rawData;

      // Check if we have cached user data
      const hasCachedUser = data.cachedUserFirstName || data.cachedUserEmail;
      const hasCachedActivity = data.cachedActivityStatus !== undefined;

      // Build user object from cached data or mark for fetching
      let user: Partial<FirebaseUser> | undefined;
      if (hasCachedUser) {
        user = {
          id: data.userId,
          firstName: data.cachedUserFirstName || '',
          lastName: data.cachedUserLastName || '',
          email: data.cachedUserEmail || '',
          imageUrl: data.cachedUserImageUrl || '',
          timezone: data.cachedUserTimezone,
        };
      } else {
        clientsMissingUserData.push(data.userId);
      }

      // Build activity score from cached data or mark for fetching
      let activityScore: ClientActivityScore | undefined;
      if (hasCachedActivity) {
        activityScore = {
          status: data.cachedActivityStatus!,
          atRisk: data.cachedActivityAtRisk ?? false,
          lastActivityAt: data.cachedActivityLastAt || null,
          daysActiveInPeriod: data.cachedActivityDaysActive ?? 0,
        };
      } else {
        clientsMissingActivityData.push(data.userId);
      }

      clientsWithCache.push({
        ...data,
        user,
        activityScore,
      });
    }

    // Fetch missing user data in parallel (only for uncached clients)
    if (clientsMissingUserData.length > 0) {
      const userDocs = await Promise.all(
        clientsMissingUserData.map(id => adminDb.collection('users').doc(id).get())
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

      // Update clients with fetched user data
      for (const client of clientsWithCache) {
        if (!client.user && userMap.has(client.userId)) {
          client.user = userMap.get(client.userId);
        }
      }
    }

    // Fetch missing activity data from org_memberships (only for uncached clients)
    if (clientsMissingActivityData.length > 0 && organizationId) {
      try {
        const BATCH_SIZE = 30;
        const activityMap = new Map<string, ClientActivityScore>();

        for (let i = 0; i < clientsMissingActivityData.length; i += BATCH_SIZE) {
          const batch = clientsMissingActivityData.slice(i, i + BATCH_SIZE);
          const snapshot = await adminDb.collection('org_memberships')
            .where('organizationId', '==', organizationId)
            .where('userId', 'in', batch)
            .select('userId', 'activityStatus', 'atRisk', 'lastActivityAt', 'daysActiveInPeriod')
            .get();

          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.activityStatus) {
              activityMap.set(data.userId, {
                status: data.activityStatus,
                atRisk: data.atRisk ?? false,
                lastActivityAt: data.lastActivityAt || null,
                daysActiveInPeriod: data.daysActiveInPeriod ?? 0,
              });
            }
          });
        }

        // Update clients with fetched activity data
        for (const client of clientsWithCache) {
          if (!client.activityScore && activityMap.has(client.userId)) {
            client.activityScore = activityMap.get(client.userId);
          }
        }
      } catch (err) {
        console.warn('[COACHING_CLIENTS] Failed to fetch activity scores:', err);
      }
    }

    // Apply status filter if specified (post-fetch filter for flexibility)
    let filteredClients = clientsWithCache;
    if (statusFilter) {
      filteredClients = clientsWithCache.filter(client => {
        if (statusFilter === 'at-risk') {
          return client.activityScore?.atRisk === true;
        }
        return client.activityScore?.status === statusFilter;
      });
    }

    // Sort by activity status (at-risk and inactive first), then by start date
    filteredClients.sort((a, b) => {
      const getPriority = (client: ClientResponse) => {
        if (client.activityScore?.atRisk) return 0;
        if (client.activityScore?.status === 'inactive') return 1;
        if (client.activityScore?.status === 'active') return 2;
        if (client.activityScore?.status === 'thriving') return 3;
        return 4;
      };

      const priorityDiff = getPriority(a) - getPriority(b);
      if (priorityDiff !== 0) return priorityDiff;

      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

    // Get next cursor for pagination
    const nextCursor = hasNextPage && docs.length > 0
      ? docs[docs.length - 1].data().startDate
      : null;

    return NextResponse.json({
      clients: filteredClients,
      pagination: {
        hasNextPage,
        nextCursor,
        total: clientsSnapshot.size - (hasNextPage ? 1 : 0),
      },
    });
  } catch (error) {
    console.error('[COACHING_CLIENTS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
