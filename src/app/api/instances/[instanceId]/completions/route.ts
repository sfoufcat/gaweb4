// ============================================================================
// PROGRAM INSTANCE COMPLETIONS API - Part of 3-Collection Architecture
// ============================================================================
//
// This is part of the new simplified program system:
//   programs → program_instances → task_completions
//
// Completions are tracked via the existing `tasks` collection with an `instanceId`
// field linking back to the program_instances document. The composite key is:
//   instanceId + dayIndex + taskId + userId
//
// For cohort programs, this route aggregates completions across all members
// to calculate completion rates for the coach dashboard.
//
// See CLAUDE.md "Program System Architecture" for full documentation.
// ============================================================================

/**
 * Program Instance Completions API
 *
 * Get and set task completion status for program instances
 *
 * GET /api/instances/[instanceId]/completions - Get all task completions
 * POST /api/instances/[instanceId]/completions - Set a task completion
 *
 * Task completion is stored in the unified `tasks` collection with:
 * - instanceId: FK to program_instances
 * - templateTaskId: The original task.id from the instance
 * - completed: boolean
 * - completedAt: ISO timestamp
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramInstance, Task } from '@/types';

type RouteParams = { params: Promise<{ instanceId: string }> };

interface CompletionSummary {
  taskId: string;
  dayIndex: number;
  weekNumber: number;
  label: string;
  totalMembers: number;
  completedCount: number;
  completionRate: number;
  isThresholdMet: boolean;
  memberBreakdown: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
    status: 'pending' | 'completed';
    completedAt?: string;
  }>;
}

/**
 * GET /api/instances/[instanceId]/completions
 * Returns completion data for all tasks in the instance
 *
 * Query params:
 * - weekNumber: Filter by week
 * - dayIndex: Filter by day (within week)
 * - threshold: Completion threshold percentage (default: 80)
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId } = await params;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const weekNumber = searchParams.get('weekNumber') ? parseInt(searchParams.get('weekNumber')!, 10) : undefined;
    const dayIndex = searchParams.get('dayIndex') ? parseInt(searchParams.get('dayIndex')!, 10) : undefined;
    const threshold = parseInt(searchParams.get('threshold') || '80', 10);

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

    const instance = data as ProgramInstance;

    // Get members based on instance type
    let memberIds: string[] = [];
    let memberProfiles: Map<string, { firstName: string; lastName: string; imageUrl: string }> = new Map();

    if (instance.type === 'cohort' && instance.cohortId) {
      // Get cohort members
      const enrollmentsSnap = await adminDb.collection('program_enrollments')
        .where('cohortId', '==', instance.cohortId)
        .where('status', 'in', ['active', 'completed'])
        .get();

      memberIds = enrollmentsSnap.docs.map(d => d.data().userId);
    } else if (instance.type === 'individual' && instance.userId) {
      memberIds = [instance.userId];
    }

    // Fetch member profiles
    if (memberIds.length > 0) {
      const userDocs = await Promise.all(
        memberIds.slice(0, 100).map(userId =>
          adminDb.collection('users').doc(userId).get()
        )
      );

      for (const userDoc of userDocs) {
        if (userDoc.exists) {
          const userData = userDoc.data();
          memberProfiles.set(userDoc.id, {
            firstName: userData?.firstName || 'Unknown',
            lastName: userData?.lastName || '',
            imageUrl: userData?.imageUrl || '',
          });
        }
      }
    }

    // Get all tasks for this instance
    const tasksQuery = adminDb.collection('tasks')
      .where('instanceId', '==', instanceId);

    const tasksSnap = await tasksQuery.get();

    // Build task completion map: Map<taskId, Map<userId, Task>>
    const taskCompletions = new Map<string, Map<string, Task>>();

    for (const taskDoc of tasksSnap.docs) {
      const task = { id: taskDoc.id, ...taskDoc.data() } as Task;
      const templateTaskId = task.templateTaskId;
      const userId = task.userId;

      if (templateTaskId && userId) {
        if (!taskCompletions.has(templateTaskId)) {
          taskCompletions.set(templateTaskId, new Map());
        }
        taskCompletions.get(templateTaskId)!.set(userId, task);
      }
    }

    // Build completion summaries for each task in the instance
    const completions: CompletionSummary[] = [];

    for (const week of instance.weeks || []) {
      if (weekNumber !== undefined && week.weekNumber !== weekNumber) continue;

      for (const day of week.days || []) {
        if (dayIndex !== undefined && day.dayIndex !== dayIndex) continue;

        for (const task of day.tasks || []) {
          const taskId = task.id;
          const userTasks = taskCompletions.get(taskId) || new Map();

          // Build member breakdown
          const memberBreakdown = memberIds.map(userId => {
            const userTask = userTasks.get(userId);
            const profile = memberProfiles.get(userId) || { firstName: 'Unknown', lastName: '', imageUrl: '' };

            return {
              userId,
              firstName: profile.firstName,
              lastName: profile.lastName,
              imageUrl: profile.imageUrl,
              status: (userTask?.completed ? 'completed' : 'pending') as 'pending' | 'completed',
              completedAt: userTask?.completedAt,
            };
          });

          const completedCount = memberBreakdown.filter(m => m.status === 'completed').length;
          const totalMembers = memberBreakdown.length;
          const completionRate = totalMembers > 0 ? Math.round((completedCount / totalMembers) * 100) : 0;

          completions.push({
            taskId,
            dayIndex: day.globalDayIndex,
            weekNumber: week.weekNumber,
            label: task.label,
            totalMembers,
            completedCount,
            completionRate,
            isThresholdMet: completionRate >= threshold,
            memberBreakdown,
          });
        }
      }
    }

    return NextResponse.json({
      completions,
      totalMembers: memberIds.length,
      threshold,
    });
  } catch (error) {
    console.error('[INSTANCE_COMPLETIONS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch completions' }, { status: 500 });
  }
}

/**
 * POST /api/instances/[instanceId]/completions
 * Set a task completion status
 *
 * Body:
 * - taskId: The task.id from the instance
 * - userId: The user to set completion for
 * - completed: boolean
 * - dayIndex: The global day index (for creating task if needed)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId } = await params;
    const body = await request.json();

    const { taskId, userId, completed, dayIndex, label } = body;

    if (!taskId || !userId) {
      return NextResponse.json({ error: 'taskId and userId are required' }, { status: 400 });
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

    // Find or create the task in the tasks collection
    const existingTaskQuery = await adminDb.collection('tasks')
      .where('instanceId', '==', instanceId)
      .where('templateTaskId', '==', taskId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (existingTaskQuery.empty) {
      // Create a new task record
      const now = new Date().toISOString();
      const newTask = {
        userId,
        instanceId,
        templateTaskId: taskId,
        label: label || 'Task',
        dayIndex: dayIndex || 1,
        isPrimary: true,
        source: 'program' as const,
        completed: !!completed,
        completedAt: completed ? now : null,
        createdAt: now,
        updatedAt: now,
      };

      const taskRef = await adminDb.collection('tasks').add(newTask);

      return NextResponse.json({
        success: true,
        taskId: taskRef.id,
        completed: !!completed,
      });
    }

    // Update existing task
    const existingTaskDoc = existingTaskQuery.docs[0];
    const now = new Date().toISOString();

    await existingTaskDoc.ref.update({
      completed: !!completed,
      completedAt: completed ? now : null,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      taskId: existingTaskDoc.id,
      completed: !!completed,
    });
  } catch (error) {
    console.error('[INSTANCE_COMPLETIONS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to set completion' }, { status: 500 });
  }
}
