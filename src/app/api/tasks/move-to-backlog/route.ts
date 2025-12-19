import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Task } from '@/types';

/**
 * POST /api/tasks/move-to-backlog
 * Moves all focus tasks from today to backlog
 * Called when user completes their evening check-in
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get all focus tasks for today
    const focusTasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', today)
      .where('listType', '==', 'focus')
      .get();

    if (focusTasksSnapshot.empty) {
      return NextResponse.json({ 
        success: true, 
        message: 'No focus tasks to move',
        movedCount: 0 
      });
    }

    // Get current backlog tasks to determine order
    const backlogTasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', today)
      .where('listType', '==', 'backlog')
      .get();

    let maxBacklogOrder = -1;
    backlogTasksSnapshot.forEach((doc) => {
      const task = doc.data() as Task;
      if (task.order > maxBacklogOrder) {
        maxBacklogOrder = task.order;
      }
    });

    // Move all focus tasks to backlog
    const batch = adminDb.batch();
    const now = new Date().toISOString();
    let movedCount = 0;

    focusTasksSnapshot.forEach((doc) => {
      maxBacklogOrder++;
      batch.update(doc.ref, {
        listType: 'backlog',
        order: maxBacklogOrder,
        updatedAt: now,
      });
      movedCount++;
    });

    await batch.commit();

    console.log(`✅ Moved ${movedCount} focus tasks to backlog for ${today}`);

    return NextResponse.json({ 
      success: true, 
      message: `Moved ${movedCount} tasks to backlog`,
      movedCount 
    });
  } catch (error: any) {
    console.error('Error moving tasks to backlog:', error);
    return NextResponse.json(
      { error: 'Failed to move tasks to backlog', message: error.message },
      { status: 500 }
    );
  }
}












