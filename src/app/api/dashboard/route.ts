import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Task, Habit } from '@/types';

/**
 * GET /api/dashboard
 * 
 * Unified API endpoint that returns ALL dashboard data in one request:
 * - User data (identity, goal)
 * - Today's tasks
 * - Active habits
 * 
 * This reduces 3 API calls to 1, improving performance significantly
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Fetch all data in parallel using Promise.all for maximum speed
    const [userDoc, habitsSnapshot, tasksSnapshot] = await Promise.all([
      // 1. User data
      adminDb.collection('users').doc(userId).get(),
      
      // 2. Habits (active only)
      adminDb
        .collection('habits')
        .where('userId', '==', userId)
        .where('archived', '==', false)
        .orderBy('createdAt', 'desc')
        .get(),
      
      // 3. Tasks for today
      adminDb
        .collection('tasks')
        .where('userId', '==', userId)
        .where('date', '==', date)
        .orderBy('order', 'asc')
        .get(),
    ]);

    // Process user data
    const userData = userDoc.exists ? userDoc.data() : null;

    // Process habits
    const habits: Habit[] = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Habit));

    // Process tasks
    const tasks: Task[] = tasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Task));

    // Separate tasks by type
    const focusTasks = tasks.filter(t => t.listType === 'focus');
    const backlogTasks = tasks.filter(t => t.listType === 'backlog');

    return NextResponse.json({
      user: userData,
      habits,
      tasks: {
        focus: focusTasks,
        backlog: backlogTasks,
      },
      date,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

