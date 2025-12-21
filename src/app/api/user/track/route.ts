import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getUserTrack, setUserTrack, isValidTrack } from '@/lib/track';
import { enrollUserInDefaultProgram, getActiveEnrollment } from '@/lib/program-engine';
import { createDefaultHabitsForTrack, hasTrackDefaultHabits } from '@/lib/habit-engine';
import type { UserTrack } from '@/types';

/**
 * @deprecated This API is deprecated. Tracks have been replaced by Programs.
 * Users now join programs from the Discover page instead of selecting tracks.
 * This API is kept for backward compatibility with existing users.
 * 
 * GET /api/user/track
 * Get the current user's track
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const track = await getUserTrack(userId);

    return NextResponse.json({
      success: true,
      track,
    });
  } catch (error) {
    console.error('[API_TRACK_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * @deprecated This API is deprecated. Tracks have been replaced by Programs.
 * Users now join programs from the Discover page instead of selecting tracks.
 * This API is kept for backward compatibility with existing users.
 * 
 * POST /api/user/track
 * Set the current user's track
 * Body: { track: UserTrack }
 * 
 * Also enrolls the user in the default starter program for that track (if one exists)
 * 
 * The program start date follows the same logic as morning check-in availability:
 * - Before noon → Day 1 starts today
 * - After noon → Day 1 starts tomorrow
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

    const success = await setUserTrack(userId, track as UserTrack);

    if (!success) {
      return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
    }

    // Check if user already has an active enrollment
    const existingEnrollment = await getActiveEnrollment(userId);
    
    let enrollmentCreated = false;
    const programName: string | null = null;

    // Only enroll if no active enrollment exists
    // Note: We use current time for program start, not account creation time
    // This ensures programs start from when the user actually selects their track
    if (!existingEnrollment) {
      const enrollment = await enrollUserInDefaultProgram(userId, track as UserTrack);
      
      if (enrollment) {
        enrollmentCreated = true;
        // Note: We don't have program name here, but it's logged in the engine
        console.log(`[TRACK] Enrolled user ${userId} in default program for track ${track}`);
      }
    } else {
      console.log(`[TRACK] User ${userId} already has active enrollment ${existingEnrollment.id}, skipping auto-enroll`);
    }

    // Create default habits for the track (if not already created)
    let habitsCreated = 0;
    const alreadyHasTrackHabits = await hasTrackDefaultHabits(userId);
    
    if (!alreadyHasTrackHabits) {
      const habitResult = await createDefaultHabitsForTrack(userId, track as UserTrack);
      habitsCreated = habitResult.habitsCreated;
      console.log(`[TRACK] Created ${habitsCreated} default habits for user ${userId} on track ${track}`);
    } else {
      console.log(`[TRACK] User ${userId} already has track-default habits, skipping habit creation`);
    }

    return NextResponse.json({
      success: true,
      track,
      enrollmentCreated,
      programName,
      habitsCreated,
    });
  } catch (error) {
    console.error('[API_TRACK_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

