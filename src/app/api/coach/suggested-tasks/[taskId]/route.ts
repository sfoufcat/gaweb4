/**
 * Suggested Task Detail API
 *
 * Approve, reject, or assign suggested tasks from call summaries.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UserRole, OrgRole, ClerkPublicMetadata, SuggestedTask, Task } from '@/types';

interface RouteParams {
  params: Promise<{
    taskId: string;
  }>;
}

/**
 * GET /api/coach/suggested-tasks/[taskId]
 *
 * Get a single suggested task
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId, sessionClaims } = await auth();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const doc = await adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('suggested_tasks')
      .doc(taskId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task: SuggestedTask = {
      id: doc.id,
      ...doc.data(),
    } as SuggestedTask;

    return NextResponse.json({ task });
  } catch (error) {
    console.error('[SUGGESTED_TASK_API] Error getting task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/coach/suggested-tasks/[taskId]
 *
 * Update suggested task status (approve, reject, or assign)
 *
 * Body:
 * - action: 'approve' | 'reject' | 'assign'
 * - listType?: 'focus' | 'backlog' (for assign)
 * - date?: string (for assign, defaults to today)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId, sessionClaims } = await auth();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    const { action, listType, date } = body;

    if (!action || !['approve', 'reject', 'assign'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be approve, reject, or assign' },
        { status: 400 }
      );
    }

    const taskRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('suggested_tasks')
      .doc(taskId);

    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const taskData = taskDoc.data() as SuggestedTask;

    // Handle different actions
    if (action === 'approve') {
      await taskRef.update({
        status: 'approved',
        reviewedBy: userId,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (action === 'reject') {
      await taskRef.update({
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (action === 'assign') {
      // Create actual task
      const taskDate = date || new Date().toISOString().split('T')[0];
      const taskListType = listType || 'backlog';

      // Get max order for the target list
      const existingTasksSnapshot = await adminDb
        .collection('tasks')
        .where('userId', '==', taskData.userId)
        .where('organizationId', '==', organizationId)
        .where('date', '==', taskDate)
        .where('listType', '==', taskListType)
        .orderBy('order', 'desc')
        .limit(1)
        .get();

      const maxOrder = existingTasksSnapshot.empty
        ? 0
        : (existingTasksSnapshot.docs[0].data().order || 0) + 1;

      // Create the task
      const newTask: Omit<Task, 'id'> = {
        userId: taskData.userId,
        organizationId,
        title: taskData.title,
        status: 'pending',
        listType: taskListType,
        order: maxOrder,
        date: taskDate,
        isPrivate: false,
        sourceType: 'call_suggestion',
        callSummaryId: taskData.callSummaryId,
        suggestedTaskId: taskId,
        programEnrollmentId: taskData.programEnrollmentId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newTaskRef = await adminDb.collection('tasks').add(newTask);

      // Update suggested task
      await taskRef.update({
        status: 'assigned',
        assignedTaskId: newTaskRef.id,
        reviewedBy: userId,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Fetch updated task
    const updatedDoc = await taskRef.get();
    const updatedTask: SuggestedTask = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as SuggestedTask;

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('[SUGGESTED_TASK_API] Error updating task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/coach/suggested-tasks/[taskId]
 *
 * Delete a suggested task
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId, sessionClaims } = await auth();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const taskRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('suggested_tasks')
      .doc(taskId);

    const doc = await taskRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await taskRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SUGGESTED_TASK_API] Error deleting task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
