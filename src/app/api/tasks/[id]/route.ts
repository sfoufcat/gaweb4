import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { updateAlignmentForToday } from '@/lib/alignment';
import { sendTasksCompletedNotification } from '@/lib/notifications';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { updateLastActivity } from '@/lib/analytics/lastActivity';
import {
  findCohortTaskStateByTaskTitle,
  updateMemberTaskState,
  getProgramCompletionThreshold,
  findCohortTaskStateByProgramTaskId,
  createCohortTaskState
} from '@/lib/cohort-task-state';
import type { Task, UpdateTaskRequest, ClerkPublicMetadata } from '@/types';

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
      if (body.status === 'completed') {
        updates.completedAt = new Date().toISOString();
        
        // Update lastActivityAt for analytics (non-blocking)
        if (organizationId) {
          updateLastActivity(userId, organizationId, 'task').catch(err => {
            console.error('[TASKS] Failed to update lastActivityAt:', err);
          });
        }
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

    // Cohort task state update: If a program-sourced task completion status changed
    if (body.status !== undefined && isProgramSourced && existingTask.programEnrollmentId) {
      const isCompleted = body.status === 'completed';
      
      try {
        // Get the enrollment to check if it's a cohort enrollment
        const enrollmentDoc = await adminDb.collection('program_enrollments').doc(existingTask.programEnrollmentId!).get();
        
        if (enrollmentDoc.exists) {
          const enrollment = enrollmentDoc.data();
          
          if (enrollment?.cohortId) { // Only if part of a cohort
            // Find the CohortTaskState for this task
            // Prefer programTaskId (robust) with title fallback (backward compat)
            let cohortState = null;

            if (existingTask.programTaskId) {
              cohortState = await findCohortTaskStateByProgramTaskId(
                enrollment.cohortId,
                existingTask.programTaskId,
                existingTask.date
              );
            }

            // Fallback to title-based matching for tasks without programTaskId
            if (!cohortState) {
              cohortState = await findCohortTaskStateByTaskTitle(
                enrollment.cohortId,
                existingTask.title,
                existingTask.date,
                existingTask.programDayIndex || 0
              );
            }

            if (cohortState) {
              const threshold = await getProgramCompletionThreshold(enrollment.programId);
              await updateMemberTaskState(
                cohortState.id,
                userId,
                isCompleted,
                id,
                threshold
              );
              console.log(`[COHORT_STATE] Updated member ${userId} task completion for cohort ${enrollment.cohortId}`);
            } else if (existingTask.programDayIndex !== undefined) {
              // Auto-create CohortTaskState for retroactive tracking
              try {
                const cohortMembersSnapshot = await adminDb
                  .collection('program_enrollments')
                  .where('cohortId', '==', enrollment.cohortId)
                  .where('status', 'in', ['active', 'upcoming'])
                  .get();

                const memberIds = cohortMembersSnapshot.docs.map(d => d.data().userId);

                const newState = await createCohortTaskState({
                  cohortId: enrollment.cohortId,
                  programId: enrollment.programId,
                  organizationId: existingTask.organizationId || enrollment.organizationId || '',
                  programDayIndex: existingTask.programDayIndex ?? 0,
                  taskTemplateId: existingTask.programTaskId || `${existingTask.title}:${existingTask.programDayIndex}`,
                  taskTitle: existingTask.title,
                  programTaskId: existingTask.programTaskId,
                  date: existingTask.date,
                  memberIds,
                });

                // Update the newly created state with this completion
                const threshold = await getProgramCompletionThreshold(enrollment.programId);
                await updateMemberTaskState(newState.id, userId, isCompleted, id, threshold);
                console.log(`[COHORT_STATE] Auto-created and updated CohortTaskState for task: ${existingTask.title}`);
              } catch (createErr) {
                console.error('[COHORT_STATE] Failed to auto-create CohortTaskState:', createErr);
              }
            } else {
              console.log(`[COHORT_STATE] Cannot create CohortTaskState - missing programDayIndex for task: ${existingTask.title}`);
            }
          }
        }
      } catch (err) {
        console.error('[COHORT_STATE] Failed to update cohort task state:', err);
      }
    }

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

