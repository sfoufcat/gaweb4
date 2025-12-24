/**
 * User Program Enrollments API
 * 
 * GET /api/programs/my-enrollments - Get current user's program enrollments
 * 
 * Returns active and upcoming program enrollments with progress info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Program, ProgramCohort, ProgramEnrollment } from '@/types';

interface EnrollmentWithDetails extends ProgramEnrollment {
  program: {
    id: string;
    name: string;
    type: 'group' | 'individual';
    lengthDays: number;
    coverImageUrl?: string;
  };
  cohort?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  progress: {
    currentDay: number;
    totalDays: number;
    percentComplete: number;
    daysRemaining: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    // Get user's enrollments
    let query = adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId);

    if (!includeCompleted) {
      query = query.where('status', 'in', ['active', 'upcoming']);
    }

    const enrollmentsSnapshot = await query.orderBy('createdAt', 'desc').get();

    if (enrollmentsSnapshot.empty) {
      return NextResponse.json({
        enrollments: [],
        activeGroupEnrollment: null,
        activeIndividualEnrollment: null,
      });
    }

    // Fetch program and cohort details for each enrollment
    const enrollments: EnrollmentWithDetails[] = [];
    let activeGroupEnrollment: EnrollmentWithDetails | null = null;
    let activeIndividualEnrollment: EnrollmentWithDetails | null = null;

    for (const doc of enrollmentsSnapshot.docs) {
      const enrollment = { id: doc.id, ...doc.data() } as ProgramEnrollment;

      // Get program
      const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
      if (!programDoc.exists) continue;
      
      const program = programDoc.data() as Program;

      // Get cohort if group program
      let cohort: ProgramCohort | undefined;
      if (enrollment.cohortId) {
        const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
        if (cohortDoc.exists) {
          cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
        }
      }

      // Calculate progress
      const startDate = new Date(enrollment.startedAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const currentDay = Math.max(1, Math.min(daysSinceStart + 1, program.lengthDays));
      const percentComplete = Math.round((currentDay / program.lengthDays) * 100);
      const daysRemaining = Math.max(0, program.lengthDays - currentDay);

      const enrollmentWithDetails: EnrollmentWithDetails = {
        ...enrollment,
        program: {
          id: program.id,
          name: program.name,
          type: program.type,
          lengthDays: program.lengthDays,
          coverImageUrl: program.coverImageUrl,
        },
        cohort: cohort ? {
          id: cohort.id,
          name: cohort.name,
          startDate: cohort.startDate,
          endDate: cohort.endDate,
        } : undefined,
        progress: {
          currentDay: enrollment.status === 'upcoming' ? 0 : currentDay,
          totalDays: program.lengthDays,
          percentComplete: enrollment.status === 'upcoming' ? 0 : percentComplete,
          daysRemaining: enrollment.status === 'upcoming' ? program.lengthDays : daysRemaining,
        },
      };

      enrollments.push(enrollmentWithDetails);

      // Track active enrollments by type
      if (enrollment.status === 'active') {
        if (program.type === 'group') {
          activeGroupEnrollment = enrollmentWithDetails;
        } else {
          activeIndividualEnrollment = enrollmentWithDetails;
        }
      }
    }

    // Separate by status
    const activeEnrollments = enrollments.filter(e => e.status === 'active');
    const upcomingEnrollments = enrollments.filter(e => e.status === 'upcoming');
    const completedEnrollments = enrollments.filter(e => e.status === 'completed');

    return NextResponse.json({
      enrollments,
      activeEnrollments,
      upcomingEnrollments,
      completedEnrollments: includeCompleted ? completedEnrollments : [],
      activeGroupEnrollment,
      activeIndividualEnrollment,
      hasActiveGroup: !!activeGroupEnrollment,
      hasActiveIndividual: !!activeIndividualEnrollment,
    });
  } catch (error) {
    console.error('[MY_ENROLLMENTS] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
  }
}


