'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import type { StarterProgramEnrollment, StarterProgram } from '@/types';

interface ProgramProgress {
  currentDay: number;
  totalDays: number;
  percentage: number;
  lastAssignedDay: number;
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
  const [hasEnrollment, setHasEnrollment] = useState(false);
  const [enrollment, setEnrollment] = useState<StarterProgramEnrollment | null>(null);
  const [program, setProgram] = useState<UseProgramEnrollmentReturn['program']>(null);
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
      
      // Update progress if tasks were created
      if (result.tasksCreated > 0) {
        await fetchEnrollment();
      }

      return {
        tasksCreated: result.tasksCreated || 0,
        currentDayIndex: result.currentDayIndex || 0,
      };
    } catch (err) {
      console.error('Error syncing tasks:', err);
      throw err;
    }
  }, [fetchEnrollment]);

  return {
    hasEnrollment,
    enrollment,
    program,
    progress,
    isLoading,
    error,
    refresh: fetchEnrollment,
    syncTasks,
  };
}



