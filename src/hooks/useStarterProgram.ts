'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';
import type { UserTrack, StarterProgramEnrollment } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface ProgramProgress {
  currentDay: number;
  totalDays: number;
  percentage: number;
  lastAssignedDay: number;
}

interface ProgramInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  lengthDays: number;
  track: UserTrack;
}

interface EnrollmentResponse {
  hasEnrollment: boolean;
  enrollment: StarterProgramEnrollment | null;
  program: ProgramInfo | null;
  progress: ProgramProgress | null;
}

interface SyncResult {
  success: boolean;
  tasksCreated: number;
  focusTasksCreated: number;
  backlogTasksCreated: number;
  currentDayIndex: number;
  enrollmentId: string | null;
  programName: string | null;
  message: string;
}

interface UseStarterProgramReturn {
  // State
  /** Whether user has an active enrollment */
  hasEnrollment: boolean;
  /** The active enrollment (if any) */
  enrollment: StarterProgramEnrollment | null;
  /** The program details (if enrolled) */
  program: ProgramInfo | null;
  /** Progress through the program */
  progress: ProgramProgress | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;

  // Computed
  /** Program badge text (e.g., "Creator starter program") */
  programBadge: string | null;
  /** Habit label for the track (e.g., "Creator habits") */
  habitLabel: string;
  /** Track display name (e.g., "Creator") */
  trackDisplayName: string;
  /** Whether program is on the last day */
  isLastDay: boolean;
  /** Whether program is completed */
  isCompleted: boolean;

  // Actions
  /** Refresh enrollment data */
  refresh: () => Promise<void>;
  /** Sync program tasks for today (creates tasks if needed) */
  syncTasks: () => Promise<SyncResult>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for managing Starter Program state and actions
 * 
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Background revalidation without showing skeleton
 * - Automatic deduplication of requests
 * 
 * This hook provides:
 * - Enrollment state and progress
 * - Program sync functionality (creates daily tasks)
 * - UI labels (badges, habit labels)
 * - Completion detection
 * 
 * Usage:
 * ```tsx
 * const { hasEnrollment, program, progress, syncTasks, programBadge } = useStarterProgram();
 * 
 * // Sync tasks on page load
 * useEffect(() => {
 *   if (hasEnrollment && shouldSync) {
 *     syncTasks();
 *   }
 * }, [hasEnrollment]);
 * 
 * // Show badge
 * {programBadge && <span>{programBadge}</span>}
 * ```
 */
export function useStarterProgram(): UseStarterProgramReturn {
  const { user, isLoaded } = useUser();
  
  const cacheKey = user ? '/api/programs/enrollment' : null;
  
  const { data, error, isLoading, mutate } = useSWR<EnrollmentResponse>(
    cacheKey,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch enrollment');
      }
      return response.json();
    },
    {
      // Cache for 2 minutes
      dedupingInterval: 2 * 60 * 1000,
      // Revalidate on focus but don't show loading
      revalidateOnFocus: true,
    }
  );

  // Sync program tasks for today
  const syncTasks = useCallback(async (): Promise<SyncResult> => {
    const defaultResult: SyncResult = {
      success: false,
      tasksCreated: 0,
      focusTasksCreated: 0,
      backlogTasksCreated: 0,
      currentDayIndex: 0,
      enrollmentId: null,
      programName: null,
      message: 'No enrollment',
    };

    if (!user) return defaultResult;

    try {
      const response = await fetch('/api/programs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to sync tasks');
      }

      const result = await response.json();
      
      // Update cache if tasks were created
      if (result.tasksCreated > 0) {
        mutate();
      }

      return {
        success: result.success,
        tasksCreated: result.tasksCreated || 0,
        focusTasksCreated: result.focusTasksCreated || 0,
        backlogTasksCreated: result.backlogTasksCreated || 0,
        currentDayIndex: result.currentDayIndex || 0,
        enrollmentId: result.enrollmentId || null,
        programName: result.programName || null,
        message: result.message || '',
      };
    } catch (err) {
      console.error('Error syncing tasks:', err);
      return {
        ...defaultResult,
        message: err instanceof Error ? err.message : 'Sync failed',
      };
    }
  }, [user, mutate]);

  // Computed values - now use program name instead of track
  const programBadge = useMemo(() => {
    if (!data?.hasEnrollment || data?.enrollment?.status !== 'active' || !data?.program?.name) {
      return null;
    }
    return `${data.program.name} Program`;
  }, [data?.hasEnrollment, data?.enrollment?.status, data?.program?.name]);

  const habitLabel = useMemo(() => {
    return 'Habits';
  }, []);

  const trackDisplayName = useMemo(() => {
    return data?.program?.name || 'Program';
  }, [data?.program?.name]);

  const isLastDay = useMemo(() => {
    if (!data?.progress || !data?.program) return false;
    return data.progress.currentDay >= data.program.lengthDays;
  }, [data?.progress, data?.program]);

  const isCompleted = useMemo(() => {
    return data?.enrollment?.status === 'completed';
  }, [data?.enrollment?.status]);

  return {
    // State
    hasEnrollment: data?.hasEnrollment ?? false,
    enrollment: data?.enrollment ?? null,
    program: data?.program ?? null,
    progress: data?.progress ?? null,
    // Only show loading on INITIAL fetch (when no data exists)
    isLoading: !isLoaded || (isLoading && !data),
    error: error?.message ?? null,
    
    // Computed
    programBadge,
    habitLabel,
    trackDisplayName,
    isLastDay,
    isCompleted,
    
    // Actions
    refresh: () => mutate(),
    syncTasks,
  };
}

// ============================================================================
// DAY 1 START TIME HELPER
// ============================================================================

/**
 * Determine the program start date based on signup time
 * 
 * Logic:
 * - If user signs up before noon (12:00) → Day 1 starts today
 * - If user signs up at/after noon → Day 1 starts tomorrow
 * 
 * This matches the existing morning check-in availability logic.
 * 
 * @param signupTime - ISO timestamp when user signed up
 * @returns ISO date string (YYYY-MM-DD) for program start
 */
export function calculateProgramStartDate(signupTime: string): string {
  const signup = new Date(signupTime);
  const hour = signup.getHours();
  
  // If before noon (12:00), start today
  // If noon or after, start tomorrow
  if (hour < 12) {
    return signup.toISOString().split('T')[0];
  } else {
    // Add one day
    const tomorrow = new Date(signup);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
}

/**
 * Check if the user should start their program today based on first-day logic
 * 
 * @param createdAt - User's account creation timestamp
 * @returns Object with start info
 */
export function getProgramStartInfo(createdAt: string): {
  startDate: string;
  isFirstDay: boolean;
  startsToday: boolean;
  startsTomorrow: boolean;
} {
  const createdAtDate = new Date(createdAt);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Calculate start date based on signup time
  const startDate = calculateProgramStartDate(createdAt);
  
  // Check if it's the user's actual first day
  const isFirstDay = (
    createdAtDate.getFullYear() === today.getFullYear() &&
    createdAtDate.getMonth() === today.getMonth() &&
    createdAtDate.getDate() === today.getDate()
  );
  
  const startsToday = startDate === todayStr;
  const startsTomorrow = !startsToday && isFirstDay;
  
  return {
    startDate,
    isFirstDay,
    startsToday,
    startsTomorrow,
  };
}
