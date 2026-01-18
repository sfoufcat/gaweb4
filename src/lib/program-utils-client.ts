/**
 * Client-safe Program Utility Functions
 *
 * These are pure utility functions that can be safely imported by client components.
 * They do NOT use firebase-admin or any Node.js-only modules.
 */

import type {
  ProgramInstanceWeek,
  ProgramWeek,
  WeekResourceAssignment,
  UnifiedEvent,
} from '@/types';

// Accept either template or instance week (both have resourceAssignments)
type WeekWithResources = Pick<ProgramWeek | ProgramInstanceWeek, 'resourceAssignments'>;

/**
 * Filters resources assigned to a specific day within a week
 *
 * @param week - The program week containing resourceAssignments (template or instance)
 * @param dayOfWeek - The day of week (1-7, where 1 is day 1 of the week)
 * @returns Array of resources assigned to show on this day
 */
export function getResourcesForDay(
  week: WeekWithResources,
  dayOfWeek: number
): WeekResourceAssignment[] {
  const assignments = week.resourceAssignments || [];

  return assignments.filter((assignment) => {
    const tag = assignment.dayTag;

    // Week-level resources always show
    if (tag === 'week') return true;

    // Daily resources always show
    if (tag === 'daily') return true;

    // Specific day match
    if (typeof tag === 'number') {
      return tag === dayOfWeek;
    }

    // Default to showing (treats undefined as week-level)
    return true;
  });
}

/**
 * Filters resources by type from day-filtered assignments
 *
 * @param assignments - Day-filtered resource assignments
 * @param resourceType - Type of resource to filter for
 * @returns Filtered assignments of the specified type, sorted by order
 */
export function getResourcesByType(
  assignments: WeekResourceAssignment[],
  resourceType: WeekResourceAssignment['resourceType']
): WeekResourceAssignment[] {
  return assignments
    .filter((a) => a.resourceType === resourceType)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// Accept weeks that may have linkedCallEventIds (instance has it, template may have it)
type WeekWithCalls = Pick<ProgramInstanceWeek, 'linkedCallEventIds'> | Pick<ProgramWeek, 'linkedCallEventIds'>;

/**
 * Filters calls for a specific calendar date
 *
 * Calls are linked to weeks via linkedCallEventIds. This function filters
 * those calls to find ones scheduled on a specific calendar date.
 *
 * @param week - The program week containing linkedCallEventIds (template or instance)
 * @param dayCalendarDate - ISO date string (YYYY-MM-DD) to filter by
 * @param events - Array of UnifiedEvent objects to filter
 * @returns Filtered array of calls scheduled for the specified date
 */
export function getCallsForDay(
  week: WeekWithCalls,
  dayCalendarDate: string,
  events: UnifiedEvent[]
): UnifiedEvent[] {
  const weekCallIds = (week as ProgramInstanceWeek).linkedCallEventIds || [];

  if (weekCallIds.length === 0 || events.length === 0) {
    return [];
  }

  // Create a set for faster lookup
  const callIdSet = new Set(weekCallIds);

  // Filter events linked to this week that fall on the specified date
  return events.filter((event) => {
    // Must be linked to this week
    if (!callIdSet.has(event.id)) return false;

    // Must have a start date/time
    if (!event.startDateTime) return false;

    // Extract date portion from startDateTime (ISO format: YYYY-MM-DDTHH:mm:ss)
    const eventDate = event.startDateTime.split('T')[0];

    // Match against the calendar date
    return eventDate === dayCalendarDate;
  });
}
