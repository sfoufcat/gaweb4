import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Task } from '@/types';

/**
 * POST /api/tasks/:id/restore
 * Restores an archived task back to the backlog
 *
 * - Resets movedToBacklogAt to now (fresh 7-day countdown)
 * - Clears archivedAt and scheduledDeleteAt
 * - clientLocked stays true for program tasks (user has taken ownership)
 *
 * MULTI-TENANCY: Only allows restoring tasks within the current organization
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // MULTI-TENANCY: Get effective org ID
    const organizationId = await getEffectiveOrgId();

    // Get the existing task
    const taskRef = adminDb.collection('tasks').doc(id);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const existingTask = { id: taskDoc.id, ...taskDoc.data() } as Task;

    // Verify ownership
    if (existingTask.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // MULTI-TENANCY: Verify task belongs to current organization
    if (organizationId && existingTask.organizationId && existingTask.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Only restore archived tasks
    if (existingTask.status !== 'archived') {
      return NextResponse.json({ error: 'Task is not archived' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Get current backlog order for today to place restored task at the end
    let backlogQuery = adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', today)
      .where('listType', '==', 'backlog');

    if (organizationId) {
      backlogQuery = backlogQuery.where('organizationId', '==', organizationId);
    }

    const backlogSnapshot = await backlogQuery.get();
    let maxOrder = -1;
    backlogSnapshot.forEach((doc) => {
      const task = doc.data() as Task;
      if (task.order > maxOrder) {
        maxOrder = task.order;
      }
    });

    // Build update object
    const updates: Partial<Task> = {
      status: 'pending',
      listType: 'backlog',
      date: today, // Restore to today's backlog
      order: maxOrder + 1,
      archivedAt: null,
      scheduledDeleteAt: null,
      movedToBacklogAt: now, // Reset backlog timer on restore
      updatedAt: now,
      // Note: clientLocked intentionally NOT cleared - if user archived a program task,
      // they've taken ownership and sync should not interfere
    };

    await taskRef.update(updates);

    console.log(`[TASKS] Restored task ${id} to backlog`);

    return NextResponse.json({
      success: true,
      task: { ...existingTask, ...updates }
    });
  } catch (error) {
    console.error('Error restoring task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to restore task', message: errorMessage },
      { status: 500 }
    );
  }
}
