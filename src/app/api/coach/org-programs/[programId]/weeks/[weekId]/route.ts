/**
 * Coach API: Individual Program Week Management
 *
 * GET /api/coach/org-programs/[programId]/weeks/[weekId] - Get a week
 * PATCH /api/coach/org-programs/[programId]/weeks/[weekId] - Update a week
 * DELETE /api/coach/org-programs/[programId]/weeks/[weekId] - Delete a week
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { recalculateWeekDayIndices, distributeWeeklyTasksToDays, syncClientProgramDaysFromWeekDistribution } from '@/lib/program-utils';
import { syncProgramTasksForDateRange, type SyncMode } from '@/lib/program-engine';
import type { ProgramWeek, ProgramTaskTemplate } from '@/types';

/**
 * Process tasks to ensure each has a unique ID for robust matching.
 * Preserves existing IDs, generates new UUIDs for tasks without IDs.
 * Also strips runtime completion data that should never be stored in templates.
 */
function processTasksWithIds(tasks: ProgramTaskTemplate[] | undefined): ProgramTaskTemplate[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((task) => {
    // Strip runtime completion data - should never be stored in templates
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
  { params }: { params: Promise<{ programId: string; weekId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, weekId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const weekDoc = await adminDb.collection('program_weeks').doc(weekId).get();
    if (!weekDoc.exists || weekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    const week = {
      id: weekDoc.id,
      ...weekDoc.data(),
      createdAt: weekDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || weekDoc.data()?.createdAt,
      updatedAt: weekDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || weekDoc.data()?.updatedAt,
    } as ProgramWeek;

    return NextResponse.json({ week });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_WEEK_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch week' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; weekId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, weekId } = await params;
    const body = await request.json();

    console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Request body:`, {
      weekId,
      distribution: body.distribution,
      distributeTasksNow: body.distributeTasksNow,
      overwriteExisting: body.overwriteExisting,
      weeklyTasksCount: body.weeklyTasks?.length ?? 'not provided',
    });

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const weekDoc = await adminDb.collection('program_weeks').doc(weekId).get();
    if (!weekDoc.exists || weekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.name !== undefined) updateData.name = body.name?.trim() || null;
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.theme !== undefined) updateData.theme = body.theme?.trim() || null;
    if (body.weeklyPrompt !== undefined) updateData.weeklyPrompt = body.weeklyPrompt?.trim() || null;
    if (body.order !== undefined) updateData.order = body.order;
    if (body.weekNumber !== undefined) updateData.weekNumber = body.weekNumber;
    if (body.startDayIndex !== undefined) updateData.startDayIndex = body.startDayIndex;
    if (body.endDayIndex !== undefined) updateData.endDayIndex = body.endDayIndex;
    if (body.weeklyTasks !== undefined) updateData.weeklyTasks = processTasksWithIds(body.weeklyTasks);
    if (body.weeklyHabits !== undefined) updateData.weeklyHabits = body.weeklyHabits || null;
    if (body.currentFocus !== undefined) updateData.currentFocus = body.currentFocus || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.scheduledCallEventId !== undefined) updateData.scheduledCallEventId = body.scheduledCallEventId || null;
    if (body.linkedCourseModuleIds !== undefined) updateData.linkedCourseModuleIds = body.linkedCourseModuleIds || null;
    if (body.linkedSummaryIds !== undefined) updateData.linkedSummaryIds = body.linkedSummaryIds || null;
    if (body.linkedCallEventIds !== undefined) updateData.linkedCallEventIds = body.linkedCallEventIds || null;
    if (body.manualNotes !== undefined) updateData.manualNotes = body.manualNotes?.trim() || null;
    if (body.fillSource !== undefined) updateData.fillSource = body.fillSource || null;
    if (body.distribution !== undefined) updateData.distribution = body.distribution || 'spread';
    if (body.coachRecordingUrl !== undefined) updateData.coachRecordingUrl = body.coachRecordingUrl?.trim() || null;
    if (body.coachRecordingNotes !== undefined) updateData.coachRecordingNotes = body.coachRecordingNotes?.trim() || null;

    // Handle moduleId updates (for moving weeks between modules)
    let moduleIdChanged = false;
    if (body.moduleId !== undefined) {
      // Verify target module exists and belongs to this program
      if (body.moduleId) {
        const targetModuleDoc = await adminDb.collection('program_modules').doc(body.moduleId).get();
        if (!targetModuleDoc.exists || targetModuleDoc.data()?.programId !== programId) {
          return NextResponse.json({ error: 'Target module not found' }, { status: 404 });
        }
      }
      const currentModuleId = weekDoc.data()?.moduleId;
      if (body.moduleId !== currentModuleId) {
        moduleIdChanged = true;
        updateData.moduleId = body.moduleId || null;
      }
    }

    await adminDb.collection('program_weeks').doc(weekId).update(updateData);
    console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Updated week ${weekId}`);

    // Recalculate day indices if moduleId changed
    if (moduleIdChanged) {
      await recalculateWeekDayIndices(programId);
    }

    // Distribute tasks to days if requested
    let distributionResult = null;
    if (body.distributeTasksNow === true) {
      try {
        const programData = programDoc.data();
        console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Starting task distribution:`, {
          weekId,
          weeklyTasksCount: body.weeklyTasks?.length ?? 'not in body',
          bodyDistribution: body.distribution,
          programDistribution: programData?.taskDistribution,
          overwriteExisting: body.overwriteExisting || false,
        });
        distributionResult = await distributeWeeklyTasksToDays(programId, weekId, {
          overwriteExisting: body.overwriteExisting || false,
          programTaskDistribution: programData?.taskDistribution, // Use program's distribution setting as fallback
        });
        console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Distributed tasks: ${JSON.stringify(distributionResult)}`);

        // Sync client_program_days with new week distribution (for 1:1 programs)
        // This ensures week-level task changes propagate to client-specific day overrides
        const currentWeekData = weekDoc.data();
        if (currentWeekData?.startDayIndex !== undefined && currentWeekData?.endDayIndex !== undefined) {
          try {
            const clientDaysSyncResult = await syncClientProgramDaysFromWeekDistribution(programId, weekId, {
              startDayIndex: currentWeekData.startDayIndex,
              endDayIndex: currentWeekData.endDayIndex,
            });
            console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Synced client_program_days: ${JSON.stringify(clientDaysSyncResult)}`);
          } catch (clientSyncErr) {
            console.error('[COACH_ORG_PROGRAM_WEEK_PATCH] Failed to sync client_program_days:', clientSyncErr);
            // Don't fail the whole request, just log the error
          }
        }
      } catch (distErr) {
        console.error('[COACH_ORG_PROGRAM_WEEK_PATCH] Failed to distribute tasks:', distErr);
        // Don't fail the whole request, just log the error
      }
    }

    // 2-way sync: If weekly tasks were updated OR distribution happened, sync to all active enrollments
    let syncResult = null;
    // Sync triggers when: weeklyTasks explicitly updated OR distribution ran
    const shouldSync = (body.weeklyTasks !== undefined || distributionResult) && body.syncToClients !== false;
    // When weekly tasks are explicitly updated, use override mode to replace old program-sourced tasks
    // This ensures new task distribution is applied correctly (fill-empty would skip existing tasks)
    const syncMode: SyncMode = body.weeklyTasks !== undefined ? 'override-program-sourced' : 'fill-empty';

    if (shouldSync) {
      try {
        const { userId } = await requireCoachWithOrg();
        console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Syncing with mode=${syncMode}, weeklyTasks updated=${body.weeklyTasks !== undefined}, distributionResult=${!!distributionResult}`);
        syncResult = await syncProgramTasksForDateRange(programId, {
          mode: syncMode,
          horizonDays: 7,
          coachUserId: userId,
        });
        console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Synced tasks to clients: ${JSON.stringify(syncResult)}`);
      } catch (syncErr) {
        console.error('[COACH_ORG_PROGRAM_WEEK_PATCH] Failed to sync tasks to clients:', syncErr);
        // Don't fail the whole request, just log the error
      }

      // Cohort sync for group programs (await to ensure completion before response)
      const program = programDoc.data();
      if (program?.type === 'group') {
        try {
          const { syncProgramTasksToAllCohorts } = await import('@/lib/sync-cohort-tasks');
          const today = new Date().toISOString().split('T')[0];
          const cohortSync = await syncProgramTasksToAllCohorts({
            programId,
            date: today,
            mode: syncMode, // Use same mode as individual sync
            syncHorizonDays: 7,
          });
          console.log(`[COHORT_SYNC] Synced to cohort members with mode=${syncMode}: ${JSON.stringify(cohortSync)}`);
        } catch (err) {
          console.error('[COHORT_SYNC] Sync failed:', err);
        }
      }
    }

    // Fetch the updated week
    const savedDoc = await adminDb.collection('program_weeks').doc(weekId).get();
    const savedWeek = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
    } as ProgramWeek;

    return NextResponse.json({
      success: true,
      week: savedWeek,
      message: 'Week updated successfully',
      ...(distributionResult && { distribution: distributionResult }),
      ...(syncResult && { clientSync: syncResult }),
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_WEEK_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update week' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; weekId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, weekId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const weekDoc = await adminDb.collection('program_weeks').doc(weekId).get();
    if (!weekDoc.exists || weekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // Delete the week
    await adminDb.collection('program_weeks').doc(weekId).delete();
    console.log(`[COACH_ORG_PROGRAM_WEEK_DELETE] Deleted week ${weekId}`);

    return NextResponse.json({
      success: true,
      message: 'Week deleted successfully',
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_WEEK_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to delete week' }, { status: 500 });
  }
}
