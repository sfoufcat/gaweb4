'use client';

import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';
import type { FirebaseUser, Habit, Task } from '@/types';

interface DashboardData {
  user: FirebaseUser | null;
  habits: Habit[];
  tasks: {
    focus: Task[];
    backlog: Task[];
  };
  date: string;
}

interface UseDashboardReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch all dashboard data in one request
 * 
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Background revalidation for fresh data
 * - Automatic deduplication of requests
 */
export function useDashboard(): UseDashboardReturn {
  const { user, isLoaded } = useUser();
  
  // Generate date-specific cache key
  const date = new Date().toISOString().split('T')[0];
  
  // Only fetch if user is authenticated
  // Using user ID in key ensures cache is per-user
  const cacheKey = user ? `/api/dashboard?date=${date}&uid=${user.id}` : null;
  
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    cacheKey,
    // Custom fetcher that strips the uid param (it's just for cache key uniqueness)
    async (key: string) => {
      const url = key.replace(/&uid=[^&]+/, '');
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return response.json();
    },
    {
      // Keep data fresh for 2 minutes before revalidating
      dedupingInterval: 2 * 60 * 1000,
      // Don't retry too aggressively
      errorRetryCount: 2,
    }
  );

  // Refetch function that triggers SWR revalidation
  const refetch = async () => {
    await mutate();
  };

  return {
    data: data ?? null,
    // Show loading only on initial load (when no cached data exists)
    loading: !isLoaded || (isLoading && !data),
    error: error?.message ?? null,
    refetch,
  };
}
