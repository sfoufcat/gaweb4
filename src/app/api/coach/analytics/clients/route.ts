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
 *   - cursor: pagination cursor
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { batchResolveActivity, type ActivityResult } from '@/lib/analytics';
import { ANALYTICS_COLLECTIONS } from '@/lib/analytics/constants';
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

    // Try to get today's snapshot first (for fast response)
    const today = new Date().toISOString().split('T')[0];
    const snapshotDoc = await adminDb
      .collection(ANALYTICS_COLLECTIONS.orgSnapshots)
      .doc(`${organizationId}_clients_${today}`)
      .get();

    let summary = {
      totalClients: 0,
      thrivingCount: 0,
      activeCount: 0,
      inactiveCount: 0,
      atRiskCount: 0,
      activeRate: 0,
    };

    if (snapshotDoc.exists) {
      const data = snapshotDoc.data();
      summary = {
        totalClients: data?.totalClients || 0,
        thrivingCount: data?.thrivingCount || 0,
        activeCount: data?.activeCount || 0,
        inactiveCount: data?.inactiveCount || 0,
        atRiskCount: data?.atRiskCount || 0,
        activeRate: data?.activeRate || 0,
      };
    }

    // Build query for org_memberships with filters
    let query = adminDb
      .collection('org_memberships')
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true);

    // Apply status filter if available on membership docs
    if (statusFilter !== 'all' && statusFilter !== 'at-risk') {
      query = query.where('activityStatus', '==', statusFilter);
    }

    // Apply squad filter
    if (squadIdFilter) {
      query = query.where('squadId', '==', squadIdFilter);
    }

    // Apply program filter
    if (programIdFilter) {
      query = query.where('currentProgramId', '==', programIdFilter);
    }

    // Limit results
    query = query.limit(limit);

    const membershipsSnapshot = await query.get();

    if (membershipsSnapshot.empty) {
      return NextResponse.json({
        summary,
        clients: [],
        computed: snapshotDoc.exists ? 'cached' : 'live',
      });
    }

    // Get user details for members
    const userIds = membershipsSnapshot.docs.map(d => d.data().userId);
    const uniqueUserIds = [...new Set(userIds)];

    // Fetch user docs in batches
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
    
    for (const doc of membershipsSnapshot.docs) {
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

    // Build client list
    const clients: ClientActivityData[] = [];

    for (const doc of membershipsSnapshot.docs) {
      const data = doc.data();
      const userId = data.userId;
      const user = userMap.get(userId);

      // Apply at-risk filter if needed
      if (statusFilter === 'at-risk' && !data.atRisk) {
        continue;
      }

      const client: ClientActivityData = {
        userId,
        name: user?.name || 'Unknown',
        email: user?.email || '',
        avatarUrl: user?.avatarUrl,
        status: data.activityStatus || 'inactive',
        atRisk: data.atRisk || false,
        lastActivityAt: data.lastActivityAt || null,
        primarySignal: data.primaryActivityType || null,
        daysActiveInPeriod: data.daysActiveInPeriod || 0,
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

    return NextResponse.json({
      summary,
      clients,
      computed: snapshotDoc.exists ? 'cached' : 'live',
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

