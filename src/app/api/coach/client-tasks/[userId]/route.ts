import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Task, TaskSourceType, TaskVisibility } from '@/types';

interface ClientTaskResponse {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  listType: 'focus' | 'backlog';
  order: number;
  sourceType: TaskSourceType;
  visibility: TaskVisibility;
  isPrivate: boolean;
  isProgramSourced: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/coach/client-tasks/[userId]?date=YYYY-MM-DD
 *
 * Returns client's tasks for a specific date, with visibility filtering:
 * - All program/coach-sourced tasks are visible to coach
 * - Client-created tasks only visible if visibility='public' (or isPrivate=false)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: coachUserId } = await auth();
    if (!coachUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: clientUserId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

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

    // Verify client is in the same organization
    const clientMembership = memberships.data.find(m => m.publicUserData?.userId === clientUserId);
    if (!clientMembership) {
      return NextResponse.json({ error: 'Client not found in this organization' }, { status: 404 });
    }

    // Fetch all tasks for the client on this date
    const tasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', clientUserId)
      .where('organizationId', '==', organizationId)
      .where('date', '==', date)
      .orderBy('order', 'asc')
      .get();

    const allTasks: Task[] = [];
    tasksSnapshot.forEach((doc) => {
      allTasks.push({ id: doc.id, ...doc.data() } as Task);
    });

    // Apply visibility filtering
    const visibleTasks: ClientTaskResponse[] = allTasks
      .filter((task) => {
        // Filter out deleted tasks
        if (task.status === 'deleted') return false;

        // Program-sourced and coach-assigned tasks are always visible to coach
        const programSourceTypes: TaskSourceType[] = ['program', 'program_day', 'program_week', 'coach_manual'];
        if (task.sourceType && programSourceTypes.includes(task.sourceType)) {
          return true;
        }

        // Client-created tasks (or tasks with no sourceType) - check visibility
        // Use new visibility field, fallback to isPrivate for legacy data
        const isPublic = task.visibility === 'public' || task.isPrivate === false;
        return isPublic;
      })
      .map((task) => {
        const programSourceTypes: TaskSourceType[] = ['program', 'program_day', 'program_week', 'coach_manual'];
        const isProgramSourced = !!(task.sourceType && programSourceTypes.includes(task.sourceType));

        return {
          id: task.id,
          title: task.title,
          status: task.status as 'pending' | 'completed',
          listType: task.listType,
          order: task.order,
          sourceType: task.sourceType || 'user',
          visibility: task.visibility || (task.isPrivate ? 'private' : 'public'),
          isPrivate: task.isPrivate,
          isProgramSourced,
          completedAt: task.completedAt,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        };
      });

    // Separate into focus and backlog
    const focusTasks = visibleTasks.filter(t => t.listType === 'focus');
    const backlogTasks = visibleTasks.filter(t => t.listType === 'backlog');

    // Calculate stats
    const completedCount = focusTasks.filter(t => t.status === 'completed').length;
    const totalFocusTasks = focusTasks.length;

    return NextResponse.json({
      date,
      clientUserId,
      focusTasks,
      backlogTasks,
      stats: {
        completedCount,
        totalFocusTasks,
        completionRate: totalFocusTasks > 0 ? Math.round((completedCount / totalFocusTasks) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('[COACH_CLIENT_TASKS] Error fetching client tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch client tasks', message: errorMessage },
      { status: 500 }
    );
  }
}
