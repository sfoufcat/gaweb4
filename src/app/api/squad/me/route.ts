import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getSquadStatsWithCache } from '@/lib/squad-alignment';
import type { Squad, SquadMember, SquadStats } from '@/types';

/**
 * GET /api/squad/me
 * Gets the current user's squad(s), members, and optionally stats.
 * 
 * DUAL SQUAD SUPPORT:
 * Premium users can be in both a standard squad and a premium squad.
 * This endpoint returns data for BOTH squads when applicable.
 * 
 * Query params:
 * - includeStats=false: Skip alignment calculations for instant load (default: true)
 * 
 * Response format:
 * {
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
 * NOTE: Coach is EXCLUDED from all alignment calculations - only regular members count.
 */

interface SquadData {
  squad: Squad | null;
  members: SquadMember[];
  stats: SquadStats | null;
}

// Helper function to fetch squad data and members
async function fetchSquadData(
  squadId: string | null | undefined,
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
  const coachId = squadData?.coachId || null;

  // Only fetch stats if requested (for instant load, skip this)
  const squadStats = includeStats 
    ? await getSquadStatsWithCache(squadId, coachId)
    : null;

  const squad: Squad = {
    id: squadDoc.id,
    name: squadData?.name || '',
    avatarUrl: squadData?.avatarUrl || '',
    description: squadData?.description || undefined,
    visibility: squadData?.visibility || 'public',
    timezone: squadData?.timezone || 'UTC',
    memberIds: squadData?.memberIds || [],
    inviteCode: squadData?.inviteCode || undefined,
    isPremium: squadData?.isPremium || false,
    coachId: coachId,
    createdAt: squadData?.createdAt || new Date().toISOString(),
    updatedAt: squadData?.updatedAt || new Date().toISOString(),
    // Stats values - null when includeStats=false (loading state)
    streak: squadStats?.squadStreak ?? null,
    avgAlignment: squadStats?.avgAlignment ?? null,
    chatChannelId: squadData?.chatChannelId || null,
    // Premium squad call fields
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

    // Get user document to find squad IDs
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Get squad IDs - support both new dual fields and legacy squadId
    let standardSquadId = userData?.standardSquadId || null;
    let premiumSquadId = userData?.premiumSquadId || null;
    
    // Fallback: If using legacy squadId, determine which type it is
    if (!standardSquadId && !premiumSquadId && userData?.squadId) {
      const legacySquadDoc = await adminDb.collection('squads').doc(userData.squadId).get();
      if (legacySquadDoc.exists) {
        const legacySquadData = legacySquadDoc.data();
        if (legacySquadData?.isPremium) {
          premiumSquadId = userData.squadId;
        } else {
          standardSquadId = userData.squadId;
        }
      }
    }
    
    // Also check squadMembers collection for any memberships not in user doc
    // This handles edge cases where user doc wasn't updated but membership exists
    if (!standardSquadId || !premiumSquadId) {
      const membershipSnapshot = await adminDb.collection('squadMembers')
        .where('userId', '==', userId)
        .get();
      
      for (const doc of membershipSnapshot.docs) {
        const memberData = doc.data();
        const squadDoc = await adminDb.collection('squads').doc(memberData.squadId).get();
        if (squadDoc.exists) {
          const squadData = squadDoc.data();
          if (squadData?.isPremium && !premiumSquadId) {
            premiumSquadId = memberData.squadId;
          } else if (!squadData?.isPremium && !standardSquadId) {
            standardSquadId = memberData.squadId;
          }
        }
      }
    }

    // If no squad memberships found at all, return empty state
    if (!standardSquadId && !premiumSquadId) {
      return NextResponse.json({
        premiumSquad: null,
        premiumMembers: [],
        premiumStats: null,
        standardSquad: null,
        standardMembers: [],
        standardStats: null,
      });
    }

    // Initialize Clerk client once for both squad fetches
    const clerk = await clerkClient();

    // Fetch both squads in parallel
    const [premiumData, standardData] = await Promise.all([
      fetchSquadData(premiumSquadId, includeStats, clerk),
      fetchSquadData(standardSquadId, includeStats, clerk),
    ]);

    return NextResponse.json({
      premiumSquad: premiumData.squad,
      premiumMembers: premiumData.members,
      premiumStats: premiumData.stats,
      standardSquad: standardData.squad,
      standardMembers: standardData.members,
      standardStats: standardData.stats,
    });
  } catch (error) {
    console.error('[SQUAD_ME_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
