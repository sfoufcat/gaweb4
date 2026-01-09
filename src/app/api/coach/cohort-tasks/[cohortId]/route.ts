import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import {
  getCohortTaskStatesForDate,
  getProgramCompletionThreshold,
  getOrCreateCohortTaskState,
} from '@/lib/cohort-task-state';
import type { CohortTaskState, ProgramCohort, CohortProgramDay, ProgramTaskTemplate } from '@/types';

interface MemberInfo {
  userId: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  status: 'pending' | 'completed';
  completedAt?: string;
}

interface CohortTaskResponse {
  taskTemplateId: string;
  programTaskId?: string; // The task template's UUID for robust matching
  title: string;
  programDayIndex: number;
  completedCount: number;
  totalMembers: number;
  completionRate: number;
  isThresholdMet: boolean;
  memberBreakdown: MemberInfo[];
}

interface CohortTasksResponse {
  cohortId: string;
  cohortName: string;
  date: string;
  threshold: number;
  tasks: CohortTaskResponse[];
  stats: {
    totalTasks: number;
    tasksAtThreshold: number;
    overallCompletionRate: number;
  };
}

/**
 * GET /api/coach/cohort-tasks/[cohortId]?date=YYYY-MM-DD&dayIndex=N
 *
 * Returns cohort-level task completion data for a specific date.
 * Shows aggregated completion % and member breakdown.
 *
 * If no CohortTaskStates exist and dayIndex is provided, will create them
 * on-demand from the cohort_program_days content.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const { userId: coachUserId } = await auth();
    if (!coachUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cohortId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const dayIndexParam = searchParams.get('dayIndex');

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

    // Get program completion threshold
    const threshold = await getProgramCompletionThreshold(cohort.programId);

    // Get cohort task states for this date
    let cohortTaskStates = await getCohortTaskStatesForDate(cohortId, date);

    // If no task states exist and dayIndex is provided, create them on-demand
    // from the cohort_program_days content
    if (cohortTaskStates.length === 0 && dayIndexParam) {
      const dayIndex = parseInt(dayIndexParam, 10);
      console.log(`[COACH_COHORT_TASKS] No states for date ${date}, creating on-demand for dayIndex ${dayIndex}`);

      // Get cohort day content
      const cohortDaySnapshot = await adminDb
        .collection('cohort_program_days')
        .where('cohortId', '==', cohortId)
        .where('dayIndex', '==', dayIndex)
        .limit(1)
        .get();

      // Get active cohort members
      const enrollmentsSnapshot = await adminDb
        .collection('program_enrollments')
        .where('cohortId', '==', cohortId)
        .where('status', 'in', ['active', 'upcoming'])
        .get();

      const memberIds = enrollmentsSnapshot.docs.map(doc => doc.data().userId);

      if (!cohortDaySnapshot.empty && memberIds.length > 0) {
        const cohortDay = cohortDaySnapshot.docs[0].data() as CohortProgramDay;
        const tasks = cohortDay.tasks || [];

        console.log(`[COACH_COHORT_TASKS] Found ${tasks.length} tasks, ${memberIds.length} members, creating states`);

        // Create CohortTaskState for each task
        for (const task of tasks) {
          await getOrCreateCohortTaskState({
            cohortId,
            programId: cohort.programId,
            organizationId,
            programDayIndex: dayIndex,
            taskTemplateId: task.id || `${task.label}:${dayIndex}`,
            taskTitle: task.label,
            programTaskId: task.id,
            date,
            memberIds,
          });
        }

        // Re-fetch the states after creation
        cohortTaskStates = await getCohortTaskStatesForDate(cohortId, date);
        console.log(`[COACH_COHORT_TASKS] Created ${cohortTaskStates.length} states on-demand`);
      }
    }

    // If still no task states, return empty response
    if (cohortTaskStates.length === 0) {
      return NextResponse.json({
        cohortId,
        cohortName: cohort.name,
        date,
        threshold,
        tasks: [],
        stats: {
          totalTasks: 0,
          tasksAtThreshold: 0,
          overallCompletionRate: 0,
        },
      } as CohortTasksResponse);
    }

    // Get user info for all members
    const allMemberIds = new Set<string>();
    for (const state of cohortTaskStates) {
      for (const userId of Object.keys(state.memberStates)) {
        if (!state.memberStates[userId].removed) {
          allMemberIds.add(userId);
        }
      }
    }

    // Fetch user profiles from Clerk
    const memberProfiles = new Map<string, { firstName: string; lastName: string; imageUrl: string }>();
    const memberIdArray = Array.from(allMemberIds);

    // Batch fetch user info (Clerk has limits, so batch in groups of 100)
    for (let i = 0; i < memberIdArray.length; i += 100) {
      const batch = memberIdArray.slice(i, i + 100);
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

    // Build task responses with member breakdown
    const tasks: CohortTaskResponse[] = cohortTaskStates.map(state => {
      const memberBreakdown: MemberInfo[] = [];

      for (const [userId, memberState] of Object.entries(state.memberStates)) {
        if (memberState.removed) continue;

        const profile = memberProfiles.get(userId) || {
          firstName: 'Unknown',
          lastName: 'User',
          imageUrl: '',
        };

        memberBreakdown.push({
          userId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          imageUrl: profile.imageUrl,
          status: memberState.status,
          completedAt: memberState.completedAt,
        });
      }

      // Sort by status (completed first) then by name
      memberBreakdown.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'completed' ? -1 : 1;
        }
        return a.firstName.localeCompare(b.firstName);
      });

      return {
        taskTemplateId: state.taskTemplateId,
        programTaskId: state.programTaskId,
        title: state.taskTitle,
        programDayIndex: state.programDayIndex,
        completedCount: state.completedCount,
        totalMembers: state.totalMembers,
        completionRate: state.completionRate,
        isThresholdMet: state.isThresholdMet,
        memberBreakdown,
      };
    });

    // Sort tasks by program day index
    tasks.sort((a, b) => a.programDayIndex - b.programDayIndex);

    // Calculate overall stats
    const totalTasks = tasks.length;
    const tasksAtThreshold = tasks.filter(t => t.isThresholdMet).length;
    const totalCompletionRate = tasks.length > 0
      ? Math.round(tasks.reduce((sum, t) => sum + t.completionRate, 0) / tasks.length)
      : 0;

    const response: CohortTasksResponse = {
      cohortId,
      cohortName: cohort.name,
      date,
      threshold,
      tasks,
      stats: {
        totalTasks,
        tasksAtThreshold,
        overallCompletionRate: totalCompletionRate,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[COACH_COHORT_TASKS] Error fetching cohort tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch cohort tasks', message: errorMessage },
      { status: 500 }
    );
  }
}
