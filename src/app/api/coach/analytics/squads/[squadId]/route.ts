/**
 * Coach API: Squad Analytics Detail
 * 
 * GET /api/coach/analytics/squads/[squadId] - Get detailed analytics for a squad
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Squad, SquadAnalytics } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { squadId } = await params;
    const { searchParams } = new URL(request.url);
    
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Get squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;
    if (squad.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Squad not found in your organization' }, { status: 404 });
    }

    // Get analytics for the last N days
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const analyticsSnapshot = await adminDb
      .collection('squad_analytics')
      .where('squadId', '==', squadId)
      .where('date', '>=', startDateStr)
      .orderBy('date', 'asc')
      .get();

    const analytics: SquadAnalytics[] = analyticsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as SquadAnalytics));

    // Calculate summary stats
    const latestAnalytics = analytics[analytics.length - 1];
    const oldestAnalytics = analytics[0];

    let averageActivityRate = 0;
    if (analytics.length > 0) {
      averageActivityRate = Math.round(
        analytics.reduce((sum, a) => sum + a.activityRate, 0) / analytics.length
      );
    }

    // Activity trend over the period
    let activityTrend: 'up' | 'down' | 'stable' = 'stable';
    let trendPercent = 0;
    if (latestAnalytics && oldestAnalytics && analytics.length > 1) {
      trendPercent = latestAnalytics.activityRate - oldestAnalytics.activityRate;
      if (trendPercent > 5) {
        activityTrend = 'up';
      } else if (trendPercent < -5) {
        activityTrend = 'down';
      }
    }

    // Get member details
    const memberIds = squad.memberIds || [];
    let members: { id: string; name: string; imageUrl: string; lastActive?: string }[] = [];
    
    if (memberIds.length > 0) {
      // Get user info for members (limit to 50 for performance)
      const usersToFetch = memberIds.slice(0, 50);
      const userDocs = await Promise.all(
        usersToFetch.map(id => adminDb.collection('users').doc(id).get())
      );
      
      members = userDocs
        .filter(doc => doc.exists)
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data?.name || `${data?.firstName || ''} ${data?.lastName || ''}`.trim() || 'Unknown',
            imageUrl: data?.avatarUrl || data?.imageUrl || '',
            lastActive: data?.updatedAt,
          };
        });
    }

    return NextResponse.json({
      squad: {
        id: squad.id,
        name: squad.name,
        avatarUrl: squad.avatarUrl,
        totalMembers: memberIds.length,
        createdAt: squad.createdAt,
      },
      analytics,
      summary: {
        currentActivityRate: latestAnalytics?.activityRate || 0,
        currentActiveMembers: latestAnalytics?.activeMembers || 0,
        currentHealthStatus: latestAnalytics?.healthStatus || 'inactive',
        averageActivityRate,
        activityTrend,
        trendPercent: Math.abs(trendPercent),
        totalDataPoints: analytics.length,
      },
      members: members.slice(0, 20), // Limit to 20 for response size
    });
  } catch (error) {
    console.error('[COACH_ANALYTICS_SQUAD] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch squad analytics' }, { status: 500 });
  }
}

