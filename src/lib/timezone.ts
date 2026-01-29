/**
 * Timezone Utilities for Notification Scheduling
 * 
 * These utilities help determine the local time for users in different timezones
 * so we can send notifications at the appropriate local time.
 */

export const DEFAULT_TIMEZONE = 'UTC';

// Notification target hours (24-hour format)
export const MORNING_NOTIFICATION_HOUR = 7;  // 7:00 AM local
export const EVENING_NOTIFICATION_HOUR = 17; // 5:00 PM local
export const WEEKEND_NOTIFICATION_HOUR = 9;  // 9:00 AM local (for weekly reflection)

/**
 * Get the current hour in a specific timezone
 * @param timezone IANA timezone string (e.g., "Europe/Amsterdam", "America/New_York")
 * @returns The current hour (0-23) in that timezone
 */
export function getCurrentHourInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find(p => p.type === 'hour');
    return parseInt(hourPart?.value || '0', 10);
  } catch (_error) {
    console.warn(`[TIMEZONE] Invalid timezone "${timezone}", falling back to UTC`);
    return new Date().getUTCHours();
  }
}

/**
 * Get the current day of week in a specific timezone
 * @param timezone IANA timezone string
 * @returns The current day of week (0 = Sunday, 6 = Saturday)
 */
export function getCurrentDayInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    });
    
    const weekday = formatter.format(new Date());
    const dayMap: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    return dayMap[weekday] ?? new Date().getDay();
  } catch (_error) {
    console.warn(`[TIMEZONE] Invalid timezone "${timezone}", falling back to UTC`);
    return new Date().getUTCDay();
  }
}

/**
 * Get the current date string (YYYY-MM-DD) in a specific timezone
 * This is important for checking if notifications have already been sent "today"
 * in the user's local time.
 * @param timezone IANA timezone string
 * @returns Date string in YYYY-MM-DD format
 */
export function getTodayInTimezone(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    return formatter.format(new Date());
  } catch (_error) {
    console.warn(`[TIMEZONE] Invalid timezone "${timezone}", falling back to UTC`);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Check if now is the right time to send a morning notification
 * @param timezone User's timezone
 * @returns true if the current hour in user's timezone is the morning notification hour
 */
export function isMorningNotificationTime(timezone: string): boolean {
  const currentHour = getCurrentHourInTimezone(timezone || DEFAULT_TIMEZONE);
  return currentHour === MORNING_NOTIFICATION_HOUR;
}

/**
 * Check if now is the right time to send an evening notification  
 * @param timezone User's timezone
 * @returns true if the current hour in user's timezone is the evening notification hour
 */
export function isEveningNotificationTime(timezone: string): boolean {
  const currentHour = getCurrentHourInTimezone(timezone || DEFAULT_TIMEZONE);
  return currentHour === EVENING_NOTIFICATION_HOUR;
}

/**
 * Check if now is the right time to send a weekly reflection notification
 * (Saturday or Sunday at the target hour)
 * @param timezone User's timezone
 * @returns true if it's a weekend and the current hour matches
 */
export function isWeekendNotificationTime(timezone: string): boolean {
  const tz = timezone || DEFAULT_TIMEZONE;
  const currentHour = getCurrentHourInTimezone(tz);
  const currentDay = getCurrentDayInTimezone(tz);
  
  // Saturday (6) or Sunday (0) at the target hour
  const isWeekend = currentDay === 0 || currentDay === 6;
  const isTargetHour = currentHour === WEEKEND_NOTIFICATION_HOUR;
  
  return isWeekend && isTargetHour;
}

/**
 * Check if it's Friday in the user's timezone
 * Used for sending weekly reflection after Friday evening check-in
 * @param timezone User's timezone
 * @returns true if it's Friday
 */
export function isFridayInTimezone(timezone: string): boolean {
  const currentDay = getCurrentDayInTimezone(timezone || DEFAULT_TIMEZONE);
  return currentDay === 5; // Friday
}

/**
 * Check if it's a weekend (Saturday or Sunday) in the user's timezone
 * Used for disabling daily check-ins on weekends
 * @param timezone User's timezone
 * @returns true if it's Saturday or Sunday
 */
export function isWeekendInTimezone(timezone: string): boolean {
  const currentDay = getCurrentDayInTimezone(timezone || DEFAULT_TIMEZONE);
  return currentDay === 0 || currentDay === 6; // Sunday or Saturday
}

/**
 * Get a debug string showing the current time in a timezone
 * Useful for logging and debugging
 */
export function getDebugTimeString(timezone: string): string {
  try {
    const tz = timezone || DEFAULT_TIMEZONE;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${formatter.format(new Date())} (${tz})`;
  } catch {
    return `UTC ${new Date().getUTCHours()}:${new Date().getUTCMinutes().toString().padStart(2, '0')}`;
  }
}

// ============================================================================
// Date utilities for alignment (moved here to avoid circular imports)
// ============================================================================

/**
 * Get today's date in YYYY-MM-DD format
 * Uses timezone-aware calculation when timezone is provided
 * @param timezone Optional IANA timezone string (e.g., "Europe/Amsterdam")
 */
export function getTodayDate(timezone?: string): string {
  if (timezone) {
    return getTodayInTimezone(timezone);
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 * @param timezone Optional IANA timezone string
 */
export function getYesterdayDate(timezone?: string): string {
  const today = getTodayDate(timezone);
  const date = new Date(today + 'T12:00:00'); // Use noon to avoid DST issues
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * Get the browser's current timezone
 * Safe to use on client-side only
 * @returns IANA timezone string (e.g., "America/New_York")
 */
export function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}






