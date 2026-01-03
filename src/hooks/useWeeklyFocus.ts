'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface UseWeeklyFocusReturn {
  /** User's full weekly focus text */
  weeklyFocus: string | null;
  /** AI-generated 2-5 word summary for display */
  weeklyFocusSummary: string | null;
  /** Whether weekly focus is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Current week number (1-based) in the program */
  currentWeek: number | null;
  /** Whether focus was auto-initialized from track defaults */
  isAutoInitialized: boolean;
  /** Refresh the weekly focus from server */
  refresh: () => Promise<void>;
}

// Demo mode mock data
const DEMO_WEEKLY_FOCUS = {
  weeklyFocus: 'Complete my morning routine every day and exercise at least 4 times this week',
  weeklyFocusSummary: 'Morning routine & exercise',
  currentWeek: 3,
  isAutoInitialized: false,
};

/**
 * Hook for accessing user's weekly focus
 * 
 * The weekly focus is:
 * 1. Stored in user.publicFocus (canonical source of truth)
 * 2. Can be set via weekly check-in
 * 3. If empty, falls back to track's weeklyFocusDefaults based on current week
 * 
 * Usage:
 * ```tsx
 * const { weeklyFocusSummary, isLoading } = useWeeklyFocus();
 * 
 * if (weeklyFocusSummary) {
 *   return <p>This week's focus: {weeklyFocusSummary}</p>;
 * }
 * ```
 */
export function useWeeklyFocus(): UseWeeklyFocusReturn {
  const { user, isLoaded } = useUser();
  const { isDemoMode } = useDemoMode();
  const [weeklyFocus, setWeeklyFocus] = useState<string | null>(null);
  const [weeklyFocusSummary, setWeeklyFocusSummary] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoInitialized, setIsAutoInitialized] = useState(false);

  const fetchWeeklyFocus = useCallback(async () => {
    // Demo mode: return mock data immediately
    if (isDemoMode) {
      setWeeklyFocus(DEMO_WEEKLY_FOCUS.weeklyFocus);
      setWeeklyFocusSummary(DEMO_WEEKLY_FOCUS.weeklyFocusSummary);
      setCurrentWeek(DEMO_WEEKLY_FOCUS.currentWeek);
      setIsAutoInitialized(DEMO_WEEKLY_FOCUS.isAutoInitialized);
      setIsLoading(false);
      return;
    }
    
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/weekly-focus');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch weekly focus');
      }

      const data = await response.json();
      setWeeklyFocus(data.weeklyFocus || null);
      setWeeklyFocusSummary(data.weeklyFocusSummary || null);
      setCurrentWeek(data.currentWeek || null);
      setIsAutoInitialized(data.isAutoInitialized || false);
    } catch (err) {
      console.error('Error fetching weekly focus:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch weekly focus');
    } finally {
      setIsLoading(false);
    }
  }, [user, isDemoMode]);

  useEffect(() => {
    // Demo mode: load mock data immediately
    if (isDemoMode) {
      fetchWeeklyFocus();
      return;
    }
    
    if (!isLoaded) return;

    if (!user) {
      setWeeklyFocus(null);
      setWeeklyFocusSummary(null);
      setCurrentWeek(null);
      setIsLoading(false);
      return;
    }

    fetchWeeklyFocus();
  }, [isLoaded, user, isDemoMode, fetchWeeklyFocus]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchWeeklyFocus();
  }, [fetchWeeklyFocus]);

  return {
    weeklyFocus,
    weeklyFocusSummary,
    isLoading,
    error,
    currentWeek,
    isAutoInitialized,
    refresh,
  };
}


