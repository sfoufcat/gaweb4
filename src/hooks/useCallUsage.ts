'use client';

import useSWR from 'swr';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface CallUsageData {
  // Monthly allowance
  monthlyAllowance: number;
  callsUsedInWindow: number;
  callsRemaining: number;
  windowResetDate: string;
  daysUntilReset: number;
  // Weekly limit (optional)
  weeklyLimit: number | null;
  callsThisWeek: number;
  weeklyRemaining: number | null;
  weekResetDate: string;
  // Extra call pricing
  pricePerExtraCallCents: number | null;
  // Booking mode
  callBookingMode: 'propose' | 'direct';
  // Program info
  programId: string;
  programName: string;
  enrollmentId: string;
}

export interface UseCallUsageResult {
  usage: CallUsageData | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
  // Derived helpers
  canScheduleProgramCall: boolean;
  isWeeklyLimitReached: boolean;
  hasAllowance: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// FETCHER
// ═══════════════════════════════════════════════════════════════════════════

const fetcher = async (url: string): Promise<CallUsageData> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch call usage' }));
    throw new Error(error.error || 'Failed to fetch call usage');
  }
  return res.json();
};

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook to fetch the client's call usage for a program enrollment
 *
 * @param enrollmentId - The program enrollment ID
 * @param enabled - Whether to enable fetching (default: true)
 * @returns Call usage data with derived helpers
 *
 * Usage states:
 * - canScheduleProgramCall: true if client has remaining allowance AND not at weekly limit
 * - isWeeklyLimitReached: true if weekly limit exists and reached
 * - hasAllowance: true if program has any call allowance configured
 */
export function useCallUsage(
  enrollmentId: string | undefined,
  enabled: boolean = true
): UseCallUsageResult {
  const { data, error, isLoading, mutate } = useSWR<CallUsageData>(
    enabled && enrollmentId ? `/api/scheduling/call-usage?enrollmentId=${enrollmentId}` : null,
    fetcher,
    {
      // Refresh every 60 seconds
      refreshInterval: 60000,
      // Revalidate on focus
      revalidateOnFocus: true,
    }
  );

  // Derived state
  const hasAllowance = (data?.monthlyAllowance ?? 0) > 0;
  const isWeeklyLimitReached = data?.weeklyLimit !== null && data?.weeklyRemaining === 0;
  const canScheduleProgramCall =
    hasAllowance &&
    (data?.callsRemaining ?? 0) > 0 &&
    !isWeeklyLimitReached;

  return {
    usage: data ?? null,
    isLoading,
    error: error ?? null,
    mutate,
    canScheduleProgramCall,
    isWeeklyLimitReached,
    hasAllowance,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DEDUCT CALL UTILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deduct a call from the client's allowance
 * Called when a program call completes (from webhook or join)
 *
 * @param enrollmentId - The program enrollment ID
 * @param eventId - The event/call ID
 * @returns Promise with success status
 */
export async function deductCallUsage(
  enrollmentId: string,
  eventId: string
): Promise<{ success: boolean; alreadyDeducted?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/scheduling/call-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentId, eventId }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to deduct call' }));
      return { success: false, error: error.error };
    }

    const data = await res.json();
    return { success: true, alreadyDeducted: data.alreadyDeducted };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format call usage for display
 * Example: "3 of 4 remaining (resets in 12 days)"
 */
export function formatCallUsageStatus(usage: CallUsageData | null): string {
  if (!usage) return '';

  const remaining = usage.callsRemaining;
  const total = usage.monthlyAllowance;
  const days = usage.daysUntilReset;

  if (total === 0) {
    return 'No call allowance';
  }

  if (remaining === 0) {
    return `0 of ${total} remaining (resets in ${days} day${days === 1 ? '' : 's'})`;
  }

  return `${remaining} of ${total} remaining (resets in ${days} day${days === 1 ? '' : 's'})`;
}

/**
 * Format weekly limit status
 * Example: "Weekly limit reached (2/2). Next available: Monday"
 */
export function formatWeeklyLimitStatus(usage: CallUsageData | null): string | null {
  if (!usage || usage.weeklyLimit === null) return null;

  if (usage.weeklyRemaining === 0) {
    const resetDate = new Date(usage.weekResetDate);
    const dayName = resetDate.toLocaleDateString('en-US', { weekday: 'long' });
    return `Weekly limit reached (${usage.weeklyLimit}/${usage.weeklyLimit}). Next available: ${dayName}`;
  }

  return `${usage.callsThisWeek}/${usage.weeklyLimit} this week`;
}

/**
 * Format extra call price for display
 * Example: "$50.00"
 */
export function formatExtraCallPrice(priceInCents: number | null): string {
  if (priceInCents === null || priceInCents === 0) {
    return 'Contact coach';
  }

  return `$${(priceInCents / 100).toFixed(2)}`;
}
