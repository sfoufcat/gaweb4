/**
 * useClientCallSummaries Hook
 *
 * Fetches call summaries for a client's program enrollment.
 */

import useSWR from 'swr';
import type { CallSummary } from '@/types';

interface CallSummariesResponse {
  summaries: CallSummary[];
  totalCount: number;
}

const fetcher = async (url: string): Promise<CallSummariesResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch call summaries');
  }
  return res.json();
};

export function useClientCallSummaries(
  programId: string | undefined,
  enrollmentId?: string,
  limit: number = 5
) {
  const { data, error, isLoading, mutate } = useSWR<CallSummariesResponse>(
    programId
      ? `/api/programs/${programId}/call-summaries?limit=${limit}${enrollmentId ? `&enrollmentId=${enrollmentId}` : ''}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    summaries: data?.summaries || [],
    totalCount: data?.totalCount || 0,
    isLoading,
    error,
    mutate,
  };
}
