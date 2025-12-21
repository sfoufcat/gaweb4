'use client';

import useSWR from 'swr';

export interface ProgramPrompt {
  title: string;
  description: string;
}

interface UseProgramPromptReturn {
  /** The prompt for today (null while loading) */
  prompt: ProgramPrompt | null;
  /** Program name if user has active enrollment */
  programName: string | null;
  /** Current day in program (null if no enrollment) */
  currentDay: number | null;
  /** Total days in program (null if no enrollment) */
  totalDays: number | null;
  /** Whether user has an active program enrollment */
  hasEnrollment: boolean;
  /** Whether the prompt is still loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}

/**
 * Hook for getting program-specific prompts for the Dynamic Section
 * 
 * Fetches the daily prompt from the user's active program enrollment.
 * Falls back to generic prompts if no active enrollment.
 * 
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Background revalidation for fresh data
 */
export function useProgramPrompt(): UseProgramPromptReturn {
  const { data, error, isLoading } = useSWR<{
    success: boolean;
    hasEnrollment: boolean;
    prompt: ProgramPrompt | null;
    programName: string | null;
    currentDay: number | null;
    totalDays?: number | null;
  }>(
    '/api/programs/today-prompt',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch prompt');
      }
      return response.json();
    },
    {
      // Prompts are day-based, cache for 1 hour
      dedupingInterval: 60 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  return {
    prompt: data?.prompt ?? null,
    programName: data?.programName ?? null,
    currentDay: data?.currentDay ?? null,
    totalDays: data?.totalDays ?? null,
    hasEnrollment: data?.hasEnrollment ?? false,
    isLoading: isLoading && !data,
    error: error?.message ?? null,
  };
}

