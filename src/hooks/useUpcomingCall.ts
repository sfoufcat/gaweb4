'use client';

import useSWR from 'swr';
import type { UnifiedEvent } from '@/types';

export type CallState = 'none' | 'scheduled' | 'joinable';

export interface UseUpcomingCallResult {
  upcomingCall: UnifiedEvent | null;
  callState: CallState;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

interface UpcomingCallResponse {
  event: UnifiedEvent | null;
  callState: CallState;
}

const fetcher = async (url: string): Promise<UpcomingCallResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch upcoming call');
  }
  return res.json();
};

/**
 * Hook to fetch the next upcoming 1:1 coaching call for a chat channel
 *
 * @param otherUserId - The other user's ID in the DM/coaching channel
 * @param enabled - Whether to enable fetching (default: true)
 * @returns Upcoming call info with state (none, scheduled, joinable)
 *
 * Call states:
 * - 'none': No upcoming call scheduled
 * - 'scheduled': Call scheduled but more than 1 hour away
 * - 'joinable': Call is within 1 hour and can be joined
 */
export function useUpcomingCall(
  otherUserId: string | undefined,
  enabled: boolean = true
): UseUpcomingCallResult {
  const { data, error, isLoading, mutate } = useSWR<UpcomingCallResponse>(
    enabled && otherUserId ? `/api/chat/upcoming-call?otherUserId=${otherUserId}` : null,
    fetcher,
    {
      // Refresh every 30 seconds to update call state
      refreshInterval: 30000,
      // Also revalidate on focus
      revalidateOnFocus: true,
    }
  );

  return {
    upcomingCall: data?.event ?? null,
    callState: data?.callState ?? 'none',
    isLoading,
    error: error ?? null,
    mutate,
  };
}
