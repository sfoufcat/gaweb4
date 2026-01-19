import { useState, useEffect, useCallback } from 'react';
import type { UnifiedEvent, ProposedTime } from '@/types';

interface UseSchedulingEventsOptions {
  startDate: string | null;
  endDate: string | null;
  types?: string[];
  status?: string[];
  role?: 'host' | 'attendee' | 'all';
}

interface UseSchedulingEventsReturn {
  events: UnifiedEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching scheduled events
 */
export function useSchedulingEvents(options: UseSchedulingEventsOptions): UseSchedulingEventsReturn {
  const { startDate, endDate, types, status, role } = options;
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!startDate || !endDate) {
      setEvents([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      if (types && types.length > 0) {
        params.set('types', types.join(','));
      }
      if (status && status.length > 0) {
        params.set('status', status.join(','));
      }
      if (role) {
        params.set('role', role);
      }

      const response = await fetch(`/api/scheduling/events?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch events');
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('[useSchedulingEvents] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, types, status, role]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    isLoading,
    error,
    refetch: fetchEvents,
  };
}

/**
 * Hook for fetching pending call proposals
 * Returns:
 * - proposals: events requiring user response (from others)
 * - myRequests: user's own pending requests awaiting response
 */
export function usePendingProposals() {
  const [proposals, setProposals] = useState<UnifiedEvent[]>([]);
  const [myRequests, setMyRequests] = useState<UnifiedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/scheduling/events', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch pending proposals');
      }

      const data = await response.json();
      setProposals(data.events || []);
      setMyRequests(data.myRequests || []);
    } catch (err) {
      console.error('[usePendingProposals] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch proposals');
      setProposals([]);
      setMyRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return {
    proposals,
    myRequests,
    isLoading,
    error,
    refetch: fetchProposals,
  };
}

interface ProposeCallOptions {
  clientId: string;
  proposedTimes: Array<{ startDateTime: string; endDateTime: string }>;
  title?: string;
  description?: string;
  duration?: number;
  locationType?: 'online' | 'chat';
  locationLabel?: string;
  meetingLink?: string;
  meetingProvider?: 'zoom' | 'google_meet' | 'stream' | 'manual';
  externalMeetingId?: string;
  schedulingNotes?: string;
  respondBy?: string;
  isRecurring?: boolean;
  recurrence?: {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    timezone: string;
    startDate: string;
    endDate?: string;
  };
  // Program instance linking (Phase 3)
  instanceId?: string;
}

interface RequestCallOptions {
  proposedTimes?: Array<{ startDateTime: string; endDateTime: string }>;
  title?: string;
  description?: string;
  duration?: number;
  // Program call tracking
  isProgramCall?: boolean;
  isExtraCall?: boolean;
  enrollmentId?: string;
  paymentIntentId?: string; // For paid extra calls
  // Direct booking mode (skips coach approval)
  directBooking?: boolean;
  startDateTime?: string; // For direct booking
  endDateTime?: string; // For direct booking
}

interface RespondOptions {
  eventId: string;
  action: 'accept' | 'decline' | 'counter';
  selectedTimeId?: string;
  counterTimes?: Array<{ startDateTime: string; endDateTime: string }>;
  message?: string;
}

interface RescheduleOptions {
  eventId: string;
  proposedTimes: Array<{ startDateTime: string; endDateTime: string }>;
  reason?: string;
}

interface UseSchedulingActionsReturn {
  proposeCall: (options: ProposeCallOptions) => Promise<UnifiedEvent>;
  requestCall: (options: RequestCallOptions) => Promise<UnifiedEvent>;
  respondToProposal: (options: RespondOptions) => Promise<UnifiedEvent>;
  cancelEvent: (eventId: string, reason?: string) => Promise<void>;
  rescheduleEvent: (options: RescheduleOptions) => Promise<UnifiedEvent>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for scheduling actions (propose, request, respond, cancel)
 */
export function useSchedulingActions(): UseSchedulingActionsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proposeCall = useCallback(async (options: ProposeCallOptions): Promise<UnifiedEvent> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/scheduling/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to propose call');
      }

      const data = await response.json();
      return data.event;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to propose call';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestCall = useCallback(async (options: RequestCallOptions): Promise<UnifiedEvent> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/scheduling/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request call');
      }

      const data = await response.json();
      return data.event;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request call';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const respondToProposal = useCallback(async (options: RespondOptions): Promise<UnifiedEvent> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/scheduling/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to respond to proposal');
      }

      const data = await response.json();
      return data.event;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to respond';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelEvent = useCallback(async (eventId: string, reason?: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/scheduling/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, reason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel event');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rescheduleEvent = useCallback(async (options: RescheduleOptions): Promise<UnifiedEvent> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/scheduling/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reschedule event');
      }

      const data = await response.json();
      return data.newEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reschedule';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    proposeCall,
    requestCall,
    respondToProposal,
    cancelEvent,
    rescheduleEvent,
    isLoading,
    error,
  };
}


