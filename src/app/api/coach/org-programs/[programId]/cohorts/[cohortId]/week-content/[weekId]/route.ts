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
import { calculateCalendarWeeks, dayIndexToDate, type CalendarWeek } from '@/lib/calendar-weeks';

/**
 * Sync day tasks to a user's tasks collection (new instance-based sync)
 */
async function syncDayTasksToUser(
  instanceId: string,
  userId: string,
  dayIndex: number,
  tasks: ProgramInstanceTask[],
  calendarDate?: string,
  organizationId?: string,
  enrollmentId?: string,
  programId?: string
): Promise<{ created: number; updated: number; deleted: number }> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();
  let created = 0, updated = 0, deleted = 0;

  // Get org's focus limit setting
  let focusLimit = 3; // Default
  if (organizationId) {
    try {
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
      const orgSettings = orgSettingsDoc.data();
      focusLimit = orgSettings?.defaultDailyFocusSlots ?? 3;
    } catch {
      // Fallback to 3 if org settings can't be fetched
    }
  }

  // Get existing tasks for this instance + day + user
  const existingTasksQuery = await adminDb.collection('tasks')
    .where('userId', '==', userId)
    .where('instanceId', '==', instanceId)
    .where('dayIndex', '==', dayIndex)
    .get();

  const existingTasksByInstanceTaskId = new Map<string, { id: string; completed: boolean; completedAt?: string; listType?: string }>();
  for (const doc of existingTasksQuery.docs) {
    const taskData = doc.data();
    if (taskData.instanceTaskId) {
      existingTasksByInstanceTaskId.set(taskData.instanceTaskId, {
        id: doc.id,
        completed: taskData.completed || false,
        completedAt: taskData.completedAt,
        listType: taskData.listType,
      });
    }
  }

  // Count how many focus tasks the user already has for this date (excluding this instance's tasks)
  let existingFocusCount = 0;
  if (calendarDate) {
    const focusTasksQuery = await adminDb.collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', calendarDate)
      .where('listType', '==', 'focus')
      .get();
    // Count focus tasks that are NOT from this instance (to avoid double counting)
    existingFocusCount = focusTasksQuery.docs.filter(doc => doc.data().instanceId !== instanceId).length;
  }

  let availableFocusSlots = focusLimit - existingFocusCount;

  const processedInstanceTaskIds = new Set<string>();

  // Separate primary and non-primary tasks
  const primaryTasks = tasks.filter(t => t.isPrimary);
  const nonPrimaryTasks = tasks.filter(t => !t.isPrimary);

  // Process primary tasks first (try to put in Focus)
  for (const task of primaryTasks) {
    processedInstanceTaskIds.add(task.id);

    const existing = existingTasksByInstanceTaskId.get(task.id);

    if (existing) {
      // Update existing task - preserve listType if already set
      const taskRef = adminDb.collection('tasks').doc(existing.id);
      batch.update(taskRef, {
        title: task.label,
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes,
        notes: task.notes,
        tag: task.tag,
        date: calendarDate,
        updatedAt: now,
      });
      // If existing task is in focus, count it towards our slots
      if (existing.listType === 'focus') {
        availableFocusSlots--;
      }
      updated++;
    } else {
      // Create new task - determine listType based on available slots
      const listType = availableFocusSlots > 0 ? 'focus' : 'backlog';
      if (listType === 'focus') {
        availableFocusSlots--;
      }

      const taskRef = adminDb.collection('tasks').doc();
      batch.set(taskRef, {
        userId,
        organizationId,
        instanceId,
        instanceTaskId: task.id,
        title: task.label,
        originalTitle: task.label, // Preserve original title for cohort matching
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes,
        notes: task.notes,
        tag: task.tag,
        sourceType: 'program',
        listType,
        dayIndex,
        programDayIndex: dayIndex, // Required for cohort task state sync
        programEnrollmentId: enrollmentId, // Required for cohort task state sync
        programId, // Program reference
        date: calendarDate,
        status: 'pending',
        order: created,
        isPrivate: false,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
  }

  // Process non-primary tasks (always go to backlog)
  for (const task of nonPrimaryTasks) {
    processedInstanceTaskIds.add(task.id);

    const existing = existingTasksByInstanceTaskId.get(task.id);

    if (existing) {
      // Update existing task
      const taskRef = adminDb.collection('tasks').doc(existing.id);
      batch.update(taskRef, {
        title: task.label,
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
      // Create new task - non-primary always goes to backlog
      const taskRef = adminDb.collection('tasks').doc();
      batch.set(taskRef, {
        userId,
        organizationId,
        instanceId,
        instanceTaskId: task.id,
        title: task.label,
        originalTitle: task.label, // Preserve original title for cohort matching
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes,
        notes: task.notes,
        tag: task.tag,
        sourceType: 'program',
        listType: 'backlog',
        dayIndex,
        programDayIndex: dayIndex, // Required for cohort task state sync
        programEnrollmentId: enrollmentId, // Required for cohort task state sync
        programId, // Program reference
        date: calendarDate,
        status: 'pending',
        order: created,
        isPrivate: false,
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
  week: ProgramInstanceWeek,
  cohortStartDate?: string,
  includeWeekends?: boolean,
  organizationId?: string,
  programId?: string
): Promise<{ membersProcessed: number; totalTasksCreated: number; totalTasksUpdated: number; totalTasksDeleted: number }> {
  // Get cohort members (only active/upcoming - don't sync to completed/stopped enrollments)
  const enrollmentsSnap = await adminDb.collection('program_enrollments')
    .where('cohortId', '==', cohortId)
    .where('status', 'in', ['active', 'upcoming'])
    .get();

  // Build a map of userId -> enrollmentId for cohort task state sync
  const memberEnrollments = new Map<string, string>();
  for (const doc of enrollmentsSnap.docs) {
    const data = doc.data();
    if (data.userId) {
      memberEnrollments.set(data.userId, doc.id);
    }
  }

  if (memberEnrollments.size === 0) {
    console.log(`[SYNC_WEEK_TO_MEMBERS] No active members in cohort ${cohortId}`);
    return { membersProcessed: 0, totalTasksCreated: 0, totalTasksUpdated: 0, totalTasksDeleted: 0 };
  }

  let totalTasksCreated = 0;
  let totalTasksUpdated = 0;
  let totalTasksDeleted = 0;

  // Sync each day's tasks to each member
  for (const day of week.days || []) {
    const tasks = (day.tasks || []) as ProgramInstanceTask[];

    // Calculate calendar date if missing (critical for task sync to work)
    let effectiveCalendarDate = day.calendarDate;
    if (!effectiveCalendarDate && cohortStartDate && day.globalDayIndex) {
      const calculatedDate = dayIndexToDate(cohortStartDate, day.globalDayIndex, includeWeekends !== false);
      effectiveCalendarDate = calculatedDate.toISOString().split('T')[0];
      console.log(`[SYNC_WEEK_TO_MEMBERS] Calculated calendarDate for day ${day.globalDayIndex}: ${effectiveCalendarDate}`);
    }

    console.log(`[SYNC_WEEK_TO_MEMBERS] Syncing day ${day.globalDayIndex} (${effectiveCalendarDate || 'NO DATE'}) with ${tasks.length} tasks to ${memberEnrollments.size} users`);

    for (const [userId, enrollmentId] of memberEnrollments.entries()) {
      const result = await syncDayTasksToUser(
        instanceId,
        userId,
        day.globalDayIndex,
        tasks,
        effectiveCalendarDate,
        organizationId,
        enrollmentId,
        programId
      );
      totalTasksCreated += result.created;
      totalTasksUpdated += result.updated;
      totalTasksDeleted += result.deleted;
    }
  }

  console.log(`[SYNC_WEEK_TO_MEMBERS] Synced week ${week.weekNumber} to ${memberEnrollments.size} members: ${totalTasksCreated} created, ${totalTasksUpdated} updated, ${totalTasksDeleted} deleted`);

  return {
    membersProcessed: memberEnrollments.size,
    totalTasksCreated,
    totalTasksUpdated,
    totalTasksDeleted,
  };
}

/**
 * Common placeholder texts that indicate an empty task
 */
const PLACEHOLDER_TEXTS = [
  'What should they accomplish?',
  'Enter task title...',
  'Task title',
  'New task',
];

/**
 * Check if a task label is empty or just a placeholder
 */
function isEmptyTask(task: ProgramTaskTemplate): boolean {
  const label = task.label?.trim() || '';
  if (!label) return true;
  return PLACEHOLDER_TEXTS.some(p => p.toLowerCase() === label.toLowerCase());
}

/**
 * Process tasks to ensure each has a unique ID for robust matching.
 * Preserves existing IDs, generates new UUIDs for tasks without IDs.
 * Also strips runtime completion data that should never be stored in templates.
 * Filters out empty tasks (those with no label or just placeholder text).
 */
function processTasksWithIds(tasks: ProgramTaskTemplate[] | undefined): ProgramTaskTemplate[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks
    .filter(task => !isEmptyTask(task))
    .map((task) => {
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

/**
 * Ensure all days in a week have correct calendar dates based on cohort start date.
 * This handles cases where existing instances were created before calendar date fix.
 */
function ensureDaysHaveCalendarDates(
  week: ProgramInstanceWeek,
  cohortStartDate: string | undefined,
  includeWeekends: boolean,
  totalDays: number
): ProgramInstanceWeek {
  if (!cohortStartDate || !week.days || week.days.length === 0) {
    return week;
  }

  // Check if days already have calendar dates
  const hasCalendarDates = week.days.every(d => d.calendarDate);
  if (hasCalendarDates) {
    return week;
  }

  // Calculate calendar weeks from cohort start date
  const calendarWeeks = calculateCalendarWeeks(cohortStartDate, totalDays, includeWeekends);
  const regularCalendarWeeks = calendarWeeks
    .filter(w => w.weekNumber > 0)
    .sort((a, b) => a.startDayIndex - b.startDayIndex);

  // Find which calendar week this instance week corresponds to
  // Use weekNumber - 1 as the position index
  const weekPosition = week.weekNumber - 1;
  const calendarWeek = regularCalendarWeeks[weekPosition];

  if (!calendarWeek?.startDate) {
    console.log(`[ENSURE_CALENDAR_DATES] No calendar week found for week ${week.weekNumber}`);
    return week;
  }

  // Update each day with calculated calendar date
  const updatedDays = week.days.map((day, index) => {
    if (day.calendarDate) {
      return day; // Already has date
    }

    const startDate = new Date(calendarWeek.startDate);
    startDate.setDate(startDate.getDate() + index);
    const calendarDate = startDate.toISOString().split('T')[0];

    // Also ensure globalDayIndex is correct
    const globalDayIndex = calendarWeek.startDayIndex + index;

    return {
      ...day,
      calendarDate,
      globalDayIndex,
    };
  });

  console.log(`[ENSURE_CALENDAR_DATES] Updated week ${week.weekNumber} days with calendar dates`);
  return {
    ...week,
    days: updatedDays,
  };
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
  const includeWeekends = programData.includeWeekends !== false;
  const daysPerWeek = includeWeekends ? 7 : 5;
  const totalDays = programData.lengthDays || 28;

  // Calculate calendar weeks from cohort start date
  let calendarWeeks: CalendarWeek[] = [];
  if (cohortData.startDate) {
    calendarWeeks = calculateCalendarWeeks(cohortData.startDate, totalDays, includeWeekends);
  }
  // Filter to only regular weeks (weekNumber > 0) and sort by startDayIndex
  const regularCalendarWeeks = calendarWeeks
    .filter(w => w.weekNumber > 0)
    .sort((a, b) => a.startDayIndex - b.startDayIndex);

  // Helper to get calendar date for a day index within a week
  const getCalendarDateForDay = (weekPosition: number, dayOffset: number): string | undefined => {
    const calendarWeek = regularCalendarWeeks[weekPosition];
    if (!calendarWeek?.startDate) return undefined;
    const startDate = new Date(calendarWeek.startDate);
    startDate.setDate(startDate.getDate() + dayOffset);
    return startDate.toISOString().split('T')[0];
  };

  // Read weeks from programs.weeks[] or fallback to program_weeks collection
  let weeks: ProgramInstanceWeek[] = [];

  if (programData.weeks && Array.isArray(programData.weeks) && programData.weeks.length > 0) {
    weeks = programData.weeks.map((weekData, weekPosition) => {
      const calendarWeek = regularCalendarWeeks[weekPosition];
      // Use calendar week's day range if available, otherwise calculate from weekNumber
      const startDayIndex = calendarWeek?.startDayIndex ?? ((weekData.weekNumber - 1) * daysPerWeek + 1);
      const endDayIndex = calendarWeek?.endDayIndex ?? (startDayIndex + daysPerWeek - 1);

      const days: ProgramInstanceDay[] = [];
      for (let i = 0; i <= endDayIndex - startDayIndex; i++) {
        const dayIndex = startDayIndex + i;
        days.push({
          dayIndex: i + 1, // Relative to week (1-based)
          globalDayIndex: dayIndex,
          calendarDate: getCalendarDateForDay(weekPosition, i),
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
      } as ProgramInstanceWeek;
    });
  } else {
    // Fallback to program_weeks collection
    const weeksSnapshot = await adminDb.collection('program_weeks')
      .where('programId', '==', programId)
      .orderBy('weekNumber', 'asc')
      .get();

    weeks = weeksSnapshot.docs.map((weekDoc, weekPosition) => {
      const weekData = weekDoc.data();
      const calendarWeek = regularCalendarWeeks[weekPosition];
      const startDayIndex = calendarWeek?.startDayIndex ?? ((weekData.weekNumber - 1) * daysPerWeek + 1);
      const endDayIndex = calendarWeek?.endDayIndex ?? (startDayIndex + daysPerWeek - 1);

      const days: ProgramInstanceDay[] = [];
      for (let i = 0; i <= endDayIndex - startDayIndex; i++) {
        const dayIndex = startDayIndex + i;
        days.push({
          dayIndex: i + 1, // Relative to week (1-based)
          globalDayIndex: dayIndex,
          calendarDate: getCalendarDateForDay(weekPosition, i),
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

    // Find the week in the instance or create it on-demand
    let weekResult = findWeekInInstance(instance.weeks || [], weekId);
    let week: ProgramInstanceWeek;

    if (!weekResult) {
      // Week doesn't exist - create it on-demand
      const weekNumber = /^\d+$/.test(weekId) ? parseInt(weekId, 10) : 1;
      const daysPerWeek = programData.includeWeekends !== false ? 7 : 5;
      const startDayIndex = (weekNumber - 1) * daysPerWeek + 1;
      const endDayIndex = startDayIndex + daysPerWeek - 1;

      const days: ProgramInstanceDay[] = [];
      for (let dayIndex = startDayIndex; dayIndex <= endDayIndex; dayIndex++) {
        days.push({
          dayIndex,
          globalDayIndex: dayIndex,
          tasks: [],
          habits: [],
        });
      }

      const now = new Date().toISOString();
      const newWeek: ProgramInstanceWeek = {
        id: crypto.randomUUID(),
        weekNumber,
        days,
        weeklyTasks: [],
        weeklyHabits: [],
        startDayIndex,
        endDayIndex,
        createdAt: now,
        updatedAt: now,
      };

      // Save the new week to the instance
      const weeks = [...(instance.weeks || []), newWeek];
      weeks.sort((a, b) => a.weekNumber - b.weekNumber);

      await adminDb.collection('program_instances').doc(instance.id!).update({
        weeks,
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`[COHORT_WEEK_CONTENT_GET] Created new week ${weekNumber} on-demand for instance ${instance.id}`);
      week = newWeek;
    } else {
      week = weekResult.week;
    }

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

    // Merge completion status from tasks collection (wrapped in try-catch to not block the response)
    try {
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
          // Note: This query requires a composite index on tasks(completed, date)
          try {
            const completedTasksSnapshot = await adminDb
              .collection('tasks')
              .where('completed', '==', true)
              .where('date', '>=', calendarWeek.startDate)
              .where('date', '<=', calendarWeek.endDate)
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
          } catch (queryErr) {
            console.warn('[COHORT_WEEK_CONTENT_GET] Completion query failed (likely missing index):', queryErr);
            // Continue without completion data - still return the week content
          }
        }
      }
    } catch (completionErr) {
      console.warn('[COHORT_WEEK_CONTENT_GET] Completion calculation failed:', completionErr);
      // Continue without completion data - still return the week content
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

    // Find the week or create it if it doesn't exist
    const weeks = [...(instance.weeks || [])];
    let weekResult = findWeekInInstance(weeks, weekId);
    let weekIndex: number;
    const now = new Date().toISOString();

    if (!weekResult) {
      // Week doesn't exist - create it
      const weekNumber = /^\d+$/.test(weekId) ? parseInt(weekId, 10) : weeks.length + 1;
      const daysPerWeek = programData.includeWeekends !== false ? 7 : 5;

      // For Week 0 (onboarding), use days from calendar or default
      // For other weeks, calculate based on weekNumber and whether Week 0 exists
      let startDayIndex: number;
      let endDayIndex: number;

      if (weekNumber === 0) {
        // Week 0 is onboarding - get day range from calendar
        const totalDays = programData.lengthDays || 28;
        const includeWeekends = programData.includeWeekends !== false;
        const calendarWeeks = calculateCalendarWeeks(cohortData.startDate, totalDays, includeWeekends);
        const onboardingWeek = calendarWeeks.find(w => w.type === 'onboarding');
        startDayIndex = onboardingWeek?.startDayIndex ?? 1;
        endDayIndex = onboardingWeek?.endDayIndex ?? Math.min(4, totalDays);
      } else {
        // Regular weeks: check if Week 0 exists to determine offset
        const weekZero = weeks.find(w => w.weekNumber === 0);
        if (weekZero && weekZero.endDayIndex) {
          // Week 1 starts after Week 0 ends
          startDayIndex = weekZero.endDayIndex + 1 + (weekNumber - 1) * daysPerWeek;
        } else {
          // No Week 0, use standard formula
          startDayIndex = (weekNumber - 1) * daysPerWeek + 1;
        }
        endDayIndex = startDayIndex + daysPerWeek - 1;
      }

      const days: ProgramInstanceDay[] = [];
      for (let dayIndex = startDayIndex; dayIndex <= endDayIndex; dayIndex++) {
        days.push({
          dayIndex,
          globalDayIndex: dayIndex,
          tasks: [],
          habits: [],
        });
      }

      const newWeek: ProgramInstanceWeek = {
        id: crypto.randomUUID(),
        weekNumber,
        days,
        weeklyTasks: [],
        weeklyHabits: [],
        startDayIndex,
        endDayIndex,
        createdAt: now,
        updatedAt: now,
      };

      weeks.push(newWeek);
      // Sort weeks by weekNumber to maintain order
      weeks.sort((a, b) => a.weekNumber - b.weekNumber);
      weekIndex = weeks.findIndex(w => w.weekNumber === weekNumber);
      console.log(`[COHORT_WEEK_CONTENT_PUT] Created new week ${weekNumber} at index ${weekIndex}`);
    } else {
      weekIndex = weekResult.index;
    }

    // Update the week with new content
    let updatedWeek: ProgramInstanceWeek = {
      ...weeks[weekIndex],
      name: body.name?.trim() || weeks[weekIndex].name,
      theme: body.theme?.trim() || weeks[weekIndex].theme,
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

    // Ensure days have calendar dates (fix for existing instances created before calendar date fix)
    updatedWeek = ensureDaysHaveCalendarDates(
      updatedWeek,
      cohortData.startDate,
      programData.includeWeekends !== false,
      programData.lengthDays || 28
    );

    weeks[weekIndex] = updatedWeek;

    // Distribute weeklyTasks to days if distribution is specified
    if (body.distributeTasksNow === true && Array.isArray(body.weeklyTasks)) {
      const distributionType = body.distribution || 'spread';
      const weeklyTasks = processTasksWithIds(body.weeklyTasks) as ProgramInstanceTask[];
      const daysToUpdate = updatedWeek.days || [];

      console.log(`[COHORT_WEEK_CONTENT_PUT] Distributing ${weeklyTasks.length} tasks with type: ${distributionType}`);

      if (distributionType === 'spread') {
        // Spread tasks evenly across the week with gaps between them
        // 3 tasks, 5 days (Mon-Fri) → task 1 on Mon, task 2 on Wed, task 3 on Fri
        const numDays = daysToUpdate.length;
        const numTasks = weeklyTasks.length;

        // First, clear old week tasks from all days
        for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
          daysToUpdate[dayIdx].tasks = (daysToUpdate[dayIdx].tasks || []).filter(
            (t: ProgramInstanceTask) => !t.source || t.source !== 'week'
          );
        }

        // Then, assign each task to a specific day, spread evenly across the week
        if (numDays > 0 && numTasks > 0) {
          for (let taskIdx = 0; taskIdx < numTasks; taskIdx++) {
            // Calculate which day this task should go to
            let targetDayIdx: number;
            if (numTasks === 1) {
              targetDayIdx = 0; // Single task goes to first day
            } else {
              // Spread evenly: task 0 → day 0, last task → last day, others evenly between
              targetDayIdx = Math.round(taskIdx * (numDays - 1) / (numTasks - 1));
            }
            
            // Add this task to that day
            const task = weeklyTasks[taskIdx];
            daysToUpdate[targetDayIdx].tasks = [
              ...daysToUpdate[targetDayIdx].tasks,
              { ...task, source: 'week' as const },
            ];
          }
        }
      } else if (distributionType === 'repeat-daily' || distributionType === 'all_days') {
        // Add all tasks to all days
        for (const day of daysToUpdate) {
          day.tasks = [
            ...(day.tasks || []).filter((t: ProgramInstanceTask) => !t.source || t.source !== 'week'),
            ...weeklyTasks.map(t => ({ ...t, source: 'week' as const })),
          ];
        }
      } else if (distributionType === 'first_day') {
        // Add all tasks to first day only
        if (daysToUpdate.length > 0) {
          daysToUpdate[0].tasks = [
            ...(daysToUpdate[0].tasks || []).filter((t: ProgramInstanceTask) => !t.source || t.source !== 'week'),
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
        syncResult = await syncWeekTasksToMembers(instanceId, cohortId, updatedWeek, cohortData.startDate, programData.includeWeekends !== false, organizationId, programId);
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

    // Find the week or create it if it doesn't exist
    const weeks = [...(instance.weeks || [])];
    let weekResult = findWeekInInstance(weeks, weekId);
    let existingWeek: ProgramInstanceWeek;
    let weekIndex: number;
    const now = new Date().toISOString();

    if (!weekResult) {
      // Week doesn't exist - create it
      const weekNumber = /^\d+$/.test(weekId) ? parseInt(weekId, 10) : weeks.length + 1;
      const daysPerWeek = programData.includeWeekends !== false ? 7 : 5;

      // For Week 0 (onboarding), use days from calendar or default
      // For other weeks, calculate based on weekNumber and whether Week 0 exists
      let startDayIndex: number;
      let endDayIndex: number;

      if (weekNumber === 0) {
        // Week 0 is onboarding - get day range from calendar
        const totalDays = programData.lengthDays || 28;
        const includeWeekends = programData.includeWeekends !== false;
        const calendarWeeks = calculateCalendarWeeks(cohortData.startDate, totalDays, includeWeekends);
        const onboardingWeek = calendarWeeks.find(w => w.type === 'onboarding');
        startDayIndex = onboardingWeek?.startDayIndex ?? 1;
        endDayIndex = onboardingWeek?.endDayIndex ?? Math.min(4, totalDays);
      } else {
        // Regular weeks: check if Week 0 exists to determine offset
        const weekZero = weeks.find(w => w.weekNumber === 0);
        if (weekZero && weekZero.endDayIndex) {
          // Week 1 starts after Week 0 ends
          startDayIndex = weekZero.endDayIndex + 1 + (weekNumber - 1) * daysPerWeek;
        } else {
          // No Week 0, use standard formula
          startDayIndex = (weekNumber - 1) * daysPerWeek + 1;
        }
        endDayIndex = startDayIndex + daysPerWeek - 1;
      }

      const days: ProgramInstanceDay[] = [];
      for (let dayIndex = startDayIndex; dayIndex <= endDayIndex; dayIndex++) {
        days.push({
          dayIndex,
          globalDayIndex: dayIndex,
          tasks: [],
          habits: [],
        });
      }

      existingWeek = {
        id: crypto.randomUUID(),
        weekNumber,
        days,
        weeklyTasks: [],
        weeklyHabits: [],
        startDayIndex,
        endDayIndex,
        createdAt: now,
        updatedAt: now,
      };

      weeks.push(existingWeek);
      weeks.sort((a, b) => a.weekNumber - b.weekNumber);
      weekIndex = weeks.findIndex(w => w.weekNumber === weekNumber);
      console.log(`[COHORT_WEEK_CONTENT_PATCH] Created new week ${weekNumber} at index ${weekIndex}`);
    } else {
      existingWeek = weekResult.week;
      weekIndex = weekResult.index;
    }

    // Build updated week (only update provided fields)
    let updatedWeek: ProgramInstanceWeek = {
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

    // Ensure days have calendar dates (fix for existing instances created before calendar date fix)
    updatedWeek = ensureDaysHaveCalendarDates(
      updatedWeek,
      cohortData.startDate,
      programData.includeWeekends !== false,
      programData.lengthDays || 28
    );

    weeks[weekIndex] = updatedWeek;

    // Distribute weeklyTasks to days if distribution is specified
    if (body.distributeTasksNow === true && updatedWeek.weeklyTasks) {
      const distributionType = updatedWeek.distribution || 'spread';
      const weeklyTasks = (updatedWeek.weeklyTasks || []) as ProgramInstanceTask[];
      const daysToUpdate = updatedWeek.days || [];

      console.log(`[COHORT_WEEK_CONTENT_PATCH] Distributing ${weeklyTasks.length} tasks with type: ${distributionType}`);

      if (distributionType === 'spread') {
        // Spread tasks evenly across the week with gaps between them
        // 3 tasks, 5 days (Mon-Fri) → task 1 on Mon, task 2 on Wed, task 3 on Fri
        const numDays = daysToUpdate.length;
        const numTasks = weeklyTasks.length;

        // First, clear old week tasks from all days
        for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
          daysToUpdate[dayIdx].tasks = (daysToUpdate[dayIdx].tasks || []).filter(
            (t: ProgramInstanceTask) => !t.source || t.source !== 'week'
          );
        }

        // Then, assign each task to a specific day, spread evenly across the week
        if (numDays > 0 && numTasks > 0) {
          for (let taskIdx = 0; taskIdx < numTasks; taskIdx++) {
            // Calculate which day this task should go to
            let targetDayIdx: number;
            if (numTasks === 1) {
              targetDayIdx = 0; // Single task goes to first day
            } else {
              // Spread evenly: task 0 → day 0, last task → last day, others evenly between
              targetDayIdx = Math.round(taskIdx * (numDays - 1) / (numTasks - 1));
            }
            
            // Add this task to that day
            const task = weeklyTasks[taskIdx];
            daysToUpdate[targetDayIdx].tasks = [
              ...daysToUpdate[targetDayIdx].tasks,
              { ...task, source: 'week' as const },
            ];
          }
        }
      } else if (distributionType === 'repeat-daily' || distributionType === 'all_days') {
        // Add all tasks to all days
        for (const day of daysToUpdate) {
          day.tasks = [
            ...(day.tasks || []).filter((t: ProgramInstanceTask) => !t.source || t.source !== 'week'),
            ...weeklyTasks.map(t => ({ ...t, source: 'week' as const })),
          ];
        }
      } else if (distributionType === 'first_day') {
        // Add all tasks to first day only
        if (daysToUpdate.length > 0) {
          daysToUpdate[0].tasks = [
            ...(daysToUpdate[0].tasks || []).filter((t: ProgramInstanceTask) => !t.source || t.source !== 'week'),
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
        syncResult = await syncWeekTasksToMembers(instanceId, cohortId, updatedWeek, cohortData.startDate, programData.includeWeekends !== false, organizationId, programId);
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
