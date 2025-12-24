/**
 * My Programs API
 * 
 * GET /api/programs/my-programs
 * 
 * Returns the current user's enrolled programs with full details:
 * - Program info (name, description, type, etc.)
 * - Cohort info (for group programs)
 * - Squad info (for group programs)
 * - Squad members (first 5 for avatar display)
 * - Progress (current day, total days, percentage)
 * - Coach info
 */

import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { 
  Program, 
  ProgramEnrollment, 
  ProgramCohort,
  Squad,
} from '@/types';

// Minimal member info for avatar display
interface SquadMemberPreview {
  id: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
}

interface EnrolledProgramWithDetails {
  enrollment: ProgramEnrollment;
  program: Program & {
    coachName: string;
    coachImageUrl?: string;
  };
  cohort?: ProgramCohort | null;
  squad?: Squad | null;
  squadMembers?: SquadMemberPreview[];
  progress: {
    currentDay: number;
    totalDays: number;
    percentage: number;
  };
}

/**
 * Calculate current day index based on start date
 */
function calculateCurrentDayIndex(startDate: string, totalDays: number): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Day 1 is the start date, so add 1
  const currentDay = diffDays + 1;
  
  // Clamp between 1 and totalDays
  return Math.max(1, Math.min(currentDay, totalDays));
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();

    // Get active enrollments for the user
    let query = adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .where('status', 'in', ['active', 'upcoming']);
    
    // On platform domain (no orgId), return empty with flag
    // Users should visit their tenant domain for programs
    const isPlatformMode = !organizationId;
    if (isPlatformMode) {
      return NextResponse.json({
        success: true,
        enrollments: [],
        isPlatformMode: true,
      });
    }
    
    // Filter by organization
    query = query.where('organizationId', '==', organizationId);

    const enrollmentsSnapshot = await query.get();

    if (enrollmentsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        enrollments: [],
        isPlatformMode: false,
      });
    }

    const clerk = await clerkClient();
    const enrolledPrograms: EnrolledProgramWithDetails[] = [];

    for (const doc of enrollmentsSnapshot.docs) {
      const enrollment = { id: doc.id, ...doc.data() } as ProgramEnrollment;

      // Get program
      const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
      if (!programDoc.exists) continue;

      const program = { id: programDoc.id, ...programDoc.data() } as Program;

      // Get coach info from organization
      let coachName = 'Coach';
      let coachImageUrl: string | undefined;

      try {
        const org = await clerk.organizations.getOrganization({ 
          organizationId: program.organizationId 
        });
        
        // Get the org admin (super_coach) as the coach
        const memberships = await clerk.organizations.getOrganizationMembershipList({
          organizationId: program.organizationId,
          limit: 100,
        });
        
        for (const membership of memberships.data) {
          if (membership.role === 'org:admin') {
            const coachUserId = membership.publicUserData?.userId;
            if (coachUserId) {
              const coachUser = await clerk.users.getUser(coachUserId);
              coachName = `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach';
              coachImageUrl = coachUser.imageUrl;
            }
            break;
          }
        }
      } catch (err) {
        console.error('Error fetching coach info:', err);
      }

      // Get cohort for group programs
      let cohort: ProgramCohort | null = null;
      if (enrollment.cohortId) {
        const cohortDoc = await adminDb.collection('program_cohorts').doc(enrollment.cohortId).get();
        if (cohortDoc.exists) {
          cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
        }
      }

      // Get squad for group programs
      let squad: Squad | null = null;
      const squadMembers: SquadMemberPreview[] = [];
      if (enrollment.squadId) {
        const squadDoc = await adminDb.collection('squads').doc(enrollment.squadId).get();
        if (squadDoc.exists) {
          squad = { id: squadDoc.id, ...squadDoc.data() } as Squad;
          
          // Fetch first 5 squad members for avatar display (excluding coach)
          const coachIdToExclude = squad.coachId;
          const memberIds = (squad.memberIds || [])
            .filter(id => id !== coachIdToExclude)
            .slice(0, 5);
          if (memberIds.length > 0) {
            try {
              for (const memberId of memberIds) {
                const memberUser = await clerk.users.getUser(memberId);
                squadMembers.push({
                  id: memberId,
                  firstName: memberUser.firstName || '',
                  lastName: memberUser.lastName || '',
                  imageUrl: memberUser.imageUrl || '',
                });
              }
            } catch (err) {
              console.error('Error fetching squad members:', err);
            }
          }
        }
      }

      // Calculate progress
      const currentDay = enrollment.status === 'upcoming' 
        ? 0 
        : calculateCurrentDayIndex(enrollment.startedAt, program.lengthDays);
      
      const percentage = enrollment.status === 'upcoming'
        ? 0
        : Math.round((currentDay / program.lengthDays) * 100);

      enrolledPrograms.push({
        enrollment,
        program: {
          ...program,
          coachName,
          coachImageUrl,
        },
        cohort,
        squad,
        squadMembers,
        progress: {
          currentDay,
          totalDays: program.lengthDays,
          percentage,
        },
      });
    }

    // Sort: group programs first, then by start date
    enrolledPrograms.sort((a, b) => {
      // Group programs first
      if (a.program.type === 'group' && b.program.type !== 'group') return -1;
      if (a.program.type !== 'group' && b.program.type === 'group') return 1;
      
      // Then by start date (newest first)
      return new Date(b.enrollment.startedAt).getTime() - new Date(a.enrollment.startedAt).getTime();
    });

    return NextResponse.json({
      success: true,
      enrollments: enrolledPrograms,
    });
  } catch (error) {
    console.error('[API_MY_PROGRAMS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

