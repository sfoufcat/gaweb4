/**
 * Coach API: Manage Single Program Enrollment
 * 
 * GET /api/coach/org-programs/[programId]/enrollments/[enrollmentId] - Get enrollment details
 * DELETE /api/coach/org-programs/[programId]/enrollments/[enrollmentId] - Remove user from program
 * 
 * When a coach removes a user:
 * 1. Enrollment status is set to 'stopped'
 * 2. User is removed from squad memberIds
 * 3. User is removed from Stream chat channel (loses chat access entirely)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCurrentUserOrganizationId, isUserOrgAdmin } from '@/lib/clerk-organizations';
import { removeUserFromSquadEntirely } from '@/lib/program-engine';
import type { ProgramEnrollment, Program } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; enrollmentId: string }> }
) {
  try {
    const { userId } = await auth();
    const { programId, enrollmentId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const organizationId = await getCurrentUserOrganizationId();
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    // Verify user is an admin (coach) of the organization
    const isCoach = await isUserOrgAdmin(userId, organizationId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Not authorized - coaches only' }, { status: 403 });
    }

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data() as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program does not belong to your organization' }, { status: 403 });
    }

    // Get the enrollment
    const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

    // Verify enrollment is for this program
    if (enrollment.programId !== programId) {
      return NextResponse.json({ error: 'Enrollment does not belong to this program' }, { status: 400 });
    }

    // Get user info
    let user = null;
    try {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(enrollment.userId);
      user = {
        id: clerkUser.id,
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        imageUrl: clerkUser.imageUrl || '',
      };
    } catch {
      // User might not exist in Clerk anymore
    }

    return NextResponse.json({
      enrollment: {
        ...enrollment,
        user,
      },
    });
  } catch (error) {
    console.error('[COACH_ENROLLMENT_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollment' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; enrollmentId: string }> }
) {
  try {
    const { userId } = await auth();
    const { programId, enrollmentId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const organizationId = await getCurrentUserOrganizationId();
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    // Verify user is an admin (coach) of the organization
    const isCoach = await isUserOrgAdmin(userId, organizationId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Not authorized - coaches only' }, { status: 403 });
    }

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data() as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program does not belong to your organization' }, { status: 403 });
    }

    // Get the enrollment
    const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

    // Verify enrollment is for this program
    if (enrollment.programId !== programId) {
      return NextResponse.json({ error: 'Enrollment does not belong to this program' }, { status: 400 });
    }

    // Check if already stopped
    if (enrollment.status === 'stopped') {
      return NextResponse.json({ error: 'Enrollment is already stopped' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const enrolledUserId = enrollment.userId;

    // 1. Update enrollment status to 'stopped'
    await enrollmentDoc.ref.update({
      status: 'stopped',
      stoppedAt: now,
      stoppedBy: userId, // Track who removed them
      stoppedReason: 'removed_by_coach',
      updatedAt: now,
    });

    // 2. Remove user from squad entirely (both memberIds and Stream chat)
    if (enrollment.squadId) {
      try {
        await removeUserFromSquadEntirely(enrolledUserId, enrollment.squadId);
        console.log(`[COACH_ENROLLMENT_DELETE] Removed user ${enrolledUserId} from squad ${enrollment.squadId}`);
      } catch (squadErr) {
        console.error(`[COACH_ENROLLMENT_DELETE] Failed to remove from squad (non-fatal):`, squadErr);
        // Continue - enrollment is already stopped
      }
    }

    // 3. Clear user's current program reference if this was their active enrollment
    try {
      const userDoc = await adminDb.collection('users').doc(enrolledUserId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.currentProgramEnrollmentId === enrollmentId) {
          await userDoc.ref.update({
            currentProgramEnrollmentId: null,
            currentProgramId: null,
            updatedAt: now,
          });
          console.log(`[COACH_ENROLLMENT_DELETE] Cleared current program reference for user ${enrolledUserId}`);
        }
      }
    } catch (userErr) {
      console.error(`[COACH_ENROLLMENT_DELETE] Failed to clear user reference (non-fatal):`, userErr);
    }

    // 4. Update cohort enrollment count if applicable
    if (enrollment.cohortId) {
      try {
        const { FieldValue } = await import('firebase-admin/firestore');
        await adminDb.collection('program_cohorts').doc(enrollment.cohortId).update({
          currentEnrollment: FieldValue.increment(-1),
        });
      } catch (cohortErr) {
        console.error(`[COACH_ENROLLMENT_DELETE] Failed to update cohort count (non-fatal):`, cohortErr);
      }
    }

    console.log(`[COACH_ENROLLMENT_DELETE] Coach ${userId} removed user ${enrolledUserId} from program ${programId}`);

    return NextResponse.json({
      success: true,
      message: 'User removed from program',
    });
  } catch (error) {
    console.error('[COACH_ENROLLMENT_DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to remove user from program' }, { status: 500 });
  }
}

