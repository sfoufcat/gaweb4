import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendWeeklyReflectionNotification } from '@/lib/notifications';
import { isFridayInTimezone, DEFAULT_TIMEZONE } from '@/lib/timezone';
import type { Task, EveningCheckIn, EveningEmotionalState } from '@/types';

// Task snapshot stored in evening check-in
interface TaskSnapshot {
  id: string;
  title: string;
  status: string;
  completedAt?: string;
}

// GET - Fetch today's evening check-in
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const checkInRef = adminDb.collection('users').doc(userId).collection('eveningCheckins').doc(date);
    const checkInDoc = await checkInRef.get();

    if (!checkInDoc.exists) {
      return NextResponse.json({ checkIn: null });
    }

    return NextResponse.json({ checkIn: { id: checkInDoc.id, ...checkInDoc.data() } });
  } catch (error) {
    console.error('Error fetching evening check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch evening check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Start a new evening check-in
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    let { tasksCompleted = 0, tasksTotal = 0 } = body;

    const today = new Date().toISOString().split('T')[0];
    const checkInRef = adminDb.collection('users').doc(userId).collection('eveningCheckins').doc(today);
    const existingDoc = await checkInRef.get();

    // If check-in already exists, return it
    if (existingDoc.exists) {
      return NextResponse.json({ checkIn: { id: existingDoc.id, ...existingDoc.data() } });
    }

    // Snapshot the current Daily Focus tasks RIGHT NOW before they can move to backlog
    const completedTasksSnapshot: TaskSnapshot[] = [];
    try {
      const tasksSnapshot = await adminDb
        .collection('tasks')
        .where('userId', '==', userId)
        .where('date', '==', today)
        .where('listType', '==', 'focus')
        .get();
      
      const focusTasks: Task[] = [];
      
      tasksSnapshot.forEach((doc) => {
        const task = { id: doc.id, ...doc.data() } as Task;
        focusTasks.push(task);
        if (task.status === 'completed') {
          completedTasksSnapshot.push({
            id: task.id,
            title: task.title,
            status: task.status,
            completedAt: task.completedAt,
          });
        }
      });
      
      // Use actual counts from the snapshot
      tasksCompleted = completedTasksSnapshot.length;
      tasksTotal = focusTasks.length;
    } catch (taskError) {
      console.error('Error snapshotting tasks for check-in:', taskError);
      // Continue with passed values if snapshot fails
    }

    const now = new Date().toISOString();
    const newCheckIn: Omit<EveningCheckIn, 'id'> & { completedTasksSnapshot: TaskSnapshot[] } = {
      date: today,
      userId,
      emotionalState: 'steady' as EveningEmotionalState,
      tasksCompleted,
      tasksTotal,
      completedTasksSnapshot, // Store the snapshot of completed focus tasks
      createdAt: now,
      updatedAt: now,
    };

    await checkInRef.set(newCheckIn);

    return NextResponse.json({ checkIn: { id: today, ...newCheckIn } }, { status: 201 });
  } catch (error) {
    console.error('Error creating evening check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to create evening check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update evening check-in progress
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();
    const today = new Date().toISOString().split('T')[0];
    const checkInRef = adminDb.collection('users').doc(userId).collection('eveningCheckins').doc(today);
    const existingDoc = await checkInRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json({ error: 'Evening check-in not found' }, { status: 404 });
    }

    const updatedData: Partial<EveningCheckIn> & { completedTasksSnapshot?: TaskSnapshot[] } = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // If marking as completed, capture final task state snapshot
    if (updates.completedAt === true) {
      updatedData.completedAt = new Date().toISOString();
      
      // Snapshot the Daily Focus tasks RIGHT NOW before they can move to backlog
      try {
        const tasksSnapshot = await adminDb
          .collection('tasks')
          .where('userId', '==', userId)
          .where('date', '==', today)
          .where('listType', '==', 'focus')
          .get();
        
        const focusTasks: Task[] = [];
        const completedTasksSnapshot: TaskSnapshot[] = [];
        
        tasksSnapshot.forEach((doc) => {
          const task = { id: doc.id, ...doc.data() } as Task;
          focusTasks.push(task);
          if (task.status === 'completed') {
            completedTasksSnapshot.push({
              id: task.id,
              title: task.title,
              status: task.status,
              completedAt: task.completedAt,
            });
          }
        });
        
        // Update with actual task data at completion time
        updatedData.tasksCompleted = completedTasksSnapshot.length;
        updatedData.tasksTotal = focusTasks.length;
        updatedData.completedTasksSnapshot = completedTasksSnapshot; // Store snapshot for story display
      } catch (taskError) {
        console.error('Error snapshotting tasks for check-in completion:', taskError);
        // Continue without task data - will fall back to original counts
      }
    }

    await checkInRef.update(updatedData);
    const updatedDoc = await checkInRef.get();

    // If completing evening check-in on Friday, trigger weekly reflection notification
    if (updates.completedAt === true) {
      try {
        // Get user's timezone to check if it's Friday in their local time
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userTimezone = userDoc.data()?.timezone || DEFAULT_TIMEZONE;
        
        if (isFridayInTimezone(userTimezone)) {
          // It's Friday in user's timezone - send weekly reflection notification
          await sendWeeklyReflectionNotification(userId, true);
        }
      } catch (notificationError) {
        // Don't fail check-in if notification fails
        console.error('[EVENING_CHECKIN] Weekly reflection notification failed:', notificationError);
      }
    }

    return NextResponse.json({ checkIn: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error) {
    console.error('Error updating evening check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to update evening check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}




