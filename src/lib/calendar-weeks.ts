/**
 * Calendar-Aligned Weeks Utilities
 *
 * Provides functions to calculate calendar-aligned weeks for program enrollments.
 * Weeks align to Mon-Fri calendar weeks, with special handling for:
 * - Onboarding Week: Week 1 (may be partial if joining mid-week)
 * - Regular Weeks: Week 2, 3, 4... Full Mon-Fri weeks in between
 * - Closing Week: Last week (may be partial, weekNumber=-1)
 *
 * ## Week Numbering Scheme
 *
 * - Week 1 = Onboarding (type='onboarding')
 * - Week 2, 3, 4... = Regular weeks (type='regular')
 * - Week -1 = Closing (type='closing')
 *
 * ## Position-Based Mapping
 *
 * When mapping template weeks to calendar weeks, use POSITION among regular weeks:
 *   - Filter calendar weeks to `weekNumber > 1` to get regular weeks only
 *   - Template Week 2 → position 0, Template Week 3 → position 1, etc.
 *
 * This logic is used in:
 * - ModuleWeeksSidebar.tsx (frontend week selection)
 * - program-utils.ts (backend distribution functions)
 */

import type { Program, ProgramEnrollment } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export type CalendarWeekType = 'onboarding' | 'regular' | 'closing';

export interface CalendarWeek {
  /** Type of week: onboarding (first), regular (middle), closing (last) */
  type: CalendarWeekType;
  /** Display label: "Week 1", "Week 2", "Closing" */
  label: string;
  /**
   * Week number: 1 for onboarding, 2+ for regular, -1 for closing.
   * IMPORTANT: When filtering for regular weeks (not onboarding or closing), use `weekNumber > 1`
   * to exclude both onboarding (1) AND closing (-1).
   */
  weekNumber: number;
  /** ISO date string for first day of this week (Monday or enrollment date) */
  startDate: string;
  /** ISO date string for last day of this week (Friday or program end date) */
  endDate: string;
  /** First program day index in this week (1-based) */
  startDayIndex: number;
  /** Last program day index in this week (1-based) */
  endDayIndex: number;
  /** Number of active program days in this week (1-5 for weekdays-only, 1-7 with weekends) */
  dayCount: number;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Format a Date object to ISO date string (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse an ISO date string to a Date object at midnight local time
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get the next Monday on or after the given date
 */
function getNextMonday(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  if (dayOfWeek === 0) {
    // Sunday -> next day is Monday
    result.setDate(result.getDate() + 1);
  } else if (dayOfWeek !== 1) {
    // Not Monday -> advance to next Monday
    result.setDate(result.getDate() + (8 - dayOfWeek));
  }
  return result;
}

/**
 * Get the Friday of the week containing the given date
 */
function getFridayOfWeek(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  if (dayOfWeek === 0) {
    // Sunday -> Friday is 5 days ahead
    result.setDate(result.getDate() + 5);
  } else if (dayOfWeek === 6) {
    // Saturday -> Friday is 6 days ahead (next week)
    result.setDate(result.getDate() + 6);
  } else {
    // Mon-Fri -> Friday is (5 - dayOfWeek) days ahead
    result.setDate(result.getDate() + (5 - dayOfWeek));
  }
  return result;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Count weekdays between two dates (inclusive)
 */
function countWeekdaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Count all days between two dates (inclusive)
 */
function countDaysBetween(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calculate all calendar weeks for an enrollment.
 *
 * @param enrollmentStartDate - ISO date string when enrollment starts
 * @param programLengthDays - Total program days (content days, not calendar days)
 * @param includeWeekends - Whether program includes weekend days (default: true)
 * @returns Array of CalendarWeek objects
 *
 * @example
 * // 15-day program, join Thursday, weekends off
 * calculateCalendarWeeks('2024-12-05', 15, false)
 * // Returns:
 * // [
 * //   { type: 'onboarding', label: 'Onboarding', dayCount: 2, ... },
 * //   { type: 'regular', label: 'Week 1', dayCount: 5, ... },
 * //   { type: 'regular', label: 'Week 2', dayCount: 5, ... },
 * //   { type: 'closing', label: 'Closing', dayCount: 3, ... },
 * // ]
 */
export function calculateCalendarWeeks(
  enrollmentStartDate: string,
  programLengthDays: number,
  includeWeekends: boolean = true
): CalendarWeek[] {
  const weeks: CalendarWeek[] = [];
  const startDate = parseDate(enrollmentStartDate);
  const startDayOfWeek = startDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Handle weekend enrollment - push effective start to Monday
  let effectiveStartDate = startDate;
  if (!includeWeekends && (startDayOfWeek === 0 || startDayOfWeek === 6)) {
    const daysUntilMonday = startDayOfWeek === 0 ? 1 : 2;
    effectiveStartDate = addDays(startDate, daysUntilMonday);
  }

  const daysPerWeek = includeWeekends ? 7 : 5;

  // Calculate days remaining in first week (until Friday for weekdays-only, until Sunday for weekends)
  const effectiveDayOfWeek = effectiveStartDate.getDay();
  let daysInFirstWeek: number;

  if (includeWeekends) {
    // Days until Sunday (end of week)
    daysInFirstWeek = effectiveDayOfWeek === 0 ? 1 : 8 - effectiveDayOfWeek;
  } else {
    // Days until Friday (Mon=1 means 5 days, Thu=4 means 2 days, Fri=5 means 1 day)
    daysInFirstWeek = 6 - effectiveDayOfWeek;
    if (daysInFirstWeek <= 0) daysInFirstWeek = 1; // Handle edge case
  }

  // Cap first week days to program length
  const onboardingDays = Math.min(daysInFirstWeek, programLengthDays);

  // Calculate end date for onboarding week
  const onboardingEndDate = addDays(effectiveStartDate, onboardingDays - 1);
  // Adjust for weekends if needed
  let actualOnboardingEndDate = onboardingEndDate;
  if (!includeWeekends) {
    // Count forward from start, skipping weekends
    let daysToAdd = onboardingDays - 1;
    actualOnboardingEndDate = new Date(effectiveStartDate);
    while (daysToAdd > 0) {
      actualOnboardingEndDate = addDays(actualOnboardingEndDate, 1);
      if (!isWeekend(actualOnboardingEndDate)) {
        daysToAdd--;
      }
    }
  }

  // Onboarding Week (weekNumber=1, but labeled "Onboarding")
  // Note: Onboarding is now weekNumber=1 (not 0), but we still display it as "Onboarding"
  // for clarity. This simplifies calculations while keeping clear UX.
  weeks.push({
    type: 'onboarding',
    label: 'Onboarding',
    weekNumber: 1,
    startDate: formatDate(effectiveStartDate),
    endDate: formatDate(actualOnboardingEndDate),
    startDayIndex: 1,
    endDayIndex: onboardingDays,
    dayCount: onboardingDays,
  });

  // If program is only onboarding week, mark it as closing too
  if (onboardingDays >= programLengthDays) {
    // Update to be both onboarding and closing (keep "Onboarding" label)
    weeks[0].type = 'closing';
    // Label stays as "Onboarding" for single-week programs
    return weeks;
  }

  // Calculate remaining weeks (starting from Week 2)
  let currentDayIndex = onboardingDays + 1;
  // Week 2 comes after onboarding (Week 1)
  // If onboarding was a full week, we still call it Week 1, next is Week 2
  // If onboarding was partial, next full week is still Week 2
  let weekNumber = 2;
  let currentMonday = getNextMonday(actualOnboardingEndDate);

  while (currentDayIndex <= programLengthDays) {
    const daysRemaining = programLengthDays - currentDayIndex + 1;
    const daysInThisWeek = Math.min(daysPerWeek, daysRemaining);
    const isLastWeek = currentDayIndex + daysInThisWeek > programLengthDays;

    // Calculate end date for this week
    let weekEndDate: Date;
    if (!includeWeekends) {
      // Count forward from Monday, skipping weekends
      weekEndDate = new Date(currentMonday);
      let daysToAdd = daysInThisWeek - 1;
      while (daysToAdd > 0) {
        weekEndDate = addDays(weekEndDate, 1);
        if (!isWeekend(weekEndDate)) {
          daysToAdd--;
        }
      }
    } else {
      weekEndDate = addDays(currentMonday, daysInThisWeek - 1);
    }

    weeks.push({
      type: isLastWeek ? 'closing' : 'regular',
      label: isLastWeek ? 'Closing' : `Week ${weekNumber}`,
      weekNumber: isLastWeek ? -1 : weekNumber,
      startDate: formatDate(currentMonday),
      endDate: formatDate(weekEndDate),
      startDayIndex: currentDayIndex,
      endDayIndex: Math.min(currentDayIndex + daysInThisWeek - 1, programLengthDays),
      dayCount: daysInThisWeek,
    });

    currentDayIndex += daysInThisWeek;
    if (!isLastWeek) {
      weekNumber++;
    }
    currentMonday = addDays(currentMonday, 7);
  }

  return weeks;
}

/**
 * Get the calendar week containing a specific program day.
 *
 * @param enrollmentStartDate - ISO date string when enrollment starts
 * @param dayIndex - Program day index (1-based)
 * @param programLengthDays - Total program days
 * @param includeWeekends - Whether program includes weekend days
 * @returns CalendarWeek containing the specified day, or null if day is out of range
 */
export function getCalendarWeekForDay(
  enrollmentStartDate: string,
  dayIndex: number,
  programLengthDays: number,
  includeWeekends: boolean = true
): CalendarWeek | null {
  if (dayIndex < 1 || dayIndex > programLengthDays) {
    return null;
  }

  const weeks = calculateCalendarWeeks(enrollmentStartDate, programLengthDays, includeWeekends);
  return weeks.find(week => dayIndex >= week.startDayIndex && dayIndex <= week.endDayIndex) || null;
}

/**
 * Get the current calendar week for an enrollment based on today's date.
 *
 * @param enrollment - ProgramEnrollment object
 * @param program - Program object
 * @param todayDate - Optional override for today's date (for testing)
 * @returns Current CalendarWeek, or null if program hasn't started or is complete
 */
export function getCurrentCalendarWeek(
  enrollment: ProgramEnrollment,
  program: Program,
  todayDate?: string
): CalendarWeek | null {
  const today = todayDate ? parseDate(todayDate) : new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = parseDate(enrollment.startedAt);
  const includeWeekends = program.includeWeekends !== false;

  // Program hasn't started yet
  if (today < startDate) {
    return null;
  }

  // Calculate current day index
  let currentDayIndex: number;
  if (includeWeekends) {
    currentDayIndex = countDaysBetween(startDate, today);
  } else {
    currentDayIndex = countWeekdaysBetween(startDate, today);
  }

  // Cap at program length
  if (currentDayIndex > program.lengthDays) {
    currentDayIndex = program.lengthDays;
  }

  return getCalendarWeekForDay(
    enrollment.startedAt,
    currentDayIndex,
    program.lengthDays,
    includeWeekends
  );
}

/**
 * Map a program day index to a calendar date.
 *
 * @param enrollmentStartDate - ISO date string when enrollment starts
 * @param dayIndex - Program day index (1-based)
 * @param includeWeekends - Whether program includes weekend days
 * @returns Date object for the specified program day
 */
export function dayIndexToDate(
  enrollmentStartDate: string,
  dayIndex: number,
  includeWeekends: boolean = true
): Date {
  const startDate = parseDate(enrollmentStartDate);

  // Handle weekend enrollment for weekdays-only programs
  let effectiveStartDate = startDate;
  if (!includeWeekends && isWeekend(startDate)) {
    const dayOfWeek = startDate.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
    effectiveStartDate = addDays(startDate, daysUntilMonday);
  }

  if (includeWeekends) {
    // Simple: just add days
    return addDays(effectiveStartDate, dayIndex - 1);
  } else {
    // Skip weekends
    let currentDate = new Date(effectiveStartDate);
    let daysToGo = dayIndex - 1;

    while (daysToGo > 0) {
      currentDate = addDays(currentDate, 1);
      if (!isWeekend(currentDate)) {
        daysToGo--;
      }
    }

    return currentDate;
  }
}

/**
 * Map a calendar date to a program day index.
 *
 * @param enrollmentStartDate - ISO date string when enrollment starts
 * @param targetDate - Date to find the day index for
 * @param includeWeekends - Whether program includes weekend days
 * @returns Program day index (1-based), or 0 if before start, or -1 if on weekend (for weekdays-only)
 */
export function dateToDayIndex(
  enrollmentStartDate: string,
  targetDate: Date,
  includeWeekends: boolean = true
): number {
  const startDate = parseDate(enrollmentStartDate);

  // Handle weekend enrollment for weekdays-only programs
  let effectiveStartDate = startDate;
  if (!includeWeekends && isWeekend(startDate)) {
    const dayOfWeek = startDate.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
    effectiveStartDate = addDays(startDate, daysUntilMonday);
  }

  // Before program start
  if (targetDate < effectiveStartDate) {
    return 0;
  }

  // On weekend for weekdays-only program
  if (!includeWeekends && isWeekend(targetDate)) {
    return -1;
  }

  if (includeWeekends) {
    return countDaysBetween(effectiveStartDate, targetDate);
  } else {
    return countWeekdaysBetween(effectiveStartDate, targetDate);
  }
}

/**
 * Get a display-friendly week label.
 *
 * @param week - CalendarWeek object
 * @returns Display string like "Onboarding (2 days)" or "Week 1"
 */
export function getWeekLabel(week: CalendarWeek, includeDayCount: boolean = false): string {
  if (includeDayCount && week.dayCount < 5) {
    return `${week.label} (${week.dayCount} day${week.dayCount !== 1 ? 's' : ''})`;
  }
  return week.label;
}

/**
 * Get the day labels for a calendar week (e.g., "Mon", "Tue", etc.)
 *
 * @param week - CalendarWeek object
 * @param includeWeekends - Whether program includes weekend days
 * @returns Array of day abbreviations
 */
export function getWeekDayLabels(
  week: CalendarWeek,
  includeWeekends: boolean = true
): string[] {
  const allDays = includeWeekends
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const startDate = parseDate(week.startDate);
  const labels: string[] = [];

  for (let i = 0; i < week.dayCount; i++) {
    const date = addDays(startDate, i);
    // Skip weekends for weekdays-only
    if (!includeWeekends && isWeekend(date)) {
      continue;
    }
    const dayOfWeek = date.getDay();
    labels.push(allDays[includeWeekends ? dayOfWeek : dayOfWeek - 1]);
  }

  return labels;
}

/**
 * Calculate total calendar weeks for a program enrollment.
 *
 * @param enrollmentStartDate - ISO date string when enrollment starts
 * @param programLengthDays - Total program days
 * @param includeWeekends - Whether program includes weekend days
 * @returns Total number of calendar weeks
 */
export function calculateTotalCalendarWeeks(
  enrollmentStartDate: string,
  programLengthDays: number,
  includeWeekends: boolean = true
): number {
  return calculateCalendarWeeks(enrollmentStartDate, programLengthDays, includeWeekends).length;
}

/**
 * Calculate the program week and day indices for a given target date.
 *
 * Given an instance/enrollment start date and a target date (e.g., when a call is scheduled),
 * this function determines which program week and day the target date falls on.
 *
 * @param instanceStartDate - ISO date string when the program instance started
 * @param targetDate - ISO date string for the date to locate (e.g., call date)
 * @param totalDays - Total program days (content days, not calendar days)
 * @param includeWeekends - Whether program includes weekend days
 * @returns Object with weekIndex (0-based), dayIndex (1-7 within week), globalDayIndex (1-based across program)
 *          Returns null if target date is outside the program range or on a weekend for weekday-only programs
 *
 * @example
 * // Program starts Jan 1, call scheduled for Jan 8 (weekdays only)
 * calculateProgramDayForDate('2024-01-01', '2024-01-08', 30, false)
 * // Returns: { weekIndex: 1, dayIndex: 1, globalDayIndex: 6 }
 */
export function calculateProgramDayForDate(
  instanceStartDate: string,
  targetDate: string,
  totalDays: number,
  includeWeekends: boolean
): { weekIndex: number; dayIndex: number; globalDayIndex: number } | null {
  // Get the global day index for the target date
  const targetDateObj = parseDate(targetDate);
  const globalDayIndex = dateToDayIndex(instanceStartDate, targetDateObj, includeWeekends);

  // Check if target is before program start or on weekend for weekday-only programs
  if (globalDayIndex <= 0) {
    return null;
  }

  // Check if target is beyond program end
  if (globalDayIndex > totalDays) {
    return null;
  }

  // Get all calendar weeks to find which week this day falls in
  const calendarWeeks = calculateCalendarWeeks(instanceStartDate, totalDays, includeWeekends);

  // Find the week that contains this global day index
  for (let weekIdx = 0; weekIdx < calendarWeeks.length; weekIdx++) {
    const week = calendarWeeks[weekIdx];
    if (globalDayIndex >= week.startDayIndex && globalDayIndex <= week.endDayIndex) {
      // Calculate day index within the week (1-based)
      const dayIndexInWeek = globalDayIndex - week.startDayIndex + 1;
      return {
        weekIndex: weekIdx,
        dayIndex: dayIndexInWeek,
        globalDayIndex: globalDayIndex,
      };
    }
  }

  // Should not reach here if weeks are calculated correctly
  return null;
}
