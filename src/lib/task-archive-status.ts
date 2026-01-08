import type { Task } from '@/types';

/**
 * Information about a task's archive lifecycle status
 */
export interface TaskArchiveStatus {
  /** Number of days the task has been in the backlog */
  daysInBacklog: number;
  /** True if the task is stale (>= 5 days in backlog) and should show warning */
  isStale: boolean;
  /** True if the task is archived */
  isArchived: boolean;
  /** Days until the task will be archived (0 if already due for archive) */
  daysUntilArchive: number;
  /** Days until the archived task will be permanently deleted (only applicable if archived) */
  daysUntilDelete: number;
}

const STALE_THRESHOLD_DAYS = 5;  // Show warning at day 5
const ARCHIVE_THRESHOLD_DAYS = 7;  // Archive at day 7

/**
 * Calculates the archive lifecycle status for a task.
 *
 * @param task - The task to check
 * @returns Archive status information
 *
 * @example
 * ```ts
 * const status = getTaskArchiveStatus(task);
 * if (status.isStale) {
 *   // Show warning icon: "Task will be archived in X days"
 *   console.log(`Warning: ${status.daysUntilArchive} days until archive`);
 * }
 * ```
 */
export function getTaskArchiveStatus(task: Task): TaskArchiveStatus {
  const now = new Date();

  // Default values
  let daysInBacklog = 0;
  let isStale = false;
  const isArchived = task.status === 'archived';
  let daysUntilArchive = ARCHIVE_THRESHOLD_DAYS;
  let daysUntilDelete = 0;

  // Calculate days in backlog (only for backlog tasks that aren't archived)
  if (task.listType === 'backlog' && task.status === 'pending') {
    if (task.movedToBacklogAt) {
      const movedDate = new Date(task.movedToBacklogAt);
      const diffMs = now.getTime() - movedDate.getTime();
      daysInBacklog = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    } else if (task.createdAt) {
      // Fallback: use createdAt for tasks without movedToBacklogAt (legacy)
      const createdDate = new Date(task.createdAt);
      const diffMs = now.getTime() - createdDate.getTime();
      daysInBacklog = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    }

    // Task is stale if in backlog for 5+ days
    isStale = daysInBacklog >= STALE_THRESHOLD_DAYS;

    // Calculate days until archive (minimum 0)
    daysUntilArchive = Math.max(0, ARCHIVE_THRESHOLD_DAYS - daysInBacklog);
  }

  // Calculate days until permanent deletion (only for archived tasks)
  if (isArchived && task.scheduledDeleteAt) {
    const deleteDate = new Date(task.scheduledDeleteAt);
    const diffMs = deleteDate.getTime() - now.getTime();
    daysUntilDelete = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  }

  return {
    daysInBacklog,
    isStale,
    isArchived,
    daysUntilArchive,
    daysUntilDelete,
  };
}

/**
 * Returns a human-readable string describing when the task will be archived.
 *
 * @param status - The task archive status
 * @returns A string like "Task will be archived in 2 days" or "Task will be archived tomorrow"
 */
export function getArchiveWarningText(status: TaskArchiveStatus): string {
  if (status.isArchived) {
    if (status.daysUntilDelete === 0) {
      return 'Task will be permanently deleted soon';
    } else if (status.daysUntilDelete === 1) {
      return 'Task will be permanently deleted tomorrow';
    }
    return `Task will be permanently deleted in ${status.daysUntilDelete} days`;
  }

  if (!status.isStale) {
    return '';
  }

  if (status.daysUntilArchive === 0) {
    return 'Task will be archived soon';
  } else if (status.daysUntilArchive === 1) {
    return 'Task will be archived tomorrow';
  }
  return `Task will be archived in ${status.daysUntilArchive} days`;
}
