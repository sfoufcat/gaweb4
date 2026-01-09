/**
 * Coach API: Cohort-Specific Program Days Management (for Group Programs)
 *
 * GET /api/coach/org-programs/[programId]/cohort-days - List cohort days
 *   Query params:
 *   - cohortId: Required - Filter by specific cohort
 *   - dayIndex: Optional - Filter by specific day index
 *
 * POST /api/coach/org-programs/[programId]/cohort-days - Create/update cohort day (upsert)
 *   Body: { cohortId: string, dayIndex: number, ...dayData }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { syncProgramTasksToAllCohorts } from '@/lib/sync-cohort-tasks';
import type { CohortProgramDay, ProgramTaskTemplate } from '@/types';

/**
 * Process tasks to ensure each has a unique ID for robust matching.
 * Preserves existing IDs, generates new UUIDs for tasks without IDs.
 * Also strips runtime completion data that should never be stored in templates.
 * Preserves source field if set, otherwise defaults to 'day' for direct saves.
 */
function processTasksWithIds(tasks: ProgramTaskTemplate[] | undefined): ProgramTaskTemplate[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((task) => {
    // Strip runtime completion data - should never be stored in templates
    // These fields are populated at read time by merging with actual task status
    const { completed, completedAt, taskId, ...cleanTask } = task as ProgramTaskTemplate & {
      completed?: boolean;
      completedAt?: string;
      taskId?: string;
    };
    return {
      ...cleanTask,
      id: task.id || crypto.randomUUID(),
      source: task.source || 'day', // Preserve existing source or mark as day-level
    };
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const program = programDoc.data();
    if (program?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // This API is only for group programs
    if (program?.type !== 'group') {
      return NextResponse.json({ error: 'Cohort days are only available for group programs' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohortId');
    const dayIndex = searchParams.get('dayIndex');

    if (!cohortId) {
      return NextResponse.json({ error: 'cohortId query parameter is required' }, { status: 400 });
    }

    // Verify cohort exists and belongs to this program
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    const cohort = cohortDoc.data();
    if (cohort?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort does not belong to this program' }, { status: 400 });
    }

    let query = adminDb
      .collection('cohort_program_days')
      .where('programId', '==', programId)
      .where('cohortId', '==', cohortId);

    if (dayIndex) {
      query = query.where('dayIndex', '==', parseInt(dayIndex, 10));
    }

    let daysSnapshot;
    try {
      daysSnapshot = await query.orderBy('dayIndex', 'asc').get();
    } catch (queryErr) {
      // Handle potential missing index error - fall back to unordered query
      console.warn('[COACH_COHORT_DAYS_GET] Ordered query failed, trying without orderBy:', queryErr);
      daysSnapshot = await adminDb
        .collection('cohort_program_days')
        .where('programId', '==', programId)
        .where('cohortId', '==', cohortId)
        .get();
    }

    const days = daysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as CohortProgramDay[];

    // Sort client-side if we had to fall back
    days.sort((a, b) => a.dayIndex - b.dayIndex);

    return NextResponse.json({
      cohortDays: days,
      total: days.length,
    });
  } catch (error) {
    console.error('[COACH_COHORT_DAYS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch cohort days' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body = await request.json();
    const { cohortId, dayIndex, ...dayData } = body;

    if (!cohortId) {
      return NextResponse.json({ error: 'cohortId is required' }, { status: 400 });
    }
    if (dayIndex === undefined || dayIndex === null) {
      return NextResponse.json({ error: 'dayIndex is required' }, { status: 400 });
    }

    // Verify program exists, belongs to this org, and is a group program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const program = programDoc.data();
    if (program?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }
    if (program?.type !== 'group') {
      return NextResponse.json({ error: 'Cohort days are only available for group programs' }, { status: 400 });
    }

    // Verify cohort exists and belongs to this program
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    const cohort = cohortDoc.data();
    if (cohort?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort does not belong to this program' }, { status: 400 });
    }

    const now = FieldValue.serverTimestamp();

    // Check if cohort day already exists for this cohort + dayIndex
    const existingDaySnapshot = await adminDb
      .collection('cohort_program_days')
      .where('cohortId', '==', cohortId)
      .where('dayIndex', '==', dayIndex)
      .limit(1)
      .get();

    if (!existingDaySnapshot.empty) {
      // Update existing cohort day
      const existingDoc = existingDaySnapshot.docs[0];
      const existingData = existingDoc.data();

      // Ensure tasks have IDs for robust matching
      let processedTasks = dayData.tasks !== undefined
        ? processTasksWithIds(dayData.tasks)
        : undefined;

      // Smart merge: preserve week-sourced tasks not in the request
      // This handles race conditions where weekly tasks were distributed after frontend loaded
      if (processedTasks !== undefined && existingData?.tasks) {
        const existingTasks: ProgramTaskTemplate[] = existingData.tasks;
        const incomingTaskIds = new Set(
          processedTasks.map(t => t.id).filter((id): id is string => Boolean(id))
        );

        const preservedWeekTasks = existingTasks.filter((t) =>
          t.source === 'week' && t.id && !incomingTaskIds.has(t.id)
        );

        if (preservedWeekTasks.length > 0) {
          console.log(
            `[COACH_COHORT_DAYS_POST] Preserving ${preservedWeekTasks.length} week-sourced tasks not in save request`
          );
          processedTasks = [...processedTasks, ...preservedWeekTasks];
        }
      }

      const updateData = {
        ...dayData,
        ...(processedTasks !== undefined && { tasks: processedTasks }),
        updatedAt: now,
      };

      await existingDoc.ref.update(updateData);

      const updatedDoc = await existingDoc.ref.get();
      const updatedDay = {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        createdAt: updatedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.createdAt,
        updatedAt: updatedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.updatedAt,
      } as CohortProgramDay;

      console.log(`[COACH_COHORT_DAYS_POST] Updated cohort day for cohort ${cohortId}, dayIndex ${dayIndex}`);

      // Always trigger sync to cohort members - even when clearing tasks
      // This ensures old program-sourced tasks get deleted from client's Daily Focus
      try {
        const syncResult = await syncProgramTasksToAllCohorts({
          programId,
          specificDayIndex: dayIndex,
          mode: 'override-program-sourced',
        });
        console.log(`[COACH_COHORT_DAYS_POST] Sync completed:`, JSON.stringify(syncResult));
      } catch (err) {
        console.error('[COACH_COHORT_DAYS_POST] Sync failed:', err);
        // Don't fail the request if sync fails
      }

      return NextResponse.json({
        success: true,
        cohortDay: updatedDay,
        created: false,
      });
    }

    // Find the template day to get programDayId
    const templateDaySnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .where('dayIndex', '==', dayIndex)
      .limit(1)
      .get();

    const templateDay = templateDaySnapshot.empty ? null : templateDaySnapshot.docs[0];

    // Create new cohort day
    const cohortDayRef = adminDb.collection('cohort_program_days').doc();
    const cohortDayData = {
      cohortId,
      programDayId: templateDay?.id || null,
      programId,
      organizationId,
      dayIndex,

      // Content from request - ensure tasks have IDs for robust matching
      title: dayData.title || undefined,
      summary: dayData.summary || undefined,
      dailyPrompt: dayData.dailyPrompt || undefined,
      tasks: processTasksWithIds(dayData.tasks),
      habits: dayData.habits || [],
      courseAssignments: dayData.courseAssignments || [],
      weekId: dayData.weekId || undefined,

      createdAt: now,
      updatedAt: now,
    };

    await cohortDayRef.set(cohortDayData);

    const createdDoc = await cohortDayRef.get();
    const createdDay = {
      id: createdDoc.id,
      ...createdDoc.data(),
      createdAt: createdDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || createdDoc.data()?.createdAt,
      updatedAt: createdDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || createdDoc.data()?.updatedAt,
    } as CohortProgramDay;

    console.log(`[COACH_COHORT_DAYS_POST] Created cohort day ${cohortDayRef.id} for cohort ${cohortId}, dayIndex ${dayIndex}`);

    // Always trigger sync to cohort members - even when creating with empty tasks
    // This ensures the explicit empty day is propagated to clients
    try {
      const syncResult = await syncProgramTasksToAllCohorts({
        programId,
        specificDayIndex: dayIndex,
        mode: 'override-program-sourced',
      });
      console.log(`[COACH_COHORT_DAYS_POST] Sync completed:`, JSON.stringify(syncResult));
    } catch (err) {
      console.error('[COACH_COHORT_DAYS_POST] Sync failed:', err);
      // Don't fail the request if sync fails
    }

    return NextResponse.json({
      success: true,
      cohortDay: createdDay,
      created: true,
    });
  } catch (error) {
    console.error('[COACH_COHORT_DAYS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to save cohort day' }, { status: 500 });
  }
}
