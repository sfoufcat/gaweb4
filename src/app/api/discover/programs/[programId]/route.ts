/**
 * Public API: Program Detail
 * 
 * GET /api/discover/programs/[programId] - Get program details for users
 * 
 * Returns program info with available cohorts (for group programs)
 * and user's enrollment status/constraints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Program, ProgramCohort, ProgramEnrollment } from '@/types';

interface CohortWithAvailability extends ProgramCohort {
  spotsRemaining: number;
  isAvailableToUser: boolean;
  unavailableReason?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { userId } = await auth();
    const { programId } = await params;

    // Get program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data() as Program;
    
    // Only show published and active programs
    if (!programData.isPublished || !programData.isActive) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Get coach info
    let coachName = 'Coach';
    let coachImageUrl: string | undefined;
    let coachBio: string | undefined;
    
    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      const clerk = await clerkClient();
      const org = await clerk.organizations.getOrganization({ 
        organizationId: programData.organizationId 
      });
      coachName = org.name || 'Coach';
      coachImageUrl = org.imageUrl || undefined;
    } catch {
      // Fallback to generic coach name
    }

    // Get user's enrollments to check constraints
    let userEnrollments: ProgramEnrollment[] = [];
    let activeGroupEnrollment: ProgramEnrollment | null = null;
    let activeIndividualEnrollment: ProgramEnrollment | null = null;

    if (userId) {
      const enrollmentsSnapshot = await adminDb
        .collection('program_enrollments')
        .where('userId', '==', userId)
        .where('status', 'in', ['active', 'upcoming'])
        .get();
      
      userEnrollments = enrollmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ProgramEnrollment[];

      // Find active enrollments by type
      for (const enrollment of userEnrollments) {
        if (enrollment.status === 'active') {
          const enrolledProgramDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
          const enrolledProgram = enrolledProgramDoc.data() as Program | undefined;
          if (enrolledProgram?.type === 'group') {
            activeGroupEnrollment = enrollment;
          } else if (enrolledProgram?.type === 'individual') {
            activeIndividualEnrollment = enrollment;
          }
        }
      }
    }

    // Check if user is already enrolled in THIS program
    const existingEnrollment = userEnrollments.find(e => e.programId === programId);

    // For group programs, get all cohorts with availability
    let cohorts: CohortWithAvailability[] = [];
    if (programData.type === 'group') {
      const cohortsSnapshot = await adminDb
        .collection('program_cohorts')
        .where('programId', '==', programId)
        .where('status', 'in', ['upcoming', 'active'])
        .orderBy('startDate', 'asc')
        .get();

      cohorts = cohortsSnapshot.docs.map(doc => {
        const data = doc.data() as ProgramCohort;
        const maxEnrollment = data.maxEnrollment || Infinity;
        const spotsRemaining = maxEnrollment === Infinity ? -1 : Math.max(0, maxEnrollment - data.currentEnrollment);
        
        // Check if this cohort is available to the user
        let isAvailableToUser = true;
        let unavailableReason: string | undefined;

        // Not open for enrollment
        if (!data.enrollmentOpen) {
          isAvailableToUser = false;
          unavailableReason = 'Enrollment is closed';
        }
        // No spots left
        else if (spotsRemaining === 0) {
          isAvailableToUser = false;
          unavailableReason = 'Cohort is full';
        }
        // User already enrolled in this cohort
        else if (existingEnrollment?.cohortId === doc.id) {
          isAvailableToUser = false;
          unavailableReason = 'Already enrolled';
        }
        // User has overlapping active group enrollment
        else if (activeGroupEnrollment && userId) {
          // Check if dates overlap with user's current group program
          const userCohortId = activeGroupEnrollment.cohortId;
          if (userCohortId) {
            // For now, we'll let them join future cohorts (upcoming status allowed)
            // But they can't join a cohort that overlaps with their current one
            const startDate = new Date(data.startDate);
            const userEnrollmentEnd = activeGroupEnrollment.startedAt 
              ? new Date(activeGroupEnrollment.startedAt) 
              : new Date();
            
            // If this cohort starts before the user's current enrollment ends, it's overlapping
            // (simplified check - in practice you'd look at the full end date)
            if (startDate < userEnrollmentEnd && activeGroupEnrollment.status === 'active') {
              isAvailableToUser = false;
              unavailableReason = 'Overlaps with your current program';
            }
          }
        }

        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          spotsRemaining,
          isAvailableToUser,
          unavailableReason,
        } as CohortWithAvailability;
      });
    }

    // Determine if user can enroll
    let canEnroll = true;
    let cannotEnrollReason: string | undefined;

    if (existingEnrollment) {
      canEnroll = false;
      cannotEnrollReason = 'Already enrolled in this program';
    } else if (programData.type === 'group' && activeGroupEnrollment) {
      // Can still buy future cohorts, so only block if all cohorts are unavailable
      const hasAvailableCohort = cohorts.some(c => c.isAvailableToUser);
      if (!hasAvailableCohort && cohorts.length > 0) {
        canEnroll = false;
        cannotEnrollReason = 'No available cohorts match your schedule';
      }
    } else if (programData.type === 'individual' && activeIndividualEnrollment) {
      canEnroll = false;
      cannotEnrollReason = 'You already have an active 1:1 program';
    }

    const program = {
      ...programData,
      id: programDoc.id,
      coachName,
      coachImageUrl,
      coachBio,
    };

    return NextResponse.json({ 
      program,
      cohorts: programData.type === 'group' ? cohorts : undefined,
      enrollment: existingEnrollment ? {
        id: existingEnrollment.id,
        status: existingEnrollment.status,
        cohortId: existingEnrollment.cohortId,
        startedAt: existingEnrollment.startedAt,
      } : null,
      canEnroll,
      cannotEnrollReason,
    });
  } catch (error) {
    console.error('[DISCOVER_PROGRAM_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch program' }, { status: 500 });
  }
}

