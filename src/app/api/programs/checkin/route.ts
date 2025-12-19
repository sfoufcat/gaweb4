import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { 
  clearProgramCheckIn, 
  shouldShowProgramCheckIn,
  enrollUserInNextProgram,
  getProgramById,
} from '@/lib/program-engine';
import type { UserTrack } from '@/types';

/**
 * GET /api/programs/checkin
 * 
 * Check if user should see the program check-in
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await shouldShowProgramCheckIn(userId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API_PROGRAMS_CHECKIN_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/programs/checkin
 * 
 * Save program check-in responses and handle next steps
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      programRating, 
      progressStatus, 
      whatWentWell, 
      obstacles, 
      continueChoice,
      programId,
    } = body;

    // Get user data for track info
    const user = await currentUser();
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const track = (user?.publicMetadata?.track || userData?.track || 'general') as UserTrack;

    // Get program info
    let programName = userData?.lastCompletedProgramName || 'Program';
    const completedProgramId = programId || userData?.lastCompletedProgramId;
    
    if (completedProgramId) {
      const program = await getProgramById(completedProgramId);
      if (program) {
        programName = program.name;
      }
    }

    // Save check-in response
    const now = new Date().toISOString();
    const checkInData = {
      userId,
      programId: completedProgramId,
      programName,
      programRating,
      progressStatus,
      whatWentWell: whatWentWell || '',
      obstacles: obstacles || '',
      continueChoice,
      createdAt: now,
    };

    // Store in program_checkins collection
    await adminDb.collection('program_checkins').add(checkInData);
    console.log(`[API_PROGRAMS_CHECKIN] Saved check-in for user ${userId}, program ${programName}`);

    // Handle continue choice
    let newEnrollment = null;
    if (continueChoice === 'continue' && completedProgramId) {
      // Enroll in next program
      newEnrollment = await enrollUserInNextProgram(userId, track, completedProgramId);
      
      if (newEnrollment) {
        const nextProgram = await getProgramById(newEnrollment.programId);
        console.log(`[API_PROGRAMS_CHECKIN] Enrolled user ${userId} in next program: ${nextProgram?.name}`);
      } else {
        console.log(`[API_PROGRAMS_CHECKIN] No next program available for user ${userId}`);
      }
    }

    // Clear the pending check-in flag (completed = false, dismissed = true)
    await clearProgramCheckIn(userId, false);

    return NextResponse.json({ 
      success: true,
      newEnrollment: newEnrollment ? {
        id: newEnrollment.id,
        programId: newEnrollment.programId,
      } : null,
      message: newEnrollment 
        ? 'Check-in saved and enrolled in next program'
        : 'Check-in saved',
    });
  } catch (error) {
    console.error('[API_PROGRAMS_CHECKIN_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/programs/checkin
 * 
 * Dismiss the check-in (user closed without completing)
 * Shows prompt in dynamic section for 24 hours
 */
export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Set dismissed = true so it shows in dynamic section for 24h
    await clearProgramCheckIn(userId, true);

    return NextResponse.json({ 
      success: true,
      message: 'Check-in dismissed, will show reminder for 24 hours',
    });
  } catch (error) {
    console.error('[API_PROGRAMS_CHECKIN_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

