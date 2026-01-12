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
  const updatedDays = week.days.map((day, index) => {
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
 * Sync day tasks to user's tasks collection
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
  let created = 0, updated = 0, deleted = 0;

  console.log(`[syncDayTasksToUser] Starting sync for user ${userId}, day ${dayIndex}, date ${calendarDate}, orgId ${organizationId}, tasks: ${tasks?.length || 0}`);

  // Get existing tasks for this instance + day + user
  const existingTasksQuery = await adminDb.collection('tasks')
    .where('userId', '==', userId)
    .where('instanceId', '==', instanceId)
    .where('dayIndex', '==', dayIndex)
    .get();

  console.log(`[syncDayTasksToUser] Found ${existingTasksQuery.docs.length} existing tasks for day ${dayIndex}`);

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
      console.log(`[syncDayTasksToUser] Creating task: ${task.label} for date ${calendarDate}`);
      batch.set(taskRef, {
        userId,
        organizationId,
        instanceId,
        instanceTaskId: task.id,
        label: task.label,
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes,
        notes: task.notes,
        tag: task.tag,
        source: 'program',
        listType: 'focus',
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
        days: week.days.map(day => ({
          ...day,
          tasks: day.tasks.map(task => ({
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
    if (body.distribution !== undefined) updatedWeek.distribution = body.distribution;
    if (body.weeklyHabits !== undefined) updatedWeek.weeklyHabits = body.weeklyHabits;
    if (body.manualNotes !== undefined) updatedWeek.manualNotes = body.manualNotes?.trim() || undefined;

    // Update weekly tasks
    if (body.weeklyTasks !== undefined) {
      updatedWeek.weeklyTasks = processTasksWithIds(body.weeklyTasks);
    }

    // Update days if provided
    if (body.days !== undefined && Array.isArray(body.days)) {
      updatedWeek.days = body.days.map((day: ProgramInstanceDay, index: number) => ({
        ...existingWeek.days[index],
        ...day,
        tasks: processTasksWithIds(day.tasks),
        hasLocalChanges: true,
      }));
    }

    // Update specific day if dayIndex is provided
    if (body.dayIndex !== undefined && body.day !== undefined) {
      const dayIdx = updatedWeek.days.findIndex(d => d.dayIndex === body.dayIndex);
      if (dayIdx !== -1) {
        updatedWeek.days[dayIdx] = {
          ...updatedWeek.days[dayIdx],
          ...body.day,
          tasks: processTasksWithIds(body.day.tasks || updatedWeek.days[dayIdx].tasks),
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

      // Distribute tasks based on distribution type
      // IMPORTANT: Always clear old 'week' source tasks from days, even if no new tasks
      const numDays = daysToUpdate.length;
      const numTasks = weeklyTasks.length;

      if (distribution.type === 'spread') {
        // Spread tasks proportionally across ALL days
        // Each task covers approximately (numDays / numTasks) days
        for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
          const existingTasks = daysToUpdate[dayIdx].tasks || [];
          // Remove old week tasks
          const nonWeekTasks = existingTasks.filter(t => !t.source || t.source !== 'week');

          if (numTasks > 0) {
            // Calculate which task this day should have based on proportional position
            // With 2 tasks and 7 days: days 0-3 get task 0, days 4-6 get task 1
            const taskIdx = Math.floor((dayIdx / numDays) * numTasks);
            const task = weeklyTasks[taskIdx];
            daysToUpdate[dayIdx].tasks = [
              ...nonWeekTasks,
              { ...task, source: 'week' as const },
            ];
          } else {
            // No weekly tasks - just keep non-week tasks (clears week tasks)
            daysToUpdate[dayIdx].tasks = nonWeekTasks;
          }
        }
      } else if (distribution.type === 'all_days') {
        // Add all tasks to all days
        for (const dayToUpdate of daysToUpdate) {
          const existingTasks = dayToUpdate.tasks || [];
          dayToUpdate.tasks = [
            ...existingTasks.filter(t => !t.source || t.source !== 'week'),
            ...weeklyTasks.map(t => ({ ...t, source: 'week' as const })),
          ];
        }
      } else if (distribution.type === 'first_day') {
        // Clear week tasks from all days, then add to first day only
        for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
          const existingTasks = daysToUpdate[dayIdx].tasks || [];
          if (dayIdx === 0) {
            // First day: add week tasks
            daysToUpdate[dayIdx].tasks = [
              ...existingTasks.filter(t => !t.source || t.source !== 'week'),
              ...weeklyTasks.map(t => ({ ...t, source: 'week' as const })),
            ];
          } else {
            // Other days: just clear week tasks
            daysToUpdate[dayIdx].tasks = existingTasks.filter(t => !t.source || t.source !== 'week');
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
          console.log(`[INSTANCE_WEEK_PATCH] Syncing day ${day.globalDayIndex} (${effectiveCalendarDate || 'NO DATE'}) to individual user ${data.userId}`);
          await syncDayTasksToUser(instanceId, data.userId, day.globalDayIndex, day.tasks, effectiveCalendarDate, data.organizationId);
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

                console.log(`[INSTANCE_WEEK_PATCH] Syncing day ${day.globalDayIndex} (${effectiveCalendarDate || 'NO DATE'}) with ${day.tasks?.length || 0} tasks to user ${enrollment.userId}`);

                await syncDayTasksToUser(
                  instanceId,
                  enrollment.userId,
                  day.globalDayIndex,
                  day.tasks,
                  effectiveCalendarDate,
                  data.organizationId
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
