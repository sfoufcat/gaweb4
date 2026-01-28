'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useDemoMode } from '@/contexts/DemoModeContext';
import type { WeeklyContentResponse } from '@/app/api/programs/[programId]/weekly-content/route';

export type { WeeklyContentResponse };

export interface UseProgramWeeklyContentReturn {
  week: WeeklyContentResponse['week'];
  days: WeeklyContentResponse['days'];
  resourceAssignments: WeeklyContentResponse['resourceAssignments'];
  events: WeeklyContentResponse['events'];
  courses: WeeklyContentResponse['courses'];
  articles: WeeklyContentResponse['articles'];
  downloads: WeeklyContentResponse['downloads'];
  links: WeeklyContentResponse['links'];
  summaries: WeeklyContentResponse['summaries'];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  mutate: (data?: WeeklyContentResponse | Promise<WeeklyContentResponse> | ((current?: WeeklyContentResponse) => WeeklyContentResponse | undefined), opts?: { revalidate?: boolean }) => Promise<WeeklyContentResponse | undefined>;
}

/**
 * Hook for fetching weekly program content for the client view
 *
 * Uses SWR for:
 * - Instant loading from cache when switching between weeks
 * - Background revalidation without showing skeleton
 * - Automatic deduplication of requests
 *
 * @param programId - The program ID to fetch content for (null to skip)
 * @param weekNumber - Optional specific week to fetch (defaults to current week)
 */
export function useProgramWeeklyContent(
  programId: string | null,
  weekNumber?: number
): UseProgramWeeklyContentReturn {
  const { isDemoMode } = useDemoMode();

  // Demo data
  const demoContent = useMemo(() => {
    if (!isDemoMode) return null;

    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return {
      week: {
        weekNumber: 2,
        name: 'Week 2: Building Momentum',
        theme: 'Establishing Your Routine',
        description: 'This week we focus on creating sustainable habits and building the daily routines that will support your long-term success.',
        weeklyPrompt: 'What does your ideal morning routine look like?',
        currentFocus: [
          'Complete daily morning reflection',
          'Track your habits consistently',
          'Connect with your accountability partner',
        ],
        notes: [
          'Remember to celebrate small wins',
          'Focus on progress, not perfection',
        ],
        manualNotes: 'Great progress last week! Focus on consistency.',
        startDayIndex: 8,
        endDayIndex: 14,
      },
      days: Array.from({ length: 5 }, (_, i) => {
        const dayDate = new Date(today);
        dayDate.setDate(today.getDate() - today.getDay() + 1 + i);

        return {
          dayIndex: i + 1,
          globalDayIndex: 8 + i,
          calendarDate: dayDate.toISOString().split('T')[0],
          dayName: dayNames[dayDate.getDay()],
          isToday: dayDate.toDateString() === today.toDateString(),
          isPast: dayDate < today,
          tasks: [
            { id: `task-${i}-1`, label: 'Morning reflection', isPrimary: true, type: 'task' as const },
            { id: `task-${i}-2`, label: 'Complete daily lesson', isPrimary: false, type: 'learning' as const },
          ],
          linkedEventIds: i === 2 ? ['demo-event-1'] : [],
          linkedArticleIds: i === 0 ? ['demo-article-1'] : [],
          linkedCourseIds: i === 1 ? ['demo-course-1'] : [],
        };
      }),
      events: [],
      courses: [],
      articles: [],
      resourceAssignments: [],
      downloads: [],
      links: [],
      summaries: [],
      success: true,
    } as WeeklyContentResponse;
  }, [isDemoMode]);

  const cacheKey = programId
    ? `/api/programs/${programId}/weekly-content${weekNumber ? `?weekNumber=${weekNumber}` : ''}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<WeeklyContentResponse>(
    isDemoMode ? null : cacheKey,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch weekly content');
      }
      return response.json();
    },
    {
      dedupingInterval: 5 * 60 * 1000, // Cache for 5 minutes
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  // Demo mode
  if (isDemoMode && demoContent) {
    return {
      week: demoContent.week,
      days: demoContent.days,
      resourceAssignments: demoContent.resourceAssignments,
      events: demoContent.events,
      courses: demoContent.courses,
      articles: demoContent.articles,
      downloads: demoContent.downloads,
      links: demoContent.links,
      summaries: demoContent.summaries,
      isLoading: false,
      error: null,
      refresh: async () => {},
      mutate: async () => undefined,
    };
  }

  return {
    week: data?.week ?? null,
    days: data?.days ?? [],
    resourceAssignments: data?.resourceAssignments ?? [],
    events: data?.events ?? [],
    courses: data?.courses ?? [],
    articles: data?.articles ?? [],
    downloads: data?.downloads ?? [],
    links: data?.links ?? [],
    summaries: data?.summaries ?? [],
    isLoading: isLoading && !data,
    error: error?.message ?? null,
    refresh: async () => { await mutate(); },
    mutate,
  };
}
