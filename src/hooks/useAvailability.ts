import { useState, useEffect, useCallback } from 'react';
import type { CoachAvailability, WeeklySchedule, BlockedSlot, TimeSlot } from '@/types';

interface UseAvailabilityReturn {
  availability: CoachAvailability | null;
  isLoading: boolean;
  error: string | null;
  isDefault: boolean;
  updateAvailability: (updates: Partial<CoachAvailability>) => Promise<void>;
  addBlockedSlot: (slot: Omit<BlockedSlot, 'id'>) => Promise<void>;
  removeBlockedSlot: (slotId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing coach availability settings
 */
export function useAvailability(): UseAvailabilityReturn {
  const [availability, setAvailability] = useState<CoachAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  const fetchAvailability = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Pass client's timezone so the API can use it as default for new coaches
      const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const params = new URLSearchParams({ clientTimezone });
      const response = await fetch(`/api/coach/availability?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch availability');
      }

      const data = await response.json();
      setAvailability(data.availability);
      setIsDefault(data.isDefault || false);
    } catch (err) {
      console.error('[useAvailability] Error fetching:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch availability');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const updateAvailability = useCallback(async (updates: Partial<CoachAvailability>) => {
    try {
      setError(null);

      const response = await fetch('/api/coach/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update availability');
      }

      const data = await response.json();
      setAvailability(data.availability);
      setIsDefault(false);
    } catch (err) {
      console.error('[useAvailability] Error updating:', err);
      setError(err instanceof Error ? err.message : 'Failed to update availability');
      throw err;
    }
  }, []);

  const addBlockedSlot = useCallback(async (slot: Omit<BlockedSlot, 'id'>) => {
    try {
      setError(null);

      const response = await fetch('/api/coach/availability/blocked-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slot),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add blocked slot');
      }

      // Refetch to get updated availability
      await fetchAvailability();
    } catch (err) {
      console.error('[useAvailability] Error adding blocked slot:', err);
      setError(err instanceof Error ? err.message : 'Failed to add blocked slot');
      throw err;
    }
  }, [fetchAvailability]);

  const removeBlockedSlot = useCallback(async (slotId: string) => {
    try {
      setError(null);

      const response = await fetch('/api/coach/availability/blocked-slots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove blocked slot');
      }

      // Refetch to get updated availability
      await fetchAvailability();
    } catch (err) {
      console.error('[useAvailability] Error removing blocked slot:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove blocked slot');
      throw err;
    }
  }, [fetchAvailability]);

  return {
    availability,
    isLoading,
    error,
    isDefault,
    updateAvailability,
    addBlockedSlot,
    removeBlockedSlot,
    refetch: fetchAvailability,
  };
}

/**
 * Hook for fetching available time slots for scheduling
 * @param isCoach - If true, bypasses minimum notice time restriction (for coach-initiated scheduling)
 */
export function useAvailableSlots(
  startDate: string | null,
  endDate: string | null,
  duration?: number,
  isCoach?: boolean
) {
  const [slots, setSlots] = useState<Array<{ start: string; end: string; duration: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>(() =>
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC'
  );

  const fetchSlots = useCallback(async () => {
    if (!startDate || !endDate) {
      setSlots([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      if (duration) {
        params.set('duration', duration.toString());
      }
      if (isCoach) {
        params.set('isCoach', 'true');
      }

      const response = await fetch(`/api/scheduling/available-slots?${params}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch available slots');
      }

      const data = await response.json();
      setSlots(data.slots || []);
      setTimezone(data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (err) {
      console.error('[useAvailableSlots] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch slots');
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, duration, isCoach]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  return {
    slots,
    isLoading,
    error,
    timezone,
    refetch: fetchSlots,
  };
}


