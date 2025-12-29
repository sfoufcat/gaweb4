import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { syncProgramTasksForToday, syncProgramV2TasksForToday } from '@/lib/program-engine';

/**
 * POST /api/programs/sync
 * 
 * Sync program tasks for today.
 * This is called:
 * - On Plan Day page load
 * - On Home page first load
 * 
 * It creates tasks from the user's active program if:
 * - User has an active enrollment
 * - It's a new day that hasn't been processed yet
 * 
 * Supports both:
 * - Programs V2 (program_enrollments + program_days collections)
 * - Legacy Starter Programs (starter_program_enrollments + starter_program_days)
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try Programs V2 sync first (program_enrollments collection)
    let result = await syncProgramV2TasksForToday(userId);
    
    // If no V2 enrollment found, try legacy Starter Programs
    if (!result.enrollmentId) {
      result = await syncProgramTasksForToday(userId);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API_PROGRAMS_SYNC_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

