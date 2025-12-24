'use client';

import useSWR from 'swr';
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

interface EnrollmentResponse {
  hasEnrollment: boolean;
  enrollment: EnrollmentInfo | null;
  program: ProgramInfo | null;
  progress: EnrollmentProgress | null;
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
 * 
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Background revalidation without showing skeleton
 * - Automatic deduplication of requests
 */
export function useActiveEnrollment(): UseActiveEnrollmentReturn {
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

  return {
    hasEnrollment: data?.hasEnrollment ?? false,
    enrollment: data?.enrollment ?? null,
    program: data?.program ?? null,
    progress: data?.progress ?? null,
    // Only show loading on INITIAL fetch (when no data exists)
    isLoading: !isLoaded || (isLoading && !data),
    error: error?.message ?? null,
    refresh: async () => { await mutate(); },
  };
}
