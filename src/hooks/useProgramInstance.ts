'use client';

// ============================================================================
// PROGRAM INSTANCE HOOK - Direct API for New 3-Collection Architecture
// ============================================================================
//
// This hook provides direct access to the program_instances API.
// Use this when you have an instanceId and want to work with the new system.
//
// For migration/bridge scenarios where instanceId might not exist, use
// useProgramInstanceBridge instead.
//
// COLLECTIONS:
//   programs → Template program with embedded weeks/days/tasks
//   program_instances → One doc per enrollment (1:1) or cohort (group)
//   task_completions → Subcollection tracking individual completions
//
// API ROUTES:
//   GET    /api/instances              - List instances
//   POST   /api/instances              - Create instance from template
//   GET    /api/instances/[id]         - Get instance with all data
//   PATCH  /api/instances/[id]         - Update instance
//   GET    /api/instances/[id]/weeks/[weekNum] - Get specific week
//   GET    /api/instances/[id]/days/[dayIndex] - Get specific day
//   GET    /api/instances/[id]/completions     - Get completion summary
//   POST   /api/instances/[id]/completions     - Record completion
//
// See CLAUDE.md "Program System Architecture" for full documentation.
// ============================================================================

/**
 * useProgramInstance Hook
 *
 * React hook for interacting with program instances via the new unified API.
 * Provides methods for fetching and updating instance data, weeks, days, and completions.
 *
 * This hook abstracts the API calls and provides a clean interface for components.
 */

import { useState, useCallback, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import type {
  ProgramInstance,
  ProgramInstanceWeek,
  ProgramInstanceDay,
  ProgramInstanceTask,
} from '@/types';

// API response types
interface InstanceResponse {
  instance: ProgramInstance;
  members?: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
  }>;
  user?: {
    userId: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
  };
}

interface WeekResponse {
  week: ProgramInstanceWeek;
}

interface DayResponse {
  day: ProgramInstanceDay & { weekNumber?: number };
}

interface CompletionSummary {
  taskId: string;
  dayIndex: number;
  weekNumber: number;
  label: string;
  totalMembers: number;
  completedCount: number;
  completionRate: number;
  isThresholdMet: boolean;
  memberBreakdown: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
    status: 'pending' | 'completed';
    completedAt?: string;
  }>;
}

interface CompletionsResponse {
  completions: CompletionSummary[];
  totalMembers: number;
  threshold: number;
}

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch');
    throw error;
  }
  return res.json();
};

/**
 * Hook for working with a single program instance
 */
export function useProgramInstance(instanceId: string | null) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch instance data
  const {
    data: instanceData,
    error: fetchError,
    isLoading,
    mutate: mutateInstance,
  } = useSWR<InstanceResponse>(
    instanceId ? `/api/instances/${instanceId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  // Update instance metadata
  const updateInstance = useCallback(
    async (updates: Partial<Pick<ProgramInstance, 'startDate' | 'endDate' | 'includeWeekends' | 'dailyFocusSlots'>>) => {
      if (!instanceId) return;

      setIsUpdating(true);
      setError(null);

      try {
        const res = await fetch(`/api/instances/${instanceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          throw new Error('Failed to update instance');
        }

        const result = await res.json();
        await mutateInstance();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [instanceId, mutateInstance]
  );

  return {
    instance: instanceData?.instance,
    members: instanceData?.members,
    user: instanceData?.user,
    isLoading,
    isUpdating,
    error: fetchError?.message || error,
    updateInstance,
    refresh: mutateInstance,
  };
}

/**
 * Hook for working with a week within an instance
 */
export function useInstanceWeek(instanceId: string | null, weekNumber: number | null) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldFetch = instanceId && weekNumber !== null && weekNumber >= 0;

  // Fetch week data
  const {
    data: weekData,
    error: fetchError,
    isLoading,
    mutate: mutateWeek,
  } = useSWR<WeekResponse>(
    shouldFetch ? `/api/instances/${instanceId}/weeks/${weekNumber}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  // Update week
  const updateWeek = useCallback(
    async (updates: Partial<Omit<ProgramInstanceWeek, 'weekNumber'>>) => {
      if (!instanceId || weekNumber === null) return;

      setIsUpdating(true);
      setError(null);

      try {
        const res = await fetch(`/api/instances/${instanceId}/weeks/${weekNumber}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          throw new Error('Failed to update week');
        }

        const result = await res.json();
        await mutateWeek();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [instanceId, weekNumber, mutateWeek]
  );

  // Update a specific day within the week
  const updateDay = useCallback(
    async (dayIndex: number, updates: Partial<ProgramInstanceDay>) => {
      if (!instanceId || weekNumber === null) return;

      setIsUpdating(true);
      setError(null);

      try {
        const res = await fetch(`/api/instances/${instanceId}/weeks/${weekNumber}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayIndex,
            day: updates,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to update day');
        }

        const result = await res.json();
        await mutateWeek();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [instanceId, weekNumber, mutateWeek]
  );

  // Distribute weekly tasks to days
  const distributeWeeklyTasks = useCallback(
    async (
      weeklyTasks: ProgramInstanceTask[],
      distribution: { type: 'spread' | 'all_days' | 'first_day'; targetDays?: number[] }
    ) => {
      if (!instanceId || weekNumber === null) return;

      setIsUpdating(true);
      setError(null);

      try {
        const res = await fetch(`/api/instances/${instanceId}/weeks/${weekNumber}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weeklyTasks,
            distribution,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to distribute tasks');
        }

        const result = await res.json();
        await mutateWeek();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Distribution failed');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [instanceId, weekNumber, mutateWeek]
  );

  return {
    week: weekData?.week,
    isLoading,
    isUpdating,
    error: fetchError?.message || error,
    updateWeek,
    updateDay,
    distributeWeeklyTasks,
    refresh: mutateWeek,
  };
}

/**
 * Hook for working with a day within an instance
 */
export function useInstanceDay(instanceId: string | null, globalDayIndex: number | null) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldFetch = instanceId && globalDayIndex !== null && globalDayIndex >= 1;

  // Fetch day data
  const {
    data: dayData,
    error: fetchError,
    isLoading,
    mutate: mutateDay,
  } = useSWR<DayResponse>(
    shouldFetch ? `/api/instances/${instanceId}/days/${globalDayIndex}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  // Update day
  const updateDay = useCallback(
    async (updates: Partial<Omit<ProgramInstanceDay, 'dayIndex' | 'globalDayIndex'>>) => {
      if (!instanceId || globalDayIndex === null) return;

      setIsUpdating(true);
      setError(null);

      try {
        const res = await fetch(`/api/instances/${instanceId}/days/${globalDayIndex}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          throw new Error('Failed to update day');
        }

        const result = await res.json();
        await mutateDay();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [instanceId, globalDayIndex, mutateDay]
  );

  // Update tasks specifically
  const updateTasks = useCallback(
    async (tasks: ProgramInstanceTask[]) => {
      return updateDay({ tasks });
    },
    [updateDay]
  );

  return {
    day: dayData?.day,
    weekNumber: dayData?.day?.weekNumber,
    isLoading,
    isUpdating,
    error: fetchError?.message || error,
    updateDay,
    updateTasks,
    refresh: mutateDay,
  };
}

/**
 * Hook for working with task completions
 */
export function useInstanceCompletions(
  instanceId: string | null,
  options?: {
    weekNumber?: number;
    dayIndex?: number;
    threshold?: number;
  }
) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build query string
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (options?.weekNumber !== undefined) params.set('weekNumber', String(options.weekNumber));
    if (options?.dayIndex !== undefined) params.set('dayIndex', String(options.dayIndex));
    if (options?.threshold !== undefined) params.set('threshold', String(options.threshold));
    return params.toString();
  }, [options?.weekNumber, options?.dayIndex, options?.threshold]);

  const cacheKey = instanceId
    ? `/api/instances/${instanceId}/completions${queryParams ? `?${queryParams}` : ''}`
    : null;

  // Fetch completions
  const {
    data: completionsData,
    error: fetchError,
    isLoading,
    mutate: mutateCompletions,
  } = useSWR<CompletionsResponse>(
    cacheKey,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Set a task completion
  const setCompletion = useCallback(
    async (taskId: string, userId: string, completed: boolean, dayIndex?: number, label?: string) => {
      if (!instanceId) return;

      setIsUpdating(true);
      setError(null);

      try {
        const res = await fetch(`/api/instances/${instanceId}/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            userId,
            completed,
            dayIndex,
            label,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to set completion');
        }

        const result = await res.json();
        await mutateCompletions();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [instanceId, mutateCompletions]
  );

  // Compute task completion map for easy lookup
  const taskCompletionMap = useMemo(() => {
    const map = new Map<string, CompletionSummary>();
    for (const completion of completionsData?.completions || []) {
      map.set(completion.taskId, completion);
    }
    return map;
  }, [completionsData?.completions]);

  // Get completion for a specific task
  const getTaskCompletion = useCallback(
    (taskId: string): CompletionSummary | undefined => {
      return taskCompletionMap.get(taskId);
    },
    [taskCompletionMap]
  );

  return {
    completions: completionsData?.completions || [],
    totalMembers: completionsData?.totalMembers || 0,
    threshold: completionsData?.threshold || 80,
    isLoading,
    isUpdating,
    error: fetchError?.message || error,
    setCompletion,
    getTaskCompletion,
    taskCompletionMap,
    refresh: mutateCompletions,
  };
}

/**
 * Hook for listing instances
 */
export function useInstanceList(filters?: {
  programId?: string;
  cohortId?: string;
  userId?: string;
  type?: 'individual' | 'cohort';
  limit?: number;
  offset?: number;
}) {
  // Build query string
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters?.programId) params.set('programId', filters.programId);
    if (filters?.cohortId) params.set('cohortId', filters.cohortId);
    if (filters?.userId) params.set('userId', filters.userId);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    return params.toString();
  }, [filters]);

  const cacheKey = `/api/instances${queryParams ? `?${queryParams}` : ''}`;

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useSWR(cacheKey, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    instances: data?.instances || [],
    hasMore: data?.hasMore || false,
    isLoading,
    error: error?.message,
    refresh,
  };
}
