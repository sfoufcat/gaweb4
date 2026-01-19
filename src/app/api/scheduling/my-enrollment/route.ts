/**
 * API Route: Get Current User's Active Individual Enrollment
 *
 * GET /api/scheduling/my-enrollment
 *
 * Returns the current user's active 1:1 (individual) program enrollment.
 * Used by RequestCallModal in chat context where no enrollment info is available.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ProgramEnrollment, Program } from '@/types';

interface MyEnrollmentResponse {
  enrollmentId: string | null;
  programName: string | null;
}

export async function GET() {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json({
        enrollmentId: null,
        programName: null,
      } as MyEnrollmentResponse);
    }

    // Find active individual (1:1) enrollments for current user in this org
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .where('organizationId', '==', orgId)
      .where('status', '==', 'active')
      .limit(10)
      .get();

    if (enrollmentsSnapshot.empty) {
      return NextResponse.json({
        enrollmentId: null,
        programName: null,
      } as MyEnrollmentResponse);
    }

    // Check each enrollment to find one for an individual program
    for (const enrollmentDoc of enrollmentsSnapshot.docs) {
      const enrollment = {
        id: enrollmentDoc.id,
        ...enrollmentDoc.data(),
      } as ProgramEnrollment;

      // Get the program to check if it's individual type
      const programDoc = await adminDb
        .collection('programs')
        .doc(enrollment.programId)
        .get();

      if (!programDoc.exists) continue;

      const program = programDoc.data() as Program;

      // Only return individual (1:1) programs
      if (program.type !== 'individual') continue;

      return NextResponse.json({
        enrollmentId: enrollment.id,
        programName: program.name,
      } as MyEnrollmentResponse);
    }

    // No individual program enrollment found
    return NextResponse.json({
      enrollmentId: null,
      programName: null,
    } as MyEnrollmentResponse);

  } catch (error) {
    console.error('[MY_ENROLLMENT] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
