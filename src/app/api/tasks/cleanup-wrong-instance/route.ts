/**
 * Cleanup API: Remove tasks from instances user shouldn't have access to
 *
 * GET - Preview tasks that would be deleted
 * DELETE - Actually delete the tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

async function getUserValidInstanceIds(userId: string): Promise<Set<string>> {
  const userInstanceIds = new Set<string>();

  // Get user's active enrollments
  const enrollmentsSnapshot = await adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .get();

  for (const doc of enrollmentsSnapshot.docs) {
    const enrollment = doc.data();
    const enrollmentId = doc.id;

    // Individual enrollment instance
    const indivDoc = await adminDb
      .collection('program_instances')
      .where('enrollmentId', '==', enrollmentId)
      .where('type', '==', 'individual')
      .limit(1)
      .get();
    if (!indivDoc.empty) {
      userInstanceIds.add(indivDoc.docs[0].id);
    }

    // Cohort instance
    if (enrollment.cohortId) {
      const cohortDoc = await adminDb
        .collection('program_instances')
        .where('cohortId', '==', enrollment.cohortId)
        .where('type', '==', 'cohort')
        .limit(1)
        .get();
      if (!cohortDoc.empty) {
        userInstanceIds.add(cohortDoc.docs[0].id);
      }
    }
  }

  return userInstanceIds;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const allDates = searchParams.get('allDates') === 'true';

    // Get user's valid instance IDs
    const validInstanceIds = await getUserValidInstanceIds(userId);

    // Get all tasks with instanceId
    let query = adminDb
      .collection('tasks')
      .where('userId', '==', userId);

    // If not all dates, only get recent tasks
    if (!allDates) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      query = query.where('date', '>=', thirtyDaysAgoStr);
    }

    const tasksSnapshot = await query.get();

    const tasksFromWrongInstances: Array<{
      id: string;
      title: string;
      date: string;
      instanceId: string;
      dayIndex?: number;
    }> = [];

    tasksSnapshot.forEach((doc) => {
      const data = doc.data();
      // Only check tasks that have an instanceId
      if (data.instanceId && !validInstanceIds.has(data.instanceId)) {
        tasksFromWrongInstances.push({
          id: doc.id,
          title: data.title || data.label || 'Untitled',
          date: data.date,
          instanceId: data.instanceId,
          dayIndex: data.dayIndex,
        });
      }
    });

    return NextResponse.json({
      success: true,
      validInstanceIds: Array.from(validInstanceIds),
      tasksFromWrongInstances,
      count: tasksFromWrongInstances.length,
      message: tasksFromWrongInstances.length > 0
        ? `Found ${tasksFromWrongInstances.length} tasks from wrong instances. Use DELETE to remove them.`
        : 'No tasks from wrong instances found.',
    });
  } catch (error) {
    console.error('[CLEANUP_WRONG_INSTANCE] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const allDates = searchParams.get('allDates') === 'true';

    // Get user's valid instance IDs
    const validInstanceIds = await getUserValidInstanceIds(userId);

    // Get all tasks with instanceId
    let query = adminDb
      .collection('tasks')
      .where('userId', '==', userId);

    if (!allDates) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      query = query.where('date', '>=', thirtyDaysAgoStr);
    }

    const tasksSnapshot = await query.get();

    const taskIdsToDelete: string[] = [];
    const deletedTasks: Array<{ id: string; title: string; instanceId: string }> = [];

    tasksSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.instanceId && !validInstanceIds.has(data.instanceId)) {
        taskIdsToDelete.push(doc.id);
        deletedTasks.push({
          id: doc.id,
          title: data.title || data.label || 'Untitled',
          instanceId: data.instanceId,
        });
      }
    });

    // Delete in batches of 500
    const batches: FirebaseFirestore.WriteBatch[] = [];
    let currentBatch = adminDb.batch();
    let operationCount = 0;

    for (const taskId of taskIdsToDelete) {
      currentBatch.delete(adminDb.collection('tasks').doc(taskId));
      operationCount++;

      if (operationCount === 500) {
        batches.push(currentBatch);
        currentBatch = adminDb.batch();
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Commit all batches
    for (const batch of batches) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      deletedCount: taskIdsToDelete.length,
      deletedTasks,
      message: `Deleted ${taskIdsToDelete.length} tasks from wrong instances.`,
    });
  } catch (error) {
    console.error('[CLEANUP_WRONG_INSTANCE] Delete error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
