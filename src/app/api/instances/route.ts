// ============================================================================
// PROGRAM INSTANCES API - Part of 3-Collection Architecture
// ============================================================================
//
// This is part of the new simplified program system:
//   programs → program_instances → task_completions
//
// program_instances stores one document per enrollment (1:1) or cohort (group).
// All weeks/days/tasks are embedded in the instance document.
//
// See CLAUDE.md "Program System Architecture" for full documentation.
// ============================================================================

/**
 * Program Instances List API
 *
 * List and search program instances
 *
 * GET /api/instances - List instances with filters
 *
 * Query params:
 * - programId: Filter by program
 * - cohortId: Filter by cohort
 * - enrollmentId: Filter by enrollment (for 1:1 programs)
 * - userId: Filter by user (for individual instances)
 * - type: Filter by type ('individual' | 'cohort')
 * - limit: Max results (default: 50)
 * - offset: Pagination offset
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { ProgramInstance } from '@/types';

/**
 * GET /api/instances
 * Returns a list of program instances
 */
export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Parse query params
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');
    const cohortId = searchParams.get('cohortId');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') as 'individual' | 'cohort' | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = adminDb.collection('program_instances')
      .where('organizationId', '==', organizationId)
      .where('deletedAt', '==', null);

    if (programId) {
      query = query.where('programId', '==', programId);
    }

    if (cohortId) {
      query = query.where('cohortId', '==', cohortId);
    }

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    if (type) {
      query = query.where('type', '==', type);
    }

    // Execute query with ordering and pagination
    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(limit + 1)  // Fetch one extra to check if there are more
      .offset(offset)
      .get();

    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    // Map to instances (without full weeks data for list view)
    const instances: Array<Omit<ProgramInstance, 'weeks'> & { weekCount: number; dayCount: number }> = docs.map(doc => {
      const data = doc.data();
      const weeks = data.weeks || [];

      return {
        id: doc.id,
        programId: data.programId,
        organizationId: data.organizationId,
        type: data.type,
        userId: data.userId,
        enrollmentId: data.enrollmentId,
        cohortId: data.cohortId,
        startDate: data.startDate,
        endDate: data.endDate,
        includeWeekends: data.includeWeekends,
        dailyFocusSlots: data.dailyFocusSlots,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
        lastSyncedFromTemplate: data.lastSyncedFromTemplate?.toDate?.()?.toISOString?.() || data.lastSyncedFromTemplate,
        weekCount: weeks.length,
        dayCount: weeks.reduce((sum: number, w: { days?: unknown[] }) => sum + (w.days?.length || 0), 0),
      };
    });

    // Enrich with user/cohort names
    const enrichedInstances = await Promise.all(instances.map(async (instance) => {
      if (instance.type === 'cohort' && instance.cohortId) {
        const cohortDoc = await adminDb.collection('program_cohorts').doc(instance.cohortId).get();
        return {
          ...instance,
          cohortName: cohortDoc.data()?.name || 'Unknown Cohort',
        };
      } else if (instance.type === 'individual' && instance.userId) {
        const userDoc = await adminDb.collection('users').doc(instance.userId).get();
        const userData = userDoc.data();
        return {
          ...instance,
          userName: userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'Unknown User',
          userImageUrl: userData?.imageUrl,
        };
      }
      return instance;
    }));

    return NextResponse.json({
      instances: enrichedInstances,
      hasMore,
      offset,
      limit,
    });
  } catch (error) {
    console.error('[INSTANCES_LIST_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch instances' }, { status: 500 });
  }
}
