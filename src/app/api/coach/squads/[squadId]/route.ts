import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getSquadStatsWithCache, getStatsTabData } from '@/lib/squad-alignment';
import type { Squad, SquadMember, SquadStats, UserRole } from '@/types';

/**
 * GET /api/coach/squads/[squadId]
 * Fetches a specific squad with members and stats for the Coach Dashboard
 * 
 * Authorization:
 * - coach: Can only access squads where coachId === currentUser.id
 * - admin/super_admin: Can access any squad
 * 
 * Returns real alignment data based on UserAlignment docs.
 * NOTE: Coach is EXCLUDED from all alignment calculations - only regular members count.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { squadId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get role from session claims
    const role = (sessionClaims?.publicMetadata as any)?.role as UserRole;

    // Check if user can access coach dashboard
    if (!canAccessCoachDashboard(role)) {
      return new NextResponse('Forbidden - Coach, Admin, or Super Admin access required', { status: 403 });
    }

    // Fetch the squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();

    if (!squadDoc.exists) {
      return new NextResponse('Squad not found', { status: 404 });
    }

    const squadData = squadDoc.data();
    const coachId = squadData?.coachId || null;

    // Authorization check for coaches (do this early before fetching stats)
    if (role === 'coach' && coachId !== userId) {
      return new NextResponse('Forbidden - You are not the coach of this squad', { status: 403 });
    }

    // Get squad stats - cached stats fast, extras loaded in parallel
    const [basicStats, extraStats] = await Promise.all([
      getSquadStatsWithCache(squadId, coachId),
      getStatsTabData(squadId),
    ]);

    const squad: Squad = {
      id: squadDoc.id,
      name: squadData?.name || '',
      avatarUrl: squadData?.avatarUrl || '',
      isPremium: squadData?.isPremium || false,
      coachId: coachId,
      createdAt: squadData?.createdAt || new Date().toISOString(),
      updatedAt: squadData?.updatedAt || new Date().toISOString(),
      // Real computed values
      streak: basicStats.squadStreak,
      avgAlignment: basicStats.avgAlignment,
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
    const clerk = await clerkClient();

    for (const doc of membersSnapshot.docs) {
      const memberData = doc.data();

      // Fetch user details from Clerk
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
      
      // Get real alignment data for this member
      const memberAlignment = basicStats.memberAlignments.get(memberData.userId);
      const alignmentScore = memberAlignment?.alignmentScore ?? 0;
      const streak = memberAlignment?.currentStreak ?? 0;

      members.push({
        id: doc.id,
        squadId: memberData.squadId,
        userId: memberData.userId,
        roleInSquad: isCoach ? 'coach' : (memberData.roleInSquad || 'member'),
        firstName,
        lastName,
        imageUrl,
        // Real alignment data from UserAlignment docs
        alignmentScore,
        streak,
        // Deprecated - no longer using mood state
        moodState: null,
        createdAt: memberData.createdAt || new Date().toISOString(),
        updatedAt: memberData.updatedAt || new Date().toISOString(),
      });
    }

    // Sort: coach first, then REGULAR MEMBERS by alignment score (descending)
    // Note: Coach does NOT influence the sorting formula for members
    members.sort((a, b) => {
      // Coach always first (but doesn't participate in alignment-based sorting)
      if (a.roleInSquad === 'coach') return -1;
      if (b.roleInSquad === 'coach') return 1;
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

    // Build stats object with real computed values
    const stats: SquadStats = {
      avgAlignment: basicStats.avgAlignment,
      alignmentChange: basicStats.alignmentChange,
      topPercentile: extraStats.topPercentile,
      contributionHistory: extraStats.contributionHistory,
    };

    return NextResponse.json({
      squad,
      members,
      stats,
    });
  } catch (error) {
    console.error('[COACH_SQUAD_GET_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

