/**
 * Hook to check organization transcription credits availability
 *
 * Used to warn users before joining non-program calls when
 * the organization has no credits for summary generation.
 */

import useSWR from 'swr';

interface OrgCreditsData {
  hasCredits: boolean;
  remainingMinutes: number;
}

interface UseOrgCreditsResult {
  data: OrgCreditsData | null;
  isLoading: boolean;
  error: Error | null;
  hasCredits: boolean;
}

const fetcher = async (url: string): Promise<OrgCreditsData> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch org credits');
  }
  return res.json();
};

/**
 * Fetch organization transcription credits status
 *
 * @param enabled - Whether to fetch (default: true)
 * @returns Organization credits data and loading state
 */
export function useOrgCredits(enabled: boolean = true): UseOrgCreditsResult {
  const { data, error, isLoading } = useSWR<OrgCreditsData>(
    enabled ? '/api/scheduling/org-credits' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  return {
    data: data ?? null,
    isLoading,
    error: error ?? null,
    hasCredits: data?.hasCredits ?? true, // Default to true to avoid false warnings
  };
}
