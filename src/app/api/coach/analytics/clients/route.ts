/**
 * Coach API: Client Activity Analytics
 * 
 * GET /api/coach/analytics/clients
 * 
 * Returns client-level analytics for the coach's organization:
 * - Summary counts (total, thriving, active, inactive, at-risk)
 * - Per-client details with activity status, last activity, primary signal
 * 
 * Query params:
 *   - status: 'all' | 'thriving' | 'active' | 'inactive' | 'at-risk'
 *   - programId: filter by specific program
 *   - squadId: filter by specific squad
 *   - limit: max clients to return (default 100)
 * 
 * IMPORTANT: This endpoint computes activity status in REAL-TIME using the Activity Resolver.
 * It does NOT rely on cached/stale data.
 * 
 * NOTE: Admins (coaches, super_coaches) are ALWAYS excluded from client analytics.
 * This endpoint only shows regular members (clients).
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { batchResolveActivity } from '@/lib/analytics';
import type { HealthStatus } from '@/lib/analytics/constants';

interface ClientActivityData {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status: HealthStatus;
  atRisk: boolean;
  lastActivityAt: string | null;
  primarySignal: string | null;
  daysActiveInPeriod: number;
  programId?: string;
  programName?: string;
  squadId?: string;
  squadName?: string;
  joinedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);
    
    const statusFilter = searchParams.get('status') || 'all';
    const programIdFilter = searchParams.get('programId');
    const squadIdFilter = searchParams.get('squadId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    // Build base query for org_memberships
    // ALWAYS filter to only 'member' role - exclude coaches and super_coaches
    let query = adminDb
      .collection('org_memberships')
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .where('orgRole', '==', 'member'); // Only include regular members (clients)

    // Apply squad filter
    if (squadIdFilter) {
      query = query.where('squadId', '==', squadIdFilter);
    }

    // Apply program filter
    if (programIdFilter) {
      query = query.where('currentProgramId', '==', programIdFilter);
    }

    const membershipsSnapshot = await query.get();

    if (membershipsSnapshot.empty) {
      return NextResponse.json({
        summary: {
          totalClients: 0,
          thrivingCount: 0,
          activeCount: 0,
          inactiveCount: 0,
          atRiskCount: 0,
          activeRate: 0,
        },
        clients: [],
        computed: 'live',
      });
    }

    // DEDUPLICATE by userId - keep the most recent membership per user
    const membershipByUser = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of membershipsSnapshot.docs) {
      const data = doc.data();
      const userId = data.userId;
      
      if (!membershipByUser.has(userId)) {
        membershipByUser.set(userId, doc);
      } else {
        // Keep the more recent one
        const existingDoc = membershipByUser.get(userId)!;
        const existingCreatedAt = existingDoc.data().createdAt || '';
        const currentCreatedAt = data.createdAt || '';
        
        if (currentCreatedAt > existingCreatedAt) {
          membershipByUser.set(userId, doc);
        }
      }
    }

    const uniqueMemberDocs = Array.from(membershipByUser.values());
    const uniqueUserIds = Array.from(membershipByUser.keys());

    // Fetch user docs for display
    const userDocs = await Promise.all(
      uniqueUserIds.slice(0, 100).map(id => adminDb.collection('users').doc(id).get())
    );
    
    const userMap = new Map<string, { name: string; email: string; avatarUrl?: string }>();
    for (const doc of userDocs) {
      if (doc.exists) {
        const data = doc.data();
        userMap.set(doc.id, {
          name: data?.name || `${data?.firstName || ''} ${data?.lastName || ''}`.trim() || 'Unknown',
          email: data?.email || '',
          avatarUrl: data?.avatarUrl || data?.imageUrl,
        });
      }
    }

    // Get program/squad names if needed
    const programIds = new Set<string>();
    const squadIds = new Set<string>();
    
    for (const doc of uniqueMemberDocs) {
      const data = doc.data();
      if (data.currentProgramId) programIds.add(data.currentProgramId);
      if (data.squadId) squadIds.add(data.squadId);
    }

    const programMap = new Map<string, string>();
    const squadMap = new Map<string, string>();

    if (programIds.size > 0) {
      const programDocs = await Promise.all(
        Array.from(programIds).slice(0, 30).map(id => adminDb.collection('programs').doc(id).get())
      );
      for (const doc of programDocs) {
        if (doc.exists) {
          programMap.set(doc.id, doc.data()?.name || 'Unknown Program');
        }
      }
    }

    if (squadIds.size > 0) {
      const squadDocs = await Promise.all(
        Array.from(squadIds).slice(0, 30).map(id => adminDb.collection('squads').doc(id).get())
      );
      for (const doc of squadDocs) {
        if (doc.exists) {
          squadMap.set(doc.id, doc.data()?.name || 'Unknown Squad');
        }
      }
    }

    // COMPUTE ACTIVITY STATUS IN REAL-TIME using the Activity Resolver
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activityResults = await batchResolveActivity(
      organizationId, 
      uniqueUserIds.slice(0, limit), 
      sevenDaysAgo
    );

    // Build client list with real activity data
    const clients: ClientActivityData[] = [];
    let thrivingCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;
    let atRiskCount = 0;

    for (const doc of uniqueMemberDocs) {
      const data = doc.data();
      const userId = data.userId;
      const user = userMap.get(userId);
      const activity = activityResults.get(userId);

      // Use real computed status from Activity Resolver
      const status = activity?.status || 'inactive';
      const atRisk = activity?.atRisk || false;
      const lastActivityAt = activity?.activitySignals.lastActivityAt?.toISOString() || null;
      const primarySignal = activity?.activitySignals.primarySignal || null;
      const daysActiveInPeriod = activity?.activitySignals.daysActiveInPeriod || 0;

      // Count for summary
      if (status === 'thriving') thrivingCount++;
      else if (status === 'active') activeCount++;
      else inactiveCount++;
      if (atRisk) atRiskCount++;

      // Apply status filter AFTER computing status
      if (statusFilter !== 'all') {
        if (statusFilter === 'at-risk' && !atRisk) continue;
        if (statusFilter !== 'at-risk' && status !== statusFilter) continue;
      }

      const client: ClientActivityData = {
        userId,
        name: user?.name || 'Unknown',
        email: user?.email || '',
        avatarUrl: user?.avatarUrl,
        status,
        atRisk,
        lastActivityAt,
        primarySignal,
        daysActiveInPeriod,
        programId: data.currentProgramId,
        programName: data.currentProgramId ? programMap.get(data.currentProgramId) : undefined,
        squadId: data.squadId,
        squadName: data.squadId ? squadMap.get(data.squadId) : undefined,
        joinedAt: data.createdAt || data.joinedAt || '',
      };

      clients.push(client);
    }

    // Sort by status (inactive first to prompt action), then by last activity
    clients.sort((a, b) => {
      const statusOrder = { inactive: 0, active: 1, thriving: 2 };
      const aOrder = statusOrder[a.status] ?? 0;
      const bOrder = statusOrder[b.status] ?? 0;
      
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      // Then by at-risk (at-risk first)
      if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
      
      // Then by last activity (oldest first within same status)
      if (!a.lastActivityAt && !b.lastActivityAt) return 0;
      if (!a.lastActivityAt) return -1;
      if (!b.lastActivityAt) return 1;
      return new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime();
    });

    const totalClients = uniqueUserIds.length;
    const activeRate = totalClients > 0 
      ? Math.round(((thrivingCount + activeCount) / totalClients) * 100) 
      : 0;

    return NextResponse.json({
      summary: {
        totalClients,
        thrivingCount,
        activeCount,
        inactiveCount,
        atRiskCount,
        activeRate,
      },
      clients: clients.slice(0, limit),
      computed: 'live',
      count: clients.length,
    });
  } catch (error) {
    console.error('[COACH_ANALYTICS_CLIENTS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch client analytics' }, { status: 500 });
  }
}
