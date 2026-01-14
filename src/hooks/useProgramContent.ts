'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoDiscoverContent } from '@/lib/demo-data';
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
  // Linked resource IDs
  linkedArticleIds?: string[];
  linkedDownloadIds?: string[];
  linkedLinkIds?: string[];
  linkedQuestionnaireIds?: string[];
  linkedEventIds?: string[];
  linkedSummaryIds?: string[];
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
  const { isDemoMode } = useDemoMode();
  
  // Demo mode: return demo content directly
  const demoContent = useMemo(() => {
    if (!isDemoMode) return null;
    const content = generateDemoDiscoverContent();
    // Filter content by type and map imageUrl to coverImageUrl
    const courses = content.filter(item => item.type === 'course').slice(0, 3).map(item => ({
      ...item,
      coverImageUrl: item.imageUrl,
      thumbnailUrl: item.imageUrl,
    }));
    const articles = content.filter(item => item.type === 'article').slice(0, 3).map(item => ({
      ...item,
      coverImageUrl: item.imageUrl,
      thumbnailUrl: item.imageUrl,
    }));
    return {
      courses: courses as unknown as DiscoverCourse[],
      articles: articles as unknown as DiscoverArticle[],
      events: [] as DiscoverEvent[],
      links: [
        { id: 'link-1', title: 'Getting Started Guide', url: 'https://example.com/guide', description: 'Learn the basics' },
        { id: 'link-2', title: 'Community Resources', url: 'https://example.com/resources', description: 'Helpful community resources' },
      ] as ProgramLink[],
      downloads: [
        { id: 'dl-1', title: 'Workbook PDF', fileUrl: 'https://example.com/workbook.pdf', fileType: 'pdf', fileSize: '2.5 MB' },
      ] as ProgramDownload[],
      days: [] as ProgramDay[],
    };
  }, [isDemoMode]);
  
  const cacheKey = programId ? `/api/programs/${programId}/content` : null;
  
  const { data, error, isLoading, mutate } = useSWR<ProgramContentResponse>(
    isDemoMode ? null : cacheKey,
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

  // Demo mode: return demo content
  if (isDemoMode && demoContent) {
    return {
      courses: demoContent.courses,
      articles: demoContent.articles,
      events: demoContent.events,
      links: demoContent.links,
      downloads: demoContent.downloads,
      days: demoContent.days,
      isLoading: false,
      error: null,
      refresh: async () => {},
    };
  }

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










