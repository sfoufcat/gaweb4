/**
 * useProgramStructure Hook
 *
 * Fetches the hierarchical structure of a program (modules > weeks > days)
 * for client-side display.
 */

import useSWR from 'swr';
import type { ProgramModule, ProgramWeek, ProgramDay } from '@/types';

export interface ProgramStructure {
  modules: ProgramModule[];
  weeks: ProgramWeek[];
  days: ProgramDay[];
  hasModules: boolean;
  currentWeekIndex: number;
  currentModuleIndex: number;
}

interface ProgramStructureResponse {
  modules: ProgramModule[];
  weeks: ProgramWeek[];
  days: ProgramDay[];
  hasModules: boolean;
  programLengthDays: number;
}

const fetcher = async (url: string): Promise<ProgramStructureResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch program structure');
  }
  return res.json();
};

export function useProgramStructure(
  programId: string | undefined,
  currentDay: number = 1
) {
  const { data, error, isLoading, mutate } = useSWR<ProgramStructureResponse>(
    programId ? `/api/programs/${programId}/structure` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  );

  // Calculate current week and module based on current day
  const currentWeekIndex = data?.weeks.findIndex(
    (week) => currentDay >= week.startDayIndex && currentDay <= week.endDayIndex
  ) ?? -1;

  const currentModuleIndex = data?.modules.findIndex(
    (mod) => currentDay >= mod.startDayIndex && currentDay <= mod.endDayIndex
  ) ?? -1;

  return {
    modules: data?.modules || [],
    weeks: data?.weeks || [],
    days: data?.days || [],
    hasModules: data?.hasModules || false,
    currentWeekIndex: currentWeekIndex >= 0 ? currentWeekIndex : 0,
    currentModuleIndex: currentModuleIndex >= 0 ? currentModuleIndex : 0,
    isLoading,
    error,
    mutate,
  };
}
