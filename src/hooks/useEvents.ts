'use client';

/**
 * Unified Event Hooks
 * 
 * Provides React hooks for fetching and managing events across the application.
 * Replaces event-related logic in useDiscoverData.ts for the unified event system.
 */

import useSWR from 'swr';
import { useCallback, useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoEvents } from '@/lib/demo-data';
import type { UnifiedEvent, EventType, EventScope, EventStatus } from '@/types';

// SWR fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
};

// ============================================================================
// Types
// ============================================================================

export interface EventFilters {
  scope?: EventScope;
  eventType?: EventType;
  squadId?: string;
  programId?: string;
  status?: EventStatus;
  upcoming?: boolean;
  limit?: number;
  includeInstances?: boolean;
}

export interface EventAttendee {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface UseEventResult {
  event: UnifiedEvent | null;
  loading: boolean;
  error: string | null;
  attendees: EventAttendee[];
  totalAttendees: number;
  isJoined: boolean;
  userVote: 'yes' | 'no' | null;
  isJoining: boolean;
  isVoting: boolean;
  joinEvent: () => Promise<void>;
  leaveEvent: () => Promise<void>;
  vote: (choice: 'yes' | 'no') => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseEventsResult {
  events: UnifiedEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ============================================================================
// useEvents - List events with filters
// ============================================================================

export function useEvents(filters: EventFilters = {}): UseEventsResult {
  const { isDemoMode } = useDemoMode();
  
  // Demo mode: return demo events directly without API call
  const demoEvents = useMemo(() => {
    if (!isDemoMode) return null;
    const events = generateDemoEvents();
    // Cast to UnifiedEvent[] - demo events have compatible structure
    return events as unknown as UnifiedEvent[];
  }, [isDemoMode]);
  
  // Build query string
  const params = new URLSearchParams();
  
  if (filters.scope) params.set('scope', filters.scope);
  if (filters.eventType) params.set('eventType', filters.eventType);
  if (filters.squadId) params.set('squadId', filters.squadId);
  if (filters.programId) params.set('programId', filters.programId);
  if (filters.status) params.set('status', filters.status);
  if (filters.upcoming !== undefined) params.set('upcoming', String(filters.upcoming));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.includeInstances !== undefined) params.set('includeInstances', String(filters.includeInstances));

  const queryString = params.toString();
  const url = `/api/events${queryString ? `?${queryString}` : ''}`;

  // Skip API call in demo mode
  const { data, error, isLoading, mutate } = useSWR<{ events: UnifiedEvent[] }>(
    isDemoMode ? null : url,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const refresh = useCallback(async () => {
    if (!isDemoMode) {
      await mutate();
    }
  }, [mutate, isDemoMode]);

  // In demo mode, return demo events
  if (isDemoMode) {
    return {
      events: demoEvents ?? [],
      loading: false,
      error: null,
      refresh,
    };
  }

  return {
    events: data?.events ?? [],
    loading: isLoading && !data,
    error: error?.message ?? null,
    refresh,
  };
}

// ============================================================================
// useEvent - Single event with RSVP and voting
// ============================================================================

export function useEvent(eventId: string | null): UseEventResult {
  const { user } = useUser();
  const { isDemoMode } = useDemoMode();
  
  // Demo mode: return demo event directly
  const demoEventData = useMemo(() => {
    if (!isDemoMode || !eventId) return null;
    const events = generateDemoEvents();
    const event = events.find(e => e.id === eventId) || events[0];
    return {
      event: event as unknown as UnifiedEvent,
      attendees: [] as EventAttendee[],
      totalAttendees: 8,
      isJoined: false,
      userVote: null as 'yes' | 'no' | null,
    };
  }, [isDemoMode, eventId]);
  
  const { data, error, isLoading, mutate } = useSWR<{
    event: UnifiedEvent;
    attendees: EventAttendee[];
    totalAttendees: number;
    isJoined: boolean;
    userVote: 'yes' | 'no' | null;
  }>(
    isDemoMode ? null : (eventId ? `/api/events/${eventId}` : null),
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const [isJoining, setIsJoining] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const joinEvent = useCallback(async () => {
    if (!data || !eventId) return;
    
    // Build current user attendee for optimistic update
    const currentUserAttendee: EventAttendee | null = user ? {
      userId: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      avatarUrl: user.imageUrl || null,
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
      const response = await fetch(`/api/events/${eventId}/rsvp`, {
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
    if (!data || !eventId) return;
    
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
      const response = await fetch(`/api/events/${eventId}/rsvp`, {
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

  const vote = useCallback(async (choice: 'yes' | 'no') => {
    if (!data || !eventId) return;
    
    setIsVoting(true);
    
    try {
      const response = await fetch(`/api/events/${eventId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: choice }),
      });
      
      if (response.ok) {
        const result = await response.json();
        await mutate({
          ...data,
          event: result.event,
          userVote: result.userVote,
        }, { revalidate: false });
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsVoting(false);
    }
  }, [eventId, data, mutate]);

  const refresh = useCallback(async () => {
    if (!isDemoMode) {
      await mutate();
    }
  }, [mutate, isDemoMode]);

  // Demo mode: return demo event data
  if (isDemoMode && demoEventData) {
    return {
      event: demoEventData.event,
      loading: false,
      error: null,
      attendees: demoEventData.attendees,
      totalAttendees: demoEventData.totalAttendees,
      isJoined: demoEventData.isJoined,
      userVote: demoEventData.userVote,
      isJoining: false,
      isVoting: false,
      joinEvent: async () => {},
      leaveEvent: async () => {},
      vote: async () => {},
      refresh,
    };
  }

  return {
    event: data?.event ?? null,
    loading: isLoading && !data,
    error: error?.message ?? null,
    attendees: data?.attendees ?? [],
    totalAttendees: data?.totalAttendees ?? 0,
    isJoined: data?.isJoined ?? false,
    userVote: data?.userVote ?? null,
    isJoining,
    isVoting,
    joinEvent,
    leaveEvent,
    vote,
    refresh,
  };
}

// ============================================================================
// useProgramEvents - Events for a specific program
// ============================================================================

export function useProgramEvents(programId: string | null, options: { upcoming?: boolean; limit?: number } = {}): UseEventsResult {
  const { isDemoMode } = useDemoMode();
  
  // Demo mode: return demo events filtered by programId
  const demoEvents = useMemo(() => {
    if (!isDemoMode) return null;
    const events = generateDemoEvents();
    const filtered = programId ? events.filter(e => e.programId === programId || e.programId === 'demo-prog-2') : events;
    return filtered.slice(0, options.limit || 10) as unknown as UnifiedEvent[];
  }, [isDemoMode, programId, options.limit]);
  
  const params = new URLSearchParams();
  if (options.upcoming !== undefined) params.set('upcoming', String(options.upcoming));
  if (options.limit) params.set('limit', String(options.limit));
  
  const queryString = params.toString();
  const url = programId 
    ? `/api/programs/${programId}/events${queryString ? `?${queryString}` : ''}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<{ events: UnifiedEvent[] }>(
    isDemoMode ? null : url,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnMount: true,
    }
  );

  const refresh = useCallback(async () => {
    if (!isDemoMode) {
      await mutate();
    }
  }, [mutate, isDemoMode]);

  if (isDemoMode) {
    return {
      events: demoEvents ?? [],
      loading: false,
      error: null,
      refresh,
    };
  }

  return {
    events: data?.events ?? [],
    loading: isLoading && !data,
    error: error?.message ?? null,
    refresh,
  };
}

// ============================================================================
// useSquadEvents - Events for a specific squad
// ============================================================================

export function useSquadEvents(squadId: string | null, options: { upcoming?: boolean; limit?: number } = {}): UseEventsResult {
  const { isDemoMode } = useDemoMode();
  
  // Demo mode: return demo events filtered by squadId
  const demoEvents = useMemo(() => {
    if (!isDemoMode) return null;
    const events = generateDemoEvents();
    const filtered = squadId ? events.filter(e => e.squadId === squadId || e.squadId === 'demo-squad-1') : events;
    return filtered.slice(0, options.limit || 10) as unknown as UnifiedEvent[];
  }, [isDemoMode, squadId, options.limit]);
  
  const filters: EventFilters = {
    squadId: squadId || undefined,
    upcoming: options.upcoming ?? true,
    limit: options.limit,
    includeInstances: true,
  };

  // Only fetch if squadId is provided
  const params = new URLSearchParams();
  if (filters.squadId) params.set('squadId', filters.squadId);
  if (filters.upcoming !== undefined) params.set('upcoming', String(filters.upcoming));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.includeInstances !== undefined) params.set('includeInstances', String(filters.includeInstances));

  const queryString = params.toString();
  const url = squadId ? `/api/events?${queryString}` : null;

  const { data, error, isLoading, mutate } = useSWR<{ events: UnifiedEvent[] }>(
    isDemoMode ? null : url,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const refresh = useCallback(async () => {
    if (!isDemoMode) {
      await mutate();
    }
  }, [mutate, isDemoMode]);

  if (isDemoMode) {
    return {
      events: demoEvents ?? [],
      loading: false,
      error: null,
      refresh,
    };
  }

  return {
    events: data?.events ?? [],
    loading: isLoading && !data,
    error: error?.message ?? null,
    refresh,
  };
}

// ============================================================================
// useUpcomingEvents - Get upcoming events (any type)
// ============================================================================

export function useUpcomingEvents(limit: number = 10): UseEventsResult {
  return useEvents({
    upcoming: true,
    limit,
    includeInstances: true,
  });
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Hook to create a new event
 */
export function useCreateEvent() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEvent = useCallback(async (eventData: Partial<UnifiedEvent>): Promise<UnifiedEvent | null> => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create event');
      }

      const data = await response.json();
      return data.event;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create event';
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { createEvent, isCreating, error };
}

/**
 * Hook to update an event
 */
export function useUpdateEvent() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateEvent = useCallback(async (
    eventId: string, 
    updates: Partial<UnifiedEvent>,
    options?: { updateFutureInstances?: boolean }
  ): Promise<UnifiedEvent | null> => {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, ...options }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update event');
      }

      const data = await response.json();
      return data.event;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update event';
      setError(message);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return { updateEvent, isUpdating, error };
}

/**
 * Hook to delete/cancel an event
 */
export function useDeleteEvent() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteEvent = useCallback(async (
    eventId: string, 
    options?: { hard?: boolean; cancelFuture?: boolean }
  ): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.hard) params.set('hard', 'true');
      if (options?.cancelFuture) params.set('cancelFuture', 'true');

      const response = await fetch(`/api/events/${eventId}?${params.toString()}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete event');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete event';
      setError(message);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteEvent, isDeleting, error };
}


