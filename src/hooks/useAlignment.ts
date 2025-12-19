'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UserAlignment, UserAlignmentSummary, AlignmentState } from '@/types';

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
 * Hook for managing daily alignment state
 * Fetches alignment on mount and provides methods to refresh/update
 */
export function useAlignment(): UseAlignmentReturn {
  const [alignment, setAlignment] = useState<UserAlignment | null>(null);
  const [summary, setSummary] = useState<UserAlignmentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch alignment state
  const fetchAlignment = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/alignment');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch alignment');
      }

      setAlignment(data.alignment);
      setSummary(data.summary);
    } catch (err) {
      console.error('Error fetching alignment:', err);
      setError(err instanceof Error ? err.message : 'Failed to load alignment');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update alignment
  const updateAlignment = useCallback(async (updates: {
    didMorningCheckin?: boolean;
    didSetTasks?: boolean;
    didInteractWithSquad?: boolean;
    hasActiveGoal?: boolean;
  }) => {
    try {
      // Optimistically update state
      if (alignment) {
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
        
        setAlignment(updatedAlignment);
      }

      // Send update to server
      const response = await fetch('/api/alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update alignment');
      }

      // Update with server response
      setAlignment(data.alignment);
      setSummary(data.summary);
    } catch (err) {
      console.error('Error updating alignment:', err);
      // Refresh from server on error
      await fetchAlignment();
    }
  }, [alignment, fetchAlignment]);

  // Fetch on mount
  useEffect(() => {
    fetchAlignment();
  }, [fetchAlignment]);

  // Refetch when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      fetchAlignment();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchAlignment]);

  return {
    alignment,
    summary,
    isLoading,
    error,
    refresh: fetchAlignment,
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

