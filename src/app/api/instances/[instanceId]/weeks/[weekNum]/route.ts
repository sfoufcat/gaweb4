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

type RouteParams = { params: Promise<{ instanceId: string; weekNum: string }> };

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
  calendarDate?: string
): Promise<void> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();

  // Get existing tasks for this instance + day + user
  const existingTasksQuery = await adminDb.collection('tasks')
    .where('userId', '==', userId)
    .where('instanceId', '==', instanceId)
    .where('dayIndex', '==', dayIndex)
    .get();

  const existingTasksByTemplateId = new Map<string, { id: string; completed: boolean; completedAt?: string }>();
  for (const doc of existingTasksQuery.docs) {
    const taskData = doc.data();
    if (taskData.templateTaskId) {
      existingTasksByTemplateId.set(taskData.templateTaskId, {
        id: doc.id,
        completed: taskData.completed || false,
        completedAt: taskData.completedAt,
      });
    }
  }

  const processedTemplateIds = new Set<string>();

  // Create/update tasks
  for (const task of tasks) {
    processedTemplateIds.add(task.id);

    const existing = existingTasksByTemplateId.get(task.id);

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
    } else {
      // Create new task
      const taskRef = adminDb.collection('tasks').doc();
      batch.set(taskRef, {
        userId,
        instanceId,
        templateTaskId: task.id,
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
    }
  }

  // Delete tasks that are no longer in the day (coach deleted them)
  for (const [templateId, existing] of existingTasksByTemplateId.entries()) {
    if (!processedTemplateIds.has(templateId)) {
      const taskRef = adminDb.collection('tasks').doc(existing.id);
      batch.delete(taskRef);
    }
  }

  await batch.commit();
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
    const updatedWeek: ProgramInstanceWeek = {
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

    // Update the weeks array
    const updatedWeeks = [...weeks];
    updatedWeeks[weekIndex] = updatedWeek;

    // Save to Firestore
    await adminDb.collection('program_instances').doc(instanceId).update({
      weeks: updatedWeeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // If distribution is specified, distribute weekly tasks to days
    // Note: body.weeklyTasks can be an empty array (coach deleted all tasks), so check for array type
    if (body.distribution && Array.isArray(body.weeklyTasks)) {
      const distribution = body.distribution;
      const weeklyTasks = processTasksWithIds(body.weeklyTasks);

      // Get the days for this week
      const daysToUpdate = updatedWeek.days;

      // Distribute tasks based on distribution type
      if (distribution.type === 'spread') {
        // Spread tasks evenly across specified days
        const targetDays = distribution.targetDays || daysToUpdate.map(d => d.dayIndex);
        const tasksPerDay = Math.ceil(weeklyTasks.length / targetDays.length);

        let taskIdx = 0;
        for (const dayIndex of targetDays) {
          const dayToUpdate = daysToUpdate.find(d => d.dayIndex === dayIndex);
          if (dayToUpdate) {
            const tasksForDay = weeklyTasks.slice(taskIdx, taskIdx + tasksPerDay);
            dayToUpdate.tasks = [
              ...dayToUpdate.tasks.filter(t => t.source && t.source !== 'week'),
              ...tasksForDay.map(t => ({ ...t, source: 'week' as const })),
            ];
            taskIdx += tasksPerDay;
          }
        }
      } else if (distribution.type === 'all_days') {
        // Add all tasks to all days
        for (const dayToUpdate of daysToUpdate) {
          dayToUpdate.tasks = [
            ...dayToUpdate.tasks.filter(t => t.source && t.source !== 'week'),
            ...weeklyTasks.map(t => ({ ...t, source: 'week' as const })),
          ];
        }
      } else if (distribution.type === 'first_day') {
        // Add all tasks to first day only
        if (daysToUpdate.length > 0) {
          daysToUpdate[0].tasks = [
            ...daysToUpdate[0].tasks.filter(t => t.source && t.source !== 'week'),
            ...weeklyTasks.map(t => ({ ...t, source: 'week' as const })),
          ];
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
          await syncDayTasksToUser(instanceId, data.userId, day.globalDayIndex, day.tasks, day.calendarDate);
        }
        console.log(`[INSTANCE_WEEK_PATCH] Synced ${daysToUpdate.length} days to user ${data.userId}`);
      } else if (data?.type === 'cohort' && data?.cohortId) {
        // Cohort instance - sync to all cohort members
        const enrollmentsSnap = await adminDb.collection('program_enrollments')
          .where('cohortId', '==', data.cohortId)
          .where('status', 'in', ['active', 'completed'])
          .get();

        console.log(`[INSTANCE_WEEK_PATCH] Syncing ${daysToUpdate.length} days to ${enrollmentsSnap.docs.length} cohort members`);

        await Promise.all(
          enrollmentsSnap.docs.map(async (enrollmentDoc) => {
            const enrollment = enrollmentDoc.data();
            if (enrollment.userId) {
              for (const day of daysToUpdate) {
                await syncDayTasksToUser(
                  instanceId,
                  enrollment.userId,
                  day.globalDayIndex,
                  day.tasks,
                  day.calendarDate
                );
              }
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
