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
 * @param organizationId - Optional organization ID to filter enrollments by org
 * @returns Set of valid instance IDs
 */
export async function getUserValidInstanceIds(
  userId: string,
  organizationId?: string
): Promise<Set<string>> {
  const userInstanceIds = new Set<string>();

  // Get user's active/upcoming enrollments (filtered by org if provided)
  // Include both 'active' and 'upcoming' to support cohorts that haven't started yet
  let enrollmentsQuery = adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('status', 'in', ['active', 'upcoming']);

  if (organizationId) {
    enrollmentsQuery = enrollmentsQuery.where('organizationId', '==', organizationId);
  }

  const enrollmentsSnapshot = await enrollmentsQuery.get();

  for (const doc of enrollmentsSnapshot.docs) {
    const enrollment = doc.data();
    const enrollmentId = doc.id;

    // Individual enrollment instance - get ALL instances for this enrollment
    const indivDocs = await adminDb
      .collection('program_instances')
      .where('enrollmentId', '==', enrollmentId)
      .where('type', '==', 'individual')
      .get();
    for (const doc of indivDocs.docs) {
      userInstanceIds.add(doc.id);
    }

    // Cohort instance - get ALL instances for this cohort (there might be duplicates from migrations)
    // Including all ensures tasks from any valid instance are shown
    if (enrollment.cohortId) {
      const cohortDocs = await adminDb
        .collection('program_instances')
        .where('cohortId', '==', enrollment.cohortId)
        .where('type', '==', 'cohort')
        .get();
      for (const doc of cohortDocs.docs) {
        userInstanceIds.add(doc.id);
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
