'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

// Hook: useDiscoverEvents - Fetches from API
export function useDiscoverEvents() {
  const [events, setEvents] = useState<DiscoverEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch('/api/discover/events');
        if (!response.ok) throw new Error('Failed to fetch events');
        const data = await response.json();
        
        if (data.events) {
          setEvents(data.events);
        }
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  return { events, loading, error };
}

// Hook: useEvent - Fetches single event from API
export function useEvent(eventId: string) {
  const [event, setEvent] = useState<DiscoverEvent | null>(null);
  const [updates, setUpdates] = useState<EventUpdate[]>([]);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [totalAttendees, setTotalAttendees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    async function fetchEvent() {
      try {
        const response = await fetch(`/api/discover/events/${eventId}`);
        if (!response.ok) throw new Error('Failed to fetch event');
        const data = await response.json();
        
        if (data.event) {
          setEvent(data.event);
          if (data.updates) {
            setUpdates(data.updates);
          }
          // Set real attendee data from API
          if (data.attendees) {
            setAttendees(data.attendees);
          }
          if (typeof data.totalAttendees === 'number') {
            setTotalAttendees(data.totalAttendees);
          }
          // Set initial RSVP status from API
          if (typeof data.isJoined === 'boolean') {
            setIsJoined(data.isJoined);
          }
        }
      } catch (err) {
        console.error('Failed to fetch event:', err);
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [eventId]);

  const joinEvent = useCallback(async () => {
    // Optimistic update - set joined immediately for better UX
    setIsJoined(true);
    setIsJoining(true);
    setTotalAttendees(prev => prev + 1);
    
    try {
      const response = await fetch(`/api/discover/events/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (typeof data.totalAttendees === 'number') {
          setTotalAttendees(data.totalAttendees);
        }
      } else {
        // Revert optimistic update if failed
        setIsJoined(false);
        setTotalAttendees(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to join event:', err);
      // Revert optimistic update if failed
      setIsJoined(false);
      setTotalAttendees(prev => Math.max(0, prev - 1));
    } finally {
      setIsJoining(false);
    }
  }, [eventId]);

  const leaveEvent = useCallback(async () => {
    // Optimistic update - set left immediately for better UX
    setIsJoined(false);
    setIsJoining(true);
    setTotalAttendees(prev => Math.max(0, prev - 1));
    
    try {
      const response = await fetch(`/api/discover/events/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (typeof data.totalAttendees === 'number') {
          setTotalAttendees(data.totalAttendees);
        }
      } else {
        // Revert optimistic update if failed
        setIsJoined(true);
        setTotalAttendees(prev => prev + 1);
      }
    } catch (err) {
      console.error('Failed to leave event:', err);
      // Revert optimistic update if failed
      setIsJoined(true);
      setTotalAttendees(prev => prev + 1);
    } finally {
      setIsJoining(false);
    }
  }, [eventId]);

  return { 
    event, 
    loading, 
    error, 
    updates, 
    attendees,
    totalAttendees,
    isJoined,
    isJoining,
    joinEvent,
    leaveEvent,
  };
}

// Hook: useDiscoverArticles - Fetches from API
export function useDiscoverArticles() {
  const [articles, setArticles] = useState<DiscoverArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch('/api/discover/articles');
        if (!response.ok) throw new Error('Failed to fetch articles');
        const data = await response.json();
        
        if (data.articles) {
          setArticles(data.articles);
        }
      } catch (err) {
        console.error('Failed to fetch articles:', err);
        setError('Failed to load articles');
      } finally {
        setLoading(false);
      }
    }

    fetchArticles();
  }, []);

  return { articles, loading, error };
}

// Hook: useArticle - Fetches single article from API
export function useArticle(articleId: string) {
  const [article, setArticle] = useState<DiscoverArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const response = await fetch(`/api/discover/articles/${articleId}`);
        if (!response.ok) throw new Error('Failed to fetch article');
        const data = await response.json();
        
        if (data.article) {
          setArticle(data.article);
        }
      } catch (err) {
        console.error('Failed to fetch article:', err);
        setError('Failed to load article');
      } finally {
        setLoading(false);
      }
    }

    fetchArticle();
  }, [articleId]);

  return { article, loading, error };
}

// Hook: useDiscoverCourses - Fetches from API
export function useDiscoverCourses() {
  const [courses, setCourses] = useState<DiscoverCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const response = await fetch('/api/discover/courses');
        if (!response.ok) throw new Error('Failed to fetch courses');
        const data = await response.json();
        
        if (data.courses) {
          setCourses(data.courses);
        }
      } catch (err) {
        console.error('Failed to fetch courses:', err);
        setError('Failed to load courses');
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, []);

  return { courses, loading, error };
}

// Hook: useCourse - Fetches single course from API
export function useCourse(courseId: string) {
  const [course, setCourse] = useState<DiscoverCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const response = await fetch(`/api/discover/courses/${courseId}`);
        if (!response.ok) throw new Error('Failed to fetch course');
        const data = await response.json();
        
        if (data.course) {
          setCourse(data.course);
        }
      } catch (err) {
        console.error('Failed to fetch course:', err);
        setError('Failed to load course');
      } finally {
        setLoading(false);
      }
    }

    fetchCourse();
  }, [courseId]);

  return { course, loading, error };
}

// Hook: useDiscoverCategories
export function useDiscoverCategories() {
  const [categories, setCategories] = useState<DiscoverCategory[]>([]);
  
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/discover/categories');
        if (response.ok) {
          const data = await response.json();
          if (data.categories) {
            setCategories(data.categories);
          }
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    }
    
    fetchCategories();
  }, []);

  return { categories };
}

// Hook: useDiscoverPrograms - Fetches programs from API
export function useDiscoverPrograms() {
  const [groupPrograms, setGroupPrograms] = useState<DiscoverProgram[]>([]);
  const [individualPrograms, setIndividualPrograms] = useState<DiscoverProgram[]>([]);
  const [enrollmentConstraints, setEnrollmentConstraints] = useState<{
    canEnrollInGroup: boolean;
    canEnrollInIndividual: boolean;
  }>({ canEnrollInGroup: true, canEnrollInIndividual: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrograms() {
      try {
        const response = await fetch('/api/discover/programs');
        if (!response.ok) throw new Error('Failed to fetch programs');
        const data = await response.json();
        
        if (data.groupPrograms) {
          setGroupPrograms(data.groupPrograms);
        }
        if (data.individualPrograms) {
          setIndividualPrograms(data.individualPrograms);
        }
        if (data.enrollmentConstraints) {
          setEnrollmentConstraints(data.enrollmentConstraints);
        }
      } catch (err) {
        console.error('Failed to fetch programs:', err);
        setError('Failed to load programs');
      } finally {
        setLoading(false);
      }
    }

    fetchPrograms();
  }, []);

  return { groupPrograms, individualPrograms, enrollmentConstraints, loading, error };
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
    loading: programsLoading 
  } = useDiscoverPrograms();

  const loading = eventsLoading || articlesLoading || coursesLoading || programsLoading;

  // Split events into upcoming and past
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    
    const upcoming: DiscoverEvent[] = [];
    const past: DiscoverEvent[] = [];
    
    events.forEach(event => {
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
      .filter(a => a.trending)
      .map(a => ({
        id: a.id,
        type: 'article' as const,
        title: a.title,
        snippet: a.content?.substring(0, 100) + '...' || '',
        coverImageUrl: a.coverImageUrl,
        articleType: a.articleType,
      }));
    trendingItems.push(...trendingArticles);

    // Filter trending courses
    const trendingCourses = courses
      .filter(c => c.trending)
      .map(c => ({
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
      .filter(a => a.featured)
      .map(a => ({
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
      .filter(c => c.featured)
      .map(c => ({
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
