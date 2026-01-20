'use client';

import useSWR from 'swr';
import { useCallback, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import type {
  DiscoverEvent,
  DiscoverArticle,
  DiscoverCourse,
  DiscoverCategory,
  DiscoverProgram,
  DiscoverSquad,
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
  const { user } = useUser();
  
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
    
    // Build current user attendee for optimistic update
    const currentUserAttendee: EventAttendee | null = user ? {
      userId: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      avatarUrl: user.imageUrl || undefined,
    } : null;
    
    // Optimistic update - include user in attendees array
    const optimisticData = {
      ...data,
      isJoined: true,
      totalAttendees: data.totalAttendees + 1,
      attendees: currentUserAttendee 
        ? [currentUserAttendee, ...data.attendees.filter(a => a.userId !== user?.id)]
        : data.attendees,
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
        // Revalidate to get the accurate server data (including proper attendees list)
        await mutate();
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
  }, [eventId, data, mutate, user]);

  const leaveEvent = useCallback(async () => {
    if (!data) return;
    
    // Optimistic update - remove user from attendees array
    const optimisticData = {
      ...data,
      isJoined: false,
      totalAttendees: Math.max(0, data.totalAttendees - 1),
      attendees: user 
        ? data.attendees.filter(a => a.userId !== user.id)
        : data.attendees,
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
        // Revalidate to get the accurate server data
        await mutate();
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
  }, [eventId, data, mutate, user]);

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

// Hook: useDiscoverSquads - Fetches public squads from API with SWR caching
export function useDiscoverSquads() {
  const { data, error, isLoading } = useSWR<{
    trackSquads?: DiscoverSquad[];
    generalSquads?: DiscoverSquad[];
    otherTrackSquads?: DiscoverSquad[];
    premiumSquads?: DiscoverSquad[];
    standardSquads?: DiscoverSquad[];
  }>(
    '/api/squad/discover',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Combine all squads from the API response
  const publicSquads = useMemo(() => {
    if (!data) return [];
    return [
      ...(data.trackSquads || []),
      ...(data.generalSquads || []),
      ...(data.otherTrackSquads || []),
      ...(data.premiumSquads || []),
      ...(data.standardSquads || []),
    ];
  }, [data]);

  return {
    publicSquads,
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
  const { publicSquads, loading: squadsLoading } = useDiscoverSquads();

  const loading = eventsLoading || articlesLoading || coursesLoading || programsLoading || squadsLoading;

  // Split events into upcoming and past
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    const upcoming: DiscoverEvent[] = [];
    const past: DiscoverEvent[] = [];

    console.log('[useDiscoverData] Splitting events, total:', events.length, 'now:', now.toISOString());

    events.forEach((event) => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);

      console.log('[useDiscoverData] Event:', event.title, 'date:', event.date, 'parsed:', eventDate.toISOString(), 'isPast:', eventDate < now);

      if (eventDate >= now) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    });

    console.log('[useDiscoverData] Split result - upcoming:', upcoming.length, 'past:', past.length);

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
    publicSquads,
    loading,
  };
}

// Hook: useMyContent - Fetches user's purchased/enrolled content
export function useMyContent() {
  const { data, error, isLoading, mutate } = useSWR<{
    items: import('@/types/discover').MyContentItem[];
    totalCount: number;
    counts: {
      programs: number;
      squads: number;
      courses: number;
      articles: number;
      events: number;
      downloads: number;
      links: number;
    };
  }>(
    '/api/my-content',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2 * 60 * 1000, // 2 minutes
    }
  );

  return {
    myContent: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    counts: data?.counts ?? {
      programs: 0,
      squads: 0,
      courses: 0,
      articles: 0,
      events: 0,
      downloads: 0,
      links: 0,
    },
    loading: isLoading && !data,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

// Hook: useDiscoverDownloads - Fetches public downloads
export function useDiscoverDownloads() {
  const { data, error, isLoading } = useSWR<{ downloads: import('@/types/discover').DiscoverDownload[] }>(
    '/api/discover/downloads',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    }
  );

  return {
    downloads: data?.downloads ?? [],
    loading: isLoading && !data,
    error: error?.message ?? null,
  };
}

// Hook: useDiscoverLinks - Fetches public links
export function useDiscoverLinks() {
  const { data, error, isLoading } = useSWR<{ links: import('@/types/discover').DiscoverLink[] }>(
    '/api/discover/links',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    }
  );

  return {
    links: data?.links ?? [],
    loading: isLoading && !data,
    error: error?.message ?? null,
  };
}
