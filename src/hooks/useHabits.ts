'use client';

import useSWR from 'swr';
import type { Habit, HabitFormData } from '@/types';

const HABITS_CACHE_KEY = '/api/habits';

interface HabitsResponse {
  habits: Habit[];
}

/**
 * Hook for managing user habits with SWR caching
 * 
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Optimistic updates for mutations
 * - Background revalidation for fresh data
 */
export function useHabits() {
  const { data, error, isLoading, mutate } = useSWR<HabitsResponse>(
    HABITS_CACHE_KEY,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('Habits API returned non-OK status:', response.status);
        return { habits: [] };
      }
      return response.json();
    },
    {
      // Fallback to empty array while loading
      fallbackData: { habits: [] },
      revalidateOnFocus: false,
    }
  );

  const habits = data?.habits ?? [];

  const fetchHabits = async () => {
    await mutate();
  };

  const createHabit = async (formData: HabitFormData) => {
    try {
      const response = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create habit');
      }

      const result = await response.json();
      
      // Optimistically update cache
      await mutate(
        { habits: [result.habit, ...habits] },
        { revalidate: false }
      );
      
      return result.habit;
    } catch (err) {
      console.error('Error creating habit:', err);
      throw err;
    }
  };

  const updateHabit = async (id: string, formData: Partial<HabitFormData>) => {
    try {
      const response = await fetch(`/api/habits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update habit');
      }

      const result = await response.json();
      
      // Optimistically update cache
      await mutate(
        { habits: habits.map(h => h.id === id ? result.habit : h) },
        { revalidate: false }
      );
      
      return result.habit;
    } catch (err) {
      console.error('Error updating habit:', err);
      throw err;
    }
  };

  const archiveHabit = async (id: string) => {
    try {
      const response = await fetch(`/api/habits/${id}/archive`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to archive habit');
      }

      // Optimistically remove from cache
      await mutate(
        { habits: habits.filter(h => h.id !== id) },
        { revalidate: false }
      );
    } catch (err) {
      console.error('Error archiving habit:', err);
      throw err;
    }
  };

  const markComplete = async (id: string) => {
    try {
      const response = await fetch(`/api/habits/${id}/progress`, {
        method: 'POST',
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || 'Failed to mark habit complete');
      }

      const result = await response.json();
      
      // Optimistically update progress in cache
      await mutate(
        { habits: habits.map(h => h.id === id ? { ...h, progress: result.progress } : h) },
        { revalidate: false }
      );
    } catch (err) {
      console.error('Error marking habit complete:', err);
      throw err;
    }
  };

  const markSkip = async (id: string) => {
    try {
      const response = await fetch(`/api/habits/${id}/skip`, {
        method: 'POST',
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || 'Failed to skip habit');
      }

      const result = await response.json();
      
      // Optimistically update progress in cache
      await mutate(
        { habits: habits.map(h => h.id === id ? { ...h, progress: result.progress } : h) },
        { revalidate: false }
      );
    } catch (err) {
      console.error('Error skipping habit:', err);
      throw err;
    }
  };

  return {
    habits,
    isLoading: isLoading && habits.length === 0,
    error: error?.message ?? null,
    fetchHabits,
    createHabit,
    updateHabit,
    archiveHabit,
    markComplete,
    markSkip,
  };
}
