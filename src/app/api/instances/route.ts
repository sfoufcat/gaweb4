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
    // Note: We can't filter 'deletedAt == null' because Firestore doesn't match
    // documents where the field doesn't exist. We filter in-memory instead.
    let query = adminDb.collection('program_instances')
      .where('organizationId', '==', organizationId);

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
    // Note: When querying by cohortId, we expect at most 1 instance per cohort,
    // so we can skip ordering to avoid requiring a composite index
    let snapshot;
    try {
      if (cohortId) {
        // Simple query for single cohort - no ordering needed
        snapshot = await query.limit(limit + 1).get();
      } else {
        // Full query with ordering for list views
        snapshot = await query
          .orderBy('createdAt', 'desc')
          .limit(limit + 1)
          .offset(offset)
          .get();
      }
    } catch (queryError) {
      // If the composite index doesn't exist, fall back to simple query
      console.warn('[INSTANCES_LIST_GET] Index query failed, using fallback:', queryError);
      snapshot = await query.limit(limit + 1).get();
    }

    // Filter out soft-deleted documents in-memory
    // (Firestore 'where field == null' doesn't match documents missing the field)
    const activeDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.deletedAt;
    });

    const hasMore = activeDocs.length > limit;
    const docs = hasMore ? activeDocs.slice(0, limit) : activeDocs;

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

    // Auto-create instance for cohort if none exists (migration support)
    if (cohortId && enrichedInstances.length === 0 && programId) {
      console.log(`[INSTANCES_LIST_GET] No instance found for cohort ${cohortId}, auto-creating...`);

      try {
        // Fetch program and cohort data
        const [programDoc, cohortDoc] = await Promise.all([
          adminDb.collection('programs').doc(programId).get(),
          adminDb.collection('program_cohorts').doc(cohortId).get(),
        ]);

        if (programDoc.exists && cohortDoc.exists) {
          const programData = programDoc.data();
          const cohortData = cohortDoc.data();

          // Verify ownership
          if (programData?.organizationId === organizationId && cohortData?.programId === programId) {
            const daysPerWeek = programData.includeWeekends !== false ? 7 : 5;
            let weeks: Array<{
              id: string;
              weekNumber: number;
              moduleId?: string;
              name?: string;
              theme?: string;
              weeklyTasks: Array<{ id: string; label: string; [key: string]: unknown }>;
              weeklyHabits: unknown[];
              weeklyPrompt?: string;
              distribution?: string;
              startDayIndex?: number;
              endDayIndex?: number;
              days: Array<{ dayIndex: number; globalDayIndex: number; tasks: unknown[]; habits: unknown[] }>;
            }> = [];

            // NEW: First try to read from programs.weeks[] (embedded template weeks)
            if (programData.weeks && Array.isArray(programData.weeks) && programData.weeks.length > 0) {
              console.log(`[INSTANCES_LIST_GET] Using embedded weeks from program (${programData.weeks.length} weeks)`);
              weeks = programData.weeks.map((weekData: {
                id?: string;
                weekNumber: number;
                moduleId?: string;
                name?: string;
                theme?: string;
                startDayIndex?: number;
                endDayIndex?: number;
                weeklyTasks?: Array<{ id?: string; label: string }>;
                weeklyHabits?: unknown[];
                weeklyPrompt?: string;
                distribution?: string;
              }) => {
                const startDayIndex = weekData.startDayIndex || ((weekData.weekNumber - 1) * daysPerWeek + 1);
                const endDayIndex = weekData.endDayIndex || (startDayIndex + daysPerWeek - 1);

                const days = [];
                for (let dayIndex = startDayIndex; dayIndex <= endDayIndex; dayIndex++) {
                  days.push({
                    dayIndex,
                    globalDayIndex: dayIndex,
                    tasks: [],
                    habits: [],
                  });
                }

                return {
                  id: weekData.id || crypto.randomUUID(),
                  weekNumber: weekData.weekNumber,
                  moduleId: weekData.moduleId,
                  name: weekData.name,
                  theme: weekData.theme,
                  weeklyTasks: (weekData.weeklyTasks || []).map((t) => ({
                    ...t,
                    id: t.id || crypto.randomUUID(),
                  })),
                  weeklyHabits: weekData.weeklyHabits || [],
                  weeklyPrompt: weekData.weeklyPrompt,
                  distribution: weekData.distribution,
                  startDayIndex,
                  endDayIndex,
                  days,
                };
              });
            } else {
              // FALLBACK: Read from program_weeks collection (legacy data)
              console.log(`[INSTANCES_LIST_GET] Falling back to program_weeks collection`);
              const weeksSnapshot = await adminDb.collection('program_weeks')
                .where('programId', '==', programId)
                .orderBy('weekNumber', 'asc')
                .get();

              weeks = weeksSnapshot.docs.map(weekDoc => {
                const weekData = weekDoc.data();
                const startDayIndex = weekData.startDayIndex || ((weekData.weekNumber - 1) * daysPerWeek + 1);
                const endDayIndex = weekData.endDayIndex || (startDayIndex + daysPerWeek - 1);

                const days = [];
                for (let dayIndex = startDayIndex; dayIndex <= endDayIndex; dayIndex++) {
                  days.push({
                    dayIndex,
                    globalDayIndex: dayIndex,
                    tasks: [],
                    habits: [],
                  });
                }

                return {
                  id: weekDoc.id,
                  weekNumber: weekData.weekNumber,
                  moduleId: weekData.moduleId,
                  name: weekData.name,
                  theme: weekData.theme,
                  weeklyTasks: (weekData.weeklyTasks || []).map((t: { id?: string; label: string }) => ({
                    ...t,
                    id: t.id || crypto.randomUUID(),
                  })),
                  weeklyHabits: weekData.weeklyHabits || [],
                  weeklyPrompt: weekData.weeklyPrompt,
                  distribution: weekData.distribution,
                  startDayIndex,
                  endDayIndex,
                  days,
                };
              });
            }

            // Create the instance
            const instanceData = {
              programId,
              organizationId,
              type: 'cohort' as const,
              cohortId,
              startDate: cohortData.startDate,
              endDate: cohortData.endDate,
              includeWeekends: programData.includeWeekends !== false,
              dailyFocusSlots: programData.dailyFocusSlots || 3,
              weeks,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            const newInstanceRef = await adminDb.collection('program_instances').add(instanceData);
            console.log(`[INSTANCES_LIST_GET] Auto-created instance ${newInstanceRef.id} for cohort ${cohortId}`);

            // Return the newly created instance
            return NextResponse.json({
              instances: [{
                id: newInstanceRef.id,
                ...instanceData,
                weekCount: weeks.length,
                dayCount: weeks.reduce((sum, w) => sum + w.days.length, 0),
                cohortName: cohortData.name || 'Unknown Cohort',
              }],
              hasMore: false,
              offset: 0,
              limit,
              autoCreated: true,
            });
          }
        }
      } catch (createError) {
        console.error('[INSTANCES_LIST_GET] Auto-create failed:', createError);
        // Fall through to return empty results
      }
    }

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
