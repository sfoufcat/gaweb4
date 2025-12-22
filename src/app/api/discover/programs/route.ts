/**
 * Public API: Discover Programs
 * 
 * GET /api/discover/programs - List published programs for users to discover
 * 
 * Returns programs separated by type (group vs individual)
 * with cohort availability info for group programs.
 * 
 * Multi-tenancy: If user belongs to an organization, only show org's programs.
 * Otherwise, show all programs (default GA experience).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Program, ProgramCohort, ProgramEnrollment, ClerkPublicMetadata } from '@/types';

interface DiscoverProgram extends Program {
  coachName: string;
  coachImageUrl?: string;
  // For group programs
  nextCohort?: {
    id: string;
    name: string;
    startDate: string;
    spotsRemaining: number;
  } | null;
  // User's enrollment status
  userEnrollment?: {
    status: string;
    cohortId?: string;
  } | null;
}

export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'group' | 'individual' | null;

    // MULTI-TENANCY: Get effective org ID (domain-based in tenant mode, session-based in platform mode)
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    // Build query for published programs
    let query: FirebaseFirestore.Query = adminDb
      .collection('programs')
      .where('isPublished', '==', true)
      .where('isActive', '==', true);

    if (organizationId) {
      // User belongs to an org - show only their org's programs
      query = query.where('organizationId', '==', organizationId);
    }
    // else: no org = show all programs (global GA experience)

    if (type) {
      query = query.where('type', '==', type);
    }

    const programsSnapshot = await query.get();

    // Get user's current enrollments to check constraints
    let userEnrollments: ProgramEnrollment[] = [];
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
    }

    // Process programs and get additional data
    const programs: DiscoverProgram[] = await Promise.all(
      programsSnapshot.docs.map(async (doc) => {
        const data = doc.data() as Program;
        
        // Get coach info (from Clerk organization)
        let coachName = 'Coach';
        let coachImageUrl: string | undefined;
        
        try {
          // Try to get organization info for coach display
          if (data.organizationId) {
            const { clerkClient } = await import('@clerk/nextjs/server');
            const clerk = await clerkClient();
            const org = await clerk.organizations.getOrganization({ organizationId: data.organizationId });
            coachName = org.name || 'Coach';
            coachImageUrl = org.imageUrl || undefined;
          }
        } catch {
          // Fallback to generic coach name
        }

        let nextCohort: DiscoverProgram['nextCohort'] = null;
        
        // For group programs, get the next available cohort
        if (data.type === 'group') {
          const today = new Date().toISOString().split('T')[0];
          // Get all open cohorts for this program
          const cohortsSnapshot = await adminDb
            .collection('program_cohorts')
            .where('programId', '==', doc.id)
            .where('enrollmentOpen', '==', true)
            .get();

          // Filter and sort in memory to avoid composite index requirement
          const upcomingCohorts = cohortsSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as ProgramCohort & { id: string }))
            .filter(c => c.startDate >= today)
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

          if (upcomingCohorts.length > 0) {
            const cohortData = upcomingCohorts[0];
            const maxEnrollment = cohortData.maxEnrollment || Infinity;
            const spotsRemaining = Math.max(0, maxEnrollment - (cohortData.currentEnrollment || 0));
            
            nextCohort = {
              id: cohortData.id,
              name: cohortData.name,
              startDate: cohortData.startDate,
              spotsRemaining: maxEnrollment === Infinity ? -1 : spotsRemaining, // -1 = unlimited
            };
          }
        }

        // Check if user is enrolled in this program
        let userEnrollment: DiscoverProgram['userEnrollment'] = null;
        if (userId) {
          const enrollment = userEnrollments.find(e => e.programId === doc.id);
          if (enrollment) {
            userEnrollment = {
              status: enrollment.status,
              cohortId: enrollment.cohortId || undefined,
            };
          }
        }

        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          coachName,
          coachImageUrl,
          nextCohort,
          userEnrollment,
        } as DiscoverProgram;
      })
    );

    // Sort by createdAt descending
    programs.sort((a, b) => 
      new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
    );

    // Separate by type
    const groupPrograms = programs.filter(p => p.type === 'group');
    const individualPrograms = programs.filter(p => p.type === 'individual');

    // Check user's enrollment constraints
    let canEnrollInGroup = true;
    let canEnrollInIndividual = true;
    if (userId) {
      const activeGroupEnrollment = userEnrollments.find(
        e => e.status === 'active' && programs.find(p => p.id === e.programId)?.type === 'group'
      );
      const activeIndividualEnrollment = userEnrollments.find(
        e => e.status === 'active' && programs.find(p => p.id === e.programId)?.type === 'individual'
      );
      canEnrollInGroup = !activeGroupEnrollment;
      canEnrollInIndividual = !activeIndividualEnrollment;
    }

    return NextResponse.json({ 
      programs,
      groupPrograms,
      individualPrograms,
      totalCount: programs.length,
      enrollmentConstraints: {
        canEnrollInGroup,
        canEnrollInIndividual,
      },
    });
  } catch (error) {
    console.error('[DISCOVER_PROGRAMS_GET] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch programs',
      programs: [],
      groupPrograms: [],
      individualPrograms: [],
      totalCount: 0,
      enrollmentConstraints: {
        canEnrollInGroup: true,
        canEnrollInIndividual: true,
      },
    }, { status: 500 });
  }
}
