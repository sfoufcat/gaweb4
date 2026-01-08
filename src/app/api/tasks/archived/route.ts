import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Task } from '@/types';

/**
 * GET /api/tasks/archived
 * Returns all archived tasks for the authenticated user
 * Used by the archive modal to display tasks that can be restored
 *
 * MULTI-TENANCY: Only returns archived tasks within the current organization
 */
export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID for filtering
    const organizationId = await getEffectiveOrgId();

    // Build query for archived tasks
    let archivedQuery = adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('status', '==', 'archived')
      .orderBy('archivedAt', 'desc')
      .limit(50);

    // Filter by organization if available (multi-tenancy)
    if (organizationId) {
      archivedQuery = archivedQuery.where('organizationId', '==', organizationId);
    }

    const snapshot = await archivedQuery.get();
    const tasks: Task[] = [];

    snapshot.forEach((doc) => {
      tasks.push({ id: doc.id, ...doc.data() } as Task);
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching archived tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch archived tasks', message: errorMessage },
      { status: 500 }
    );
  }
}
