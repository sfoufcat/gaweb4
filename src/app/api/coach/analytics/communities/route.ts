/**
 * Coach API: Community Analytics Overview
 * 
 * GET /api/coach/analytics/communities - Get health overview for all standalone squads
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Squad, SquadAnalytics, SquadAnalyticsSummary, SquadHealthStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Get all standalone squads (programId is null)
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('organizationId', '==', organizationId)
      .where('programId', '==', null)
      .where('isClosed', '!=', true)
      .get();

    if (squadsSnapshot.empty) {
      return NextResponse.json({
        communities: [],
        summary: {
          thriving: 0,
          active: 0,
          inactive: 0,
          total: 0,
        },
      });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get analytics for these squads
    const squadIds = squadsSnapshot.docs.map(d => d.id);
    
    // Build community summaries
    const communities: SquadAnalyticsSummary[] = [];
    const healthCounts = { thriving: 0, active: 0, inactive: 0 };

    for (const squadDoc of squadsSnapshot.docs) {
      const squad = { id: squadDoc.id, ...squadDoc.data() } as Squad;
      const memberCount = squad.memberIds?.length || 0;

      // Try to get today's analytics, fallback to yesterday
      let analytics: SquadAnalytics | null = null;
      
      const todayAnalyticsDoc = await adminDb
        .collection('squad_analytics')
        .doc(`${squad.id}_${todayStr}`)
        .get();
      
      if (todayAnalyticsDoc.exists) {
        analytics = todayAnalyticsDoc.data() as SquadAnalytics;
      } else {
        const yesterdayAnalyticsDoc = await adminDb
          .collection('squad_analytics')
          .doc(`${squad.id}_${yesterdayStr}`)
          .get();
        
        if (yesterdayAnalyticsDoc.exists) {
          analytics = yesterdayAnalyticsDoc.data() as SquadAnalytics;
        }
      }

      // Calculate health status if no analytics exist
      let healthStatus: SquadHealthStatus = 'inactive';
      let activityRate = 0;
      let activeMembers = 0;

      if (analytics) {
        healthStatus = analytics.healthStatus;
        activityRate = analytics.activityRate;
        activeMembers = analytics.activeMembers;
      } else if (memberCount > 0) {
        // Estimate based on recent activity
        healthStatus = memberCount >= 3 ? 'active' : 'inactive';
      }

      // Get previous period for trend
      const previousDate = new Date(today);
      previousDate.setDate(previousDate.getDate() - 8);
      const previousStr = previousDate.toISOString().split('T')[0];
      
      const previousAnalyticsDoc = await adminDb
        .collection('squad_analytics')
        .doc(`${squad.id}_${previousStr}`)
        .get();

      let trendPercent = 0;
      let activityTrend: 'up' | 'down' | 'stable' = 'stable';

      if (previousAnalyticsDoc.exists && analytics) {
        const prevAnalytics = previousAnalyticsDoc.data() as SquadAnalytics;
        trendPercent = activityRate - prevAnalytics.activityRate;
        
        if (trendPercent > 5) {
          activityTrend = 'up';
        } else if (trendPercent < -5) {
          activityTrend = 'down';
        }
      }

      healthCounts[healthStatus]++;

      communities.push({
        squadId: squad.id,
        squadName: squad.name,
        squadAvatarUrl: squad.avatarUrl,
        coachId: squad.coachId ?? undefined,
        totalMembers: memberCount,
        activeMembers,
        activityRate,
        healthStatus,
        activityTrend,
        trendPercent: Math.abs(trendPercent),
        lastActivityDate: analytics?.date,
      });
    }

    // Sort by health status (inactive first to prompt action)
    communities.sort((a, b) => {
      const order = { inactive: 0, active: 1, thriving: 2 };
      return order[a.healthStatus] - order[b.healthStatus];
    });

    return NextResponse.json({
      communities,
      summary: {
        ...healthCounts,
        total: communities.length,
      },
    });
  } catch (error) {
    console.error('[COACH_ANALYTICS_COMMUNITIES] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch community analytics' }, { status: 500 });
  }
}

