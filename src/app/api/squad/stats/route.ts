import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStatsTabData, computeContributionHistory } from '@/lib/squad-alignment';
import type { SquadType } from '@/types';

/**
 * GET /api/squad/stats
 * Gets the expensive stats for the Stats tab (percentile, contribution history)
 * 
 * DUAL SQUAD SUPPORT:
 * - Accepts `type` query param to specify which squad ('premium' | 'standard')
 * - Falls back to first available squad if type not specified
 * 
 * Query params:
 * - type: 'premium' | 'standard' - Which squad's stats to fetch (optional)
 * - offset: Number of days to skip from today (for pagination, default: 0)
 * - limit: Number of days to fetch (default: 30)
 * 
 * This endpoint is designed to be called AFTER the initial page load
 * to avoid blocking the Squad tab display.
 * 
 * NOTE: Coach is EXCLUDED from all calculations - only regular members count.
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const requestedType = searchParams.get('type') as SquadType | null;
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    // Get user's squad IDs
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    let standardSquadId = userData?.standardSquadId || null;
    let premiumSquadId = userData?.premiumSquadId || null;
    
    // Handle legacy squadId if new fields not set
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

    // Determine which squad ID to use
    let squadId: string | null = null;
    
    if (requestedType === 'premium' && premiumSquadId) {
      squadId = premiumSquadId;
    } else if (requestedType === 'standard' && standardSquadId) {
      squadId = standardSquadId;
    } else {
      // Fallback: use first available (premium first)
      squadId = premiumSquadId || standardSquadId;
    }

    // If no squad found, return empty stats
    if (!squadId) {
      return NextResponse.json({
        topPercentile: 0,
        contributionHistory: [],
        squadCreatedAt: null,
        hasMore: false,
      });
    }

    // Verify squad exists and get creation date
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({
        topPercentile: 0,
        contributionHistory: [],
        squadCreatedAt: null,
        hasMore: false,
      });
    }

    const squadData = squadDoc.data();
    const squadCreatedAt = squadData?.createdAt || null;
    const coachId = squadData?.coachId || null;

    // If this is a "Load More" request (offset > 0), only fetch contribution history
    if (offset > 0) {
      const contributionHistory = await computeContributionHistory(
        squadId,
        limit,
        coachId,
        offset,
        squadCreatedAt
      );

      // Check if there's more data (we haven't reached squad creation date)
      const hasMore = contributionHistory.length === limit && squadCreatedAt;

      return NextResponse.json({
        topPercentile: 0, // Not needed for load more
        contributionHistory,
        squadCreatedAt,
        hasMore,
      });
    }

    // Initial load - get percentile and contribution history
    const statsData = await getStatsTabData(squadId, squadCreatedAt);

    // Check if there's more data beyond the initial 30 days
    const hasMore = statsData.contributionHistory.length === 30 && squadCreatedAt;

    return NextResponse.json({
      topPercentile: statsData.topPercentile,
      contributionHistory: statsData.contributionHistory,
      squadCreatedAt,
      hasMore,
    });
  } catch (error) {
    console.error('[SQUAD_STATS_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
