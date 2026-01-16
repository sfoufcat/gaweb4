/**
 * Client-safe Program Utility Functions
 *
 * These are pure utility functions that can be safely imported by client components.
 * They do NOT use firebase-admin or any Node.js-only modules.
 */

import type {
  ProgramInstanceWeek,
  WeekResourceAssignment,
  UnifiedEvent,
} from '@/types';

/**
 * Filters resources assigned to a specific day within a week
 *
 * @param week - The program instance week containing resourceAssignments
 * @param dayOfWeek - The day of week (1-7, where 1 is day 1 of the week)
 * @returns Array of resources assigned to show on this day
 */
export function getResourcesForDay(
  week: ProgramInstanceWeek,
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

/**
 * Filters calls for a specific calendar date
 *
 * Calls are linked to weeks via linkedCallEventIds. This function filters
 * those calls to find ones scheduled on a specific calendar date.
 *
 * @param week - The program instance week containing linkedCallEventIds
 * @param dayCalendarDate - ISO date string (YYYY-MM-DD) to filter by
 * @param events - Array of UnifiedEvent objects to filter
 * @returns Filtered array of calls scheduled for the specified date
 */
export function getCallsForDay(
  week: ProgramInstanceWeek,
  dayCalendarDate: string,
  events: UnifiedEvent[]
): UnifiedEvent[] {
  const weekCallIds = week.linkedCallEventIds || [];

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
