// ============================================================================
// PROGRAM INSTANCE API - Part of 3-Collection Architecture
// ============================================================================
//
// This is part of the new simplified program system:
//   programs → program_instances → task_completions
//
// This route handles CRUD for individual program instance documents.
// Each instance contains embedded weeks/days/tasks.
//
// See CLAUDE.md "Program System Architecture" for full documentation.
// ============================================================================

/**
 * Program Instance API
 *
 * Unified API for managing program instances (both individual enrollments and cohorts)
 *
 * GET /api/instances/[instanceId] - Get instance with all weeks/days
 * PATCH /api/instances/[instanceId] - Update instance metadata
 * DELETE /api/instances/[instanceId] - Delete instance (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramInstance, ProgramInstanceWeek, ProgramInstanceDay, ProgramTaskTemplate } from '@/types';

type RouteParams = { params: Promise<{ instanceId: string }> };

/**
 * Helper to convert task template to instance task
 */
function toInstanceTask(task: ProgramTaskTemplate): ProgramInstanceDay['tasks'][0] {
  return {
    id: task.id || crypto.randomUUID(),
    label: task.label,
    type: task.type,
    isPrimary: task.isPrimary,
    estimatedMinutes: task.estimatedMinutes,
    notes: task.notes,
    tag: task.tag,
    source: 'week' as const,
  };
}

/**
 * Re-distributes tasks for a partial week using the correct active range.
 * Used for migrating stale instances where tasks were distributed before the fix.
 */
function redistributeTasksForPartialWeek(
  weeklyTasks: ProgramTaskTemplate[],
  days: ProgramInstanceDay[],
  distribution: string | undefined,
  activeStartDay: number,
  activeEndDay: number
): ProgramInstanceDay[] {
  const numDays = days.length;
  if (numDays === 0 || weeklyTasks.length === 0) return days;

  const activeStartIdx = Math.max(0, activeStartDay - 1);
  const activeEndIdx = Math.min(numDays - 1, activeEndDay - 1);
  const activeRange = activeEndIdx - activeStartIdx + 1;

  // Clone days and clear tasks for re-distribution
  const updatedDays = days.map(d => ({ ...d, tasks: [] as ProgramInstanceDay['tasks'] }));

  const distType = distribution || 'spread';

  if (distType === 'first_day') {
    for (const task of weeklyTasks) {
      updatedDays[activeStartIdx].tasks.push(toInstanceTask(task));
    }
  } else if (distType === 'all_days') {
    for (const task of weeklyTasks) {
      for (let dayIdx = activeStartIdx; dayIdx <= activeEndIdx; dayIdx++) {
        updatedDays[dayIdx].tasks.push(toInstanceTask(task));
      }
    }
  } else {
    // 'spread'
    const numTasks = weeklyTasks.length;
    if (numTasks >= activeRange) {
      let taskIdx = 0;
      for (let d = activeStartIdx; d <= activeEndIdx; d++) {
        const remainingDays = activeEndIdx - d + 1;
        const remainingTasks = numTasks - taskIdx;
        const count = Math.ceil(remainingTasks / remainingDays);
        for (let j = 0; j < count && taskIdx < numTasks; j++) {
          updatedDays[d].tasks.push(toInstanceTask(weeklyTasks[taskIdx++]));
        }
      }
    } else {
      for (let i = 0; i < numTasks; i++) {
        let targetDayIdx: number;
        if (numTasks === 1) {
          targetDayIdx = activeStartIdx;
        } else {
          const offset = Math.round(i * (activeRange - 1) / (numTasks - 1));
          targetDayIdx = activeStartIdx + offset;
        }
        updatedDays[targetDayIdx].tasks.push(toInstanceTask(weeklyTasks[i]));
      }
    }
  }

  return updatedDays;
}

/**
 * GET /api/instances/[instanceId]
 * Returns the full program instance with weeks and days
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId } = await params;

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

    // Backfill startDate if missing (legacy instances)
    let startDate = data.startDate;
    if (!startDate) {
      if (data.type === 'individual' && data.enrollmentId) {
        // Get from enrollment
        const enrollmentDoc = await adminDb.collection('program_enrollments').doc(data.enrollmentId).get();
        if (enrollmentDoc.exists) {
          const enrollmentData = enrollmentDoc.data();
          startDate = enrollmentData?.startDate || enrollmentData?.startedAt;
          if (typeof startDate?.toDate === 'function') {
            startDate = startDate.toDate().toISOString().split('T')[0];
          }
        }
      } else if (data.type === 'cohort' && data.cohortId) {
        // Get from cohort
        const cohortDoc = await adminDb.collection('program_cohorts').doc(data.cohortId).get();
        if (cohortDoc.exists) {
          startDate = cohortDoc.data()?.startDate;
        }
      }
      // Persist the backfilled startDate
      if (startDate) {
        await instanceDoc.ref.update({ startDate, updatedAt: new Date().toISOString() });
        console.log(`[INSTANCE_GET] Backfilled startDate=${startDate} for instance ${instanceId}`);
      }
    }

    const instance: ProgramInstance = {
      id: instanceDoc.id,
      programId: data.programId,
      organizationId: data.organizationId,
      type: data.type,
      userId: data.userId,
      enrollmentId: data.enrollmentId,
      cohortId: data.cohortId,
      startDate,
      endDate: data.endDate,
      weeks: data.weeks || [],
      includeWeekends: data.includeWeekends,
      dailyFocusSlots: data.dailyFocusSlots,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      lastSyncedFromTemplate: data.lastSyncedFromTemplate?.toDate?.()?.toISOString?.() || data.lastSyncedFromTemplate,
    };

    // MIGRATION: Fix stale task distribution in partial weeks
    // Instances created before the partial week fix have tasks distributed to all days
    // instead of only active days. Detect and fix this on load.
    const daysPerWeek = data.includeWeekends !== false ? 7 : 5;
    let needsMigration = false;

    for (const week of instance.weeks) {
      // Check if this is a partial week (onboarding or closing with partial days)
      const hasPartialStart = week.actualStartDayOfWeek && week.actualStartDayOfWeek > 1;
      const hasPartialEnd = week.actualEndDayOfWeek && week.actualEndDayOfWeek < daysPerWeek;

      if ((hasPartialStart || hasPartialEnd) && week.weeklyTasks?.length && week.days?.length) {
        // Calculate active range
        const activeStartIdx = (week.actualStartDayOfWeek || 1) - 1;
        const activeEndIdx = (week.actualEndDayOfWeek || daysPerWeek) - 1;

        // Check if tasks exist on inactive days (sign of stale distribution)
        const hasTasksOnInactiveDays = week.days.some((day, idx) =>
          (idx < activeStartIdx || idx > activeEndIdx) && day.tasks && day.tasks.length > 0
        );

        if (hasTasksOnInactiveDays) {
          console.log(`[INSTANCE_GET] Detected stale task distribution in week ${week.weekNumber}:`, {
            actualStartDayOfWeek: week.actualStartDayOfWeek,
            actualEndDayOfWeek: week.actualEndDayOfWeek,
            activeRange: `${activeStartIdx + 1}-${activeEndIdx + 1}`,
            daysWithTasks: week.days.map((d, i) => ({ dayIdx: i + 1, taskCount: d.tasks?.length || 0 })),
          });

          // Re-distribute tasks to correct days
          week.days = redistributeTasksForPartialWeek(
            week.weeklyTasks as ProgramTaskTemplate[],
            week.days as ProgramInstanceDay[],
            week.distribution,
            week.actualStartDayOfWeek || 1,
            week.actualEndDayOfWeek || daysPerWeek
          );
          needsMigration = true;
        }
      }
    }

    // Persist migration if needed
    if (needsMigration) {
      try {
        await instanceDoc.ref.update({
          weeks: instance.weeks,
          updatedAt: new Date().toISOString(),
        });
        console.log(`[INSTANCE_GET] Migrated stale task distribution for instance ${instanceId}`);
      } catch (migrationError) {
        console.error(`[INSTANCE_GET] Failed to persist migration for instance ${instanceId}:`, migrationError);
        // Continue anyway - the in-memory instance is already fixed
      }
    }

    // Debug: Log what weeks data we're returning from Firestore
    console.log('[INSTANCE_GET] Returning instance:', {
      instanceId,
      type: instance.type,
      weeksCount: instance.weeks?.length ?? 0,
      weeks: instance.weeks?.map((w: ProgramInstanceWeek) => ({
        weekNumber: w.weekNumber,
        weeklyTasksCount: w.weeklyTasks?.length ?? 0,
        weeklyTaskLabels: w.weeklyTasks?.map(t => t.label),
      })),
    });

    // For cohort instances, fetch member completion data
    if (instance.type === 'cohort' && instance.cohortId) {
      // Get cohort members
      const enrollmentsSnap = await adminDb.collection('program_enrollments')
        .where('cohortId', '==', instance.cohortId)
        .where('status', 'in', ['active', 'completed'])
        .get();

      const memberIds = enrollmentsSnap.docs.map(d => d.data().userId);

      // Get user profiles for member info
      const memberProfiles = await Promise.all(
        memberIds.slice(0, 50).map(async (userId) => {
          const userDoc = await adminDb.collection('users').doc(userId).get();
          const userData = userDoc.data();
          return {
            userId,
            firstName: userData?.firstName || 'Unknown',
            lastName: userData?.lastName || '',
            imageUrl: userData?.imageUrl || '',
          };
        })
      );

      // Enrich weeks with completion data
      instance.weeks = (instance.weeks || []).map((week: ProgramInstanceWeek) => ({
        ...week,
        days: (week.days || []).map(day => ({
          ...day,
          tasks: (day.tasks || []).map(task => {
            // Get task completion from tasks collection
            // This will be optimized in production with a batch query
            return {
              ...task,
              _memberCount: memberProfiles.length,
            };
          }),
        })),
      }));

      return NextResponse.json({
        instance,
        members: memberProfiles,
      });
    }

    // For individual instances, fetch user profile and task completion data
    if (instance.type === 'individual' && instance.userId) {
      const userDoc = await adminDb.collection('users').doc(instance.userId).get();
      const userData = userDoc.data();

      // MIGRATE EXISTING TASKS: Add instanceId to tasks that don't have it
      // This ensures old tasks (created before instanceId was added) work with the new system
      if (instance.enrollmentId) {
        const oldTasksSnap = await adminDb.collection('tasks')
          .where('userId', '==', instance.userId)
          .where('programEnrollmentId', '==', instance.enrollmentId)
          .get();

        if (!oldTasksSnap.empty) {
          const batch = adminDb.batch();
          let migratedCount = 0;

          for (const doc of oldTasksSnap.docs) {
            const data = doc.data();
            // Only migrate if missing instanceId
            if (!data.instanceId) {
              batch.update(doc.ref, {
                instanceId,
                dayIndex: data.programDayIndex || data.dayIndex,
                label: data.label || data.title || data.originalTitle,
              });
              migratedCount++;
            }
          }

          if (migratedCount > 0) {
            await batch.commit();
            console.log(`[INSTANCE_GET] Migrated ${migratedCount} tasks to use instanceId`);
          }
        }
      }

      // Fetch task completion data from tasks collection
      // Tasks are linked via instanceId + dayIndex + label (new system)
      const taskCompletionMap: Record<string, { completed: boolean; completedAt?: string }> = {};

      // Query by instanceId - tasks created by cron job or on-demand sync
      const tasksSnap = await adminDb.collection('tasks')
        .where('userId', '==', instance.userId)
        .where('instanceId', '==', instanceId)
        .get();

      for (const taskDoc of tasksSnap.docs) {
        const taskData = taskDoc.data();
        const dayIdx = taskData.dayIndex;
        // Use label field, fallback to title or originalTitle for backward compatibility
        const label = taskData.label || taskData.title || taskData.originalTitle || '';

        if (dayIdx && label) {
          const key = `${dayIdx}:${label}`;
          taskCompletionMap[key] = {
            completed: taskData.completed === true,
            completedAt: taskData.completedAt,
          };
        }

        // Also store by just the label for fallback matching
        if (label) {
          taskCompletionMap[label] = {
            completed: taskData.completed === true,
            completedAt: taskData.completedAt,
          };
        }

        // Also store by instanceTaskId if available (most reliable match)
        if (taskData.instanceTaskId) {
          taskCompletionMap[taskData.instanceTaskId] = {
            completed: taskData.completed === true,
            completedAt: taskData.completedAt,
          };
        }
      }

      console.log('[INSTANCE_GET] Individual completion data:', {
        instanceId,
        userId: instance.userId,
        tasksFound: tasksSnap.docs.length,
        completionCount: Object.keys(taskCompletionMap).length,
        sampleKeys: Object.keys(taskCompletionMap).slice(0, 10),
      });

      return NextResponse.json({
        instance,
        user: {
          userId: instance.userId,
          firstName: userData?.firstName || 'Unknown',
          lastName: userData?.lastName || '',
          imageUrl: userData?.imageUrl || '',
        },
        taskCompletionMap,
      });
    }

    return NextResponse.json({ instance });
  } catch (error) {
    console.error('[INSTANCE_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch instance' }, { status: 500 });
  }
}

/**
 * PATCH /api/instances/[instanceId]
 * Update instance metadata (not week/day content - use week routes for that)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId } = await params;
    const body = await request.json();

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

    // Build update object (only allow certain fields to be updated)
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Metadata fields that can be updated
    if (body.startDate !== undefined) updateData.startDate = body.startDate;
    if (body.endDate !== undefined) updateData.endDate = body.endDate;
    if (body.includeWeekends !== undefined) updateData.includeWeekends = body.includeWeekends;
    if (body.dailyFocusSlots !== undefined) updateData.dailyFocusSlots = body.dailyFocusSlots;

    await adminDb.collection('program_instances').doc(instanceId).update(updateData);

    // Fetch updated instance
    const updatedDoc = await adminDb.collection('program_instances').doc(instanceId).get();
    const updatedData = updatedDoc.data();

    const instance: ProgramInstance = {
      id: updatedDoc.id,
      programId: updatedData?.programId,
      organizationId: updatedData?.organizationId,
      type: updatedData?.type,
      userId: updatedData?.userId,
      enrollmentId: updatedData?.enrollmentId,
      cohortId: updatedData?.cohortId,
      startDate: updatedData?.startDate,
      endDate: updatedData?.endDate,
      weeks: updatedData?.weeks || [],
      includeWeekends: updatedData?.includeWeekends,
      dailyFocusSlots: updatedData?.dailyFocusSlots,
      createdAt: updatedData?.createdAt?.toDate?.()?.toISOString?.() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt?.toDate?.()?.toISOString?.() || updatedData?.updatedAt,
      lastSyncedFromTemplate: updatedData?.lastSyncedFromTemplate,
    };

    return NextResponse.json({
      success: true,
      instance,
    });
  } catch (error) {
    console.error('[INSTANCE_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update instance' }, { status: 500 });
  }
}

/**
 * DELETE /api/instances/[instanceId]
 * Soft delete an instance (marks as deleted, doesn't remove data)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId } = await params;

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

    // Soft delete - mark as deleted
    await adminDb.collection('program_instances').doc(instanceId).update({
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Instance deleted successfully',
    });
  } catch (error) {
    console.error('[INSTANCE_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to delete instance' }, { status: 500 });
  }
}
