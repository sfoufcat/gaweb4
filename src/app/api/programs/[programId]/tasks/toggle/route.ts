/**
 * Program Task Toggle API
 *
 * POST /api/programs/[programId]/tasks/toggle
 * Toggle completion status for a program task (for enrolled users)
 *
 * Body:
 * - enrollmentId: The user's enrollment ID
 * - taskId: The task ID from the program instance
 * - dayIndex: The day index (for task identification)
 * - completed: The new completion status
 * - label: The task label (for creating task record if needed)
 * - calendarDate: The calendar date for this day (YYYY-MM-DD)
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';

type RouteParams = { params: Promise<{ programId: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { programId } = await params;
    const body = await request.json();
    const { enrollmentId, taskId, dayIndex, completed, label, calendarDate } = body;

    // Get organization ID for multi-tenant filtering
    const organizationId = await getEffectiveOrgId();

    if (!enrollmentId || !taskId) {
      return NextResponse.json(
        { error: 'enrollmentId and taskId are required' },
        { status: 400 }
      );
    }

    // Verify the enrollment belongs to this user
    const enrollmentDoc = await adminDb
      .collection('program_enrollments')
      .doc(enrollmentId)
      .get();

    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const enrollment = enrollmentDoc.data();
    if (enrollment?.clerkUserId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (enrollment?.programId !== programId) {
      return NextResponse.json({ error: 'Program mismatch' }, { status: 400 });
    }

    // Find the instance for this enrollment
    // First try individual instance
    let instanceSnapshot = await adminDb
      .collection('program_instances')
      .where('programId', '==', programId)
      .where('enrollmentId', '==', enrollmentId)
      .where('type', '==', 'individual')
      .limit(1)
      .get();

    // If no individual instance, try cohort instance
    if (instanceSnapshot.empty && enrollment.cohortId) {
      instanceSnapshot = await adminDb
        .collection('program_instances')
        .where('programId', '==', programId)
        .where('cohortId', '==', enrollment.cohortId)
        .where('type', '==', 'cohort')
        .limit(1)
        .get();
    }

    if (instanceSnapshot.empty) {
      return NextResponse.json({ error: 'Program instance not found' }, { status: 404 });
    }

    const instanceId = instanceSnapshot.docs[0].id;

    // Find or create the task in the tasks collection
    const existingTaskQuery = await adminDb.collection('tasks')
      .where('instanceId', '==', instanceId)
      .where('instanceTaskId', '==', taskId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    const now = new Date().toISOString();

    if (existingTaskQuery.empty) {
      // Create a new task record with all fields needed for Daily Focus sync
      const newTask = {
        userId,
        instanceId,
        instanceTaskId: taskId,
        title: label || 'Task',
        label: label || 'Task',
        dayIndex: dayIndex || 1,
        // Include date for Daily Focus query compatibility
        date: calendarDate || new Date().toISOString().split('T')[0],
        // Include status for Daily Focus compatibility
        status: completed ? 'completed' : 'pending',
        listType: 'focus' as const,
        order: 0,
        isPrimary: false,
        source: 'program' as const,
        sourceType: 'program' as const,
        completed: !!completed,
        completedAt: completed ? now : null,
        createdAt: now,
        updatedAt: now,
        isPrivate: false,
        // Include organizationId for multi-tenant filtering
        ...(organizationId && { organizationId }),
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

    await existingTaskDoc.ref.update({
      completed: !!completed,
      completedAt: completed ? now : null,
      // Also update status for Daily Focus compatibility
      status: completed ? 'completed' : 'pending',
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      taskId: existingTaskDoc.id,
      completed: !!completed,
    });
  } catch (error) {
    console.error('[PROGRAM_TASK_TOGGLE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle task completion' },
      { status: 500 }
    );
  }
}
