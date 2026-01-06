import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getSquadStatsWithCache } from '@/lib/squad-alignment';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import type { Squad, SquadMember, SquadStats } from '@/types';

// Discovery squad type (matches SquadDiscoveryCard expectations)
interface DiscoverySquad {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  coachId?: string;
  coachName?: string;
  coachImageUrl?: string;
  memberCount: number;
  memberAvatars: string[];
  priceInCents?: number;
  subscriptionEnabled?: boolean;
  billingInterval?: string;
  visibility?: string;
}

/**
 * GET /api/squad/me
 * Gets the current user's squad(s), members, and optionally stats.
 * 
 * MULTI-TENANCY: Only returns squads that belong to the user's current organization.
 * Squads from other tenants are filtered out to prevent cross-tenant data leakage.
 * 
 * MULTI-SQUAD SUPPORT:
 * Users can be in multiple squads (e.g., program squad + standalone squad).
 * This endpoint returns data for ALL squads the user is in.
 * 
 * Query params:
 * - includeStats=false: Skip alignment calculations for instant load (default: true)
 * 
 * Response format:
 * {
 *   squads: Array<{
 *     squad: Squad,
 *     members: SquadMember[],
 *     stats: SquadStats | null,
 *   }>,
 *   // Legacy format for backward compatibility (first coach squad + first non-coach squad)
 *   premiumSquad: Squad | null,
 *   premiumMembers: SquadMember[],
 *   premiumStats: SquadStats | null,
 *   standardSquad: Squad | null,
 *   standardMembers: SquadMember[],
 *   standardStats: SquadStats | null,
 * }
 * 
 * PERFORMANCE OPTIMIZED:
 * - When includeStats=false: Only hits squads + squadMembers collections (very fast)
 * - When includeStats=true: Also fetches alignment data for members and squad
 * 
 * For expensive stats (percentile, contribution history), use /api/squad/stats endpoint.
 * 
 * NOTE: Coach and super_coach are EXCLUDED from all alignment calculations - only regular members count.
 */

interface SquadData {
  squad: Squad | null;
  members: SquadMember[];
  stats: SquadStats | null;
}

/**
 * Helper function to fetch discoverable squads (for users with no squads)
 * This is a simplified version of /api/squad/discover that returns essential data
 */
async function fetchDiscoverySquads(organizationId: string): Promise<DiscoverySquad[]> {
  try {
    const squadsSnapshot = await adminDb.collection('squads')
      .where('visibility', '==', 'public')
      .where('organizationId', '==', organizationId)
      .get();

    const discoverySquads: DiscoverySquad[] = [];

    for (const doc of squadsSnapshot.docs) {
      const data = doc.data() as Squad;

      // Get member count
      const membersSnapshot = await adminDb.collection('squadMembers')
        .where('squadId', '==', doc.id)
        .get();

      // Filter out coach from count
      const nonCoachMembers = membersSnapshot.docs.filter(
        memberDoc => memberDoc.data().userId !== data.coachId
      );
      const memberCount = nonCoachMembers.length;

      // Skip full squads
      if (memberCount >= MAX_SQUAD_MEMBERS) continue;

      // Get first 3 member avatars
      const memberAvatars: string[] = [];
      const memberDocs = nonCoachMembers.slice(0, 3);
      for (const memberDoc of memberDocs) {
        const memberData = memberDoc.data();
        if (memberData.imageUrl) {
          memberAvatars.push(memberData.imageUrl);
        } else if (memberData.userId) {
          const userDoc = await adminDb.collection('users').doc(memberData.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            memberAvatars.push(userData?.avatarUrl || userData?.imageUrl || '');
          }
        }
      }

      // Get coach info if has coach
      let coachName: string | undefined;
      let coachImageUrl: string | undefined;
      if (data.coachId) {
        const coachDoc = await adminDb.collection('users').doc(data.coachId).get();
        if (coachDoc.exists) {
          const coachData = coachDoc.data();
          coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || 'Coach';
          coachImageUrl = coachData?.avatarUrl || coachData?.imageUrl || '';
        }
      }

      discoverySquads.push({
        id: doc.id,
        name: data.name || '',
        description: data.description,
        avatarUrl: data.avatarUrl,
        coachId: data.coachId || undefined,
        coachName,
        coachImageUrl,
        memberCount,
        memberAvatars: memberAvatars.filter(Boolean),
        priceInCents: data.priceInCents,
        subscriptionEnabled: data.subscriptionEnabled,
        billingInterval: data.billingInterval,
        visibility: data.visibility,
      });
    }

    // Sort by member count (most popular first)
    return discoverySquads.sort((a, b) => b.memberCount - a.memberCount);
  } catch (error) {
    console.error('[SQUAD_ME] Error fetching discovery squads:', error);
    return [];
  }
}

/**
 * Helper function to fetch squad data and members
 * 
 * @param squadId - The squad ID to fetch
 * @param currentUserId - The current user's ID to verify membership
 * @param userOrgId - User's current organization ID for multi-tenancy filtering
 * @param includeStats - Whether to include alignment stats
 * @param clerk - Clerk client instance
 */
async function fetchSquadData(
  squadId: string | null | undefined,
  currentUserId: string,
  userOrgId: string | null,
  includeStats: boolean,
  clerk: Awaited<ReturnType<typeof clerkClient>>
): Promise<SquadData> {
  if (!squadId) {
    return { squad: null, members: [], stats: null };
  }

  // Fetch the squad document
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  
  if (!squadDoc.exists) {
    return { squad: null, members: [], stats: null };
  }

  const squadData = squadDoc.data();
  
  // MEMBERSHIP VERIFICATION (defense in depth):
  // Verify user is actually a member of this squad via squadMembers collection.
  // This prevents stale data if user document wasn't properly updated when removed.
  const membershipCheck = await adminDb.collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', currentUserId)
    .limit(1)
    .get();
  
  if (membershipCheck.empty) {
    console.log(`[SQUAD_ME] User ${currentUserId} not in squadMembers for squad ${squadId} - filtering out stale reference`);
    return { squad: null, members: [], stats: null };
  }
  
  // MULTI-TENANCY CHECK: Only return squad if it belongs to user's current organization
  const squadOrgId = squadData?.organizationId || null;
  
  // Case 1: Squad has an org, user has an org, but they don't match - filter out
  if (squadOrgId && userOrgId && squadOrgId !== userOrgId) {
    console.log(`[SQUAD_ME] Filtering out squad ${squadId} (org: ${squadOrgId}) - user org: ${userOrgId}`);
    return { squad: null, members: [], stats: null };
  }
  
  // Case 2: User has no org context (platform mode) but squad belongs to an org - filter out
  // This prevents cross-tenant data leakage when on platform domain
  if (!userOrgId && squadOrgId) {
    console.log(`[SQUAD_ME] Filtering out squad ${squadId} (org: ${squadOrgId}) - user has no org context (platform mode)`);
    return { squad: null, members: [], stats: null };
  }
  
  // Case 3: Squad has no org but user is in tenant mode - filter out
  // All squads should belong to an organization in multi-tenant mode
  if (userOrgId && !squadOrgId) {
    console.log(`[SQUAD_ME] Filtering out squad ${squadId} (no org) - user is in tenant mode (${userOrgId})`);
    return { squad: null, members: [], stats: null };
  }
  
  const coachId = squadData?.coachId || null;

  // Only fetch stats if requested (for instant load, skip this)
  const squadStats = includeStats 
    ? await getSquadStatsWithCache(squadId, coachId)
    : null;

  const hasCoach = !!coachId;
  
  const squad: Squad = {
    id: squadDoc.id,
    name: squadData?.name || '',
    avatarUrl: squadData?.avatarUrl || '',
    description: squadData?.description || undefined,
    visibility: squadData?.visibility || 'public',
    timezone: squadData?.timezone || 'UTC',
    memberIds: squadData?.memberIds || [],
    inviteCode: squadData?.inviteCode || undefined,
    hasCoach: hasCoach,
    coachId: coachId,
    organizationId: squadOrgId || undefined,
    createdAt: squadData?.createdAt || new Date().toISOString(),
    updatedAt: squadData?.updatedAt || new Date().toISOString(),
    // Stats values - null when includeStats=false (loading state)
    streak: squadStats?.squadStreak ?? null,
    avgAlignment: squadStats?.avgAlignment ?? null,
    chatChannelId: squadData?.chatChannelId || `squad-${squadDoc.id}`,
    // Program association (null = standalone squad, not attached to any program)
    programId: squadData?.programId || null,
    cohortId: squadData?.cohortId || null,
    // Coach-scheduled call fields (only used when hasCoach: true)
    nextCallDateTime: squadData?.nextCallDateTime || null,
    nextCallTimezone: squadData?.nextCallTimezone || null,
    nextCallLocation: squadData?.nextCallLocation || null,
    nextCallTitle: squadData?.nextCallTitle || null,
  };

  // Fetch all members of this squad
  const membersSnapshot = await adminDb.collection('squadMembers')
    .where('squadId', '==', squadId)
    .get();

  const members: SquadMember[] = [];
  
  for (const doc of membersSnapshot.docs) {
    const memberData = doc.data();
    
    // Fetch user details from Clerk (source of truth for user identity)
    let firstName = '';
    let lastName = '';
    let imageUrl = '';
    
    try {
      const clerkUser = await clerk.users.getUser(memberData.userId);
      firstName = clerkUser.firstName || '';
      lastName = clerkUser.lastName || '';
      imageUrl = clerkUser.imageUrl || '';
    } catch (err) {
      console.error(`Failed to fetch Clerk user ${memberData.userId}:`, err);
      // Fallback to Firebase data if Clerk fails
      const userDoc = await adminDb.collection('users').doc(memberData.userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      firstName = userData?.firstName || '';
      lastName = userData?.lastName || '';
      imageUrl = userData?.avatarUrl || userData?.imageUrl || '';
    }

    // Determine if this member is the coach (based on squad.coachId)
    const isCoach = coachId === memberData.userId;
    
    // Get alignment data for this member (null when includeStats=false for loading state)
    let alignmentScore: number | null = null;
    let streak: number | null = null;
    
    if (squadStats) {
      const memberAlignment = squadStats.memberAlignments.get(memberData.userId);
      alignmentScore = memberAlignment?.alignmentScore ?? 0;
      streak = memberAlignment?.currentStreak ?? 0;
    }

    members.push({
      id: doc.id,
      squadId: memberData.squadId,
      userId: memberData.userId,
      roleInSquad: isCoach ? 'coach' : (memberData.roleInSquad || 'member'),
      firstName,
      lastName,
      imageUrl,
      // Alignment data - null when includeStats=false (shows loading skeleton)
      alignmentScore,
      streak,
      // Deprecated - no longer using mood state, using alignment instead
      moodState: null,
      createdAt: memberData.createdAt || new Date().toISOString(),
      updatedAt: memberData.updatedAt || new Date().toISOString(),
    });
  }

  // Sort: coach first, then REGULAR MEMBERS by alignment score (descending), then streak, then name
  members.sort((a, b) => {
    // Coach always first
    if (a.roleInSquad === 'coach') return -1;
    if (b.roleInSquad === 'coach') return 1;
    
    // If stats not loaded, sort alphabetically only
    if (!squadStats) {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    }
    
    // Then by alignment score (descending)
    const scoreDiff = (b.alignmentScore || 0) - (a.alignmentScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    // Then by streak (descending)
    const streakDiff = (b.streak || 0) - (a.streak || 0);
    if (streakDiff !== 0) return streakDiff;
    // Then by name alphabetically
    const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
    const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Build stats object - null when includeStats=false
  const stats: SquadStats | null = squadStats ? {
    avgAlignment: squadStats.avgAlignment,
    alignmentChange: squadStats.alignmentChange,
    topPercentile: 0, // Loaded separately via /api/squad/stats
    contributionHistory: [], // Loaded separately via /api/squad/stats
  } : null;

  return { squad, members, stats };
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('includeStats') !== 'false'; // Default to true

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    // In tenant mode (subdomain): uses x-tenant-org-id header from middleware
    // In platform mode: returns null (no tenant context)
    const userOrgId = await getEffectiveOrgId();
    
    // PLATFORM MODE: If no org context, return empty state immediately
    // Squads are tenant-specific - they shouldn't appear on the platform domain
    if (!userOrgId) {
      console.log('[SQUAD_ME] Platform mode (no orgId) - returning empty state');
      return NextResponse.json({
        premiumSquad: null,
        premiumMembers: [],
        premiumStats: null,
        standardSquad: null,
        standardMembers: [],
        standardStats: null,
        isPlatformMode: true,
      });
    }

    // Get user document to find squad IDs
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Get squad IDs - support new squadIds array and legacy fields
    const squadIds: string[] = [];
    
    // First try new squadIds array
    if (userData?.squadIds && Array.isArray(userData.squadIds)) {
      squadIds.push(...userData.squadIds);
    }
    
    // Fallback: Add legacy fields if not already in array
    if (userData?.standardSquadId && !squadIds.includes(userData.standardSquadId)) {
      squadIds.push(userData.standardSquadId);
    }
    if (userData?.premiumSquadId && !squadIds.includes(userData.premiumSquadId)) {
      squadIds.push(userData.premiumSquadId);
    }
    if (userData?.squadId && !squadIds.includes(userData.squadId)) {
      squadIds.push(userData.squadId);
    }
    
    // Also check squadMembers collection for any memberships not in user doc
    // This handles edge cases where user doc wasn't updated but membership exists
    // MULTI-TENANCY: Only find memberships in squads belonging to user's current org
    const membershipSnapshot = await adminDb.collection('squadMembers')
      .where('userId', '==', userId)
      .get();
    
    for (const doc of membershipSnapshot.docs) {
      const memberData = doc.data();
      if (!squadIds.includes(memberData.squadId)) {
        squadIds.push(memberData.squadId);
      }
    }

    // If no squad memberships found at all, return empty state WITH discovery squads
    if (squadIds.length === 0) {
      // Fetch available squads user can join
      const discoverySquads = await fetchDiscoverySquads(userOrgId);

      return NextResponse.json({
        squads: [],
        discoverySquads, // Available squads to join
        // Legacy format for backward compatibility
        premiumSquad: null,
        premiumMembers: [],
        premiumStats: null,
        standardSquad: null,
        standardMembers: [],
        standardStats: null,
      });
    }

    // Initialize Clerk client once for all squad fetches
    const clerk = await clerkClient();

    // Fetch all squads in parallel (with org filtering and membership verification)
    const squadDataPromises = squadIds.map(squadId => 
      fetchSquadData(squadId, userId, userOrgId, includeStats, clerk)
    );
    const allSquadData = await Promise.all(squadDataPromises);
    
    // Filter out null squads (filtered by org or not found)
    const validSquads = allSquadData.filter(data => data.squad !== null);
    
    // For backward compatibility, find first hasCoach squad and first non-hasCoach squad
    const coachSquad = validSquads.find(data => data.squad?.hasCoach);
    const nonCoachSquad = validSquads.find(data => !data.squad?.hasCoach);

    return NextResponse.json({
      // New multi-squad format
      squads: validSquads,
      // Legacy format for backward compatibility
      premiumSquad: coachSquad?.squad || null,
      premiumMembers: coachSquad?.members || [],
      premiumStats: coachSquad?.stats || null,
      standardSquad: nonCoachSquad?.squad || null,
      standardMembers: nonCoachSquad?.members || [],
      standardStats: nonCoachSquad?.stats || null,
    });
  } catch (error) {
    console.error('[SQUAD_ME_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
