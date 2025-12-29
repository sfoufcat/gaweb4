'use client';

import useSWR from 'swr';
import type { DiscoverCourse, DiscoverArticle, DiscoverEvent } from '@/types/discover';

/**
 * Types for program-specific content
 */
export interface ProgramLink {
  id: string;
  title: string;
  url: string;
  description?: string;
}

export interface ProgramDownload {
  id: string;
  title: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: string;
}

export interface ProgramDayTask {
  id: string;
  title: string;
  type: 'course' | 'article' | 'habit' | 'task' | 'event';
  completed?: boolean;
}

export interface ProgramDay {
  dayIndex: number;
  tasks: ProgramDayTask[];
}

export interface ProgramContentResponse {
  success: boolean;
  courses: DiscoverCourse[];
  articles: DiscoverArticle[];
  events: DiscoverEvent[];
  links: ProgramLink[];
  downloads: ProgramDownload[];
  days: ProgramDay[];
}

export interface UseProgramContentReturn {
  courses: DiscoverCourse[];
  articles: DiscoverArticle[];
  events: DiscoverEvent[];
  links: ProgramLink[];
  downloads: ProgramDownload[];
  days: ProgramDay[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching program-specific content (courses, articles, events, links, downloads, days)
 * 
 * Uses SWR for:
 * - Instant loading from cache when switching tabs (Program <-> Squad)
 * - Background revalidation without showing skeleton
 * - Automatic deduplication of requests
 * - Per-program caching (different cache key per programId)
 * 
 * @param programId - The program ID to fetch content for (null to skip fetching)
 */
export function useProgramContent(programId: string | null): UseProgramContentReturn {
  const cacheKey = programId ? `/api/programs/${programId}/content` : null;
  
  const { data, error, isLoading, mutate } = useSWR<ProgramContentResponse>(
    cacheKey,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch program content');
      }
      return response.json();
    },
    {
      // Cache for 5 minutes - program content doesn't change frequently
      dedupingInterval: 5 * 60 * 1000,
      // Don't refetch on focus - content is relatively static
      revalidateOnFocus: false,
      // Keep previous data while revalidating for smoother UX
      keepPreviousData: true,
    }
  );

  return {
    courses: data?.courses ?? [],
    articles: data?.articles ?? [],
    events: data?.events ?? [],
    links: data?.links ?? [],
    downloads: data?.downloads ?? [],
    days: data?.days ?? [],
    // Only show loading on INITIAL fetch (when no data exists)
    isLoading: isLoading && !data,
    error: error?.message ?? null,
    refresh: async () => { await mutate(); },
  };
}







