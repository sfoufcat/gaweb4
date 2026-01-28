/**
 * Coach API: Individual Program Week Management (Embedded in programs.weeks[])
 *
 * GET /api/coach/org-programs/[programId]/weeks/[weekId] - Get a week
 * PATCH /api/coach/org-programs/[programId]/weeks/[weekId] - Update a week
 * DELETE /api/coach/org-programs/[programId]/weeks/[weekId] - Delete a week
 *
 * NEW: Uses embedded weeks in programs.weeks[] instead of separate program_weeks collection
 * The weekId is the week's id field within the embedded array.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramWeek, ProgramTaskTemplate, Program } from '@/types';

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

    // Fetch program with embedded weeks
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data() as Program;
    const weeks: ProgramWeek[] = programData.weeks || [];

    // Find week by id or weekNumber
    let week = weeks.find(w => w.id === weekId);

    // Fallback: try to find by weekNumber if weekId is numeric
    if (!week && /^\d+$/.test(weekId)) {
      const weekNum = parseInt(weekId, 10);
      week = weeks.find(w => w.weekNumber === weekNum);
    }

    if (!week) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // Ensure all fields are populated
    const enrichedWeek: ProgramWeek = {
      ...week,
      programId,
      organizationId,
    };

    return NextResponse.json({ week: enrichedWeek });
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

    console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Request for week ${weekId}:`, {
      distribution: body.distribution,
      weeklyTasksCount: body.weeklyTasks?.length ?? 'not provided',
    });

    // Fetch program with embedded weeks
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data() as Program;
    const weeks: ProgramWeek[] = programData.weeks || [];

    // Find week index by id or weekNumber
    let weekIndex = weeks.findIndex(w => w.id === weekId);

    // Fallback: try to find by weekNumber if weekId is numeric
    if (weekIndex === -1 && /^\d+$/.test(weekId)) {
      const weekNum = parseInt(weekId, 10);
      weekIndex = weeks.findIndex(w => w.weekNumber === weekNum);
    }

    if (weekIndex === -1) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    const existingWeek = weeks[weekIndex];
    const now = new Date().toISOString();

    // Handle moduleId updates (for moving weeks between modules)
    if (body.moduleId !== undefined && body.moduleId !== existingWeek.moduleId) {
      // Verify target module exists and belongs to this program
      if (body.moduleId) {
        const targetModuleDoc = await adminDb.collection('program_modules').doc(body.moduleId).get();
        if (!targetModuleDoc.exists || targetModuleDoc.data()?.programId !== programId) {
          return NextResponse.json({ error: 'Target module not found' }, { status: 404 });
        }
      }
    }

    // Build updated week (only update provided fields)
    const updatedWeek: ProgramWeek = {
      ...existingWeek,
      updatedAt: now,
    };

    if (body.name !== undefined) updatedWeek.name = body.name?.trim() || undefined;
    if (body.description !== undefined) updatedWeek.description = body.description?.trim() || undefined;
    if (body.theme !== undefined) updatedWeek.theme = body.theme?.trim() || undefined;
    if (body.weeklyPrompt !== undefined) updatedWeek.weeklyPrompt = body.weeklyPrompt?.trim() || undefined;
    if (body.order !== undefined) updatedWeek.order = body.order;
    if (body.weekNumber !== undefined) updatedWeek.weekNumber = body.weekNumber;
    if (body.startDayIndex !== undefined) updatedWeek.startDayIndex = body.startDayIndex;
    if (body.endDayIndex !== undefined) updatedWeek.endDayIndex = body.endDayIndex;
    if (body.weeklyTasks !== undefined) updatedWeek.weeklyTasks = processTasksWithIds(body.weeklyTasks);
    if (body.weeklyHabits !== undefined) updatedWeek.weeklyHabits = body.weeklyHabits || undefined;
    if (body.currentFocus !== undefined) updatedWeek.currentFocus = body.currentFocus || undefined;
    if (body.notes !== undefined) updatedWeek.notes = body.notes || undefined;
    if (body.scheduledCallEventId !== undefined) updatedWeek.scheduledCallEventId = body.scheduledCallEventId || undefined;
    if (body.linkedCourseModuleIds !== undefined) updatedWeek.linkedCourseModuleIds = body.linkedCourseModuleIds || undefined;
    if (body.linkedSummaryIds !== undefined) updatedWeek.linkedSummaryIds = body.linkedSummaryIds || undefined;
    if (body.linkedCallEventIds !== undefined) updatedWeek.linkedCallEventIds = body.linkedCallEventIds || undefined;
    // Linked resources
    if (body.linkedArticleIds !== undefined) updatedWeek.linkedArticleIds = body.linkedArticleIds || [];
    if (body.linkedDownloadIds !== undefined) updatedWeek.linkedDownloadIds = body.linkedDownloadIds || [];
    if (body.linkedLinkIds !== undefined) updatedWeek.linkedLinkIds = body.linkedLinkIds || [];
    if (body.linkedQuestionnaireIds !== undefined) updatedWeek.linkedQuestionnaireIds = body.linkedQuestionnaireIds || [];
    if (body.linkedCourseIds !== undefined) updatedWeek.linkedCourseIds = body.linkedCourseIds || [];
    if (body.courseAssignments !== undefined) updatedWeek.courseAssignments = body.courseAssignments || [];
    if (body.resourceAssignments !== undefined) updatedWeek.resourceAssignments = body.resourceAssignments || [];
    if (body.manualNotes !== undefined) updatedWeek.manualNotes = body.manualNotes?.trim() || undefined;
    if (body.fillSource !== undefined) updatedWeek.fillSource = body.fillSource || undefined;
    if (body.distribution !== undefined) updatedWeek.distribution = body.distribution || 'spread';
    if (body.coachRecordingUrl !== undefined) updatedWeek.coachRecordingUrl = body.coachRecordingUrl?.trim() || undefined;
    if (body.coachRecordingNotes !== undefined) updatedWeek.coachRecordingNotes = body.coachRecordingNotes?.trim() || undefined;
    if (body.moduleId !== undefined) updatedWeek.moduleId = body.moduleId || '';

    // Update the weeks array
    const updatedWeeks = [...weeks];
    updatedWeeks[weekIndex] = updatedWeek;

    // Update the program document
    await adminDb.collection('programs').doc(programId).update({
      weeks: updatedWeeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Updated week ${weekId} in program ${programId}`);

    // Sync updated week content to all instances of this program
    // This ensures clients see the changes immediately without manual sync
    // Query all instances for this program (status field may not exist on older instances)
    const instancesSnapshot = await adminDb.collection('program_instances')
      .where('programId', '==', programId)
      .get();

    if (!instancesSnapshot.empty) {
      const weekNumber = updatedWeek.weekNumber;
      console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Syncing week ${weekNumber} to ${instancesSnapshot.docs.length} instances`);

      await Promise.all(instancesSnapshot.docs.map(async (instanceDoc) => {
        const instanceData = instanceDoc.data();
        const instanceWeeks = instanceData.weeks || [];
        const instanceWeekIndex = instanceWeeks.findIndex((w: { weekNumber: number }) => w.weekNumber === weekNumber);

        if (instanceWeekIndex !== -1) {
          // Update the week in the instance with template content
          // Preserve instance-specific fields (recordings, manual notes, etc.)
          const existingInstanceWeek = instanceWeeks[instanceWeekIndex];
          instanceWeeks[instanceWeekIndex] = {
            ...existingInstanceWeek,
            // Sync from template
            name: updatedWeek.name,
            theme: updatedWeek.theme,
            description: updatedWeek.description,
            weeklyPrompt: updatedWeek.weeklyPrompt,
            weeklyTasks: updatedWeek.weeklyTasks,
            weeklyHabits: updatedWeek.weeklyHabits,
            currentFocus: updatedWeek.currentFocus,
            notes: updatedWeek.notes,
            distribution: updatedWeek.distribution,
            // Sync resources
            resourceAssignments: updatedWeek.resourceAssignments || [],
            linkedArticleIds: updatedWeek.linkedArticleIds || [],
            linkedDownloadIds: updatedWeek.linkedDownloadIds || [],
            linkedLinkIds: updatedWeek.linkedLinkIds || [],
            linkedCourseIds: updatedWeek.linkedCourseIds || [],
            linkedQuestionnaireIds: updatedWeek.linkedQuestionnaireIds || [],
            courseAssignments: updatedWeek.courseAssignments || [],
            // Keep instance-specific fields
            coachRecordingUrl: existingInstanceWeek.coachRecordingUrl,
            coachRecordingNotes: existingInstanceWeek.coachRecordingNotes,
            manualNotes: existingInstanceWeek.manualNotes,
            linkedSummaryIds: existingInstanceWeek.linkedSummaryIds,
            linkedCallEventIds: existingInstanceWeek.linkedCallEventIds,
            days: existingInstanceWeek.days, // Preserve distributed tasks
          };

          await instanceDoc.ref.update({
            weeks: instanceWeeks,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`[COACH_ORG_PROGRAM_WEEK_PATCH] Synced week ${weekNumber} to instance ${instanceDoc.id}`);
        }
      }));
    }

    // Return the updated week with full context
    const responseWeek: ProgramWeek = {
      ...updatedWeek,
      programId,
      organizationId,
    };

    return NextResponse.json({
      success: true,
      week: responseWeek,
      instancesUpdated: instancesSnapshot.docs.length,
      message: 'Week updated successfully',
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

    // Fetch program with embedded weeks
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data() as Program;
    const weeks: ProgramWeek[] = programData.weeks || [];

    // Find week index by id or weekNumber
    let weekIndex = weeks.findIndex(w => w.id === weekId);

    // Fallback: try to find by weekNumber if weekId is numeric
    if (weekIndex === -1 && /^\d+$/.test(weekId)) {
      const weekNum = parseInt(weekId, 10);
      weekIndex = weeks.findIndex(w => w.weekNumber === weekNum);
    }

    if (weekIndex === -1) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // Prevent deletion of Onboarding (first) and Closing (last) weeks
    const weekToDelete = weeks[weekIndex];
    const isOnboarding = weekIndex === 0 || weekToDelete.weekNumber === 0;
    const isClosing = weekIndex === weeks.length - 1 || weekToDelete.weekNumber === -1;

    if (isOnboarding) {
      return NextResponse.json({ error: 'Cannot delete Onboarding week' }, { status: 400 });
    }
    if (isClosing) {
      return NextResponse.json({ error: 'Cannot delete Closing week' }, { status: 400 });
    }

    // Remove the week from the array
    const remainingWeeks = weeks.filter((_, index) => index !== weekIndex);

    // Recalculate all weeks' day indices and week numbers
    const daysPerWeek = programData.includeWeekends !== false ? 7 : 5;
    const numWeeks = remainingWeeks.length;
    const now = new Date().toISOString();

    const updatedWeeks = remainingWeeks.map((week, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === numWeeks - 1;

      // Calculate new weekNumber: 0 for first (Onboarding), -1 for last (Closing), else sequential
      let newWeekNumber: number;
      if (isFirst) {
        newWeekNumber = 0;
      } else if (isLast && numWeeks > 2) {
        newWeekNumber = -1;
      } else {
        newWeekNumber = idx;
      }

      // Calculate new day indices
      const newStartDayIndex = idx * daysPerWeek + 1;
      const newEndDayIndex = newStartDayIndex + daysPerWeek - 1;

      return {
        ...week,
        weekNumber: newWeekNumber,
        startDayIndex: newStartDayIndex,
        endDayIndex: newEndDayIndex,
        updatedAt: now,
      };
    });

    // Calculate new program lengthDays
    const newLengthDays = numWeeks * daysPerWeek;

    // Update the program document with recalculated weeks and lengthDays
    await adminDb.collection('programs').doc(programId).update({
      weeks: updatedWeeks,
      lengthDays: newLengthDays,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COACH_ORG_PROGRAM_WEEK_DELETE] Deleted week ${weekId}, recalculated ${numWeeks} weeks, lengthDays=${newLengthDays}`);

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
