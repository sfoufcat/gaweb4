import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { updateAlignmentForToday } from '@/lib/alignment';
import { sendTasksCompletedNotification } from '@/lib/notifications';
import type { Task, UpdateTaskRequest } from '@/types';

/**
 * PATCH /api/tasks/:id
 * Updates a task (title, status, listType, order, isPrivate)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body: UpdateTaskRequest = await request.json();

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

    // Build update object
    const updates: Partial<Task> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      updates.title = body.title.trim();
    }

    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === 'completed') {
        updates.completedAt = new Date().toISOString();
      }
    }

    if (body.isPrivate !== undefined) {
      updates.isPrivate = body.isPrivate;
    }

    if (body.order !== undefined) {
      updates.order = body.order;
    }

    if (body.listType !== undefined) {
      // If moving to focus, ensure focus doesn't exceed 3 tasks
      if (body.listType === 'focus' && existingTask.listType !== 'focus') {
        const focusTasksSnapshot = await adminDb
          .collection('tasks')
          .where('userId', '==', userId)
          .where('date', '==', existingTask.date)
          .where('listType', '==', 'focus')
          .get();

        if (focusTasksSnapshot.size >= 3) {
          return NextResponse.json(
            { error: 'Focus list is full. Maximum 3 tasks allowed.' },
            { status: 400 }
          );
        }
      }

      updates.listType = body.listType;
    }

    await taskRef.update(updates);

    const updatedTask: Task = { ...existingTask, ...updates } as Task;

    // Update alignment when a task is moved to focus for today
    const today = new Date().toISOString().split('T')[0];
    if (body.listType === 'focus' && existingTask.listType !== 'focus' && existingTask.date === today) {
      try {
        await updateAlignmentForToday(userId, { didSetTasks: true });
      } catch (alignmentError) {
        // Don't fail task update if alignment update fails
        console.error('[TASKS] Alignment update failed:', alignmentError);
      }
    }

    // Check if all 3 focus tasks are now completed and send notification
    if (body.status === 'completed' && existingTask.listType === 'focus' && existingTask.date === today) {
      try {
        // Check if evening check-in is already completed for today
        const eveningCheckInRef = adminDb.collection('users').doc(userId).collection('eveningCheckins').doc(today);
        const eveningCheckInDoc = await eveningCheckInRef.get();
        const eveningCompleted = eveningCheckInDoc.exists && eveningCheckInDoc.data()?.completedAt;

        // Only check for all tasks completed if evening check-in is not done
        if (!eveningCompleted) {
          // Get all focus tasks for today
          const focusTasksSnapshot = await adminDb
            .collection('tasks')
            .where('userId', '==', userId)
            .where('date', '==', today)
            .where('listType', '==', 'focus')
            .get();

          const focusTasks: Task[] = [];
          focusTasksSnapshot.forEach((doc) => {
            focusTasks.push({ id: doc.id, ...doc.data() } as Task);
          });

          // Check if all 3 focus tasks are completed
          const completedCount = focusTasks.filter((t) => t.status === 'completed').length;
          const totalFocusTasks = focusTasks.length;

          if (totalFocusTasks === 3 && completedCount === 3) {
            // All 3 focus tasks completed! Send notification
            await sendTasksCompletedNotification(userId);
          }
        }
      } catch (notificationError) {
        // Don't fail task update if notification fails
        console.error('[TASKS] Notification failed:', notificationError);
      }
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update task', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/:id
 * Deletes a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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

    await taskRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task', message: error.message },
      { status: 500 }
    );
  }
}

