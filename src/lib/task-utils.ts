/**
 * Task Utilities
 *
 * Shared utilities for task management, including instance validation
 * to filter out orphaned tasks from old/invalid instances.
 */

import { adminDb } from '@/lib/firebase-admin';

/**
 * Gets the set of valid instance IDs for a user based on their active enrollments.
 *
 * Used to filter tasks: only tasks from valid instances should be shown.
 * This prevents orphaned tasks from old/deleted instances from appearing.
 *
 * @param userId - The user's ID
 * @returns Set of valid instance IDs
 */
export async function getUserValidInstanceIds(userId: string): Promise<Set<string>> {
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

/**
 * Filters tasks to only include valid ones (non-program tasks or tasks from valid instances).
 *
 * @param tasks - Array of tasks to filter
 * @param validInstanceIds - Set of valid instance IDs (from getUserValidInstanceIds)
 * @returns Filtered array of tasks
 */
export function filterTasksByValidInstances<T extends { sourceType?: string; instanceId?: string | null }>(
  tasks: T[],
  validInstanceIds: Set<string>
): T[] {
  return tasks.filter(task => {
    // Keep non-program tasks (user-created tasks)
    if (task.sourceType !== 'program' && task.sourceType !== 'program_day' && task.sourceType !== 'program_week') {
      return true;
    }
    // Keep program tasks only if from a valid instance
    return task.instanceId && validInstanceIds.has(task.instanceId);
  });
}
