/**
 * Coach API: Individual Cohort Day Management
 *
 * GET /api/coach/org-programs/[programId]/cohort-days/[cohortDayId] - Get a cohort day
 * PATCH /api/coach/org-programs/[programId]/cohort-days/[cohortDayId] - Update a cohort day
 * DELETE /api/coach/org-programs/[programId]/cohort-days/[cohortDayId] - Delete a cohort day
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { CohortProgramDay, ProgramTaskTemplate } from '@/types';

/**
 * Process tasks to ensure each has a unique ID for robust matching.
 * Also strips runtime completion data that should never be stored in templates.
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
    };
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; cohortDayId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortDayId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const cohortDayDoc = await adminDb.collection('cohort_program_days').doc(cohortDayId).get();
    if (!cohortDayDoc.exists || cohortDayDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort day not found' }, { status: 404 });
    }

    const cohortDay = {
      id: cohortDayDoc.id,
      ...cohortDayDoc.data(),
      createdAt: cohortDayDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || cohortDayDoc.data()?.createdAt,
      updatedAt: cohortDayDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || cohortDayDoc.data()?.updatedAt,
    } as CohortProgramDay;

    return NextResponse.json({ cohortDay });
  } catch (error) {
    console.error('[COACH_COHORT_DAY_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch cohort day' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; cohortDayId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortDayId } = await params;
    const body = await request.json();

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const cohortDayDoc = await adminDb.collection('cohort_program_days').doc(cohortDayId).get();
    if (!cohortDayDoc.exists || cohortDayDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort day not found' }, { status: 404 });
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Content fields
    if (body.title !== undefined) updateData.title = body.title?.trim() || null;
    if (body.summary !== undefined) updateData.summary = body.summary?.trim() || null;
    if (body.dailyPrompt !== undefined) updateData.dailyPrompt = body.dailyPrompt?.trim() || null;
    if (body.tasks !== undefined) {
      let processedTasks = processTasksWithIds(body.tasks);

      // Smart merge: preserve week-sourced tasks not in the request
      // This handles race conditions where weekly tasks were distributed after frontend loaded
      const existingData = cohortDayDoc.data();
      if (existingData?.tasks) {
        const existingTasks: ProgramTaskTemplate[] = existingData.tasks;
        const incomingTaskIds = new Set(
          processedTasks.map(t => t.id).filter((id): id is string => Boolean(id))
        );

        const preservedWeekTasks = existingTasks.filter((t) =>
          t.source === 'week' && t.id && !incomingTaskIds.has(t.id)
        );

        if (preservedWeekTasks.length > 0) {
          console.log(
            `[COACH_COHORT_DAY_PATCH] Preserving ${preservedWeekTasks.length} week-sourced tasks not in save request`
          );
          processedTasks = [...processedTasks, ...preservedWeekTasks];
        }
      }

      updateData.tasks = processedTasks;
    }
    if (body.habits !== undefined) updateData.habits = body.habits || [];
    if (body.courseAssignments !== undefined) updateData.courseAssignments = body.courseAssignments || [];
    if (body.weekId !== undefined) updateData.weekId = body.weekId || null;

    // Note: We don't allow updating positional fields (dayIndex)
    // Those come from the template

    await adminDb.collection('cohort_program_days').doc(cohortDayId).update(updateData);
    console.log(`[COACH_COHORT_DAY_PATCH] Updated cohort day ${cohortDayId}`);

    // Fetch the updated day
    const savedDoc = await adminDb.collection('cohort_program_days').doc(cohortDayId).get();
    const savedDay = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
    } as CohortProgramDay;

    // Note: No 2-way sync for cohort days - sync is manual
    // This differs from client days which auto-sync to user's Daily Focus

    return NextResponse.json({
      success: true,
      cohortDay: savedDay,
      message: 'Cohort day updated successfully',
    });
  } catch (error) {
    console.error('[COACH_COHORT_DAY_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update cohort day' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; cohortDayId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortDayId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const cohortDayDoc = await adminDb.collection('cohort_program_days').doc(cohortDayId).get();
    if (!cohortDayDoc.exists || cohortDayDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort day not found' }, { status: 404 });
    }

    // Delete the cohort day
    await adminDb.collection('cohort_program_days').doc(cohortDayId).delete();
    console.log(`[COACH_COHORT_DAY_DELETE] Deleted cohort day ${cohortDayId}`);

    return NextResponse.json({
      success: true,
      message: 'Cohort day deleted successfully',
    });
  } catch (error) {
    console.error('[COACH_COHORT_DAY_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to delete cohort day' }, { status: 500 });
  }
}
