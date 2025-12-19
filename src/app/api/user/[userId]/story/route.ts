import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/user/[userId]/story
 * Fetches story-related data for a specific user
 * Used by squad members to view each other's stories
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: currentUserId } = await auth();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: targetUserId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Fetch user data from Firebase
    const userDoc = await adminDb.collection('users').doc(targetUserId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Check if user has an active goal
    const hasActiveGoal = !!(userData?.goal && !userData?.goalCompleted);
    
    // Fetch today's focus tasks
    const isOwnProfile = currentUserId === targetUserId;
    
    const tasksQuery = adminDb
      .collection('tasks')
      .where('userId', '==', targetUserId)
      .where('date', '==', date)
      .where('listType', '==', 'focus');

    const tasksSnapshot = await tasksQuery.get();
    const tasks = tasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const hasTasksToday = tasks.length > 0;

    // Check if evening check-in is completed for today
    const eveningCheckInRef = adminDb
      .collection('users')
      .doc(targetUserId)
      .collection('eveningCheckins')
      .doc(date);
    const eveningCheckInDoc = await eveningCheckInRef.get();
    const eveningCheckInData = eveningCheckInDoc.exists ? eveningCheckInDoc.data() : null;
    const hasDayClosed = !!(eveningCheckInData?.completedAt);

    // Check if weekly reflection is completed for current week
    // Get the Monday of the current week as the week identifier
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(now.setDate(diff));
    const weekId = monday.toISOString().split('T')[0];

    const weeklyReflectionRef = adminDb
      .collection('users')
      .doc(targetUserId)
      .collection('weeklyReflections')
      .doc(weekId);
    const weeklyReflectionDoc = await weeklyReflectionRef.get();
    const weeklyReflectionData = weeklyReflectionDoc.exists ? weeklyReflectionDoc.data() : null;
    const hasWeekClosed = !!(weeklyReflectionData?.completedAt);

    // For completed tasks, PRIORITIZE the snapshot from the evening check-in
    // This is the source of truth for what was completed when they closed their day
    interface TaskSnapshot {
      id: string;
      title?: string;
      status?: string;
      isPrivate?: boolean;
    }
    let completedTasks: TaskSnapshot[] = [];
    
    if (hasDayClosed && eveningCheckInData?.completedTasksSnapshot?.length > 0) {
      // Use the snapshot - this was captured at check-in time before tasks moved to backlog
      completedTasks = eveningCheckInData.completedTasksSnapshot;
    } else {
      // Fallback to current API data (for backward compatibility or if snapshot missing)
      completedTasks = tasks.filter((task): task is typeof task & { status: 'completed' } => 
        (task as { status?: string }).status === 'completed'
      );
    }

    // Build response
    const response = {
      hasActiveGoal,
      hasTasksToday,
      hasDayClosed,
      hasWeekClosed,
      goal: hasActiveGoal
        ? {
            title: userData?.goal || '',
            targetDate: userData?.goalTargetDate || '',
            progress: userData?.goalProgress || 0,
          }
        : null,
      tasks: tasks.map(task => {
        const taskData = task as { title?: string; status?: string; isPrivate?: boolean };
        const isPrivate = taskData.isPrivate || false;
        return {
          id: task.id,
          title: (!isOwnProfile && isPrivate) ? 'Private task' : (taskData.title || ''),
          status: taskData.status || 'pending',
          isPrivate,
        };
      }),
      completedTasks: completedTasks.map((task: TaskSnapshot) => {
        const isPrivate = task.isPrivate || false;
        return {
          id: task.id,
          title: (!isOwnProfile && isPrivate) ? 'Private task' : (task.title || ''),
          status: 'completed',
          isPrivate,
        };
      }),
      eveningCheckIn: hasDayClosed ? {
        emotionalState: eveningCheckInData?.emotionalState || 'steady',
        tasksCompleted: eveningCheckInData?.tasksCompleted || 0,
        tasksTotal: eveningCheckInData?.tasksTotal || 0,
      } : null,
      weeklyReflection: hasWeekClosed ? {
        progressChange: (weeklyReflectionData?.progress || 0) - (weeklyReflectionData?.previousProgress || 0),
        publicFocus: weeklyReflectionData?.publicFocus || undefined,
      } : null,
      user: {
        firstName: userData?.firstName || '',
        lastName: userData?.lastName || '',
        imageUrl: userData?.avatarUrl || userData?.imageUrl || '',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching user story data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch story data' },
      { status: 500 }
    );
  }
}


