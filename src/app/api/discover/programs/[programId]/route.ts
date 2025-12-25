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
import type { Program, ProgramCohort, ProgramEnrollment, ProgramDay, OrgBranding } from '@/types';
import { DEFAULT_BRANDING_COLORS } from '@/types';

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

    // Get coach info - find the super_coach user from the organization
    let coachName = 'Coach';
    let coachImageUrl: string | undefined;
    let coachBio: string | undefined;
    
    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      const clerk = await clerkClient();
      
      // Get organization members to find the super_coach (the actual coach user)
      const memberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: programData.organizationId,
      });
      
      // Find the member with super_coach orgRole (stored in membership publicMetadata)
      const coachMember = memberships.data.find(m => {
        const metadata = m.publicMetadata as { orgRole?: string } | undefined;
        return metadata?.orgRole === 'super_coach';
      });
      
      if (coachMember?.publicUserData?.userId) {
        // Get the actual coach user's details
        const coachUser = await clerk.users.getUser(coachMember.publicUserData.userId);
        coachName = `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach';
        coachImageUrl = coachUser.imageUrl || undefined;
      } else {
        // Fallback to first admin member if no super_coach found
        const adminMember = memberships.data.find(m => 
          m.role === 'org:admin' && m.publicUserData?.userId
        );
        if (adminMember?.publicUserData?.userId) {
          const adminUser = await clerk.users.getUser(adminMember.publicUserData.userId);
          coachName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Coach';
          coachImageUrl = adminUser.imageUrl || undefined;
        }
      }
    } catch (err) {
      console.error('[DISCOVER_PROGRAM_GET] Error fetching coach info:', err);
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

    // Get total enrollments count and recent member avatars for social proof (if showEnrollmentCount is enabled)
    let totalEnrollments = 0;
    let enrolledMemberAvatars: string[] = [];
    if (programData.showEnrollmentCount) {
      // Get enrollment count
      const enrollmentCount = await adminDb
        .collection('program_enrollments')
        .where('programId', '==', programId)
        .count()
        .get();
      totalEnrollments = enrollmentCount.data().count;
      
      // Get recent enrollments for avatar display (max 3)
      if (totalEnrollments > 0) {
        try {
          const { clerkClient } = await import('@clerk/nextjs/server');
          const clerk = await clerkClient();
          
          const recentEnrollments = await adminDb
            .collection('program_enrollments')
            .where('programId', '==', programId)
            .orderBy('enrolledAt', 'desc')
            .limit(3)
            .get();
          
          // Fetch user profile images from Clerk
          const userIds = recentEnrollments.docs.map(doc => doc.data().userId as string);
          const avatarPromises = userIds.map(async (uid) => {
            try {
              const user = await clerk.users.getUser(uid);
              return user.imageUrl || null;
            } catch {
              return null;
            }
          });
          
          const avatars = await Promise.all(avatarPromises);
          enrolledMemberAvatars = avatars.filter((url): url is string => url !== null);
        } catch (err) {
          console.error('[DISCOVER_PROGRAM_GET] Error fetching enrolled member avatars:', err);
          // Continue without avatars
        }
      }
    }

    // Get program days for curriculum preview (if showCurriculum is enabled)
    let days: ProgramDay[] = [];
    if (programData.showCurriculum) {
      const daysSnapshot = await adminDb
        .collection('program_days')
        .where('programId', '==', programId)
        .get();
      
      days = daysSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as ProgramDay))
        .sort((a, b) => a.dayIndex - b.dayIndex);
    }

    // Get organization branding (accent colors)
    let branding = {
      accentLight: DEFAULT_BRANDING_COLORS.accentLight,
      accentDark: DEFAULT_BRANDING_COLORS.accentDark,
    };
    
    try {
      const brandingDoc = await adminDb
        .collection('org_branding')
        .doc(programData.organizationId)
        .get();
      
      if (brandingDoc.exists) {
        const brandingData = brandingDoc.data() as OrgBranding;
        if (brandingData.colors) {
          branding = {
            accentLight: brandingData.colors.accentLight || DEFAULT_BRANDING_COLORS.accentLight,
            accentDark: brandingData.colors.accentDark || DEFAULT_BRANDING_COLORS.accentDark,
          };
        }
      }
    } catch (err) {
      console.error('[DISCOVER_PROGRAM_GET] Error fetching branding:', err);
      // Use default branding
    }

    return NextResponse.json({ 
      program,
      cohorts: programData.type === 'group' ? cohorts : undefined,
      days: programData.showCurriculum ? days : undefined,
      totalEnrollments: programData.showEnrollmentCount ? totalEnrollments : undefined,
      enrolledMemberAvatars: programData.showEnrollmentCount ? enrolledMemberAvatars : undefined,
      enrollment: existingEnrollment ? {
        id: existingEnrollment.id,
        status: existingEnrollment.status,
        cohortId: existingEnrollment.cohortId,
        startedAt: existingEnrollment.startedAt,
      } : null,
      canEnroll,
      cannotEnrollReason,
      branding,
    });
  } catch (error) {
    console.error('[DISCOVER_PROGRAM_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch program' }, { status: 500 });
  }
}

