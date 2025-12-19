import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { clearUserTrack } from '@/lib/track';
import { stopAllEnrollmentsForUser } from '@/lib/program-engine';
import { deleteTrackDefaultHabits } from '@/lib/habit-engine';

/**
 * POST /api/user/track/reset
 * Reset user's track-related data when changing tracks
 * 
 * This resets:
 * - Tasks (both user-created and program-generated)
 * - Track-default habits (habits with source='track_default')
 * - Track selection (set to null)
 * - Active program enrollment(s)
 * 
 * This keeps:
 * - User-created habits (source='user' or no source field)
 * - Streak
 * - Squads
 * - Premium/Coaching status
 * - Coach assignment
 * - Profile data
 * - Goals
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Stop all active program enrollments (this also deletes program-generated tasks)
    const enrollmentResult = await stopAllEnrollmentsForUser(userId, true);
    console.log(`[TRACK_RESET] Stopped ${enrollmentResult.enrollmentsStopped} enrollments, deleted ${enrollmentResult.tasksDeleted} program tasks for user ${userId}`);

    // 2. Delete all remaining user tasks (user-created tasks not tied to programs)
    const tasksRef = adminDb.collection('tasks');
    const tasksQuery = await tasksRef.where('userId', '==', userId).get();
    
    const taskDeletePromises = tasksQuery.docs.map(doc => doc.ref.delete());
    await Promise.all(taskDeletePromises);
    console.log(`[TRACK_RESET] Deleted ${tasksQuery.size} total tasks for user ${userId}`);

    // 3. Delete only track-default habits (preserve user-created habits)
    const deletedHabitsCount = await deleteTrackDefaultHabits(userId);
    console.log(`[TRACK_RESET] Deleted ${deletedHabitsCount} track-default habits for user ${userId}`);

    // 4. Clear track from Clerk and Firebase
    await clearUserTrack(userId);
    console.log(`[TRACK_RESET] Cleared track for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Track reset complete. Tasks, track-default habits, and program enrollment cleared.',
      deletedTasks: tasksQuery.size,
      deletedHabits: deletedHabitsCount,
      enrollmentsStopped: enrollmentResult.enrollmentsStopped,
    });
  } catch (error) {
    console.error('[API_TRACK_RESET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

