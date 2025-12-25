'use client';

import useSWR from 'swr';
import { useCallback, useMemo, useState } from 'react';
import type {
  DiscoverEvent,
  DiscoverArticle,
  DiscoverCourse,
  DiscoverCategory,
  DiscoverProgram,
  TrendingItem,
  RecommendedItem,
  EventUpdate,
  EventAttendee,
} from '@/types/discover';

// Shared SWR fetcher
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return response.json();
}

// Hook: useDiscoverEvents - Fetches from API with SWR caching
export function useDiscoverEvents() {
  const { data, error, isLoading } = useSWR<{ events: DiscoverEvent[] }>(
    '/api/discover/events',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    }
  );

  return {
    events: data?.events ?? [],
    loading: isLoading && !data,
    error: error?.message ?? null,
  };
}

// Hook: useEvent - Fetches single event from API with SWR caching
export function useEvent(eventId: string) {
  const { data, error, isLoading, mutate } = useSWR<{
    event: DiscoverEvent;
    updates: EventUpdate[];
    attendees: EventAttendee[];
    totalAttendees: number;
    isJoined: boolean;
  }>(
    eventId ? `/api/discover/events/${eventId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const [isJoining, setIsJoining] = useState(false);

  const joinEvent = useCallback(async () => {
    if (!data) return;
    
    // Optimistic update
    const optimisticData = {
      ...data,
      isJoined: true,
      totalAttendees: data.totalAttendees + 1,
    };
    
    setIsJoining(true);
    await mutate(optimisticData, { revalidate: false });
    
    try {
      const response = await fetch(`/api/discover/events/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });
      
      if (response.ok) {
        const result = await response.json();
        await mutate({
          ...data,
          isJoined: true,
          totalAttendees: result.totalAttendees ?? data.totalAttendees + 1,
        }, { revalidate: false });
      } else {
        // Revert on failure
        await mutate(data, { revalidate: false });
      }
    } catch {
      // Revert on error
      await mutate(data, { revalidate: false });
    } finally {
      setIsJoining(false);
    }
  }, [eventId, data, mutate]);

  const leaveEvent = useCallback(async () => {
    if (!data) return;
    
    // Optimistic update
    const optimisticData = {
      ...data,
      isJoined: false,
      totalAttendees: Math.max(0, data.totalAttendees - 1),
    };
    
    setIsJoining(true);
    await mutate(optimisticData, { revalidate: false });
    
    try {
      const response = await fetch(`/api/discover/events/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });
      
      if (response.ok) {
        const result = await response.json();
        await mutate({
          ...data,
          isJoined: false,
          totalAttendees: result.totalAttendees ?? Math.max(0, data.totalAttendees - 1),
        }, { revalidate: false });
      } else {
        // Revert on failure
        await mutate(data, { revalidate: false });
      }
    } catch {
      // Revert on error
      await mutate(data, { revalidate: false });
    } finally {
      setIsJoining(false);
    }
  }, [eventId, data, mutate]);

  return {
    event: data?.event ?? null,
    loading: isLoading && !data,
    error: error?.message ?? null,
    updates: data?.updates ?? [],
    attendees: data?.attendees ?? [],
    totalAttendees: data?.totalAttendees ?? 0,
    isJoined: data?.isJoined ?? false,
    isJoining,
    joinEvent,
    leaveEvent,
  };
}

// Hook: useDiscoverArticles - Fetches from API with SWR caching
export function useDiscoverArticles() {
  const { data, error, isLoading } = useSWR<{ articles: DiscoverArticle[] }>(
    '/api/discover/articles',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    }
  );

  return {
    articles: data?.articles ?? [],
    loading: isLoading && !data,
    error: error?.message ?? null,
  };
}

// Hook: useArticle - Fetches single article from API with SWR caching
export function useArticle(articleId: string) {
  const { data, error, isLoading } = useSWR<{ article: DiscoverArticle }>(
    articleId ? `/api/discover/articles/${articleId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    article: data?.article ?? null,
    loading: isLoading && !data,
    error: error?.message ?? null,
  };
}

// Hook: useDiscoverCourses - Fetches from API with SWR caching
export function useDiscoverCourses() {
  const { data, error, isLoading } = useSWR<{ courses: DiscoverCourse[] }>(
    '/api/discover/courses',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    }
  );

  return {
    courses: data?.courses ?? [],
    loading: isLoading && !data,
    error: error?.message ?? null,
  };
}

// Hook: useCourse - Fetches single course from API with SWR caching
export function useCourse(courseId: string) {
  const { data, error, isLoading } = useSWR<{ course: DiscoverCourse }>(
    courseId ? `/api/discover/courses/${courseId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    course: data?.course ?? null,
    loading: isLoading && !data,
    error: error?.message ?? null,
  };
}

// Hook: useDiscoverCategories with SWR caching
export function useDiscoverCategories() {
  const { data } = useSWR<{ categories: DiscoverCategory[] }>(
    '/api/discover/categories',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10 * 60 * 1000, // 10 minutes - categories rarely change
    }
  );

  return { categories: data?.categories ?? [] };
}

// Hook: useDiscoverPrograms - Fetches programs from API with SWR caching
export function useDiscoverPrograms() {
  const { data, error, isLoading } = useSWR<{
    groupPrograms: DiscoverProgram[];
    individualPrograms: DiscoverProgram[];
    enrollmentConstraints: {
      canEnrollInGroup: boolean;
      canEnrollInIndividual: boolean;
    };
  }>(
    '/api/discover/programs',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    }
  );

  return {
    groupPrograms: data?.groupPrograms ?? [],
    individualPrograms: data?.individualPrograms ?? [],
    enrollmentConstraints: data?.enrollmentConstraints ?? {
      canEnrollInGroup: true,
      canEnrollInIndividual: true,
    },
    loading: isLoading && !data,
    error: error?.message ?? null,
  };
}

// Combined hook for the main discover page
// Optimized: derives trending/recommended from articles/courses instead of separate fetches
export function useDiscoverData() {
  const { events, loading: eventsLoading } = useDiscoverEvents();
  const { articles, loading: articlesLoading } = useDiscoverArticles();
  const { courses, loading: coursesLoading } = useDiscoverCourses();
  const { categories } = useDiscoverCategories();
  const {
    groupPrograms,
    individualPrograms,
    enrollmentConstraints,
    loading: programsLoading,
  } = useDiscoverPrograms();

  const loading = eventsLoading || articlesLoading || coursesLoading || programsLoading;

  // Split events into upcoming and past
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    const upcoming: DiscoverEvent[] = [];
    const past: DiscoverEvent[] = [];

    events.forEach((event) => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);

      if (eventDate >= now) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    });

    // Sort upcoming by date ascending (soonest first)
    upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Sort past by date descending (most recent first)
    past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [events]);

  // Derive trending items from articles and courses (no extra fetch!)
  const trending = useMemo(() => {
    const trendingItems: TrendingItem[] = [];

    // Filter trending articles
    const trendingArticles = articles
      .filter((a) => a.trending)
      .map((a) => ({
        id: a.id,
        type: 'article' as const,
        title: a.title,
        snippet: a.content?.substring(0, 100) + '...' || '',
        coverImageUrl: a.coverImageUrl,
        thumbnailUrl: a.thumbnailUrl,
        articleType: a.articleType,
      }));
    trendingItems.push(...trendingArticles);

    // Filter trending courses
    const trendingCourses = courses
      .filter((c) => c.trending)
      .map((c) => ({
        id: c.id,
        type: 'course' as const,
        title: c.title,
        snippet: c.shortDescription?.substring(0, 100) + '...' || '',
        coverImageUrl: c.coverImageUrl,
      }));
    trendingItems.push(...trendingCourses);

    return trendingItems;
  }, [articles, courses]);

  // Derive recommended items from articles and courses (no extra fetch!)
  const recommended = useMemo(() => {
    const recommendedItems: RecommendedItem[] = [];

    // Filter featured articles
    const featuredArticles = articles
      .filter((a) => a.featured)
      .map((a) => ({
        id: a.id,
        type: 'article' as const,
        title: a.title,
        subtitle: a.authorName || '',
        coverImageUrl: a.coverImageUrl || '',
        year: a.publishedAt ? new Date(a.publishedAt).getFullYear().toString() : '',
        articleType: a.articleType,
      }));
    recommendedItems.push(...featuredArticles);

    // Filter featured courses
    const featuredCourses = courses
      .filter((c) => c.featured)
      .map((c) => ({
        id: c.id,
        type: 'course' as const,
        title: c.title,
        subtitle: c.category || '',
        coverImageUrl: c.coverImageUrl || '',
      }));
    recommendedItems.push(...featuredCourses);

    return recommendedItems;
  }, [articles, courses]);

  return {
    events,
    upcomingEvents,
    pastEvents,
    articles,
    courses,
    categories,
    trending,
    recommended,
    groupPrograms,
    individualPrograms,
    enrollmentConstraints,
    loading,
  };
}
