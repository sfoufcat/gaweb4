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
import type { ProgramInstance, ProgramInstanceWeek } from '@/types';

type RouteParams = { params: Promise<{ instanceId: string }> };

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

    const instance: ProgramInstance = {
      id: instanceDoc.id,
      programId: data.programId,
      organizationId: data.organizationId,
      type: data.type,
      userId: data.userId,
      enrollmentId: data.enrollmentId,
      cohortId: data.cohortId,
      startDate: data.startDate,
      endDate: data.endDate,
      weeks: data.weeks || [],
      includeWeekends: data.includeWeekends,
      dailyFocusSlots: data.dailyFocusSlots,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      lastSyncedFromTemplate: data.lastSyncedFromTemplate?.toDate?.()?.toISOString?.() || data.lastSyncedFromTemplate,
    };

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
      instance.weeks = instance.weeks.map((week: ProgramInstanceWeek) => ({
        ...week,
        days: week.days.map(day => ({
          ...day,
          tasks: day.tasks.map(task => {
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
        const label = taskData.label || '';

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
