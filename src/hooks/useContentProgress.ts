'use client';

import useSWR from 'swr';
import type { ContentProgress, ContentProgressType, ContentProgressStatus } from '@/types';

// Base cache key for content progress
const PROGRESS_BASE_KEY = '/api/content-progress';

interface ContentProgressResponse {
  progress: ContentProgress[];
  totalCount: number;
}

interface SingleProgressResponse {
  progress: ContentProgress;
  created?: boolean;
  updated?: boolean;
  recompletion?: boolean;
  completionCount?: number;
}

interface ContentProgressFilters {
  contentType?: ContentProgressType;
  contentId?: string;
  instanceId?: string;
  status?: ContentProgressStatus;
  userId?: string; // For coaches viewing client progress
}

interface MarkCompleteParams {
  contentType: ContentProgressType;
  contentId: string;
  moduleId?: string;
  lessonId?: string;
  watchProgress?: number;
  instanceId?: string;
  enrollmentId?: string; // Alternative to instanceId - API will look up instance
  weekIndex?: number;
  dayIndex?: number;
}

interface UpdateProgressParams {
  status?: ContentProgressStatus;
  progressPercent?: number;
  watchProgress?: number;
  manuallyCompleted?: boolean;
}

/**
 * Build cache key from base and filters
 */
function buildCacheKey(filters?: ContentProgressFilters): string {
  if (!filters || Object.keys(filters).length === 0) {
    return PROGRESS_BASE_KEY;
  }

  const params = new URLSearchParams();
  if (filters.contentType) params.set('contentType', filters.contentType);
  if (filters.contentId) params.set('contentId', filters.contentId);
  if (filters.instanceId) params.set('instanceId', filters.instanceId);
  if (filters.status) params.set('status', filters.status);
  if (filters.userId) params.set('userId', filters.userId);

  return `${PROGRESS_BASE_KEY}?${params.toString()}`;
}

/**
 * Hook for managing content progress with SWR caching
 *
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Optimistic updates for mutations
 * - Background revalidation for fresh data
 *
 * @param filters - Optional filters for progress records
 */
export function useContentProgress(filters?: ContentProgressFilters) {
  const cacheKey = buildCacheKey(filters);

  const { data, error, isLoading, mutate } = useSWR<ContentProgressResponse>(
    cacheKey,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('Content Progress API returned non-OK status:', response.status);
        return { progress: [], totalCount: 0 };
      }
      return response.json();
    },
    {
      fallbackData: { progress: [], totalCount: 0 },
      revalidateOnFocus: false,
    }
  );

  const progress = data?.progress ?? [];

  /**
   * Refresh progress data from the server
   */
  const refreshProgress = async () => {
    await mutate();
  };

  /**
   * Get progress for a specific content item
   */
  const getProgressForContent = (
    contentType: ContentProgressType,
    contentId: string,
    lessonId?: string
  ): ContentProgress | undefined => {
    return progress.find((p) => {
      if (p.contentType !== contentType) return false;
      if (p.contentId !== contentId) return false;
      if (lessonId && p.lessonId !== lessonId) return false;
      return true;
    });
  };

  /**
   * Check if content is completed
   */
  const isContentCompleted = (
    contentType: ContentProgressType,
    contentId: string,
    lessonId?: string
  ): boolean => {
    const p = getProgressForContent(contentType, contentId, lessonId);
    return p?.status === 'completed';
  };

  /**
   * Get completion percentage for a course (aggregated from lessons)
   */
  const getCourseCompletionPercent = (courseId: string): number => {
    const courseLessons = progress.filter(
      (p) => p.contentType === 'course_lesson' && p.contentId === courseId
    );

    if (courseLessons.length === 0) return 0;

    const completedCount = courseLessons.filter((p) => p.status === 'completed').length;
    return Math.round((completedCount / courseLessons.length) * 100);
  };

  /**
   * Mark content as complete
   */
  const markComplete = async (params: MarkCompleteParams): Promise<ContentProgress> => {
    try {
      const response = await fetch(`${PROGRESS_BASE_KEY}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark content complete');
      }

      const result: SingleProgressResponse = await response.json();

      // Optimistically update cache
      const existing = progress.find(
        (p) =>
          p.contentType === params.contentType &&
          p.contentId === params.contentId &&
          (params.lessonId ? p.lessonId === params.lessonId : true)
      );

      if (existing) {
        // Update existing record
        await mutate(
          {
            progress: progress.map((p) =>
              p.id === existing.id ? result.progress : p
            ),
            totalCount: data?.totalCount ?? progress.length,
          },
          { revalidate: false }
        );
      } else {
        // Add new record
        await mutate(
          {
            progress: [result.progress, ...progress],
            totalCount: (data?.totalCount ?? progress.length) + 1,
          },
          { revalidate: false }
        );
      }

      return result.progress;
    } catch (err) {
      console.error('Error marking content complete:', err);
      throw err;
    }
  };

  /**
   * Update progress for a specific record
   */
  const updateProgress = async (
    id: string,
    updates: UpdateProgressParams
  ): Promise<ContentProgress> => {
    try {
      const response = await fetch(`${PROGRESS_BASE_KEY}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update progress');
      }

      const result: SingleProgressResponse = await response.json();

      // Optimistically update cache
      await mutate(
        {
          progress: progress.map((p) => (p.id === id ? result.progress : p)),
          totalCount: data?.totalCount ?? progress.length,
        },
        { revalidate: false }
      );

      return result.progress;
    } catch (err) {
      console.error('Error updating progress:', err);
      throw err;
    }
  };

  /**
   * Create or update progress (upsert)
   */
  const upsertProgress = async (params: MarkCompleteParams & { status?: ContentProgressStatus }): Promise<ContentProgress> => {
    try {
      const response = await fetch(PROGRESS_BASE_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upsert progress');
      }

      const result: SingleProgressResponse = await response.json();

      // Update cache
      if (result.created) {
        await mutate(
          {
            progress: [result.progress, ...progress],
            totalCount: (data?.totalCount ?? progress.length) + 1,
          },
          { revalidate: false }
        );
      } else {
        await mutate(
          {
            progress: progress.map((p) =>
              p.id === result.progress.id ? result.progress : p
            ),
            totalCount: data?.totalCount ?? progress.length,
          },
          { revalidate: false }
        );
      }

      return result.progress;
    } catch (err) {
      console.error('Error upserting progress:', err);
      throw err;
    }
  };

  /**
   * Track video watch progress (updates watchProgress field)
   * @param options.instanceId - Link to program instance for cohort tracking
   * @param options.enrollmentId - Alternative to instanceId - API will look up instance
   * @param options.weekIndex - Which program week (1-based)
   * @param options.dayIndex - Which day in the week (1-7)
   */
  const trackWatchProgress = async (
    contentType: ContentProgressType,
    contentId: string,
    watchProgress: number,
    options?: {
      moduleId?: string;
      lessonId?: string;
      instanceId?: string;
      enrollmentId?: string;
      weekIndex?: number;
      dayIndex?: number;
    }
  ): Promise<ContentProgress> => {
    return upsertProgress({
      contentType,
      contentId,
      watchProgress,
      status: 'in_progress',
      ...options,
    });
  };

  /**
   * Delete a progress record
   */
  const deleteProgress = async (id: string): Promise<void> => {
    try {
      const response = await fetch(`${PROGRESS_BASE_KEY}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete progress');
      }

      // Remove from cache
      await mutate(
        {
          progress: progress.filter((p) => p.id !== id),
          totalCount: Math.max(0, (data?.totalCount ?? progress.length) - 1),
        },
        { revalidate: false }
      );
    } catch (err) {
      console.error('Error deleting progress:', err);
      throw err;
    }
  };

  return {
    // Data
    progress,
    totalCount: data?.totalCount ?? 0,
    isLoading,
    error,

    // Queries
    getProgressForContent,
    isContentCompleted,
    getCourseCompletionPercent,

    // Mutations
    refreshProgress,
    markComplete,
    updateProgress,
    upsertProgress,
    trackWatchProgress,
    deleteProgress,
  };
}

/**
 * Hook for tracking progress of a single content item
 * Useful for content viewers (CourseViewer, ArticleViewer)
 */
export function useSingleContentProgress(
  contentType: ContentProgressType,
  contentId: string,
  lessonId?: string
) {
  const { progress, isLoading, error, ...rest } = useContentProgress({
    contentType,
    contentId,
  });

  // Find the specific progress record
  const currentProgress = progress.find((p) => {
    if (p.contentType !== contentType) return false;
    if (p.contentId !== contentId) return false;
    if (lessonId && p.lessonId !== lessonId) return false;
    return true;
  });

  return {
    progress: currentProgress,
    isCompleted: currentProgress?.status === 'completed',
    watchProgress: currentProgress?.watchProgress ?? 0,
    completionCount: currentProgress?.completionCount ?? 0,
    isLoading,
    error,
    ...rest,
  };
}
