/**
 * Program Client Utilities
 *
 * Client-safe utility functions for program calculations.
 * These functions do NOT import firebase-admin and can be used in client components.
 */

import type { ProgramEnrollment, StarterProgramEnrollment } from '@/types';

/**
 * Check if a date falls on a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Count the number of weekdays between two dates (inclusive)
 */
export function countWeekdaysBetween(startDate: Date, endDate: Date): number {
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
 * Get the active cycle number for an enrollment
 */
export function getActiveCycleNumber(enrollment: ProgramEnrollment | StarterProgramEnrollment): number {
  return (enrollment as ProgramEnrollment).currentCycleNumber || 1;
}

/**
 * Calculate what day of the program a user is on based on enrollment
 *
 * @param enrollmentStartedAt - ISO string of when enrollment started
 * @param programLengthDays - Total days in the program
 * @param includeWeekends - Whether weekends count as program days
 * @param cycleNumber - Current cycle number (for evergreen programs)
 * @param cycleStartedAt - Optional ISO string of when current cycle started
 * @param todayDate - Optional override for today's date (for testing)
 * @returns Object with dayIndex and whether rollover should occur
 */
export function calculateProgramDayIndex(
  enrollmentStartedAt: string,
  programLengthDays: number,
  includeWeekends: boolean,
  cycleNumber: number,
  cycleStartedAt?: string,
  todayDate?: string
): { dayIndex: number; shouldRollover: boolean } {
  const today = todayDate || new Date().toISOString().split('T')[0];

  // Use cycle start date if available (for cycles > 1), otherwise use enrollment start
  const effectiveStartDate = cycleNumber > 1 && cycleStartedAt
    ? cycleStartedAt.split('T')[0]
    : enrollmentStartedAt;

  const startDate = new Date(effectiveStartDate + 'T00:00:00');
  const todayDateObj = new Date(today + 'T00:00:00');

  let dayIndex: number;

  if (includeWeekends) {
    // Simple day count
    const elapsedMs = todayDateObj.getTime() - startDate.getTime();
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    dayIndex = elapsedDays + 1;
  } else {
    // Count only weekdays
    dayIndex = countWeekdaysBetween(startDate, todayDateObj);
  }

  // Check if we need to roll over to next cycle
  const shouldRollover = dayIndex > programLengthDays;

  // Cap at program length (will trigger rollover for evergreen)
  return {
    dayIndex: Math.min(dayIndex, programLengthDays),
    shouldRollover,
  };
}
