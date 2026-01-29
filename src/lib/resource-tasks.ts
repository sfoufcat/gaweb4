/**
 * Utility functions for generating tasks from program resources
 */

import type { WeekResourceAssignment, ProgramTaskTemplate } from '@/types';

/**
 * Generate a task label based on resource type
 */
export function getTaskLabelForResource(
  resourceType: WeekResourceAssignment['resourceType'],
  title: string,
  lessonInfo?: { lessonNumber: number; lessonTitle: string }
): string {
  if (lessonInfo) {
    return `Watch Lesson ${lessonInfo.lessonNumber}: ${lessonInfo.lessonTitle}`;
  }
  switch (resourceType) {
    case 'course':
      return `Watch ${title}`;
    case 'video':
      return `Watch ${title}`;
    case 'questionnaire':
      return `Fill in ${title}`;
    case 'article':
      return `Read ${title}`;
    case 'download':
      return `Download ${title}`;
    case 'link':
      return `Visit ${title}`;
    default:
      return title;
  }
}

/**
 * Generate tasks from resources that have alsoCreateTask: true
 *
 * @param resourceAssignments - The resource assignments to process
 * @param resourceTitles - Map of resourceId to title for label generation
 * @param courseData - Optional course data for generating per-lesson tasks
 * @returns Array of generated tasks
 */
export function generateTasksFromResources(
  resourceAssignments: WeekResourceAssignment[],
  resourceTitles: Map<string, string>,
  courseData?: Map<string, { modules?: { id: string; title: string; lessons?: { id: string; title: string }[] }[] }>
): ProgramTaskTemplate[] {
  const tasks: ProgramTaskTemplate[] = [];

  for (const assignment of resourceAssignments) {
    if (!assignment.alsoCreateTask) continue;

    const title = resourceTitles.get(assignment.resourceId) || assignment.title || 'Resource';

    // For courses with lesson mapping, generate per-lesson tasks
    if (assignment.resourceType === 'course' && assignment.lessonDayMapping) {
      const course = courseData?.get(assignment.resourceId);
      const lessons = course?.modules?.flatMap(m => m.lessons || []) || [];
      let lessonNumber = 0;

      for (const [lessonId, dayNumber] of Object.entries(assignment.lessonDayMapping)) {
        lessonNumber++;
        const lesson = lessons.find(l => l.id === lessonId);
        const lessonTitle = lesson?.title || `Lesson ${lessonNumber}`;

        tasks.push({
          id: `resource-task-${assignment.id}-${lessonId}`,
          label: getTaskLabelForResource('course', title, { lessonNumber, lessonTitle }),
          isPrimary: true,
          type: 'task',
          dayTag: dayNumber,
          source: 'week',
          sourceResourceId: assignment.id,
        });
      }
    } else {
      // Single task for the resource
      tasks.push({
        id: `resource-task-${assignment.id}`,
        label: getTaskLabelForResource(assignment.resourceType, title),
        isPrimary: true,
        type: 'task',
        dayTag: assignment.dayTag === 'week' ? 'auto' :
                assignment.dayTag === 'spread' ? 'spread' :
                assignment.dayTag,
        source: 'week',
        sourceResourceId: assignment.id,
      });
    }
  }

  return tasks;
}

/**
 * Merge generated resource tasks with existing weekly tasks
 * - Adds new generated tasks
 * - Updates existing resource tasks with new dayTag values
 * - Removes generated tasks for resources that no longer have alsoCreateTask
 * - Preserves manually-added tasks
 *
 * @param existingTasks - Current weekly tasks
 * @param generatedTasks - Tasks generated from resources
 * @param resourceAssignments - Current resource assignments (to know which are enabled)
 * @returns Merged task array
 */
export function mergeResourceTasks(
  existingTasks: ProgramTaskTemplate[],
  generatedTasks: ProgramTaskTemplate[],
  resourceAssignments: WeekResourceAssignment[]
): ProgramTaskTemplate[] {
  // Get set of resource IDs that have alsoCreateTask enabled
  const enabledResourceIds = new Set(
    resourceAssignments
      .filter(a => a.alsoCreateTask)
      .map(a => a.id)
  );

  // Build a map of generated task ID -> generated task for quick lookup
  const generatedTaskMap = new Map(generatedTasks.map(t => [t.id, t]));

  // Process existing tasks:
  // - Keep manual tasks unchanged
  // - Remove resource tasks for disabled resources
  // - Update resource tasks with new dayTag from generated tasks
  const updatedExistingTasks = existingTasks
    .filter(task => {
      if (!task.sourceResourceId) return true; // Keep manual tasks
      return enabledResourceIds.has(task.sourceResourceId);
    })
    .map(task => {
      // If this is a resource task, update its dayTag from the generated version
      if (task.sourceResourceId && generatedTaskMap.has(task.id)) {
        const generated = generatedTaskMap.get(task.id)!;
        return { ...task, dayTag: generated.dayTag };
      }
      return task;
    });

  // Create a set of existing task IDs (after filtering)
  const existingTaskIds = new Set(updatedExistingTasks.map(t => t.id));

  // Add new generated tasks that don't already exist
  const newTasks = generatedTasks.filter(task => !existingTaskIds.has(task.id));

  return [...updatedExistingTasks, ...newTasks];
}
