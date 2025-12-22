import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Task, ClerkPublicMetadata } from '@/types';

/**
 * POST /api/tasks/move-to-backlog
 * Moves all focus tasks from today to backlog
 * Called when user completes their evening check-in
 * 
 * MULTI-TENANCY: Only moves tasks within the current organization
 */
export async function POST(_request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    const today = new Date().toISOString().split('T')[0];

    // Get all focus tasks for today (within organization)
    let focusQuery = adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', today)
      .where('listType', '==', 'focus');
    
    if (organizationId) {
      focusQuery = focusQuery.where('organizationId', '==', organizationId);
    }
    
    const focusTasksSnapshot = await focusQuery.get();

    if (focusTasksSnapshot.empty) {
      return NextResponse.json({ 
        success: true, 
        message: 'No focus tasks to move',
        movedCount: 0 
      });
    }

    // Get current backlog tasks to determine order (within organization)
    let backlogQuery = adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', today)
      .where('listType', '==', 'backlog');
    
    if (organizationId) {
      backlogQuery = backlogQuery.where('organizationId', '==', organizationId);
    }
    
    const backlogTasksSnapshot = await backlogQuery.get();

    let maxBacklogOrder = -1;
    backlogTasksSnapshot.forEach((doc) => {
      const task = doc.data() as Task;
      if (task.order > maxBacklogOrder) {
        maxBacklogOrder = task.order;
      }
    });

    // Move all focus tasks to backlog
    const batch = adminDb.batch();
    const now = new Date().toISOString();
    let movedCount = 0;

    focusTasksSnapshot.forEach((doc) => {
      maxBacklogOrder++;
      batch.update(doc.ref, {
        listType: 'backlog',
        order: maxBacklogOrder,
        updatedAt: now,
      });
      movedCount++;
    });

    await batch.commit();

    console.log(`✅ Moved ${movedCount} focus tasks to backlog for ${today}`);

    return NextResponse.json({ 
      success: true, 
      message: `Moved ${movedCount} tasks to backlog`,
      movedCount 
    });
  } catch (error) {
    console.error('Error moving tasks to backlog:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to move tasks to backlog', message: errorMessage },
      { status: 500 }
    );
  }
}












