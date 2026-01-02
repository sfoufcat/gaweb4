/**
 * Coach API: Community Analytics Overview
 * 
 * GET /api/coach/analytics/communities - Get health overview for all squads
 * Query params:
 *   - type: 'all' | 'standalone' | 'program' (default: 'all')
 *   - excludeAdmins: 'true' | 'false' (default: 'false') - exclude coaches/super_coaches from calculations
 * 
 * REAL-TIME: This endpoint now computes activity in real-time using the Activity Resolver,
 * ensuring accurate active member counts instead of relying on stale cached data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { batchResolveActivity } from '@/lib/analytics';
import { withDemoMode } from '@/lib/demo-api';
import type { Squad, SquadAnalytics, SquadAnalyticsSummary, SquadHealthStatus, OrgMembership } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('analytics-communities');
    if (demoData) return demoData;
    
    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') || 'all'; // 'all', 'standalone', 'program'
    const excludeAdmins = searchParams.get('excludeAdmins') === 'true';

    // Get all squads for this organization and filter in memory
    // This avoids requiring composite indexes
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('organizationId', '==', organizationId)
      .get();

    // Filter squads in memory based on type and closed status
    const openSquadDocs = squadsSnapshot.docs.filter(doc => {
      const data = doc.data();
      
      // Skip closed squads
      if (data.isClosed === true) return false;
      
      // Apply type filter
      if (typeFilter === 'standalone') {
        return data.programId == null;
      } else if (typeFilter === 'program') {
        return data.programId != null;
      }
      
      // 'all' - include everything
      return true;
    });

    if (openSquadDocs.length === 0) {
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

    // If excluding admins, fetch all org memberships to identify admin users
    const adminUserIds = new Set<string>();
    if (excludeAdmins) {
      const membershipsSnapshot = await adminDb
        .collection('org_memberships')
        .where('organizationId', '==', organizationId)
        .where('isActive', '==', true)
        .get();
      
      for (const doc of membershipsSnapshot.docs) {
        const membership = doc.data() as OrgMembership;
        if (membership.orgRole === 'super_coach' || membership.orgRole === 'coach') {
          adminUserIds.add(membership.userId);
        }
      }
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Build community summaries
    const communities: SquadAnalyticsSummary[] = [];
    const healthCounts = { thriving: 0, active: 0, inactive: 0 };

    for (const squadDoc of openSquadDocs) {
      const squad = { id: squadDoc.id, ...squadDoc.data() } as Squad;
      
      // Get member IDs, optionally excluding admins
      let memberIds = squad.memberIds || [];
      if (excludeAdmins) {
        memberIds = memberIds.filter(id => !adminUserIds.has(id));
        // Also exclude the squad's coach
        if (squad.coachId) {
          memberIds = memberIds.filter(id => id !== squad.coachId);
        }
      }
      
      const memberCount = memberIds.length;

      // REAL-TIME ACTIVITY CALCULATION using Activity Resolver
      let healthStatus: SquadHealthStatus = 'inactive';
      let activityRate = 0;
      let activeMembers = 0;

      if (memberCount > 0) {
        // Compute activity in real-time for all members
        const activityResults = await batchResolveActivity(
          organizationId,
          memberIds,
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
        );

        // Count active members (status is 'thriving' or 'active')
        for (const result of activityResults.values()) {
          if (result.status === 'thriving' || result.status === 'active') {
            activeMembers++;
          }
        }

        // Calculate activity rate
        activityRate = memberCount > 0 ? Math.round((activeMembers / memberCount) * 100) : 0;

        // Determine health status based on activity rate
        if (activityRate >= 70) {
          healthStatus = 'thriving';
        } else if (activityRate >= 40) {
          healthStatus = 'active';
        } else {
          healthStatus = 'inactive';
        }
      }

      // Get previous period for trend (use cached analytics for historical comparison)
      const previousDate = new Date(today);
      previousDate.setDate(previousDate.getDate() - 8);
      const previousStr = previousDate.toISOString().split('T')[0];
      
      const previousAnalyticsDoc = await adminDb
        .collection('squad_analytics')
        .doc(`${squad.id}_${previousStr}`)
        .get();

      let trendPercent = 0;
      let activityTrend: 'up' | 'down' | 'stable' = 'stable';

      if (previousAnalyticsDoc.exists) {
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
        squadType: squad.programId ? 'program' : 'standalone',
        programId: squad.programId ?? undefined,
        totalMembers: memberCount,
        activeMembers,
        activityRate,
        healthStatus,
        activityTrend,
        trendPercent: Math.abs(trendPercent),
        lastActivityDate: todayStr,
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
      computed: 'live', // Indicate this is real-time computed data
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

