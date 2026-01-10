import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { syncMembersWithEnrollments, getProgramCompletionThreshold } from '@/lib/cohort-task-state';
import type { CohortTaskState, ProgramCohort } from '@/types';

interface MemberInfo {
  userId: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  status: 'pending' | 'completed';
  completedAt?: string;
  date?: string; // For aggregate view, which date they completed
}

interface TaskMemberResponse {
  taskId: string;
  taskTitle: string;
  completionRate: number;
  completedCount: number;
  totalMembers: number;
  memberBreakdown: MemberInfo[];
}

/**
 * GET /api/coach/cohort-tasks/[cohortId]/task/[taskId]
 *
 * Returns member breakdown for a specific task in a cohort.
 * Supports single date or date range queries.
 *
 * Query params:
 * - date: Single date (YYYY-MM-DD) for day view
 * - startDate/endDate: Date range for week aggregate view
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cohortId: string; taskId: string }> }
) {
  try {
    const { userId: coachUserId } = await auth();
    if (!coachUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cohortId, taskId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // MULTI-TENANCY: Get effective org ID
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Verify requester is a coach/admin in this organization
    const client = await clerkClient();
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
    });

    const coachMembership = memberships.data.find(m => m.publicUserData?.userId === coachUserId);
    if (!coachMembership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const coachRole = coachMembership.role;
    const isCoachOrAdmin = coachRole === 'org:admin' || coachRole === 'org:coach' || coachRole === 'org:super_coach';
    if (!isCoachOrAdmin) {
      return NextResponse.json({ error: 'Coach or admin role required' }, { status: 403 });
    }

    // Get the cohort
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    const cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;

    // Verify cohort belongs to this organization
    if (cohort.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Cohort not found in this organization' }, { status: 404 });
    }

    // Build query for CohortTaskState
    let query = adminDb
      .collection('cohort_task_states')
      .where('cohortId', '==', cohortId);

    // Filter by taskId - can be either taskTemplateId or programTaskId
    // We need to query both to handle different ways tasks are identified
    const taskStatesSnapshot = await query.get();

    // Filter task states that match the taskId
    const matchingStates = taskStatesSnapshot.docs.filter(doc => {
      const data = doc.data();
      // Match by taskTemplateId, programTaskId, or taskTitle (as fallback)
      return data.taskTemplateId === taskId ||
             data.programTaskId === taskId ||
             data.taskTitle === taskId;
    });

    // If date range specified, filter by dates
    let filteredStates = matchingStates;
    if (date) {
      filteredStates = matchingStates.filter(doc => doc.data().date === date);
    } else if (startDate && endDate) {
      filteredStates = matchingStates.filter(doc => {
        const stateDate = doc.data().date;
        return stateDate >= startDate && stateDate <= endDate;
      });
    }

    if (filteredStates.length === 0) {
      return NextResponse.json({
        taskId,
        taskTitle: taskId, // Use taskId as fallback title
        completionRate: 0,
        completedCount: 0,
        totalMembers: 0,
        memberBreakdown: [],
      } as TaskMemberResponse);
    }

    // Sync members with current enrollments to ensure states have correct member list
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('cohortId', '==', cohortId)
      .where('status', 'in', ['active', 'upcoming'])
      .get();

    const enrolledMemberIds = enrollmentsSnapshot.docs.map(doc => doc.data().userId);
    
    if (enrolledMemberIds.length > 0) {
      const threshold = await getProgramCompletionThreshold(cohort.programId);
      
      for (const stateDoc of filteredStates) {
        const stateData = stateDoc.data() as CohortTaskState;
        const existingCount = Object.keys(stateData.memberStates || {})
          .filter(k => !stateData.memberStates[k]?.removed).length;

        if (enrolledMemberIds.length > existingCount) {
          console.log(`[COHORT_TASK_MEMBERS] Syncing members for state ${stateDoc.id}: ${existingCount} -> ${enrolledMemberIds.length} members`);
          await syncMembersWithEnrollments(stateDoc.id, enrolledMemberIds, threshold);
        }
      }

      // Re-fetch states after sync to get updated member data
      const refreshedSnapshot = await adminDb
        .collection('cohort_task_states')
        .where('cohortId', '==', cohortId)
        .get();

      const refreshedMatchingStates = refreshedSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.taskTemplateId === taskId ||
               data.programTaskId === taskId ||
               data.taskTitle === taskId;
      });

      // Re-apply date filtering
      if (date) {
        filteredStates = refreshedMatchingStates.filter(doc => doc.data().date === date);
      } else if (startDate && endDate) {
        filteredStates = refreshedMatchingStates.filter(doc => {
          const stateDate = doc.data().date;
          return stateDate >= startDate && stateDate <= endDate;
        });
      } else {
        filteredStates = refreshedMatchingStates;
      }
    }

    // Aggregate member states across all matching task states (for date range queries)
    const aggregatedMembers = new Map<string, {
      status: 'pending' | 'completed';
      completedAt?: string;
      date?: string;
    }>();

    let taskTitle = '';
    let totalMembersSet = new Set<string>();

    for (const doc of filteredStates) {
      const state = { id: doc.id, ...doc.data() } as CohortTaskState;
      if (!taskTitle) taskTitle = state.taskTitle;

      for (const [userId, memberState] of Object.entries(state.memberStates)) {
        if (memberState.removed) continue;
        totalMembersSet.add(userId);

        const existing = aggregatedMembers.get(userId);
        if (!existing) {
          aggregatedMembers.set(userId, {
            status: memberState.status,
            completedAt: memberState.completedAt,
            date: memberState.status === 'completed' ? state.date : undefined,
          });
        } else if (memberState.status === 'completed' && existing.status !== 'completed') {
          // Update to completed if any state shows completed
          aggregatedMembers.set(userId, {
            status: 'completed',
            completedAt: memberState.completedAt,
            date: state.date,
          });
        }
      }
    }

    // Get user info for all members
    const memberIds = Array.from(totalMembersSet);

    // Fetch user profiles from Clerk
    const memberProfiles = new Map<string, { firstName: string; lastName: string; imageUrl: string }>();

    // Batch fetch user info (Clerk has limits, so batch in groups of 100)
    for (let i = 0; i < memberIds.length; i += 100) {
      const batch = memberIds.slice(i, i + 100);
      const usersResponse = await client.users.getUserList({
        userId: batch,
        limit: 100,
      });

      for (const user of usersResponse.data) {
        memberProfiles.set(user.id, {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          imageUrl: user.imageUrl || '',
        });
      }
    }

    // Build member breakdown
    const memberBreakdown: MemberInfo[] = [];
    let completedCount = 0;

    for (const [userId, memberState] of aggregatedMembers) {
      const profile = memberProfiles.get(userId) || {
        firstName: 'Unknown',
        lastName: 'User',
        imageUrl: '',
      };

      if (memberState.status === 'completed') {
        completedCount++;
      }

      memberBreakdown.push({
        userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        imageUrl: profile.imageUrl,
        status: memberState.status,
        completedAt: memberState.completedAt,
        date: memberState.date,
      });
    }

    // Sort by status (completed first) then by name
    memberBreakdown.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'completed' ? -1 : 1;
      }
      return a.firstName.localeCompare(b.firstName);
    });

    const totalMembers = memberBreakdown.length;
    const completionRate = totalMembers > 0
      ? Math.round((completedCount / totalMembers) * 100)
      : 0;

    const response: TaskMemberResponse = {
      taskId,
      taskTitle: taskTitle || taskId,
      completionRate,
      completedCount,
      totalMembers,
      memberBreakdown,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[COACH_COHORT_TASK] Error fetching task member data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch task member data', message: errorMessage },
      { status: 500 }
    );
  }
}
