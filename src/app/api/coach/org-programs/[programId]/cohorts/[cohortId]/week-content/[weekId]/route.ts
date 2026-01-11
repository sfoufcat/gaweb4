/**
 * Cohort Week Content API (Using program_instances)
 * Manages cohort-specific week content via embedded weeks in program_instances
 *
 * GET - Fetch cohort week content from program_instances.weeks[]
 * PUT - Create or update cohort week content (upsert)
 * PATCH - Partial update of cohort week content
 *
 * NEW: Uses program_instances.weeks[] instead of separate cohort_week_content collection
 * The weekId parameter is the weekNumber (e.g., "1", "2") or the week's id field
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramTaskTemplate, ProgramCohort, Program, ProgramInstance, ProgramInstanceWeek, ProgramInstanceTask, ProgramInstanceDay } from '@/types';
import { getProgramCompletionThreshold } from '@/lib/cohort-task-state';
import { calculateCalendarWeeks, type CalendarWeek } from '@/lib/calendar-weeks';

/**
 * Sync day tasks to a user's tasks collection (new instance-based sync)
 */
async function syncDayTasksToUser(
  instanceId: string,
  userId: string,
  dayIndex: number,
  tasks: ProgramInstanceTask[],
  calendarDate?: string
): Promise<{ created: number; updated: number; deleted: number }> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();
  let created = 0, updated = 0, deleted = 0;

  // Get existing tasks for this instance + day + user
  const existingTasksQuery = await adminDb.collection('tasks')
    .where('userId', '==', userId)
    .where('instanceId', '==', instanceId)
    .where('dayIndex', '==', dayIndex)
    .get();

  const existingTasksByInstanceTaskId = new Map<string, { id: string; completed: boolean; completedAt?: string }>();
  for (const doc of existingTasksQuery.docs) {
    const taskData = doc.data();
    if (taskData.instanceTaskId) {
      existingTasksByInstanceTaskId.set(taskData.instanceTaskId, {
        id: doc.id,
        completed: taskData.completed || false,
        completedAt: taskData.completedAt,
      });
    }
  }

  const processedInstanceTaskIds = new Set<string>();

  // Create/update tasks
  for (const task of tasks) {
    processedInstanceTaskIds.add(task.id);

    const existing = existingTasksByInstanceTaskId.get(task.id);

    if (existing) {
      // Update existing task (preserve completion status)
      const taskRef = adminDb.collection('tasks').doc(existing.id);
      batch.update(taskRef, {
        label: task.label,
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes,
        notes: task.notes,
        tag: task.tag,
        date: calendarDate,
        updatedAt: now,
      });
      updated++;
    } else {
      // Create new task
      const taskRef = adminDb.collection('tasks').doc();
      batch.set(taskRef, {
        userId,
        instanceId,
        instanceTaskId: task.id,
        label: task.label,
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes,
        notes: task.notes,
        tag: task.tag,
        source: 'program',
        dayIndex,
        date: calendarDate,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
  }

  // Delete tasks that are no longer in the day (coach deleted them)
  for (const [templateId, existing] of existingTasksByInstanceTaskId.entries()) {
    if (!processedInstanceTaskIds.has(templateId)) {
      const taskRef = adminDb.collection('tasks').doc(existing.id);
      batch.delete(taskRef);
      deleted++;
    }
  }

  await batch.commit();
  return { created, updated, deleted };
}

/**
 * Sync week tasks to all cohort members using the new instance-based system
 */
async function syncWeekTasksToMembers(
  instanceId: string,
  cohortId: string,
  week: ProgramInstanceWeek
): Promise<{ membersProcessed: number; totalTasksCreated: number; totalTasksUpdated: number; totalTasksDeleted: number }> {
  // Get active cohort members
  const enrollmentsSnap = await adminDb.collection('program_enrollments')
    .where('cohortId', '==', cohortId)
    .where('status', 'in', ['active', 'completed'])
    .get();

  const memberUserIds = enrollmentsSnap.docs.map(doc => doc.data().userId).filter(Boolean);

  if (memberUserIds.length === 0) {
    console.log(`[SYNC_WEEK_TO_MEMBERS] No active members in cohort ${cohortId}`);
    return { membersProcessed: 0, totalTasksCreated: 0, totalTasksUpdated: 0, totalTasksDeleted: 0 };
  }

  let totalTasksCreated = 0;
  let totalTasksUpdated = 0;
  let totalTasksDeleted = 0;

  // Sync each day's tasks to each member
  for (const day of week.days || []) {
    const tasks = (day.tasks || []) as ProgramInstanceTask[];

    for (const userId of memberUserIds) {
      const result = await syncDayTasksToUser(
        instanceId,
        userId,
        day.globalDayIndex,
        tasks,
        day.calendarDate
      );
      totalTasksCreated += result.created;
      totalTasksUpdated += result.updated;
      totalTasksDeleted += result.deleted;
    }
  }

  console.log(`[SYNC_WEEK_TO_MEMBERS] Synced week ${week.weekNumber} to ${memberUserIds.length} members: ${totalTasksCreated} created, ${totalTasksUpdated} updated, ${totalTasksDeleted} deleted`);

  return {
    membersProcessed: memberUserIds.length,
    totalTasksCreated,
    totalTasksUpdated,
    totalTasksDeleted,
  };
}

/**
 * Process tasks to ensure each has a unique ID for robust matching.
 * Preserves existing IDs, generates new UUIDs for tasks without IDs.
 * Also strips runtime completion data that should never be stored in templates.
 */
function processTasksWithIds(tasks: ProgramTaskTemplate[] | undefined): ProgramTaskTemplate[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((task) => {
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

type RouteParams = { params: Promise<{ programId: string; cohortId: string; weekId: string }> };

/**
 * Find or create the program instance for a cohort
 */
async function getOrCreateCohortInstance(
  programId: string,
  cohortId: string,
  organizationId: string,
  programData: Program,
  cohortData: ProgramCohort
): Promise<{ instanceId: string; instance: ProgramInstance }> {
  // Try to find existing instance
  const instanceQuery = await adminDb
    .collection('program_instances')
    .where('cohortId', '==', cohortId)
    .where('programId', '==', programId)
    .limit(1)
    .get();

  if (!instanceQuery.empty) {
    const doc = instanceQuery.docs[0];
    return {
      instanceId: doc.id,
      instance: { id: doc.id, ...doc.data() } as ProgramInstance,
    };
  }

  // Create new instance from template
  console.log(`[COHORT_WEEK_CONTENT] Auto-creating instance for cohort ${cohortId}`);
  const daysPerWeek = programData.includeWeekends !== false ? 7 : 5;

  // Read weeks from programs.weeks[] or fallback to program_weeks collection
  let weeks: ProgramInstanceWeek[] = [];

  if (programData.weeks && Array.isArray(programData.weeks) && programData.weeks.length > 0) {
    weeks = programData.weeks.map((weekData) => {
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
        startDayIndex: weekData.startDayIndex,
        endDayIndex: weekData.endDayIndex,
        days,
      } as ProgramInstanceWeek;
    });
  } else {
    // Fallback to program_weeks collection
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
      } as ProgramInstanceWeek;
    });
  }

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
  console.log(`[COHORT_WEEK_CONTENT] Created instance ${newInstanceRef.id} for cohort ${cohortId}`);

  return {
    instanceId: newInstanceRef.id,
    instance: { id: newInstanceRef.id, ...instanceData } as ProgramInstance,
  };
}

/**
 * Find week in instance by weekId (can be weekNumber or week.id)
 */
function findWeekInInstance(weeks: ProgramInstanceWeek[], weekId: string): { week: ProgramInstanceWeek; index: number } | null {
  // Try by weekNumber first if numeric (more reliable than id)
  if (/^\d+$/.test(weekId)) {
    const weekNum = parseInt(weekId, 10);
    const index = weeks.findIndex(w => w.weekNumber === weekNum);
    if (index !== -1) return { week: weeks[index], index };
  }

  // Fallback: try by id
  const index = weeks.findIndex(w => w.id === weekId);
  if (index === -1) return null;
  return { week: weeks[index], index };
}

/**
 * GET /api/coach/org-programs/[programId]/cohorts/[cohortId]/week-content/[weekId]
 * Returns the cohort-specific week content from program_instances
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortId, weekId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const programData = programDoc.data() as Program;

    // Verify cohort exists and belongs to this program
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists || cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    const cohortData = cohortDoc.data() as ProgramCohort;

    // Get or create the instance
    const { instance } = await getOrCreateCohortInstance(
      programId,
      cohortId,
      organizationId,
      programData,
      cohortData
    );

    // Find the week in the instance
    const weekResult = findWeekInInstance(instance.weeks || [], weekId);
    if (!weekResult) {
      return NextResponse.json({ error: 'Week not found in instance' }, { status: 404 });
    }

    const { week } = weekResult;

    // Build content response (matching old cohort_week_content structure for compatibility)
    const content = {
      id: week.id || `week-${week.weekNumber}`,
      cohortId,
      programWeekId: weekId, // For backward compatibility
      programId,
      organizationId,
      weekNumber: week.weekNumber,
      coachRecordingUrl: week.coachRecordingUrl,
      coachRecordingNotes: week.coachRecordingNotes,
      linkedSummaryIds: week.linkedSummaryIds || [],
      linkedCallEventIds: week.linkedCallEventIds || [],
      manualNotes: week.manualNotes,
      weeklyTasks: week.weeklyTasks || [],
      weeklyHabits: week.weeklyHabits || [],
      weeklyPrompt: week.weeklyPrompt,
      distribution: week.distribution,
      name: week.name,
      theme: week.theme,
    };

    // Merge completion status from tasks collection
    if (content.weeklyTasks && content.weeklyTasks.length > 0) {
      const threshold = await getProgramCompletionThreshold(programId);

      // Get cohort members
      const enrollmentsSnapshot = await adminDb
        .collection('program_enrollments')
        .where('cohortId', '==', cohortId)
        .where('status', 'in', ['active', 'upcoming'])
        .get();
      const memberIds = enrollmentsSnapshot.docs.map(d => d.data().userId as string);
      const totalMembers = memberIds.length;

      // Calculate calendar week dates
      let calendarWeek: CalendarWeek | undefined;
      if (cohortData.startDate) {
        const includeWeekends = programData.includeWeekends !== false;
        const totalDays = programData.lengthDays;
        const calendarWeeks = calculateCalendarWeeks(cohortData.startDate, totalDays, includeWeekends);
        const calendarRegularWeeks = calendarWeeks
          .filter((w: CalendarWeek) => w.weekNumber > 0)
          .sort((a: CalendarWeek, b: CalendarWeek) => a.startDayIndex - b.startDayIndex);

        // Map week to calendar week by position
        const weekPosition = week.weekNumber - 1;
        calendarWeek = calendarRegularWeeks[weekPosition];
      }

      if (calendarWeek && totalMembers > 0) {
        // Query completed tasks for the week's date range
        const completedTasksSnapshot = await adminDb
          .collection('tasks')
          .where('date', '>=', calendarWeek.startDate)
          .where('date', '<=', calendarWeek.endDate)
          .where('completed', '==', true)
          .get();

        content.weeklyTasks = content.weeklyTasks.map((template) => {
          const memberCompletions = completedTasksSnapshot.docs.filter(d => {
            const data = d.data();
            const titleMatches = data.title === template.label || data.originalTitle === template.label;
            return titleMatches && memberIds.includes(data.userId);
          });

          const completedCount = memberCompletions.length;
          const completionRate = totalMembers > 0 ? Math.round((completedCount / totalMembers) * 100) : 0;
          const isThresholdMet = completionRate >= threshold;

          return {
            ...template,
            completed: isThresholdMet,
            completionRate,
            completedCount,
            totalMembers,
          };
        });
      }
    }

    return NextResponse.json({ content, exists: true });
  } catch (error) {
    console.error('[COHORT_WEEK_CONTENT_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch cohort week content' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-programs/[programId]/cohorts/[cohortId]/week-content/[weekId]
 * Create or update cohort week content (upsert) in program_instances
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortId, weekId } = await params;
    const body = await request.json();

    // Verify program and cohort
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const programData = programDoc.data() as Program;

    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists || cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    const cohortData = cohortDoc.data() as ProgramCohort;

    // Get or create instance
    const { instanceId, instance } = await getOrCreateCohortInstance(
      programId,
      cohortId,
      organizationId,
      programData,
      cohortData
    );

    // Find the week
    const weeks = [...(instance.weeks || [])];
    const weekResult = findWeekInInstance(weeks, weekId);

    if (!weekResult) {
      return NextResponse.json({ error: 'Week not found in instance' }, { status: 404 });
    }

    const { index: weekIndex } = weekResult;
    const now = new Date().toISOString();

    // Update the week with new content
    const updatedWeek: ProgramInstanceWeek = {
      ...weeks[weekIndex],
      coachRecordingUrl: body.coachRecordingUrl?.trim() || undefined,
      coachRecordingNotes: body.coachRecordingNotes?.trim() || undefined,
      linkedSummaryIds: body.linkedSummaryIds || [],
      linkedCallEventIds: body.linkedCallEventIds || [],
      manualNotes: body.manualNotes?.trim() || undefined,
      weeklyTasks: processTasksWithIds(body.weeklyTasks),
      weeklyHabits: body.weeklyHabits || [],
      weeklyPrompt: body.weeklyPrompt?.trim() || undefined,
      distribution: body.distribution || undefined,
      updatedAt: now,
    };

    weeks[weekIndex] = updatedWeek;

    // Distribute weeklyTasks to days if distribution is specified
    if (body.distributeTasksNow === true && Array.isArray(body.weeklyTasks)) {
      const distributionType = body.distribution || 'spread';
      const weeklyTasks = processTasksWithIds(body.weeklyTasks) as ProgramInstanceTask[];
      const daysToUpdate = updatedWeek.days || [];

      console.log(`[COHORT_WEEK_CONTENT_PUT] Distributing ${weeklyTasks.length} tasks with type: ${distributionType}`);

      if (distributionType === 'spread') {
        // Spread tasks evenly across days
        const targetDays = daysToUpdate.map(d => d.dayIndex);
        const tasksPerDay = targetDays.length > 0 ? Math.ceil(weeklyTasks.length / targetDays.length) : 0;

        let taskIdx = 0;
        for (const day of daysToUpdate) {
          const tasksForDay = weeklyTasks.slice(taskIdx, taskIdx + tasksPerDay);
          day.tasks = [
            ...(day.tasks || []).filter((t: ProgramInstanceTask) => t.source && t.source !== 'week'),
            ...tasksForDay.map(t => ({ ...t, source: 'week' as const })),
          ];
          taskIdx += tasksPerDay;
        }
      } else if (distributionType === 'repeat-daily' || distributionType === 'all_days') {
        // Add all tasks to all days
        for (const day of daysToUpdate) {
          day.tasks = [
            ...(day.tasks || []).filter((t: ProgramInstanceTask) => t.source && t.source !== 'week'),
            ...weeklyTasks.map(t => ({ ...t, source: 'week' as const })),
          ];
        }
      } else if (distributionType === 'first_day') {
        // Add all tasks to first day only
        if (daysToUpdate.length > 0) {
          daysToUpdate[0].tasks = [
            ...(daysToUpdate[0].tasks || []).filter((t: ProgramInstanceTask) => t.source && t.source !== 'week'),
            ...weeklyTasks.map(t => ({ ...t, source: 'week' as const })),
          ];
        }
      }

      // Update the week with distributed tasks
      updatedWeek.days = daysToUpdate;
      weeks[weekIndex] = updatedWeek;
    }

    // Update the instance
    await adminDb.collection('program_instances').doc(instanceId).update({
      weeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COHORT_WEEK_CONTENT_PUT] Updated week ${weekId} in instance ${instanceId}`);

    // Build response content
    const savedContent = {
      ...updatedWeek,
      id: updatedWeek.id || `week-${updatedWeek.weekNumber}`,
      cohortId,
      programWeekId: weekId,
      programId,
      organizationId,
      weekNumber: updatedWeek.weekNumber,
    };

    // Trigger task sync if requested (using new instance-based sync)
    let syncResult = null;
    if (body.distributeTasksNow === true) {
      try {
        syncResult = await syncWeekTasksToMembers(instanceId, cohortId, updatedWeek);
        console.log(`[COHORT_WEEK_CONTENT_PUT] Synced to ${syncResult.membersProcessed} members: ${syncResult.totalTasksCreated} created, ${syncResult.totalTasksUpdated} updated`);
      } catch (syncErr) {
        console.error('[COHORT_WEEK_CONTENT_PUT] Sync failed:', syncErr);
      }
    }

    return NextResponse.json({
      success: true,
      content: savedContent,
      created: false,
      ...(syncResult && { memberSync: { tasksCreated: syncResult.totalTasksCreated, membersProcessed: syncResult.membersProcessed } }),
    });
  } catch (error) {
    console.error('[COHORT_WEEK_CONTENT_PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to save cohort week content' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/org-programs/[programId]/cohorts/[cohortId]/week-content/[weekId]
 * Partial update of cohort week content in program_instances
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortId, weekId } = await params;
    const body = await request.json();

    // Verify program and cohort
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const programData = programDoc.data() as Program;

    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists || cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    const cohortData = cohortDoc.data() as ProgramCohort;

    // Get or create instance
    const { instanceId, instance } = await getOrCreateCohortInstance(
      programId,
      cohortId,
      organizationId,
      programData,
      cohortData
    );

    // Find the week
    const weeks = [...(instance.weeks || [])];
    const weekResult = findWeekInInstance(weeks, weekId);

    if (!weekResult) {
      return NextResponse.json({ error: 'Week not found in instance' }, { status: 404 });
    }

    const { week: existingWeek, index: weekIndex } = weekResult;
    const now = new Date().toISOString();

    // Build updated week (only update provided fields)
    const updatedWeek: ProgramInstanceWeek = {
      ...existingWeek,
      updatedAt: now,
    };

    if (body.coachRecordingUrl !== undefined) {
      updatedWeek.coachRecordingUrl = body.coachRecordingUrl?.trim() || undefined;
    }
    if (body.coachRecordingNotes !== undefined) {
      updatedWeek.coachRecordingNotes = body.coachRecordingNotes?.trim() || undefined;
    }
    if (body.linkedSummaryIds !== undefined) {
      updatedWeek.linkedSummaryIds = body.linkedSummaryIds || [];
    }
    if (body.linkedCallEventIds !== undefined) {
      updatedWeek.linkedCallEventIds = body.linkedCallEventIds || [];
    }
    if (body.manualNotes !== undefined) {
      updatedWeek.manualNotes = body.manualNotes?.trim() || undefined;
    }
    if (body.weeklyTasks !== undefined) {
      updatedWeek.weeklyTasks = processTasksWithIds(body.weeklyTasks);
    }
    if (body.weeklyHabits !== undefined) {
      updatedWeek.weeklyHabits = body.weeklyHabits || [];
    }
    if (body.weeklyPrompt !== undefined) {
      updatedWeek.weeklyPrompt = body.weeklyPrompt?.trim() || undefined;
    }
    if (body.distribution !== undefined) {
      updatedWeek.distribution = body.distribution || undefined;
    }
    if (body.name !== undefined) {
      updatedWeek.name = body.name?.trim() || undefined;
    }
    if (body.theme !== undefined) {
      updatedWeek.theme = body.theme?.trim() || undefined;
    }

    weeks[weekIndex] = updatedWeek;

    // Distribute weeklyTasks to days if distribution is specified
    if (body.distributeTasksNow === true && updatedWeek.weeklyTasks) {
      const distributionType = updatedWeek.distribution || 'spread';
      const weeklyTasks = (updatedWeek.weeklyTasks || []) as ProgramInstanceTask[];
      const daysToUpdate = updatedWeek.days || [];

      console.log(`[COHORT_WEEK_CONTENT_PATCH] Distributing ${weeklyTasks.length} tasks with type: ${distributionType}`);

      if (distributionType === 'spread') {
        // Spread tasks evenly across days
        const targetDays = daysToUpdate.map(d => d.dayIndex);
        const tasksPerDay = targetDays.length > 0 ? Math.ceil(weeklyTasks.length / targetDays.length) : 0;

        let taskIdx = 0;
        for (const day of daysToUpdate) {
          const tasksForDay = weeklyTasks.slice(taskIdx, taskIdx + tasksPerDay);
          day.tasks = [
            ...(day.tasks || []).filter((t: ProgramInstanceTask) => t.source && t.source !== 'week'),
            ...tasksForDay.map(t => ({ ...t, source: 'week' as const })),
          ];
          taskIdx += tasksPerDay;
        }
      } else if (distributionType === 'repeat-daily' || distributionType === 'all_days') {
        // Add all tasks to all days
        for (const day of daysToUpdate) {
          day.tasks = [
            ...(day.tasks || []).filter((t: ProgramInstanceTask) => t.source && t.source !== 'week'),
            ...weeklyTasks.map(t => ({ ...t, source: 'week' as const })),
          ];
        }
      } else if (distributionType === 'first_day') {
        // Add all tasks to first day only
        if (daysToUpdate.length > 0) {
          daysToUpdate[0].tasks = [
            ...(daysToUpdate[0].tasks || []).filter((t: ProgramInstanceTask) => t.source && t.source !== 'week'),
            ...weeklyTasks.map(t => ({ ...t, source: 'week' as const })),
          ];
        }
      }

      // Update the week with distributed tasks
      updatedWeek.days = daysToUpdate;
      weeks[weekIndex] = updatedWeek;
    }

    // Update the instance
    await adminDb.collection('program_instances').doc(instanceId).update({
      weeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COHORT_WEEK_CONTENT_PATCH] Updated week ${weekId} in instance ${instanceId}`);

    // Build response content
    const savedContent = {
      ...updatedWeek,
      id: updatedWeek.id || `week-${updatedWeek.weekNumber}`,
      cohortId,
      programWeekId: weekId,
      programId,
      organizationId,
      weekNumber: updatedWeek.weekNumber,
    };

    // Trigger task sync if requested (using new instance-based sync)
    let syncResult = null;
    if (body.distributeTasksNow === true) {
      try {
        syncResult = await syncWeekTasksToMembers(instanceId, cohortId, updatedWeek);
        console.log(`[COHORT_WEEK_CONTENT_PATCH] Synced to ${syncResult.membersProcessed} members: ${syncResult.totalTasksCreated} created, ${syncResult.totalTasksUpdated} updated`);
      } catch (syncErr) {
        console.error('[COHORT_WEEK_CONTENT_PATCH] Sync failed:', syncErr);
      }
    }

    return NextResponse.json({
      success: true,
      content: savedContent,
      created: false,
      ...(syncResult && { memberSync: { tasksCreated: syncResult.totalTasksCreated, membersProcessed: syncResult.membersProcessed } }),
    });
  } catch (error) {
    console.error('[COHORT_WEEK_CONTENT_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update cohort week content' }, { status: 500 });
  }
}
