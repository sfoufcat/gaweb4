/**
 * useProgramSchedule Hook
 *
 * Fetches aggregated schedule items for a program enrollment.
 * Combines calls, courses, and tasks into a unified timeline.
 */

import useSWR from 'swr';
import type { ScheduledItem } from '@/types';

export interface ScheduleGroup {
  label: string;
  items: ScheduledItem[];
}

interface ProgramScheduleResponse {
  scheduleItems: ScheduledItem[];
  groups: ScheduleGroup[];
  upcomingCallCount: number;
  pendingTaskCount: number;
}

const fetcher = async (url: string): Promise<ProgramScheduleResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch program schedule');
  }
  return res.json();
};

export function useProgramSchedule(
  programId: string | undefined,
  enrollmentId?: string
) {
  const { data, error, isLoading, mutate } = useSWR<ProgramScheduleResponse>(
    programId ? `/api/programs/${programId}/schedule${enrollmentId ? `?enrollmentId=${enrollmentId}` : ''}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  );

  return {
    scheduleItems: data?.scheduleItems || [],
    groups: data?.groups || [],
    upcomingCallCount: data?.upcomingCallCount || 0,
    pendingTaskCount: data?.pendingTaskCount || 0,
    isLoading,
    error,
    mutate,
  };
}
