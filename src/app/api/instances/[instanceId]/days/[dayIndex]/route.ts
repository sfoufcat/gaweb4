/**
 * Program Instance Day API
 *
 * Manage individual day content within a program instance
 *
 * GET /api/instances/[instanceId]/days/[dayIndex] - Get day content
 * PATCH /api/instances/[instanceId]/days/[dayIndex] - Update day content
 *
 * Note: dayIndex is the globalDayIndex (1-based across entire program)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramInstance, ProgramInstanceWeek, ProgramInstanceDay, ProgramInstanceTask } from '@/types';
import { dayIndexToDate } from '@/lib/calendar-weeks';

type RouteParams = { params: Promise<{ instanceId: string; dayIndex: string }> };

/**
 * Process tasks to ensure each has a unique ID
 */
function processTasksWithIds(tasks: ProgramInstanceTask[] | undefined): ProgramInstanceTask[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((task) => ({
    ...task,
    id: task.id || crypto.randomUUID(),
  }));
}

/**
 * Find day and its containing week by global day index
 */
function findDayByGlobalIndex(
  weeks: ProgramInstanceWeek[],
  globalDayIndex: number
): { week: ProgramInstanceWeek; day: ProgramInstanceDay; weekIndex: number; dayIndexInWeek: number } | null {
  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex];
    for (let dayIdx = 0; dayIdx < (week.days?.length || 0); dayIdx++) {
      const day = week.days[dayIdx];
      if (day.globalDayIndex === globalDayIndex) {
        return { week, day, weekIndex, dayIndexInWeek: dayIdx };
      }
    }
  }
  return null;
}

/**
 * GET /api/instances/[instanceId]/days/[dayIndex]
 * Returns the day content for the specified global day index
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId, dayIndex: dayIndexStr } = await params;
    const globalDayIndex = parseInt(dayIndexStr, 10);

    if (isNaN(globalDayIndex) || globalDayIndex < 1) {
      return NextResponse.json({ error: 'Invalid day index' }, { status: 400 });
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
    const result = findDayByGlobalIndex(weeks, globalDayIndex);

    if (!result) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 });
    }

    const { day, week } = result;

    // For cohort instances, enrich with completion data
    if (data?.type === 'cohort' && data?.cohortId) {
      const enrollmentsSnap = await adminDb.collection('program_enrollments')
        .where('cohortId', '==', data.cohortId)
        .where('status', 'in', ['active', 'upcoming', 'completed'])
        .get();

      const totalMembers = enrollmentsSnap.docs.length;

      const enrichedDay = {
        ...day,
        weekNumber: week.weekNumber,
        tasks: day.tasks.map(task => ({
          ...task,
          _totalMembers: totalMembers,
          _completedCount: 0,
        })),
      };

      return NextResponse.json({ day: enrichedDay });
    }

    return NextResponse.json({
      day: {
        ...day,
        weekNumber: week.weekNumber,
      },
    });
  } catch (error) {
    console.error('[INSTANCE_DAY_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch day' }, { status: 500 });
  }
}

/**
 * PATCH /api/instances/[instanceId]/days/[dayIndex]
 * Update day content (title, summary, tasks, etc.)
 * This is the source of truth - when coach saves a day, this is what persists
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId, dayIndex: dayIndexStr } = await params;
    const globalDayIndex = parseInt(dayIndexStr, 10);
    const body = await request.json();

    if (isNaN(globalDayIndex) || globalDayIndex < 1) {
      return NextResponse.json({ error: 'Invalid day index' }, { status: 400 });
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
    const result = findDayByGlobalIndex(weeks, globalDayIndex);

    if (!result) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 });
    }

    const { weekIndex, dayIndexInWeek } = result;
    const existingDay = weeks[weekIndex].days[dayIndexInWeek];

    // Build the updated day
    const updatedDay: ProgramInstanceDay = {
      ...existingDay,
      hasLocalChanges: true,
    };

    // Update day-level fields
    if (body.title !== undefined) updatedDay.title = body.title?.trim() || undefined;
    if (body.summary !== undefined) updatedDay.summary = body.summary?.trim() || undefined;
    if (body.dailyPrompt !== undefined) updatedDay.dailyPrompt = body.dailyPrompt?.trim() || undefined;
    if (body.calendarDate !== undefined) updatedDay.calendarDate = body.calendarDate;
    if (body.habits !== undefined) updatedDay.habits = body.habits || [];
    if (body.courseAssignments !== undefined) updatedDay.courseAssignments = body.courseAssignments || [];

    // Update tasks - this is the source of truth
    // If coach deletes a task, it's gone. No "smart merge" that brings back week tasks.
    if (body.tasks !== undefined) {
      updatedDay.tasks = processTasksWithIds(body.tasks);
    }

    // Update the weeks array
    const updatedWeeks = [...weeks];
    updatedWeeks[weekIndex] = {
      ...updatedWeeks[weekIndex],
      days: [...updatedWeeks[weekIndex].days],
    };
    updatedWeeks[weekIndex].days[dayIndexInWeek] = updatedDay;

    // Save to Firestore
    await adminDb.collection('program_instances').doc(instanceId).update({
      weeks: updatedWeeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Calculate calendar date if missing (needed for task sync to work correctly)
    let effectiveCalendarDate = updatedDay.calendarDate;
    if (!effectiveCalendarDate && data?.startDate) {
      // Calculate from instance start date and day index
      const includeWeekends = data?.includeWeekends !== false;
      const calculatedDate = dayIndexToDate(data.startDate, globalDayIndex, includeWeekends);
      effectiveCalendarDate = calculatedDate.toISOString().split('T')[0];
      console.log(`[INSTANCE_DAY_PATCH] Calculated calendarDate from dayIndex ${globalDayIndex}: ${effectiveCalendarDate} (includeWeekends: ${includeWeekends})`);

      // Update the day with the calculated calendar date for future reference
      updatedWeeks[weekIndex].days[dayIndexInWeek].calendarDate = effectiveCalendarDate;
      await adminDb.collection('program_instances').doc(instanceId).update({
        weeks: updatedWeeks,
      });
    }

    // Sync tasks to user's tasks collection if this is an individual instance
    if (data?.type === 'individual' && data?.userId) {
      await syncDayTasksToUser(instanceId, data.userId, globalDayIndex, updatedDay.tasks, effectiveCalendarDate, data.organizationId);
    }

    // Sync tasks to ALL cohort members if this is a cohort instance
    if (data?.type === 'cohort' && data?.cohortId) {
      const enrollmentsSnap = await adminDb.collection('program_enrollments')
        .where('cohortId', '==', data.cohortId)
        .where('status', 'in', ['active', 'upcoming', 'completed'])
        .get();

      console.log(`[INSTANCE_DAY_PATCH] Syncing to ${enrollmentsSnap.docs.length} cohort members`, {
        globalDayIndex,
        calendarDate: effectiveCalendarDate,
        taskCount: updatedDay.tasks?.length || 0,
      });

      // Sync to each member in parallel
      await Promise.all(
        enrollmentsSnap.docs.map(async (enrollmentDoc) => {
          const enrollment = enrollmentDoc.data();
          if (enrollment.userId) {
            console.log(`[INSTANCE_DAY_PATCH] Syncing day ${globalDayIndex} (${effectiveCalendarDate}) to user ${enrollment.userId}`);
            await syncDayTasksToUser(
              instanceId,
              enrollment.userId,
              globalDayIndex,
              updatedDay.tasks,
              effectiveCalendarDate,
              data.organizationId
            );
          }
        })
      );
    }

    // Fetch the updated day
    const refreshedDoc = await adminDb.collection('program_instances').doc(instanceId).get();
    const refreshedWeeks: ProgramInstanceWeek[] = refreshedDoc.data()?.weeks || [];
    const refreshedResult = findDayByGlobalIndex(refreshedWeeks, globalDayIndex);

    return NextResponse.json({
      success: true,
      day: refreshedResult ? {
        ...refreshedResult.day,
        weekNumber: refreshedResult.week.weekNumber,
      } : null,
    });
  } catch (error) {
    console.error('[INSTANCE_DAY_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update day' }, { status: 500 });
  }
}

/**
 * Sync day tasks to user's tasks collection
 * This ensures tasks appear in the user's Daily Focus
 */
async function syncDayTasksToUser(
  instanceId: string,
  userId: string,
  dayIndex: number,
  tasks: ProgramInstanceTask[],
  calendarDate?: string,
  organizationId?: string
): Promise<void> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();

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
    const data = doc.data();
    if (data.instanceTaskId) {
      existingTasksByInstanceTaskId.set(data.instanceTaskId, {
        id: doc.id,
        completed: data.completed || false,
        completedAt: data.completedAt,
        listType: data.listType,
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
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes,
        notes: task.notes,
        tag: task.tag,
        source: 'program',
        listType,
        dayIndex,
        date: calendarDate,
        status: 'pending',
        order: processedInstanceTaskIds.size,
        isPrivate: false,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
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
    } else {
      // Create new task - non-primary always goes to backlog
      const taskRef = adminDb.collection('tasks').doc();
      batch.set(taskRef, {
        userId,
        organizationId,
        instanceId,
        instanceTaskId: task.id,
        title: task.label,
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes,
        notes: task.notes,
        tag: task.tag,
        source: 'program',
        listType: 'backlog',
        dayIndex,
        date: calendarDate,
        status: 'pending',
        order: processedInstanceTaskIds.size,
        isPrivate: false,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Delete tasks that are no longer in the day (coach deleted them)
  for (const [templateId, existing] of existingTasksByInstanceTaskId.entries()) {
    if (!processedInstanceTaskIds.has(templateId)) {
      const taskRef = adminDb.collection('tasks').doc(existing.id);
      batch.delete(taskRef);
    }
  }

  await batch.commit();
}
