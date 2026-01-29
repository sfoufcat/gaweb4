import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate the correct profile URL for a user.
 * 
 * - If viewing the current user's profile, returns `/profile`
 * - If viewing another user's profile, returns `/profile/[userId]`
 * 
 * @param userId - The ID of the user whose profile to link to (optional)
 * @param currentUserId - The ID of the currently logged-in user
 * @returns The profile URL string
 */
export function getProfileUrl(userId: string | undefined, currentUserId: string): string {
  if (!userId || userId === currentUserId) {
    return '/profile';
  }
  return `/profile/${userId}`;
}

/**
 * Check if the current time is within one hour before an event starts.
 * Used to show "Join Call" button at the appropriate time.
 */
export function isWithinOneHourBefore(datetime: string | Date | undefined | null): boolean {
  if (!datetime) return false;
  const eventTime = new Date(datetime);
  if (isNaN(eventTime.getTime())) return false;
  const now = new Date();
  const oneHourBefore = new Date(eventTime.getTime() - 60 * 60 * 1000);
  return now >= oneHourBefore && now < eventTime;
}

/**
 * Check if an event has already ended (is in the past).
 * Uses endDateTime if available, otherwise calculates from startDateTime + durationMinutes.
 */
export function isPastEvent(event: { startDateTime: string; endDateTime?: string; durationMinutes?: number }): boolean {
  const endTime = event.endDateTime
    ? new Date(event.endDateTime)
    : new Date(new Date(event.startDateTime).getTime() + (event.durationMinutes || 60) * 60000);
  return endTime < new Date();
}

