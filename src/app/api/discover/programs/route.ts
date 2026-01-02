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
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateDemoProgramsWithStats } from '@/lib/demo-data';
import type { Program, ProgramCohort, ProgramEnrollment } from '@/types';

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
    // Demo mode: return demo programs
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const demoPrograms = generateDemoProgramsWithStats();
      const formattedPrograms = demoPrograms.map(p => ({
        id: p.id,
        organizationId: 'demo-org',
        name: p.name,
        slug: p.slug,
        description: p.description,
        coverImageUrl: p.coverImageUrl,
        type: p.type,
        lengthDays: p.durationDays,
        priceInCents: p.priceInCents,
        isPublished: p.isPublished,
        isActive: true,
        coachName: 'Coach Adam',
        coachImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
        nextCohort: p.type === 'group' ? {
          id: `${p.id}-cohort-1`,
          name: 'Spring 2025',
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          spotsRemaining: 8,
        } : null,
        userEnrollment: null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
      
      const groupPrograms = formattedPrograms.filter(p => p.type === 'group');
      const individualPrograms = formattedPrograms.filter(p => p.type === 'individual');
      
      return demoResponse({
        groupPrograms,
        individualPrograms,
        enrollmentConstraints: {
          canEnrollInGroup: true,
          canEnrollInIndividual: true,
        },
      });
    }
    
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'group' | 'individual' | null;

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();

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
        
        // Get coach info - find the super_coach user from the organization
        let coachName = 'Coach';
        let coachImageUrl: string | undefined;
        
        try {
          if (data.organizationId) {
            const { clerkClient } = await import('@clerk/nextjs/server');
            const clerk = await clerkClient();
            
            // Get organization members to find the super_coach (the actual coach user)
            const memberships = await clerk.organizations.getOrganizationMembershipList({
              organizationId: data.organizationId,
            });
            
            // Find the member with super_coach orgRole (stored in membership publicMetadata)
            const coachMember = memberships.data.find(m => {
              const metadata = m.publicMetadata as { orgRole?: string } | undefined;
              return metadata?.orgRole === 'super_coach';
            });
            
            if (coachMember?.publicUserData?.userId) {
              const coachUser = await clerk.users.getUser(coachMember.publicUserData.userId);
              coachName = `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach';
              coachImageUrl = coachUser.imageUrl || undefined;
            } else {
              // Fallback to first admin member
              const adminMember = memberships.data.find(m => 
                m.role === 'org:admin' && m.publicUserData?.userId
              );
              if (adminMember?.publicUserData?.userId) {
                const adminUser = await clerk.users.getUser(adminMember.publicUserData.userId);
                coachName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Coach';
                coachImageUrl = adminUser.imageUrl || undefined;
              }
            }
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
