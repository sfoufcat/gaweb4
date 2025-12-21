'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

interface ProgramInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  lengthDays: number;
}

interface EnrollmentProgress {
  currentDay: number;
  totalDays: number;
  percentage: number;
  lastAssignedDay: number;
}

interface EnrollmentInfo {
  id: string;
  userId: string;
  programId: string;
  startedAt: string;
  status: 'active' | 'completed' | 'stopped';
  lastAssignedDayIndex: number;
  createdAt: string;
  updatedAt: string;
}

interface UseActiveEnrollmentReturn {
  /** Whether user has an active enrollment */
  hasEnrollment: boolean;
  /** Enrollment details (null if no enrollment) */
  enrollment: EnrollmentInfo | null;
  /** Program info (null if no enrollment) */
  program: ProgramInfo | null;
  /** Progress info (null if no enrollment) */
  progress: EnrollmentProgress | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh enrollment data */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch the current user's active program enrollment
 */
export function useActiveEnrollment(): UseActiveEnrollmentReturn {
  const { user, isLoaded } = useUser();
  const [hasEnrollment, setHasEnrollment] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentInfo | null>(null);
  const [program, setProgram] = useState<ProgramInfo | null>(null);
  const [progress, setProgress] = useState<EnrollmentProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchEnrollment();
  }, [fetchEnrollment]);

  return {
    hasEnrollment,
    enrollment,
    program,
    progress,
    isLoading,
    error,
    refresh,
  };
}



