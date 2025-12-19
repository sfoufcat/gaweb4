'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import type { FirebaseUser, Habit, Task } from '@/types';

interface DashboardData {
  user: FirebaseUser | null;
  habits: Habit[];
  tasks: {
    focus: Task[];
    backlog: Task[];
  };
  date: string;
}

interface UseDashboardReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch all dashboard data in one request
 * Replaces multiple separate API calls for better performance
 */
export function useDashboard(): UseDashboardReturn {
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const date = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/dashboard?date=${date}`);

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err: unknown) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isLoaded]);

  return {
    data,
    loading,
    error,
    refetch: fetchDashboard,
  };
}

