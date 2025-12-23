'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import type { Habit, MorningCheckIn, EveningCheckIn, Task, Squad, SquadMember } from '@/types';

export interface ProgramEnrollmentWithDetails {
  id: string;
  programId: string;
  program: {
    id: string;
    name: string;
    type: 'group' | 'individual';
    lengthDays: number;
    coverImageUrl?: string;
  };
  cohort?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  progress: {
    currentDay: number;
    totalDays: number;
    percentComplete: number;
    daysRemaining: number;
  };
  status: string;
}

export interface DashboardData {
  user: Record<string, unknown> | null;
  habits: Habit[];
  tasks: {
    focus: Task[];
    backlog: Task[];
  };
  checkIns: {
    morning: MorningCheckIn | null;
    evening: EveningCheckIn | null;
    weekly: { id: string; completedAt?: string } | null;
    program: {
      show: boolean;
      programId: string | null;
      programName: string | null;
    };
  };
  programEnrollments: {
    active: ProgramEnrollmentWithDetails[];
    upcoming: ProgramEnrollmentWithDetails[];
  };
  squads: {
    premium: { squad: Squad | null; members: SquadMember[] };
    standard: { squad: Squad | null; members: SquadMember[] };
  };
  date: string;
  weekId: string;
  organizationId: string | null;
}

const initialData: DashboardData = {
  user: null,
  habits: [],
  tasks: { focus: [], backlog: [] },
  checkIns: {
    morning: null,
    evening: null,
    weekly: null,
    program: { show: false, programId: null, programName: null },
  },
  programEnrollments: { active: [], upcoming: [] },
  squads: {
    premium: { squad: null, members: [] },
    standard: { squad: null, members: [] },
  },
  date: '',
  weekId: '',
  organizationId: null,
};

/**
 * Unified dashboard hook that fetches ALL homepage data in a single request
 * Replaces 10+ separate API calls with one optimized endpoint
 */
export function useDashboard() {
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<DashboardData>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchDashboard = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/dashboard?date=${today}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('[useDashboard] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    if (isLoaded && user && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchDashboard();
    }
  }, [isLoaded, user, fetchDashboard]);

  // Refetch on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (isLoaded && user) {
        fetchDashboard();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isLoaded, user, fetchDashboard]);

  return {
    ...data,
    isLoading,
    error,
    refetch: fetchDashboard,
  };
}
