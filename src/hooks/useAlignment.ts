'use client';

import useSWR from 'swr';
import { useCallback, useMemo } from 'react';
import type { UserAlignment, UserAlignmentSummary, AlignmentState, AlignmentActivityConfig } from '@/types';
import { DEFAULT_ALIGNMENT_CONFIG } from '@/types';
import { useDemoMode } from '@/contexts/DemoModeContext';

const ALIGNMENT_CACHE_KEY = '/api/alignment';

interface AlignmentResponse {
  alignment: UserAlignment;
  summary: UserAlignmentSummary;
  alignmentConfig: AlignmentActivityConfig;
}

interface UseAlignmentReturn extends AlignmentState {
  alignmentConfig: AlignmentActivityConfig;
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
  const { isDemoMode } = useDemoMode();
  
  // Demo alignment data with 100% alignment and streak of 12
  const demoAlignment = useMemo((): AlignmentResponse => ({
    alignment: {
      id: 'demo-alignment',
      userId: 'demo-user',
      organizationId: 'demo-org',
      date: new Date().toISOString().split('T')[0],
      didMorningCheckin: true,
      didSetTasks: true,
      didInteractWithSquad: true,
      hasActiveGoal: true,
      didEveningCheckin: true,
      didCompleteTasks: true,
      didCompleteHabits: true,
      alignmentScore: 100,
      fullyAligned: true,
      streakOnThisDay: 12,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    summary: {
      id: 'demo-alignment-summary',
      userId: 'demo-user',
      organizationId: 'demo-org',
      currentStreak: 12,
      lastAlignedDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    },
    alignmentConfig: DEFAULT_ALIGNMENT_CONFIG,
  }), []);
  
  const { data, error, isLoading, mutate } = useSWR<AlignmentResponse>(
    isDemoMode ? null : ALIGNMENT_CACHE_KEY, // Skip API call in demo mode
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

  const alignment = isDemoMode ? demoAlignment.alignment : (data?.alignment ?? null);
  const summary = isDemoMode ? demoAlignment.summary : (data?.summary ?? null);
  const alignmentConfig = isDemoMode ? demoAlignment.alignmentConfig : (data?.alignmentConfig ?? DEFAULT_ALIGNMENT_CONFIG);

  // Refresh alignment from server
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Update alignment with optimistic update
  // Note: Score calculation is delegated to the server since it depends on org config
  const updateAlignment = useCallback(async (updates: {
    didMorningCheckin?: boolean;
    didSetTasks?: boolean;
    didInteractWithSquad?: boolean;
    hasActiveGoal?: boolean;
  }) => {
    if (!alignment) return;

    // Optimistic flag updates only - server calculates actual score
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

    try {
      // Optimistically update cache with flag changes
      // Score will be corrected by server response
      await mutate(
        { alignment: updatedAlignment, summary: summary!, alignmentConfig },
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

      // Update with server response (includes correct score based on org config)
      await mutate(
        { alignment: responseData.alignment, summary: responseData.summary, alignmentConfig: responseData.alignmentConfig || alignmentConfig },
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
    alignmentConfig,
    isLoading: isDemoMode ? false : (isLoading && !data),
    error: isDemoMode ? null : (error?.message ?? null),
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
