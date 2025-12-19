import { useState, useEffect, useCallback } from 'react';
import type { EveningCheckIn, EveningEmotionalState } from '@/types';

interface UseEveningCheckInReturn {
  checkIn: EveningCheckIn | null;
  isLoading: boolean;
  error: string | null;
  startCheckIn: (tasksCompleted: number, tasksTotal: number) => Promise<EveningCheckIn | null>;
  updateEmotionalState: (state: EveningEmotionalState) => Promise<EveningCheckIn | null>;
  saveReflection: (text: string) => Promise<EveningCheckIn | null>;
  completeCheckIn: () => Promise<EveningCheckIn | null>;
  refetch: () => Promise<void>;
}

export function useEveningCheckIn(): UseEveningCheckInReturn {
  const [checkIn, setCheckIn] = useState<EveningCheckIn | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCheckIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkin/evening');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch evening check-in');
      }

      setCheckIn(data.checkIn);
    } catch (err) {
      console.error('Error fetching evening check-in:', err);
      setError(err instanceof Error ? err.message : 'Failed to load evening check-in');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCheckIn();
  }, [fetchCheckIn]);

  const startCheckIn = useCallback(
    async (tasksCompleted: number, tasksTotal: number): Promise<EveningCheckIn | null> => {
      try {
        const response = await fetch('/api/checkin/evening', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasksCompleted, tasksTotal }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to start evening check-in');
        }

        setCheckIn(data.checkIn);
        return data.checkIn;
      } catch (err) {
        console.error('Error starting evening check-in:', err);
        setError(err instanceof Error ? err.message : 'Failed to start evening check-in');
        return null;
      }
    },
    []
  );

  const updateEmotionalState = useCallback(
    async (emotionalState: EveningEmotionalState): Promise<EveningCheckIn | null> => {
      try {
        const response = await fetch('/api/checkin/evening', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emotionalState }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update emotional state');
        }

        setCheckIn(data.checkIn);
        return data.checkIn;
      } catch (err) {
        console.error('Error updating emotional state:', err);
        setError(err instanceof Error ? err.message : 'Failed to update emotional state');
        return null;
      }
    },
    []
  );

  const saveReflection = useCallback(
    async (reflectionText: string): Promise<EveningCheckIn | null> => {
      try {
        const response = await fetch('/api/checkin/evening', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reflectionText }),
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

  const completeCheckIn = useCallback(async (): Promise<EveningCheckIn | null> => {
    try {
      const response = await fetch('/api/checkin/evening', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete evening check-in');
      }

      setCheckIn(data.checkIn);
      return data.checkIn;
    } catch (err) {
      console.error('Error completing evening check-in:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete evening check-in');
      return null;
    }
  }, []);

  return {
    checkIn,
    isLoading,
    error,
    startCheckIn,
    updateEmotionalState,
    saveReflection,
    completeCheckIn,
    refetch: fetchCheckIn,
  };
}














