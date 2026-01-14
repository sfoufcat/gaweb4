import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { updateAlignmentForToday } from '@/lib/alignment';
import { sendTasksCompletedNotification } from '@/lib/notifications';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { updateLastActivity } from '@/lib/analytics/lastActivity';
import { updateClientActivityStatus } from '@/lib/analytics/activity';
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
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body: UpdateTaskRequest = await request.json();

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

    // Build update object
    const updates: Partial<Task> = {
      updatedAt: new Date().toISOString(),
    };

    // 2-way sync: If client edits a program-sourced task, lock it from future sync overwrites
    // Only lock when actual content is edited (title), not for status/order/listType changes
    const isProgramSourced = existingTask.sourceType &&
      ['program', 'program_day', 'program_week', 'coach_manual'].includes(existingTask.sourceType);
    if (isProgramSourced && !existingTask.clientLocked && body.title !== undefined) {
      updates.clientLocked = true;
    }

    // Handle visibility update
    if (body.visibility !== undefined) {
      updates.visibility = body.visibility;
      // Sync with legacy isPrivate field
      updates.isPrivate = body.visibility === 'private';
    }

    if (body.title !== undefined) {
      updates.title = body.title.trim();
    }

    if (body.status !== undefined) {
      updates.status = body.status;
      // Sync completed boolean with status for query compatibility
      updates.completed = body.status === 'completed';
      if (body.status === 'completed') {
        updates.completedAt = new Date().toISOString();

        // Update lastActivityAt for analytics (non-blocking)
        if (organizationId) {
          updateLastActivity(userId, organizationId, 'task').catch(err => {
            console.error('[TASKS] Failed to update lastActivityAt:', err);
          });
          // Update activity status for real-time status updates (non-blocking)
          updateClientActivityStatus(organizationId, userId).catch(err => {
            console.error('[TASKS] Failed to update activity status:', err);
          });
        }
      } else {
        // Clear completedAt when uncompleting
        updates.completedAt = undefined;
      }
    }

    if (body.isPrivate !== undefined) {
      updates.isPrivate = body.isPrivate;
      // Sync with new visibility field
      updates.visibility = body.isPrivate ? 'private' : 'public';
    }

    if (body.order !== undefined) {
      updates.order = body.order;
    }

    if (body.listType !== undefined) {
      // If moving to focus, ensure focus doesn't exceed the limit
      if (body.listType === 'focus' && existingTask.listType !== 'focus') {
        // Get org settings to determine focus limit
        let focusLimit = 3; // Default fallback
        if (organizationId) {
          const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
          const orgSettings = orgSettingsDoc.data();
          focusLimit = orgSettings?.defaultDailyFocusSlots ?? 3;
        }

        const focusTasksSnapshot = await adminDb
          .collection('tasks')
          .where('userId', '==', userId)
          .where('date', '==', existingTask.date)
          .where('listType', '==', 'focus')
          .where('status', 'in', ['pending', 'completed']) // Exclude deleted/archived tasks
          .get();

        if (focusTasksSnapshot.size >= focusLimit) {
          return NextResponse.json(
            { error: `Focus list is full. Maximum ${focusLimit} tasks allowed.` },
            { status: 400 }
          );
        }
      }

      updates.listType = body.listType;

      // Track when task first moves to backlog (for archive lifecycle)
      if (body.listType === 'backlog' && !existingTask.movedToBacklogAt) {
        updates.movedToBacklogAt = new Date().toISOString();
      }
    }

    await taskRef.update(updates);

    const updatedTask: Task = { ...existingTask, ...updates } as Task;

    // NOTE: Cohort task completion tracking now uses the NEW system:
    // - Tasks have `completed` boolean field (set above when status changes)
    // - Coach dashboard queries `tasks` collection directly with `.where('completed', '==', true)`
    // - Aggregation is calculated on-the-fly, no separate cohort_task_states collection needed

    // Update alignment when a task is moved to focus for today (org-scoped)
    const today = new Date().toISOString().split('T')[0];
    if (body.listType === 'focus' && existingTask.listType !== 'focus' && existingTask.date === today && organizationId) {
      try {
        await updateAlignmentForToday(userId, organizationId, { didSetTasks: true });
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
 * For program-sourced tasks: soft-delete to prevent sync from recreating them
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
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

    // 2-way sync: For program-sourced tasks, soft-delete to prevent sync from recreating
    const isProgramSourced = existingTask.sourceType && 
      ['program', 'program_day', 'program_week', 'coach_manual'].includes(existingTask.sourceType);
    
    if (isProgramSourced) {
      // Soft delete: mark as deleted and client-locked instead of actually deleting
      await taskRef.update({
        status: 'deleted' as const, // Using a special status to hide the task
        clientLocked: true,
        updatedAt: new Date().toISOString(),
      });
      console.log(`[TASKS] Soft-deleted program-sourced task ${id}`);
    } else {
      // Regular delete for client-created tasks
      await taskRef.delete();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete task', message },
      { status: 500 }
    );
  }
}

