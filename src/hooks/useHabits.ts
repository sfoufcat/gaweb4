import { useState, useEffect } from 'react';
import type { Habit, HabitFormData } from '@/types';

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHabits = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/habits');
      
      // Handle any non-OK response gracefully
      if (!response.ok) {
        console.warn('Habits API returned non-OK status:', response.status);
        setHabits([]);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      setHabits(data.habits || []);
    } catch (err) {
      // Silently fail and return empty habits
      console.warn('Error fetching habits (non-critical):', err);
      setHabits([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createHabit = async (data: HabitFormData) => {
    try {
      const response = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create habit');
      }

      const result = await response.json();
      setHabits(prev => [result.habit, ...prev]);
      return result.habit;
    } catch (err) {
      console.error('Error creating habit:', err);
      throw err;
    }
  };

  const updateHabit = async (id: string, data: Partial<HabitFormData>) => {
    try {
      const response = await fetch(`/api/habits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update habit');
      }

      const result = await response.json();
      setHabits(prev => prev.map(h => h.id === id ? result.habit : h));
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

      // Remove from active habits list (it will be fetched separately as archived)
      setHabits(prev => prev.filter(h => h.id !== id));
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
        const data = await response.json();
        throw new Error(data.error || 'Failed to mark habit complete');
      }

      const result = await response.json();
      setHabits(prev => prev.map(h => 
        h.id === id ? { ...h, progress: result.progress } : h
      ));
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
        const data = await response.json();
        throw new Error(data.error || 'Failed to skip habit');
      }

      const result = await response.json();
      setHabits(prev => prev.map(h => 
        h.id === id ? { ...h, progress: result.progress } : h
      ));
    } catch (err) {
      console.error('Error skipping habit:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  return {
    habits,
    isLoading,
    error,
    fetchHabits,
    createHabit,
    updateHabit,
    archiveHabit,
    markComplete,
    markSkip,
  };
}

