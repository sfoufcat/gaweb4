/**
 * API Route: Get Client's Active Individual Enrollment for Scheduling
 * 
 * GET /api/scheduling/client-enrollment?clientId=xxx
 * 
 * Returns the client's active 1:1 (individual) program enrollment and its
 * program instance, if any exists. This is used by ScheduleCallModal to
 * allow linking calls to program weeks/days.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import type { ProgramEnrollment, Program, ProgramInstance } from '@/types';

interface ClientEnrollmentResponse {
  enrollment: ProgramEnrollment | null;
  program: {
    id: string;
    name: string;
    lengthDays: number;
    includeWeekends: boolean;
  } | null;
  instance: ProgramInstance | null;
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    // Find active individual (1:1) enrollments for this client in this org
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', clientId)
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'active')
      .limit(10) // Get a few to filter by program type
      .get();

    if (enrollmentsSnapshot.empty) {
      return NextResponse.json({
        enrollment: null,
        program: null,
        instance: null,
      } as ClientEnrollmentResponse);
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
      
      // Only return individual (1:1) programs for call linking
      if (program.type !== 'individual') continue;

      // Found an individual program enrollment - now get the instance
      const instancesSnapshot = await adminDb
        .collection('program_instances')
        .where('enrollmentId', '==', enrollment.id)
        .where('type', '==', 'individual')
        .limit(1)
        .get();

      let instance: ProgramInstance | null = null;
      if (!instancesSnapshot.empty) {
        const instanceDoc = instancesSnapshot.docs[0];
        instance = {
          id: instanceDoc.id,
          ...instanceDoc.data(),
        } as ProgramInstance;
      }

      return NextResponse.json({
        enrollment,
        program: {
          id: programDoc.id,
          name: program.name,
          lengthDays: program.lengthDays || 30,
          includeWeekends: program.includeWeekends !== false,
        },
        instance,
      } as ClientEnrollmentResponse);
    }

    // No individual program enrollment found
    return NextResponse.json({
      enrollment: null,
      program: null,
      instance: null,
    } as ClientEnrollmentResponse);

  } catch (error) {
    console.error('[CLIENT_ENROLLMENT] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
