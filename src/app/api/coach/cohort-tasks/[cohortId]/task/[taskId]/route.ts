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

    // Get the program instance for this cohort
    // Fetch all instances and pick the most recently updated one (handles duplicate instances)
    const instanceQuery = await adminDb
      .collection('program_instances')
      .where('cohortId', '==', cohortId)
      .get();

    if (instanceQuery.empty) {
      // Fallback or return empty if no instance (migration pending)
      console.warn(`[COHORT_TASK] No instance found for cohort ${cohortId}`);
      return NextResponse.json({
        taskId,
        taskTitle: taskId,
        completionRate: 0,
        completedCount: 0,
        totalMembers: 0,
        memberBreakdown: [],
      } as TaskMemberResponse);
    }

    // Pick the most recently updated instance (handles duplicate instances case)
    const sortedInstances = instanceQuery.docs.sort((a, b) => {
      const aUpdated = a.data().updatedAt?.toMillis?.() || a.data().updatedAt || 0;
      const bUpdated = b.data().updatedAt?.toMillis?.() || b.data().updatedAt || 0;
      return bUpdated - aUpdated; // desc order
    });
    const instanceId = sortedInstances[0].id;
    console.log(`[COHORT_TASK] Using instance ${instanceId} for cohort ${cohortId} (picked from ${instanceQuery.docs.length} instances)`);

    // Get all tasks for this instance and template task ID
    // This queries the 'tasks' collection directly (new system)
    console.log(`[COHORT_TASK] Querying tasks with instanceId=${instanceId}, instanceTaskId=${taskId}`);
    const tasksQuery = await adminDb
      .collection('tasks')
      .where('instanceId', '==', instanceId)
      .where('instanceTaskId', '==', taskId)
      .get();
    console.log(`[COHORT_TASK] Found ${tasksQuery.docs.length} tasks matching query`);

    // Map tasks to member status
    const taskStatusMap = new Map<string, { status: 'pending' | 'completed'; completedAt?: string }>();
    tasksQuery.docs.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        taskStatusMap.set(data.userId, {
          status: data.completed ? 'completed' : 'pending',
          completedAt: data.completedAt,
        });
      }
    });

    // Get all enrolled members to ensure we show everyone
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('cohortId', '==', cohortId)
      .where('status', 'in', ['active', 'upcoming', 'completed'])
      .get();

    const memberIds = enrollmentsSnapshot.docs.map(doc => doc.data().userId);
    console.log(`[COHORT_TASK] Found ${enrollmentsSnapshot.docs.length} enrollments, memberIds: ${memberIds.join(', ')}`);
    
    // Fetch user profiles from Clerk
    const memberProfiles = new Map<string, { firstName: string; lastName: string; imageUrl: string }>();
    
    for (let i = 0; i < memberIds.length; i += 100) {
      const batch = memberIds.slice(i, i + 100);
      try {
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
      } catch (err) {
        console.error('Error fetching Clerk users:', err);
      }
    }

    // Build member breakdown
    const memberBreakdown: MemberInfo[] = memberIds.map(userId => {
      const profile = memberProfiles.get(userId) || {
        firstName: 'Unknown',
        lastName: 'User',
        imageUrl: '',
      };
      
      const statusData = taskStatusMap.get(userId);
      
      return {
        userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        imageUrl: profile.imageUrl,
        status: statusData?.status || 'pending',
        completedAt: statusData?.completedAt,
      };
    });

    // Sort: Completed first, then alphabetical
    memberBreakdown.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'completed' ? -1 : 1;
      }
      return a.firstName.localeCompare(b.firstName);
    });

    const completedCount = memberBreakdown.filter(m => m.status === 'completed').length;
    const totalMembers = memberBreakdown.length;
    const completionRate = totalMembers > 0
      ? Math.round((completedCount / totalMembers) * 100)
      : 0;

    return NextResponse.json({
      taskId,
      taskTitle: taskId, // We don't have title readily available without querying the task/instance, using ID fallback
      completionRate,
      completedCount,
      totalMembers,
      memberBreakdown,
    } as TaskMemberResponse);
  } catch (error) {
    console.error('[COACH_COHORT_TASK] Error fetching task member data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch task member data', message: errorMessage },
      { status: 500 }
    );
  }
}
