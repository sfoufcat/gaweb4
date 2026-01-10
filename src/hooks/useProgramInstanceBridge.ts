'use client';

/**
 * useProgramInstanceBridge Hook
 *
 * Bridge hook that abstracts between old API pattern and new program_instances API.
 * Components use this hook, and it automatically chooses the right API based on
 * whether an instanceId is available (migrated data) or not (legacy data).
 *
 * This enables gradual migration without changing component logic.
 */

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import type {
  ProgramInstanceDay,
  ProgramInstanceWeek,
  ProgramDay,
  ProgramWeek,
  ClientViewContext,
  CohortViewContext,
  ProgramHabitTemplate,
  DayCourseAssignment,
} from '@/types';

// Unified day data that both old and new systems can provide
export interface UnifiedDayData {
  dayIndex: number;
  globalDayIndex?: number;
  calendarDate?: string;
  title?: string;
  summary?: string;
  dailyPrompt?: string;
  tasks: Array<{
    id: string;
    label: string;
    isPrimary: boolean;
    type?: string;
    estimatedMinutes?: number;
    notes?: string;
    completed?: boolean;
    completedAt?: string;
  }>;
  habits?: ProgramHabitTemplate[];
  courseAssignments?: DayCourseAssignment[];
}

// Unified week data
export interface UnifiedWeekData {
  weekNumber: number;
  name?: string;
  theme?: string;
  description?: string;
  weeklyPrompt?: string;
  weeklyTasks: Array<{
    id: string;
    label: string;
    isPrimary: boolean;
  }>;
  days: UnifiedDayData[];
  coachRecordingUrl?: string;
  coachRecordingNotes?: string;
}

// Unified completion data
export interface UnifiedCompletionData {
  taskId: string;
  completedCount: number;
  totalMembers: number;
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

interface BridgeOptions {
  // Old API pattern
  programId: string;
  apiBasePath: string;
  clientViewContext?: ClientViewContext;
  cohortViewContext?: CohortViewContext;

  // New API pattern (if instanceId present, use new API)
  instanceId?: string | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

/**
 * Bridge hook for day operations
 */
export function useDayBridge(options: BridgeOptions & { dayIndex: number }) {
  const { programId, apiBasePath, clientViewContext, cohortViewContext, instanceId, dayIndex } = options;
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useNewApi = !!instanceId;
  const isClientMode = clientViewContext?.mode === 'client';
  const isCohortMode = cohortViewContext?.mode === 'cohort';

  // Build the appropriate URL
  const dataUrl = useMemo(() => {
    if (useNewApi) {
      return `/api/instances/${instanceId}/days/${dayIndex}`;
    }

    // Old API pattern
    const base = `${apiBasePath}/${programId}`;
    if (isClientMode && clientViewContext?.enrollmentId) {
      return `${base}/client-days?enrollmentId=${clientViewContext.enrollmentId}&dayIndex=${dayIndex}`;
    } else if (isCohortMode && cohortViewContext?.mode === 'cohort') {
      return `${base}/cohort-days?cohortId=${cohortViewContext.cohortId}&dayIndex=${dayIndex}`;
    }
    return `${base}/days/${dayIndex}`;
  }, [useNewApi, instanceId, apiBasePath, programId, isClientMode, isCohortMode, clientViewContext, cohortViewContext, dayIndex]);

  // Fetch data
  const { data, error: fetchError, isLoading, mutate } = useSWR(
    dataUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Normalize data to unified format
  const day: UnifiedDayData | null = useMemo(() => {
    if (!data) return null;

    if (useNewApi) {
      const instanceDay = data.day as ProgramInstanceDay;
      return {
        dayIndex: instanceDay.dayIndex,
        globalDayIndex: instanceDay.globalDayIndex,
        calendarDate: instanceDay.calendarDate,
        title: instanceDay.title,
        summary: instanceDay.summary,
        dailyPrompt: instanceDay.dailyPrompt,
        tasks: instanceDay.tasks.map(t => ({
          id: t.id,
          label: t.label,
          isPrimary: t.isPrimary,
          type: t.type,
          estimatedMinutes: t.estimatedMinutes,
          notes: t.notes,
        })),
        habits: instanceDay.habits,
        courseAssignments: instanceDay.courseAssignments,
      };
    }

    // Old API response
    const oldDay = (data.day || data.clientDay || data.cohortDay) as ProgramDay;
    if (!oldDay) return null;

    return {
      dayIndex: oldDay.dayIndex,
      title: oldDay.title,
      summary: oldDay.summary,
      dailyPrompt: oldDay.dailyPrompt,
      tasks: (oldDay.tasks || []).map(t => ({
        id: t.id || crypto.randomUUID(),
        label: t.label,
        isPrimary: t.isPrimary,
        type: t.type,
        estimatedMinutes: t.estimatedMinutes,
        notes: t.notes,
      })),
      habits: oldDay.habits,
      courseAssignments: oldDay.courseAssignments,
    };
  }, [data, useNewApi]);

  // Update day
  const updateDay = useCallback(
    async (updates: Partial<UnifiedDayData>) => {
      setIsUpdating(true);
      setError(null);

      try {
        let url: string;
        let method: string;
        let body: Record<string, unknown>;

        if (useNewApi) {
          url = `/api/instances/${instanceId}/days/${dayIndex}`;
          method = 'PATCH';
          body = updates;
        } else {
          // Old API pattern
          const base = `${apiBasePath}/${programId}`;
          if (isClientMode && clientViewContext?.enrollmentId) {
            url = `${base}/client-days`;
            method = 'POST';
            body = {
              dayIndex,
              enrollmentId: clientViewContext.enrollmentId,
              ...updates,
            };
          } else if (isCohortMode && cohortViewContext?.mode === 'cohort') {
            url = `${base}/cohort-days`;
            method = 'POST';
            body = {
              dayIndex,
              cohortId: cohortViewContext.cohortId,
              ...updates,
            };
          } else {
            url = `${base}/days/${dayIndex}`;
            method = 'PATCH';
            body = updates;
          }
        }

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error('Failed to update day');

        await mutate();
        return await res.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [useNewApi, instanceId, apiBasePath, programId, isClientMode, isCohortMode, clientViewContext, cohortViewContext, dayIndex, mutate]
  );

  return {
    day,
    isLoading,
    isUpdating,
    error: fetchError?.message || error,
    updateDay,
    refresh: mutate,
    isUsingNewApi: useNewApi,
  };
}

/**
 * Bridge hook for week operations
 */
export function useWeekBridge(options: BridgeOptions & { weekNumber: number }) {
  const { programId, apiBasePath, clientViewContext, cohortViewContext, instanceId, weekNumber } = options;
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useNewApi = !!instanceId;
  const isClientMode = clientViewContext?.mode === 'client';
  const isCohortMode = cohortViewContext?.mode === 'cohort';

  // Build the appropriate URL
  const dataUrl = useMemo(() => {
    if (useNewApi) {
      return `/api/instances/${instanceId}/weeks/${weekNumber}`;
    }

    // Old API pattern - need to get week by weekNumber
    const base = `${apiBasePath}/${programId}`;
    if (isClientMode && clientViewContext?.enrollmentId) {
      return `${base}/client-weeks?enrollmentId=${clientViewContext.enrollmentId}&weekNumber=${weekNumber}`;
    } else if (isCohortMode && cohortViewContext?.mode === 'cohort') {
      // Get week ID first, then fetch content
      return `${base}/cohorts/${cohortViewContext.cohortId}/weeks?weekNumber=${weekNumber}`;
    }
    return `${base}/weeks?weekNumber=${weekNumber}`;
  }, [useNewApi, instanceId, apiBasePath, programId, isClientMode, isCohortMode, clientViewContext, cohortViewContext, weekNumber]);

  // Fetch data
  const { data, error: fetchError, isLoading, mutate } = useSWR(
    dataUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Normalize to unified format
  const week: UnifiedWeekData | null = useMemo(() => {
    if (!data) return null;

    if (useNewApi) {
      const instanceWeek = data.week as ProgramInstanceWeek;
      return {
        weekNumber: instanceWeek.weekNumber,
        name: instanceWeek.name,
        theme: instanceWeek.theme,
        description: instanceWeek.description,
        weeklyPrompt: instanceWeek.weeklyPrompt,
        weeklyTasks: (instanceWeek.weeklyTasks || []).map(t => ({
          id: t.id,
          label: t.label,
          isPrimary: t.isPrimary,
        })),
        days: instanceWeek.days.map(d => ({
          dayIndex: d.dayIndex,
          globalDayIndex: d.globalDayIndex,
          calendarDate: d.calendarDate,
          title: d.title,
          summary: d.summary,
          dailyPrompt: d.dailyPrompt,
          tasks: d.tasks.map(t => ({
            id: t.id,
            label: t.label,
            isPrimary: t.isPrimary,
            type: t.type,
            estimatedMinutes: t.estimatedMinutes,
            notes: t.notes,
          })),
          habits: d.habits,
          courseAssignments: d.courseAssignments,
        })),
        coachRecordingUrl: instanceWeek.coachRecordingUrl,
        coachRecordingNotes: instanceWeek.coachRecordingNotes,
      };
    }

    // Old API response - will vary based on endpoint
    const oldWeek = (data.week || data.clientWeek || data) as ProgramWeek;
    if (!oldWeek) return null;

    return {
      weekNumber: oldWeek.weekNumber,
      name: oldWeek.name,
      theme: oldWeek.theme,
      description: oldWeek.description,
      weeklyPrompt: oldWeek.weeklyPrompt,
      weeklyTasks: (oldWeek.weeklyTasks || []).map(t => ({
        id: t.id || crypto.randomUUID(),
        label: t.label,
        isPrimary: t.isPrimary,
      })),
      days: [], // Old API fetches days separately
      coachRecordingUrl: oldWeek.coachRecordingUrl,
      coachRecordingNotes: oldWeek.coachRecordingNotes,
    };
  }, [data, useNewApi]);

  // Update week
  const updateWeek = useCallback(
    async (updates: Partial<UnifiedWeekData>) => {
      setIsUpdating(true);
      setError(null);

      try {
        let url: string;
        let method: string;
        let body: Record<string, unknown>;

        if (useNewApi) {
          url = `/api/instances/${instanceId}/weeks/${weekNumber}`;
          method = 'PATCH';
          body = updates;
        } else {
          // Old API pattern
          const base = `${apiBasePath}/${programId}`;
          if (isCohortMode && cohortViewContext?.mode === 'cohort') {
            // Need to get week ID first for old API
            url = `${base}/cohorts/${cohortViewContext.cohortId}/week-content/${data?.weekId || weekNumber}`;
            method = 'PUT';
            body = updates;
          } else if (isClientMode && clientViewContext?.enrollmentId) {
            url = `${base}/client-weeks/${data?.weekId || weekNumber}`;
            method = 'PATCH';
            body = {
              enrollmentId: clientViewContext.enrollmentId,
              ...updates,
            };
          } else {
            url = `${base}/weeks/${data?.weekId || weekNumber}`;
            method = 'PATCH';
            body = updates;
          }
        }

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error('Failed to update week');

        await mutate();
        return await res.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [useNewApi, instanceId, apiBasePath, programId, isClientMode, isCohortMode, clientViewContext, cohortViewContext, weekNumber, data, mutate]
  );

  return {
    week,
    isLoading,
    isUpdating,
    error: fetchError?.message || error,
    updateWeek,
    refresh: mutate,
    isUsingNewApi: useNewApi,
  };
}

/**
 * Bridge hook for completion data
 */
export function useCompletionBridge(options: BridgeOptions & {
  dayIndex?: number;
  weekNumber?: number;
  threshold?: number;
}) {
  const { programId, apiBasePath, cohortViewContext, instanceId, dayIndex, weekNumber, threshold = 80 } = options;
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useNewApi = !!instanceId;
  const isCohortMode = cohortViewContext?.mode === 'cohort';

  // Build the appropriate URL
  const dataUrl = useMemo(() => {
    if (!isCohortMode && !useNewApi) return null;

    if (useNewApi) {
      const params = new URLSearchParams();
      if (dayIndex !== undefined) params.set('dayIndex', String(dayIndex));
      if (weekNumber !== undefined) params.set('weekNumber', String(weekNumber));
      params.set('threshold', String(threshold));
      return `/api/instances/${instanceId}/completions?${params.toString()}`;
    }

    // Old API pattern
    if (isCohortMode && cohortViewContext?.mode === 'cohort') {
      return `/api/coach/cohort-tasks/${cohortViewContext.cohortId}`;
    }

    return null;
  }, [useNewApi, instanceId, isCohortMode, cohortViewContext, dayIndex, weekNumber, threshold]);

  // Fetch data
  const { data, error: fetchError, isLoading, mutate } = useSWR(
    dataUrl,
    dataUrl ? fetcher : null,
    { revalidateOnFocus: false, refreshInterval: 30000 }
  );

  // Normalize to unified format
  const completions: Map<string, UnifiedCompletionData> = useMemo(() => {
    const map = new Map<string, UnifiedCompletionData>();
    if (!data) return map;

    if (useNewApi) {
      for (const c of (data.completions || [])) {
        map.set(c.taskId, {
          taskId: c.taskId,
          completedCount: c.completedCount,
          totalMembers: c.totalMembers,
          completionRate: c.completionRate,
          isThresholdMet: c.isThresholdMet,
          memberBreakdown: c.memberBreakdown,
        });
      }
    } else {
      // Old API response structure
      for (const task of (data.tasks || [])) {
        const taskId = task.programTaskId || task.taskTemplateId || task.title;
        map.set(taskId, {
          taskId,
          completedCount: task.completedCount || 0,
          totalMembers: task.totalMembers || 0,
          completionRate: task.completionRate || 0,
          isThresholdMet: task.isThresholdMet || false,
          memberBreakdown: task.memberBreakdown || [],
        });
      }
    }

    return map;
  }, [data, useNewApi]);

  // Set completion
  const setCompletion = useCallback(
    async (taskId: string, userId: string, completed: boolean) => {
      if (!useNewApi) {
        // Old API doesn't support setting completion from coach dashboard
        console.warn('Setting completion not supported in legacy API');
        return;
      }

      setIsUpdating(true);
      setError(null);

      try {
        const res = await fetch(`/api/instances/${instanceId}/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, userId, completed }),
        });

        if (!res.ok) throw new Error('Failed to set completion');

        await mutate();
        return await res.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [useNewApi, instanceId, mutate]
  );

  return {
    completions,
    totalMembers: data?.totalMembers || 0,
    threshold: data?.threshold || threshold,
    isLoading,
    isUpdating,
    error: fetchError?.message || error,
    setCompletion,
    refresh: mutate,
    isUsingNewApi: useNewApi,
  };
}

/**
 * Hook to check if data has been migrated and get instanceId
 */
export function useInstanceIdLookup(options: {
  programId: string;
  enrollmentId?: string;
  cohortId?: string;
}) {
  const { programId, enrollmentId, cohortId } = options;

  // Build lookup URL
  const lookupUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('programId', programId);
    if (enrollmentId) params.set('enrollmentId', enrollmentId);
    if (cohortId) params.set('cohortId', cohortId);
    params.set('limit', '1');
    return `/api/instances?${params.toString()}`;
  }, [programId, enrollmentId, cohortId]);

  const { data, isLoading } = useSWR(
    lookupUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  const instanceId = useMemo(() => {
    if (!data?.instances?.length) return null;
    const instance = data.instances[0];

    // Verify it matches our criteria
    if (enrollmentId && instance.enrollmentId !== enrollmentId) return null;
    if (cohortId && instance.cohortId !== cohortId) return null;

    return instance.id;
  }, [data, enrollmentId, cohortId]);

  return {
    instanceId,
    isLoading,
    isMigrated: !!instanceId,
  };
}
