import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { 
  getActiveEnrollment, 
  getProgramById,
  enrollUserInDefaultProgram,
  stopAllEnrollmentsForUser,
  calculateCurrentDayIndex,
} from '@/lib/program-engine';
import type { UserTrack } from '@/types';

// Valid tracks for legacy enrollment (deprecated)
const VALID_TRACKS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'community_builder',
  'general',
];

function isValidTrack(track: string): track is UserTrack {
  return VALID_TRACKS.includes(track as UserTrack);
}

/**
 * GET /api/programs/enrollment
 * 
 * Get the current user's active program enrollment.
 * Returns enrollment details including program info and progress.
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const enrollment = await getActiveEnrollment(userId);

    if (!enrollment) {
      return NextResponse.json({
        success: true,
        hasEnrollment: false,
        enrollment: null,
        program: null,
        progress: null,
      });
    }

    // Get program details
    const program = await getProgramById(enrollment.programId);

    if (!program) {
      return NextResponse.json({
        success: true,
        hasEnrollment: true,
        enrollment,
        program: null,
        progress: null,
        error: 'Program not found',
      });
    }

    // Calculate progress
    const today = new Date().toISOString().split('T')[0];
    const currentDayIndex = calculateCurrentDayIndex(enrollment.startedAt, program.lengthDays, today);
    const progressPercentage = Math.round((currentDayIndex / program.lengthDays) * 100);

    return NextResponse.json({
      success: true,
      hasEnrollment: true,
      enrollment,
      program: {
        id: program.id,
        name: program.name,
        slug: program.slug,
        description: program.description,
        lengthDays: program.lengthDays,
        track: program.track,
      },
      progress: {
        currentDay: currentDayIndex,
        totalDays: program.lengthDays,
        percentage: progressPercentage,
        lastAssignedDay: enrollment.lastAssignedDayIndex,
      },
    });
  } catch (error) {
    console.error('[API_PROGRAMS_ENROLLMENT_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/programs/enrollment
 * 
 * Enroll the current user in the default program for a track.
 * Body: { track: UserTrack }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { track } = body;

    if (!track || !isValidTrack(track)) {
      return NextResponse.json(
        { error: 'Invalid track. Must be one of: content_creator, saas, coach_consultant, ecom, agency, general' },
        { status: 400 }
      );
    }

    // First, stop any existing enrollments
    const stopResult = await stopAllEnrollmentsForUser(userId, true);
    
    if (stopResult.enrollmentsStopped > 0) {
      console.log(`[PROGRAMS_ENROLLMENT] Stopped ${stopResult.enrollmentsStopped} existing enrollments, deleted ${stopResult.tasksDeleted} tasks`);
    }

    // Enroll in the default program for the track
    const enrollment = await enrollUserInDefaultProgram(userId, track as UserTrack);

    if (!enrollment) {
      return NextResponse.json({
        success: true,
        enrolled: false,
        message: `No default program available for track: ${track}`,
      });
    }

    // Get program details
    const program = await getProgramById(enrollment.programId);

    return NextResponse.json({
      success: true,
      enrolled: true,
      enrollment,
      program: program ? {
        id: program.id,
        name: program.name,
        slug: program.slug,
        lengthDays: program.lengthDays,
      } : null,
      previousEnrollmentsStopped: stopResult.enrollmentsStopped,
      previousTasksDeleted: stopResult.tasksDeleted,
    });
  } catch (error) {
    console.error('[API_PROGRAMS_ENROLLMENT_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/programs/enrollment
 * 
 * Stop the current user's active enrollment(s).
 * Optionally delete program-generated tasks.
 * Query params: ?deleteTasks=true (default: true)
 */
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const deleteTasks = searchParams.get('deleteTasks') !== 'false';

    const result = await stopAllEnrollmentsForUser(userId, deleteTasks);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[API_PROGRAMS_ENROLLMENT_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



