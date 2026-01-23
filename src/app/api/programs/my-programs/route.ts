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
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateDemoUserProfile, generateDemoProgramSquadMembers } from '@/lib/demo-data';
import type {
  Program,
  ProgramEnrollment,
  ProgramCohort,
  Squad,
  ClientCoachingData,
} from '@/types';

// Minimal member info for avatar display
interface SquadMemberPreview {
  id: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
}

// Next call info for 1:1 programs (pre-fetched to avoid flash)
interface NextCallInfo {
  datetime: string | null;
  timezone: string;
  location: string;
  title?: string;
}

// Coaching data for 1:1 programs (pre-fetched to avoid flash)
interface CoachingDataPreview {
  focusAreas: string[];
  actionItems: Array<{ id: string; text: string; completed?: boolean }>;
  resources: Array<{ id: string; title: string; url: string; description?: string }>;
  chatChannelId?: string;
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
  // For individual programs: pre-fetched to avoid UI flash
  nextCall?: NextCallInfo | null;
  coachingData?: CoachingDataPreview | null;
}

/**
 * Fetch coaching data from clientCoachingData for individual programs
 * Returns nextCall and coachingData (focusAreas, actionItems, resources)
 */
async function fetchCoachingDataForUser(
  userId: string,
  organizationId: string
): Promise<{ nextCall: NextCallInfo | null; coachingData: CoachingDataPreview | null }> {
  try {
    // ClientCoachingData doc ID format: ${organizationId}_${userId}
    const coachingDocId = `${organizationId}_${userId}`;
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(coachingDocId).get();

    if (!coachingDoc.exists) {
      return { nextCall: null, coachingData: null };
    }

    const data = coachingDoc.data() as ClientCoachingData;

    // Extract nextCall - only include if the call hasn't started yet
    let nextCall: NextCallInfo | null = null;
    if (data.nextCall?.datetime) {
      const callTime = new Date(data.nextCall.datetime);
      const now = new Date();
      // Only show call if it's in the future
      if (callTime > now) {
        nextCall = {
          datetime: data.nextCall.datetime,
          timezone: data.nextCall.timezone || 'America/New_York',
          location: data.nextCall.location || 'Chat',
          title: data.nextCall.title,
        };
      }
    }

    // Extract coaching data preview (excluding private notes)
    const coachingData: CoachingDataPreview = {
      focusAreas: data.focusAreas || [],
      actionItems: (data.actionItems || []).map(item => ({
        id: item.id,
        text: item.text,
        completed: item.completed,
      })),
      resources: (data.resources || []).map(res => ({
        id: res.id,
        title: res.title,
        url: res.url,
        description: res.description,
      })),
      chatChannelId: data.chatChannelId,
    };

    return { nextCall, coachingData };
  } catch (err) {
    console.error('[MY_PROGRAMS] Error fetching coaching data:', err);
    return { nextCall: null, coachingData: null };
  }
}

// Discovery program type for users without enrollments
interface DiscoveryProgram {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  type: 'group' | 'individual';
  lengthDays: number;
  priceInCents: number;
  currency?: string;
  coachName?: string;
  coachImageUrl?: string;
  nextCohort?: {
    id: string;
    name: string;
    startDate: string;
    spotsRemaining: number;
  } | null;
}

/**
 * Fetch discovery programs for users without enrollments
 * This pre-fetches the data so UI loads instantly
 */
async function fetchDiscoveryPrograms(
  organizationId: string,
  userId: string
): Promise<{ groupPrograms: DiscoveryProgram[]; individualPrograms: DiscoveryProgram[] }> {
  try {
    const clerk = await clerkClient();

    // Query published programs for this org
    const programsSnapshot = await adminDb
      .collection('programs')
      .where('organizationId', '==', organizationId)
      .where('isPublished', '==', true)
      .where('isActive', '==', true)
      .get();

    if (programsSnapshot.empty) {
      return { groupPrograms: [], individualPrograms: [] };
    }

    // Get coach info from organization (super_coach)
    let coachName = 'Coach';
    let coachImageUrl: string | undefined;
    try {
      const memberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId,
        limit: 100,
      });

      const coachMember = memberships.data.find(m => {
        const metadata = m.publicMetadata as { orgRole?: string } | undefined;
        return metadata?.orgRole === 'super_coach';
      }) || memberships.data.find(m => m.role === 'org:admin');

      if (coachMember?.publicUserData?.userId) {
        const coachUser = await clerk.users.getUser(coachMember.publicUserData.userId);
        coachName = `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach';
        coachImageUrl = coachUser.imageUrl || undefined;
      }
    } catch {
      // Use default coach name
    }

    const programs: DiscoveryProgram[] = await Promise.all(
      programsSnapshot.docs.map(async (doc) => {
        const data = doc.data() as Program;

        let nextCohort: DiscoveryProgram['nextCohort'] = null;

        // For group programs, get the next available cohort
        if (data.type === 'group') {
          const today = new Date().toISOString().split('T')[0];
          const cohortsSnapshot = await adminDb
            .collection('program_cohorts')
            .where('programId', '==', doc.id)
            .where('enrollmentOpen', '==', true)
            .get();

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
              spotsRemaining: maxEnrollment === Infinity ? -1 : spotsRemaining,
            };
          }
        }

        return {
          id: doc.id,
          name: data.name,
          description: data.description,
          coverImageUrl: data.coverImageUrl,
          type: data.type,
          lengthDays: data.lengthDays,
          priceInCents: data.priceInCents || 0,
          currency: data.currency || 'USD',
          coachName,
          coachImageUrl,
          nextCohort,
        };
      })
    );

    // Sort by createdAt descending
    const groupPrograms = programs.filter(p => p.type === 'group');
    const individualPrograms = programs.filter(p => p.type === 'individual');

    return { groupPrograms, individualPrograms };
  } catch (err) {
    console.error('[MY_PROGRAMS] Error fetching discovery programs:', err);
    return { groupPrograms: [], individualPrograms: [] };
  }
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
    // Demo mode: return demo program enrollments (both group and individual)
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const profile = generateDemoUserProfile();
      // Generate 17 members for program squad (different from standalone squad members)
      const programSquadMembers = profile.squad ? generateDemoProgramSquadMembers(profile.squad.id, 17) : [];
      
      // Build enrollments from profile.programs array
      const enrollments = profile.programs.map((prog, index) => {
        const isGroupProgram = prog.type === 'group';
        
        return {
          enrollment: {
            id: `demo-enrollment-${index + 1}`,
            userId: profile.id,
            programId: prog.id,
            organizationId: 'demo-org',
            status: 'active',
            startedAt: new Date(Date.now() - prog.currentDay * 24 * 60 * 60 * 1000).toISOString(),
            startDate: new Date(Date.now() - prog.currentDay * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
          },
          program: {
            id: prog.id,
            name: prog.name,
            description: isGroupProgram 
              ? 'Transform your life with daily guided actions and community support.'
              : 'One-on-one coaching to accelerate your business and personal growth.',
            type: prog.type,
            lengthDays: prog.totalDays,
            coverImageUrl: prog.coverImageUrl,
            coachName: 'Coach Adam',
            coachImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
            // Individual programs can have client community
            clientCommunityEnabled: prog.type === 'individual',
            clientCommunitySquadId: prog.type === 'individual' ? 'demo-community-squad' : undefined,
          },
          cohort: isGroupProgram ? {
            id: `demo-cohort-${index + 1}`,
            name: 'Winter 2025',
            programId: prog.id,
            startDate: new Date(Date.now() - prog.currentDay * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + (prog.totalDays - prog.currentDay) * 24 * 60 * 60 * 1000).toISOString(),
          } : null,
          // Squad only for group programs - with 17 members
          squad: isGroupProgram && profile.squad ? {
            id: profile.squad.id,
            name: profile.squad.name,
            avatarUrl: profile.squad.avatarUrl || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&h=200&fit=crop',
            coachId: null,
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            // Add memberIds array with 17 member IDs for count display
            memberIds: programSquadMembers.map(m => m.odataUserId),
          } : null,
          // First 5 members for avatar display (different from standalone squad)
          squadMembers: isGroupProgram ? programSquadMembers.slice(0, 5).map(m => ({
            id: m.odataUserId,
            firstName: m.firstName,
            lastName: m.lastName,
            imageUrl: m.imageUrl,
          })) : [],
          progress: {
            currentDay: prog.currentDay,
            totalDays: prog.totalDays,
            percentage: prog.progress,
          },
          // Demo next call for individual programs (3 days from now at 2pm)
          nextCall: !isGroupProgram ? {
            datetime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000).toISOString(),
            timezone: 'America/New_York',
            location: 'Video Call',
            title: 'Coaching Session',
          } : null,
          // Demo coaching data for individual programs
          coachingData: !isGroupProgram ? {
            focusAreas: ['Building consistent morning routines', 'Improving focus during deep work sessions'],
            actionItems: [
              { id: 'demo-1', text: 'Complete the weekly reflection exercise', completed: false },
              { id: 'demo-2', text: 'Track sleep schedule for 7 days', completed: true },
            ],
            resources: [
              { id: 'demo-res-1', title: 'Atomic Habits Summary', url: 'https://example.com/atomic-habits', description: 'Key takeaways from our discussion' },
            ],
            chatChannelId: 'demo-coaching-chat',
          } : null,
        };
      });
      
      return demoResponse({
        success: true,
        enrollments,
        isPlatformMode: false,
      });
    }
    
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    console.log(`[MY_PROGRAMS] organizationId from getEffectiveOrgId: ${organizationId}`);

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
      // No enrollments - fetch discovery programs so UI loads instantly
      const discoveryPrograms = await fetchDiscoveryPrograms(organizationId, userId);
      return NextResponse.json({
        success: true,
        enrollments: [],
        isPlatformMode: false,
        discoveryPrograms,
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

      // For individual programs, fetch coaching data to avoid UI flash
      let nextCall: NextCallInfo | null = null;
      let coachingData: CoachingDataPreview | null = null;
      if (program.type === 'individual' && organizationId) {
        const coachingResult = await fetchCoachingDataForUser(userId, organizationId);
        nextCall = coachingResult.nextCall;
        coachingData = coachingResult.coachingData;
      }

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
        nextCall,
        coachingData,
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

