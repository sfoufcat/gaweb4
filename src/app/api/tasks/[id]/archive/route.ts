import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Task } from '@/types';

/**
 * POST /api/tasks/:id/archive
 * Archives a task (sets status to 'archived')
 *
 * For program-sourced tasks:
 * - Sets clientLocked=true to prevent sync from interfering
 * - Does NOT affect cohort task state (only completion does)
 * - Does NOT affect program templates or other users' tasks
 *
 * MULTI-TENANCY: Only allows archiving tasks within the current organization
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

    // Don't archive already archived tasks
    if (existingTask.status === 'archived') {
      return NextResponse.json({ error: 'Task is already archived' }, { status: 400 });
    }

    // Don't archive deleted tasks
    if (existingTask.status === 'deleted') {
      return NextResponse.json({ error: 'Cannot archive a deleted task' }, { status: 400 });
    }

    const now = new Date().toISOString();
    // Schedule permanent deletion 30 days from now
    const scheduledDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Check if this is a program-sourced task
    const isProgramSourced = existingTask.sourceType &&
      ['program', 'program_day', 'program_week', 'coach_manual'].includes(existingTask.sourceType);

    // Build update object
    const updates: Partial<Task> = {
      status: 'archived',
      archivedAt: now,
      scheduledDeleteAt,
      updatedAt: now,
    };

    // CRITICAL: Lock program tasks to prevent sync from interfering
    // This follows the same pattern as DELETE for program-sourced tasks
    if (isProgramSourced && !existingTask.clientLocked) {
      updates.clientLocked = true;
    }

    await taskRef.update(updates);

    console.log(`[TASKS] Archived task ${id}${isProgramSourced ? ' (program-sourced, locked)' : ''}`);

    return NextResponse.json({
      success: true,
      task: { ...existingTask, ...updates }
    });
  } catch (error) {
    console.error('Error archiving task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to archive task', message: errorMessage },
      { status: 500 }
    );
  }
}
