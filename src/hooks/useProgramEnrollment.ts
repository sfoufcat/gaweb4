'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';
import type { StarterProgramEnrollment, StarterProgram } from '@/types';

interface ProgramProgress {
  currentDay: number;
  totalDays: number;
  percentage: number;
  lastAssignedDay: number;
  // Evergreen program support
  cycleNumber?: number; // Current cycle number (for evergreen programs, default 1)
  isEvergreen?: boolean; // Whether this is an evergreen program
}

interface EnrollmentResponse {
  hasEnrollment: boolean;
  enrollment: StarterProgramEnrollment | null;
  program: Pick<StarterProgram, 'id' | 'name' | 'slug' | 'description' | 'lengthDays' | 'track'> | null;
  progress: ProgramProgress | null;
}

interface UseProgramEnrollmentReturn {
  /** Whether the user has an active enrollment */
  hasEnrollment: boolean;
  /** The active enrollment (if any) */
  enrollment: StarterProgramEnrollment | null;
  /** The program details (if enrolled) */
  program: Pick<StarterProgram, 'id' | 'name' | 'slug' | 'description' | 'lengthDays' | 'track'> | null;
  /** Progress through the program */
  progress: ProgramProgress | null;
  /** Whether enrollment data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh enrollment data */
  refresh: () => Promise<void>;
  /** Sync program tasks for today */
  syncTasks: () => Promise<{ tasksCreated: number; currentDayIndex: number }>;
}

/**
 * Hook for accessing the current user's program enrollment
 * 
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Background revalidation without showing skeleton
 * - Automatic deduplication of requests
 * 
 * Usage:
 * ```tsx
 * const { hasEnrollment, program, progress, syncTasks } = useProgramEnrollment();
 * 
 * if (hasEnrollment && program) {
 *   console.log(`Day ${progress?.currentDay} of ${program.name}`);
 * }
 * ```
 */
export function useProgramEnrollment(): UseProgramEnrollmentReturn {
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
  const syncTasks = useCallback(async (): Promise<{ tasksCreated: number; currentDayIndex: number }> => {
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
        tasksCreated: result.tasksCreated || 0,
        currentDayIndex: result.currentDayIndex || 0,
      };
    } catch (err) {
      console.error('Error syncing tasks:', err);
      throw err;
    }
  }, [mutate]);

  return {
    hasEnrollment: data?.hasEnrollment ?? false,
    enrollment: data?.enrollment ?? null,
    program: data?.program ?? null,
    progress: data?.progress ?? null,
    // Only show loading on INITIAL fetch (when no data exists)
    isLoading: !isLoaded || (isLoading && !data),
    error: error?.message ?? null,
    refresh: async () => { await mutate(); },
    syncTasks,
  };
}
