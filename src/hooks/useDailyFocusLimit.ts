'use client';

import { useOrgSettings } from './useOrgSettings';

const DEFAULT_FOCUS_LIMIT = 3;

interface UseDailyFocusLimitReturn {
  limit: number;
  isLoading: boolean;
}

/**
 * Hook to get the daily focus limit for the current organization
 * 
 * Returns the org's defaultDailyFocusSlots or falls back to 3
 * This is the hard cap for all users in the org.
 * 
 * Usage:
 * ```tsx
 * const { limit, isLoading } = useDailyFocusLimit();
 * 
 * // limit = 3 (default) or org's configured value (1-6)
 * ```
 */
export function useDailyFocusLimit(): UseDailyFocusLimitReturn {
  const { settings, isLoading } = useOrgSettings();

  const limit = settings?.defaultDailyFocusSlots ?? DEFAULT_FOCUS_LIMIT;

  return {
    limit,
    isLoading,
  };
}

export default useDailyFocusLimit;







