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

