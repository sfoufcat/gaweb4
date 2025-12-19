'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useTrack } from './useTrack';
import type { UserTrack, StarterProgramEnrollment } from '@/types';
import { getProgramBadgeForTrack, getHabitLabelForTrack } from '@/lib/starter-program-config';
import { getTrackDisplayName } from '@/lib/track-prompts';

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
  const { track } = useTrack();
  
  // State
  const [hasEnrollment, setHasEnrollment] = useState(false);
  const [enrollment, setEnrollment] = useState<StarterProgramEnrollment | null>(null);
  const [program, setProgram] = useState<ProgramInfo | null>(null);
  const [progress, setProgress] = useState<ProgramProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch enrollment data
  const fetchEnrollment = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/programs/enrollment');
      
      if (!response.ok) {
        throw new Error('Failed to fetch enrollment');
      }

      const data = await response.json();
      
      setHasEnrollment(data.hasEnrollment || false);
      setEnrollment(data.enrollment || null);
      setProgram(data.program || null);
      setProgress(data.progress || null);
    } catch (err) {
      console.error('Error fetching enrollment:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch enrollment');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initialize on mount
  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setHasEnrollment(false);
      setEnrollment(null);
      setProgram(null);
      setProgress(null);
      setIsLoading(false);
      return;
    }

    fetchEnrollment();
  }, [isLoaded, user, fetchEnrollment]);

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
      
      // Update progress if tasks were created
      if (result.tasksCreated > 0) {
        await fetchEnrollment();
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
  }, [user, fetchEnrollment]);

  // Computed values
  const programBadge = useMemo(() => {
    if (!track || !hasEnrollment || enrollment?.status !== 'active') {
      return null;
    }
    return getProgramBadgeForTrack(track);
  }, [track, hasEnrollment, enrollment?.status]);

  const habitLabel = useMemo(() => {
    return getHabitLabelForTrack(track);
  }, [track]);

  const trackDisplayName = useMemo(() => {
    return getTrackDisplayName(track);
  }, [track]);

  const isLastDay = useMemo(() => {
    if (!progress || !program) return false;
    return progress.currentDay >= program.lengthDays;
  }, [progress, program]);

  const isCompleted = useMemo(() => {
    return enrollment?.status === 'completed';
  }, [enrollment?.status]);

  return {
    // State
    hasEnrollment,
    enrollment,
    program,
    progress,
    isLoading,
    error,
    
    // Computed
    programBadge,
    habitLabel,
    trackDisplayName,
    isLastDay,
    isCompleted,
    
    // Actions
    refresh: fetchEnrollment,
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



