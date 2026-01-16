/**
 * Program Instance Week API
 *
 * Manage individual week content within a program instance
 *
 * GET /api/instances/[instanceId]/weeks/[weekNum] - Get week content
 * PATCH /api/instances/[instanceId]/weeks/[weekNum] - Update week content
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramInstanceWeek, ProgramInstanceDay, ProgramInstanceTask } from '@/types';
import { calculateCalendarWeeks, dayIndexToDate } from '@/lib/calendar-weeks';

type RouteParams = { params: Promise<{ instanceId: string; weekNum: string }> };

/**
 * Ensure all days in a week have correct calendar dates.
 * This handles cases where existing instances were created before calendar date fix.
 */
function ensureDaysHaveCalendarDates(
  week: ProgramInstanceWeek,
  startDate: string | undefined,
  includeWeekends: boolean,
  totalDays: number
): ProgramInstanceWeek {
  if (!startDate || !week.days || week.days.length === 0) {
    return week;
  }

  // Check if days already have calendar dates
  const hasCalendarDates = week.days.every(d => d.calendarDate);
  if (hasCalendarDates) {
    return week;
  }

  // Calculate calendar weeks from start date
  const calendarWeeks = calculateCalendarWeeks(startDate, totalDays, includeWeekends);
  const regularCalendarWeeks = calendarWeeks
    .filter(w => w.weekNumber > 0)
    .sort((a, b) => a.startDayIndex - b.startDayIndex);

  // Find which calendar week this instance week corresponds to
  const weekPosition = week.weekNumber - 1;
  const calendarWeek = regularCalendarWeeks[weekPosition];

  if (!calendarWeek?.startDate) {
    console.log(`[ENSURE_CALENDAR_DATES] No calendar week found for week ${week.weekNumber}`);
    return week;
  }

  // Update each day with calculated calendar date
  const updatedDays = (week.days || []).map((day, index) => {
    if (day.calendarDate) {
      return day;
    }

    const startDateObj = new Date(calendarWeek.startDate);
    startDateObj.setDate(startDateObj.getDate() + index);
    const calendarDate = startDateObj.toISOString().split('T')[0];
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
function isEmptyTask(task: ProgramInstanceTask): boolean {
  const label = task.label?.trim() || '';
  if (!label) return true;
  return PLACEHOLDER_TEXTS.some(p => p.toLowerCase() === label.toLowerCase());
}

/**
 * Process tasks to ensure each has a unique ID and filter out empty tasks
 */
function processTasksWithIds(tasks: ProgramInstanceTask[] | undefined): ProgramInstanceTask[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks
    .filter(task => !isEmptyTask(task))
    .map((task) => ({
      ...task,
      id: task.id || crypto.randomUUID(),
    }));
}

/**
 * Sync day tasks to user's tasks collection
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
): Promise<void> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();
  let created = 0, updated = 0, deleted = 0;

  console.log(`[syncDayTasksToUser] Starting sync for user ${userId}, day ${dayIndex}, date ${calendarDate}, orgId ${organizationId}, tasks: ${tasks?.length || 0}`);

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

  console.log(`[syncDayTasksToUser] Found ${existingTasksQuery.docs.length} existing tasks for day ${dayIndex}`);

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
  console.log(`[syncDayTasksToUser] Focus limit: ${focusLimit}, existing (other): ${existingFocusCount}, available: ${availableFocusSlots}`);

  const processedInstanceTaskIds = new Set<string>();

  // Separate primary and non-primary tasks
  const primaryTasks = tasks.filter(t => t.isPrimary);
  const nonPrimaryTasks = tasks.filter(t => !t.isPrimary);

  // Process primary tasks first (try to put in Focus)
  for (const task of primaryTasks) {
    processedInstanceTaskIds.add(task.id);

    const existing = existingTasksByInstanceTaskId.get(task.id);

    if (existing) {
      // Update existing task - preserve listType if already set, otherwise determine based on isPrimary
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
      console.log(`[syncDayTasksToUser] Creating primary task: ${task.label} as ${listType} for date ${calendarDate}`);
      batch.set(taskRef, {
        userId,
        organizationId,
        instanceId,
        instanceTaskId: task.id,
        label: task.label, // Required for completion tracking - must match instance task label
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
      console.log(`[syncDayTasksToUser] Creating non-primary task: ${task.label} as backlog for date ${calendarDate}`);
      batch.set(taskRef, {
        userId,
        organizationId,
        instanceId,
        instanceTaskId: task.id,
        label: task.label, // Required for completion tracking - must match instance task label
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
  console.log(`[syncDayTasksToUser] Completed: ${created} created, ${updated} updated, ${deleted} deleted`);
}

/**
 * GET /api/instances/[instanceId]/weeks/[weekNum]
 * Returns the week content for the specified week number
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId, weekNum } = await params;
    const weekNumber = parseInt(weekNum, 10);

    if (isNaN(weekNumber) || weekNumber < 0) {
      return NextResponse.json({ error: 'Invalid week number' }, { status: 400 });
    }

    // Get the instance
    const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();

    if (!instanceDoc.exists) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const data = instanceDoc.data();

    // Verify organization access
    if (data?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const weeks: ProgramInstanceWeek[] = data?.weeks || [];
    const week = weeks.find(w => w.weekNumber === weekNumber);

    if (!week) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // For cohort instances, enrich with completion data
    if (data?.type === 'cohort' && data?.cohortId) {
      // Get cohort member count
      const enrollmentsSnap = await adminDb.collection('program_enrollments')
        .where('cohortId', '==', data.cohortId)
        .where('status', 'in', ['active', 'completed'])
        .get();

      const totalMembers = enrollmentsSnap.docs.length;

      // Enrich tasks with completion placeholders
      const enrichedWeek = {
        ...week,
        days: (week.days || []).map(day => ({
          ...day,
          tasks: (day.tasks || []).map(task => ({
            ...task,
            _totalMembers: totalMembers,
            _completedCount: 0, // Will be populated from tasks collection
          })),
        })),
        weeklyTasks: (week.weeklyTasks || []).map(task => ({
          ...task,
          _totalMembers: totalMembers,
          _completedCount: 0,
        })),
      };

      return NextResponse.json({ week: enrichedWeek });
    }

    return NextResponse.json({ week });
  } catch (error) {
    console.error('[INSTANCE_WEEK_GET] Error:', error);
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

/**
 * PATCH /api/instances/[instanceId]/weeks/[weekNum]
 * Update week content (name, theme, tasks, etc.)
 * Also handles day updates within the week
 *
 * When distribution is specified, tasks are distributed to days and
 * synced to users' tasks collection immediately.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId, weekNum } = await params;
    const weekNumber = parseInt(weekNum, 10);
    const body = await request.json();

    if (isNaN(weekNumber) || weekNumber < 0) {
      return NextResponse.json({ error: 'Invalid week number' }, { status: 400 });
    }

    // Get the instance
    const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();

    if (!instanceDoc.exists) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const data = instanceDoc.data();

    // Verify organization access
    if (data?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const weeks: ProgramInstanceWeek[] = data?.weeks || [];
    const weekIndex = weeks.findIndex(w => w.weekNumber === weekNumber);

    if (weekIndex === -1) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // Build the updated week
    const existingWeek = weeks[weekIndex];
    let updatedWeek: ProgramInstanceWeek = {
      ...existingWeek,
      hasLocalChanges: true,
    };

    // Update week-level fields
    if (body.name !== undefined) updatedWeek.name = body.name?.trim() || undefined;
    if (body.theme !== undefined) updatedWeek.theme = body.theme?.trim() || undefined;
    if (body.description !== undefined) updatedWeek.description = body.description?.trim() || undefined;
    if (body.weeklyPrompt !== undefined) updatedWeek.weeklyPrompt = body.weeklyPrompt?.trim() || undefined;
    if (body.coachRecordingUrl !== undefined) updatedWeek.coachRecordingUrl = body.coachRecordingUrl || undefined;
    if (body.coachRecordingNotes !== undefined) updatedWeek.coachRecordingNotes = body.coachRecordingNotes?.trim() || undefined;
    if (body.linkedSummaryIds !== undefined) updatedWeek.linkedSummaryIds = body.linkedSummaryIds;
    if (body.linkedCallEventIds !== undefined) updatedWeek.linkedCallEventIds = body.linkedCallEventIds;
    // Update linked content (resources attached to this week)
    if (body.linkedArticleIds !== undefined) updatedWeek.linkedArticleIds = body.linkedArticleIds || [];
    if (body.linkedDownloadIds !== undefined) updatedWeek.linkedDownloadIds = body.linkedDownloadIds || [];
    if (body.linkedLinkIds !== undefined) updatedWeek.linkedLinkIds = body.linkedLinkIds || [];
    if (body.linkedQuestionnaireIds !== undefined) updatedWeek.linkedQuestionnaireIds = body.linkedQuestionnaireIds || [];
    if (body.linkedCourseIds !== undefined) updatedWeek.linkedCourseIds = body.linkedCourseIds || [];
    if (body.courseAssignments !== undefined) updatedWeek.courseAssignments = body.courseAssignments || [];
    if (body.distribution !== undefined) updatedWeek.distribution = body.distribution;
    if (body.weeklyHabits !== undefined) updatedWeek.weeklyHabits = body.weeklyHabits;
    if (body.manualNotes !== undefined) updatedWeek.manualNotes = body.manualNotes?.trim() || undefined;

    // Update weekly tasks
    if (body.weeklyTasks !== undefined) {
      updatedWeek.weeklyTasks = processTasksWithIds(body.weeklyTasks);
    }

    // Update days if provided - merge day tasks with existing week tasks
    if (body.days !== undefined && Array.isArray(body.days)) {
      updatedWeek.days = body.days.map((day: ProgramInstanceDay, index: number) => {
        const existingDay = (existingWeek.days || [])[index];
        const incomingTasks = processTasksWithIds(day.tasks);
        // Keep existing week-distributed tasks
        const existingWeekTasks = (existingDay?.tasks || []).filter(t => t.source === 'week');
        // Incoming tasks are day-specific (filter out any with source: 'week' to avoid duplicates)
        const dayTasks = incomingTasks.filter(t => t.source !== 'week');
        return {
          ...existingDay,
          ...day,
          tasks: [...dayTasks, ...existingWeekTasks],
          hasLocalChanges: true,
        };
      });
    }

    // Update specific day if dayIndex is provided - merge day tasks with existing week tasks
    if (body.dayIndex !== undefined && body.day !== undefined) {
      const dayIdx = (updatedWeek.days || []).findIndex(d => d.dayIndex === body.dayIndex);
      if (dayIdx !== -1) {
        const existingDay = updatedWeek.days[dayIdx];
        const incomingTasks = processTasksWithIds(body.day.tasks || existingDay.tasks);
        // Keep existing week-distributed tasks
        const existingWeekTasks = (existingDay?.tasks || []).filter(t => t.source === 'week');
        // Incoming tasks are day-specific
        const dayTasks = incomingTasks.filter(t => t.source !== 'week');
        updatedWeek.days[dayIdx] = {
          ...existingDay,
          ...body.day,
          tasks: [...dayTasks, ...existingWeekTasks],
          hasLocalChanges: true,
        };
      }
    }

    // Ensure days have calendar dates (fix for existing instances created before calendar date fix)
    const instanceStartDate = data?.startDate as string | undefined;
    const includeWeekends = data?.includeWeekends !== false;
    const totalDays = weeks.reduce((sum, w) => sum + (w.days?.length || 0), 0) || 28;

    updatedWeek = ensureDaysHaveCalendarDates(
      updatedWeek,
      instanceStartDate,
      includeWeekends,
      totalDays
    );

    // Update the weeks array
    const updatedWeeks = [...weeks];
    updatedWeeks[weekIndex] = updatedWeek;

    // Save to Firestore
    await adminDb.collection('program_instances').doc(instanceId).update({
      weeks: updatedWeeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // If distribution is specified (or distributeTasksNow flag is set), distribute weekly tasks to days
    // Note: body.weeklyTasks can be an empty array (coach deleted all tasks), so check for array type
    // Use body.distribution, or fall back to existing week distribution if distributeTasksNow is set
    const distributionSetting = body.distribution || (body.distributeTasksNow && updatedWeek.distribution);

    console.log(`[INSTANCE_WEEK_PATCH] Distribution check:`, {
      bodyDistribution: body.distribution,
      distributeTasksNow: body.distributeTasksNow,
      weekDistribution: updatedWeek.distribution,
      distributionSetting,
      hasWeeklyTasks: Array.isArray(body.weeklyTasks),
      weeklyTasksCount: Array.isArray(body.weeklyTasks) ? body.weeklyTasks.length : 'not-array',
      instanceStartDate: instanceStartDate || 'NOT SET',
    });

    if (distributionSetting && Array.isArray(body.weeklyTasks)) {
      // Normalize distribution format:
      // - String format: 'spread' | 'repeat-daily' (from TypeScript TaskDistribution type)
      // - Object format: { type: 'spread' | 'all_days' | 'first_day', targetDays?: number[] }
      let distribution: { type: string; targetDays?: number[] };
      if (typeof distributionSetting === 'string') {
        // Map string format to object format
        const typeMap: Record<string, string> = {
          'spread': 'spread',
          'repeat-daily': 'all_days',
        };
        distribution = { type: typeMap[distributionSetting] || 'spread' };
      } else {
        distribution = distributionSetting;
      }
      const weeklyTasks = processTasksWithIds(body.weeklyTasks);

      // Get the days for this week (ensure it's an array)
      const daysToUpdate = updatedWeek.days || [];

      console.log(`[INSTANCE_WEEK_PATCH] Distribution: ${distribution.type}, tasks: ${weeklyTasks.length}, days: ${daysToUpdate.length}`);

      // Distribute tasks based on per-task dayTag (overrides) or program distribution (default)
      // IMPORTANT: Always clear old 'week' source tasks from days first
      const numDays = daysToUpdate.length;

      // Step 1: Clear all week-sourced tasks from all days
      for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
        const existingTasks = daysToUpdate[dayIdx].tasks || [];
        daysToUpdate[dayIdx].tasks = existingTasks.filter(t => !t.source || t.source !== 'week');
      }

      // Step 2: Categorize tasks by their dayTag
      const dailyTasks: typeof weeklyTasks = [];      // dayTag: 'daily' → all days
      const spreadTasks: typeof weeklyTasks = [];     // dayTag: 'spread' → spread evenly
      const specificDayTasks: Map<number, typeof weeklyTasks> = new Map(); // dayTag: 1-7 → specific day
      const autoTasks: typeof weeklyTasks = [];       // dayTag: undefined/'auto' → use program distribution

      for (const task of weeklyTasks) {
        const dayTag = task.dayTag;
        if (dayTag === 'daily') {
          dailyTasks.push(task);
        } else if (dayTag === 'spread') {
          spreadTasks.push(task);
        } else if (typeof dayTag === 'number' && dayTag >= 1 && dayTag <= numDays) {
          const existing = specificDayTasks.get(dayTag) || [];
          existing.push(task);
          specificDayTasks.set(dayTag, existing);
        } else {
          // dayTag: undefined, 'auto', or invalid → use program distribution
          autoTasks.push(task);
        }
      }

      console.log(`[INSTANCE_WEEK_PATCH] Task categories: daily=${dailyTasks.length}, spread=${spreadTasks.length}, specific=${specificDayTasks.size} days, auto=${autoTasks.length}`);

      // Step 3: Add daily tasks to ALL days
      for (const task of dailyTasks) {
        for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
          daysToUpdate[dayIdx].tasks = [
            ...daysToUpdate[dayIdx].tasks,
            { ...task, source: 'week' as const },
          ];
        }
      }

      // Step 4: Add specific-day tasks to their designated day
      for (const [dayNum, tasks] of specificDayTasks) {
        const dayIdx = dayNum - 1; // dayTag is 1-based, array is 0-based
        if (dayIdx >= 0 && dayIdx < numDays) {
          for (const task of tasks) {
            daysToUpdate[dayIdx].tasks = [
              ...daysToUpdate[dayIdx].tasks,
              { ...task, source: 'week' as const },
            ];
          }
        }
      }

      // Step 5: Spread tasks with dayTag: 'spread' evenly across the week
      if (spreadTasks.length > 0 && numDays > 0) {
        for (let taskIdx = 0; taskIdx < spreadTasks.length; taskIdx++) {
          let targetDayIdx: number;
          if (spreadTasks.length === 1) {
            targetDayIdx = 0;
          } else {
            targetDayIdx = Math.round(taskIdx * (numDays - 1) / (spreadTasks.length - 1));
          }
          daysToUpdate[targetDayIdx].tasks = [
            ...daysToUpdate[targetDayIdx].tasks,
            { ...spreadTasks[taskIdx], source: 'week' as const },
          ];
        }
      }

      // Step 6: Apply program distribution to 'auto' tasks
      if (autoTasks.length > 0 && numDays > 0) {
        if (distribution.type === 'spread') {
          // Spread auto tasks evenly
          for (let taskIdx = 0; taskIdx < autoTasks.length; taskIdx++) {
            let targetDayIdx: number;
            if (autoTasks.length === 1) {
              targetDayIdx = 0;
            } else {
              targetDayIdx = Math.round(taskIdx * (numDays - 1) / (autoTasks.length - 1));
            }
            daysToUpdate[targetDayIdx].tasks = [
              ...daysToUpdate[targetDayIdx].tasks,
              { ...autoTasks[taskIdx], source: 'week' as const },
            ];
          }
        } else if (distribution.type === 'all_days') {
          // Add all auto tasks to all days
          for (const task of autoTasks) {
            for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
              daysToUpdate[dayIdx].tasks = [
                ...daysToUpdate[dayIdx].tasks,
                { ...task, source: 'week' as const },
              ];
            }
          }
        } else if (distribution.type === 'first_day') {
          // Add all auto tasks to first day only
          for (const task of autoTasks) {
            daysToUpdate[0].tasks = [
              ...daysToUpdate[0].tasks,
              { ...task, source: 'week' as const },
            ];
          }
        }
      }

      // Save the distributed tasks
      updatedWeeks[weekIndex] = {
        ...updatedWeek,
        days: daysToUpdate,
      };

      await adminDb.collection('program_instances').doc(instanceId).update({
        weeks: updatedWeeks,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Sync distributed tasks to users' tasks collection
      if (data?.type === 'individual' && data?.userId) {
        // Individual instance - sync to the single user
        for (const day of daysToUpdate) {
          // Calculate calendar date if missing (critical for task sync to work)
          // Note: globalDayIndex can be 0, so use typeof check instead of truthy check
          let effectiveCalendarDate = day.calendarDate;
          if (!effectiveCalendarDate && instanceStartDate && typeof day.globalDayIndex === 'number') {
            const calculatedDate = dayIndexToDate(instanceStartDate, day.globalDayIndex, includeWeekends);
            effectiveCalendarDate = calculatedDate.toISOString().split('T')[0];
            console.log(`[INSTANCE_WEEK_PATCH] Calculated calendarDate for day ${day.globalDayIndex}: ${effectiveCalendarDate}`);
          }
          // Skip syncing if we can't determine the calendar date - prevents creating tasks with wrong/null dates
          if (!effectiveCalendarDate) {
            console.log(`[INSTANCE_WEEK_PATCH] SKIPPING day ${day.globalDayIndex} - no calendar date available (instance startDate: ${instanceStartDate || 'NOT SET'})`);
            continue;
          }

          console.log(`[INSTANCE_WEEK_PATCH] Syncing day ${day.globalDayIndex} (${effectiveCalendarDate}) with ${day.tasks?.length || 0} tasks to individual user ${data.userId}`);
          await syncDayTasksToUser(
            instanceId,
            data.userId,
            day.globalDayIndex,
            day.tasks,
            effectiveCalendarDate,
            data.organizationId,
            data.enrollmentId, // Pass enrollment ID for individual instance
            data.programId // Pass program ID
          );
        }
        console.log(`[INSTANCE_WEEK_PATCH] Synced ${daysToUpdate.length} days to user ${data.userId}`);
      } else if (data?.type === 'cohort' && data?.cohortId) {
        // Cohort instance - sync to all cohort members
        const enrollmentsSnap = await adminDb.collection('program_enrollments')
          .where('cohortId', '==', data.cohortId)
          .where('status', 'in', ['active', 'upcoming', 'completed'])
          .get();

        console.log(`[INSTANCE_WEEK_PATCH] Syncing ${daysToUpdate.length} days to ${enrollmentsSnap.docs.length} cohort members`);

        await Promise.all(
          enrollmentsSnap.docs.map(async (enrollmentDoc) => {
            const enrollment = enrollmentDoc.data();
            console.log(`[INSTANCE_WEEK_PATCH] Processing enrollment:`, {
              enrollmentId: enrollmentDoc.id,
              userId: enrollment.userId,
              status: enrollment.status
            });

            if (enrollment.userId) {
              for (const day of daysToUpdate) {
                // Calculate calendar date if missing (critical for task sync to work)
                // Note: globalDayIndex can be 0, so use typeof check instead of truthy check
                let effectiveCalendarDate = day.calendarDate;
                if (!effectiveCalendarDate && instanceStartDate && typeof day.globalDayIndex === 'number') {
                  const calculatedDate = dayIndexToDate(instanceStartDate, day.globalDayIndex, includeWeekends);
                  effectiveCalendarDate = calculatedDate.toISOString().split('T')[0];
                  console.log(`[INSTANCE_WEEK_PATCH] Calculated calendarDate for day ${day.globalDayIndex}: ${effectiveCalendarDate}`);
                }

                // Skip syncing if we can't determine the calendar date - prevents creating tasks with wrong/null dates
                if (!effectiveCalendarDate) {
                  console.log(`[INSTANCE_WEEK_PATCH] SKIPPING day ${day.globalDayIndex} - no calendar date available (instance startDate: ${instanceStartDate || 'NOT SET'})`);
                  continue;
                }

                console.log(`[INSTANCE_WEEK_PATCH] Syncing day ${day.globalDayIndex} (${effectiveCalendarDate}) with ${day.tasks?.length || 0} tasks to user ${enrollment.userId}`);

                await syncDayTasksToUser(
                  instanceId,
                  enrollment.userId,
                  day.globalDayIndex,
                  day.tasks,
                  effectiveCalendarDate,
                  data.organizationId,
                  enrollmentDoc.id, // Pass enrollment ID for cohort task state sync
                  data.programId // Pass program ID
                );
              }
            } else {
              console.log(`[INSTANCE_WEEK_PATCH] Skipping enrollment ${enrollmentDoc.id} - no userId`);
            }
          })
        );
      }
    }

    // Fetch the updated week to return
    const refreshedDoc = await adminDb.collection('program_instances').doc(instanceId).get();
    const refreshedWeeks: ProgramInstanceWeek[] = refreshedDoc.data()?.weeks || [];
    const refreshedWeek = refreshedWeeks.find(w => w.weekNumber === weekNumber);

    return NextResponse.json({
      success: true,
      week: refreshedWeek,
    });
  } catch (error) {
    console.error('[INSTANCE_WEEK_PATCH] Error:', error);
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
