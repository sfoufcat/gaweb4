'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import type { UserAlignment, UserAlignmentSummary, AlignmentState } from '@/types';

const ALIGNMENT_CACHE_KEY = '/api/alignment';

interface AlignmentResponse {
  alignment: UserAlignment;
  summary: UserAlignmentSummary;
}

interface UseAlignmentReturn extends AlignmentState {
  refresh: () => Promise<void>;
  updateAlignment: (updates: {
    didMorningCheckin?: boolean;
    didSetTasks?: boolean;
    didInteractWithSquad?: boolean;
    hasActiveGoal?: boolean;
  }) => Promise<void>;
}

/**
 * Hook for managing daily alignment state with SWR caching
 * 
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Optimistic updates for alignment changes
 * - Background revalidation for fresh data
 */
export function useAlignment(): UseAlignmentReturn {
  const { data, error, isLoading, mutate } = useSWR<AlignmentResponse>(
    ALIGNMENT_CACHE_KEY,
    async (url: string) => {
      const response = await fetch(url);
      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to fetch alignment');
      }
      
      return responseData;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const alignment = data?.alignment ?? null;
  const summary = data?.summary ?? null;

  // Refresh alignment from server
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Update alignment with optimistic update
  const updateAlignment = useCallback(async (updates: {
    didMorningCheckin?: boolean;
    didSetTasks?: boolean;
    didInteractWithSquad?: boolean;
    hasActiveGoal?: boolean;
  }) => {
    if (!alignment) return;

    // Calculate optimistic state
    const updatedAlignment = { ...alignment };
    if (updates.didMorningCheckin !== undefined) {
      updatedAlignment.didMorningCheckin = updates.didMorningCheckin;
    }
    if (updates.didSetTasks !== undefined) {
      updatedAlignment.didSetTasks = updates.didSetTasks;
    }
    if (updates.didInteractWithSquad !== undefined) {
      updatedAlignment.didInteractWithSquad = updates.didInteractWithSquad;
    }
    if (updates.hasActiveGoal !== undefined) {
      updatedAlignment.hasActiveGoal = updates.hasActiveGoal;
    }
    
    // Recalculate score
    let score = 0;
    if (updatedAlignment.didMorningCheckin) score += 25;
    if (updatedAlignment.didSetTasks) score += 25;
    if (updatedAlignment.didInteractWithSquad) score += 25;
    if (updatedAlignment.hasActiveGoal) score += 25;
    updatedAlignment.alignmentScore = score;
    updatedAlignment.fullyAligned = score === 100;

    try {
      // Optimistically update cache
      await mutate(
        { alignment: updatedAlignment, summary: summary! },
        { revalidate: false }
      );

      // Send update to server
      const response = await fetch('/api/alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to update alignment');
      }

      // Update with server response
      await mutate(
        { alignment: responseData.alignment, summary: responseData.summary },
        { revalidate: false }
      );
    } catch (err) {
      console.error('Error updating alignment:', err);
      // Revalidate from server on error
      await mutate();
    }
  }, [alignment, summary, mutate]);

  return {
    alignment,
    summary,
    isLoading: isLoading && !data,
    error: error?.message ?? null,
    refresh,
    updateAlignment,
  };
}

/**
 * Utility function to track squad interaction
 * Call this when user sends a message in squad chat
 */
export async function trackSquadInteraction(): Promise<void> {
  try {
    await fetch('/api/alignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ didInteractWithSquad: true }),
    });
  } catch (err) {
    console.error('Error tracking squad interaction:', err);
  }
}
