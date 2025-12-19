import { useState, useEffect, useCallback } from 'react';
import type { WeeklyReflectionCheckIn, OnTrackStatus } from '@/types';

interface UseWeeklyReflectionReturn {
  checkIn: WeeklyReflectionCheckIn | null;
  isLoading: boolean;
  error: string | null;
  startCheckIn: () => Promise<WeeklyReflectionCheckIn | null>;
  updateOnTrackStatus: (status: OnTrackStatus) => Promise<WeeklyReflectionCheckIn | null>;
  updateProgress: (progress: number) => Promise<WeeklyReflectionCheckIn | null>;
  saveReflection: (field: 'whatWentWell' | 'biggestObstacles' | 'nextWeekPlan' | 'publicFocus', value: string) => Promise<WeeklyReflectionCheckIn | null>;
  completeCheckIn: () => Promise<WeeklyReflectionCheckIn | null>;
  markGoalComplete: () => Promise<WeeklyReflectionCheckIn | null>;
  refetch: () => Promise<void>;
}

// Get the week identifier (Monday of the current week)
// Prefixed with underscore as it's available for future use
function _getWeekId(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export function useWeeklyReflection(): UseWeeklyReflectionReturn {
  const [checkIn, setCheckIn] = useState<WeeklyReflectionCheckIn | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCheckIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkin/weekly');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch weekly reflection');
      }

      setCheckIn(data.checkIn);
    } catch (err) {
      console.error('Error fetching weekly reflection:', err);
      setError(err instanceof Error ? err.message : 'Failed to load weekly reflection');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCheckIn();
  }, [fetchCheckIn]);

  const startCheckIn = useCallback(async (): Promise<WeeklyReflectionCheckIn | null> => {
    try {
      const response = await fetch('/api/checkin/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start weekly reflection');
      }

      setCheckIn(data.checkIn);
      return data.checkIn;
    } catch (err) {
      console.error('Error starting weekly reflection:', err);
      setError(err instanceof Error ? err.message : 'Failed to start weekly reflection');
      return null;
    }
  }, []);

  const updateOnTrackStatus = useCallback(
    async (onTrackStatus: OnTrackStatus): Promise<WeeklyReflectionCheckIn | null> => {
      try {
        const response = await fetch('/api/checkin/weekly', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onTrackStatus }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update on-track status');
        }

        setCheckIn(data.checkIn);
        return data.checkIn;
      } catch (err) {
        console.error('Error updating on-track status:', err);
        setError(err instanceof Error ? err.message : 'Failed to update on-track status');
        return null;
      }
    },
    []
  );

  const updateProgress = useCallback(
    async (progress: number): Promise<WeeklyReflectionCheckIn | null> => {
      try {
        const response = await fetch('/api/checkin/weekly', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update progress');
        }

        setCheckIn(data.checkIn);
        return data.checkIn;
      } catch (err) {
        console.error('Error updating progress:', err);
        setError(err instanceof Error ? err.message : 'Failed to update progress');
        return null;
      }
    },
    []
  );

  const saveReflection = useCallback(
    async (
      field: 'whatWentWell' | 'biggestObstacles' | 'nextWeekPlan' | 'publicFocus',
      value: string
    ): Promise<WeeklyReflectionCheckIn | null> => {
      try {
        const response = await fetch('/api/checkin/weekly', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save reflection');
        }

        setCheckIn(data.checkIn);
        return data.checkIn;
      } catch (err) {
        console.error('Error saving reflection:', err);
        setError(err instanceof Error ? err.message : 'Failed to save reflection');
        return null;
      }
    },
    []
  );

  const completeCheckIn = useCallback(async (): Promise<WeeklyReflectionCheckIn | null> => {
    try {
      const response = await fetch('/api/checkin/weekly', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete weekly reflection');
      }

      setCheckIn(data.checkIn);
      return data.checkIn;
    } catch (err) {
      console.error('Error completing weekly reflection:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete weekly reflection');
      return null;
    }
  }, []);

  const markGoalComplete = useCallback(async (): Promise<WeeklyReflectionCheckIn | null> => {
    try {
      const response = await fetch('/api/checkin/weekly', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalCompleted: true, completedAt: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark goal as complete');
      }

      setCheckIn(data.checkIn);
      return data.checkIn;
    } catch (err) {
      console.error('Error marking goal complete:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark goal as complete');
      return null;
    }
  }, []);

  return {
    checkIn,
    isLoading,
    error,
    startCheckIn,
    updateOnTrackStatus,
    updateProgress,
    saveReflection,
    completeCheckIn,
    markGoalComplete,
    refetch: fetchCheckIn,
  };
}



