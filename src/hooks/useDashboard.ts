'use client';

import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';
import type { Habit, MorningCheckIn, EveningCheckIn, Task, Squad, SquadMember } from '@/types';

// Check if we're on demo site (doesn't use hooks, safe for use in hook body)
function isDemoSite(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'demo.coachful.co';
}

export interface ProgramEnrollmentWithDetails {
  id: string;
  programId: string;
  program: {
    id: string;
    name: string;
    description?: string;
    type: 'group' | 'individual';
    lengthDays: number;
    coverImageUrl?: string;
    durationType?: 'fixed' | 'evergreen';
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
    // Evergreen program support
    cycleNumber?: number;
    isEvergreen?: boolean;
  };
  status: string;
}

// Carousel cards types
export interface ProgramPrompt {
  title: string;
  description: string;
}

export interface DiscoverRecommendation {
  id: string;
  type: 'article' | 'course';
  title: string;
  description: string;
  coverImageUrl?: string;
  category?: string;
}

export interface CarouselCardsData {
  programPrompt: {
    hasEnrollment: boolean;
    prompt: ProgramPrompt;
    programName: string | null;
    currentDay: number | null;
    totalDays: number | null;
  };
  discoverRecommendation: DiscoverRecommendation | null;
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
      programDays?: number | null;
      completionConfig?: {
        hasUpsell?: boolean;
        upsellProgramId?: string;
        feedbackEnabled?: boolean;
        celebrationMessage?: string;
      };
      upsellProgram?: {
        id: string;
        name: string;
        description: string;
        coverImageUrl?: string;
        priceInCents: number;
        currency: string;
        lengthDays: number;
      } | null;
    };
  };
  programEnrollments: {
    active: ProgramEnrollmentWithDetails[];
    upcoming: ProgramEnrollmentWithDetails[];
  };
  squads: {
    /** @deprecated Use program instead */
    premium: { squad: Squad | null; members: SquadMember[] };
    /** @deprecated Use standalone instead */
    standard: { squad: Squad | null; members: SquadMember[] };
    /** Squad tied to a program (has programId) */
    program?: { squad: Squad | null; members: SquadMember[] };
    /** Standalone squad (no programId) */
    standalone?: { squad: Squad | null; members: SquadMember[] };
  };
  // Carousel cards data (program prompt + discover recommendation)
  carouselCards?: CarouselCardsData;
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
    program: { show: false, programId: null, programName: null, programDays: null, completionConfig: undefined, upsellProgram: null },
  },
  programEnrollments: { active: [], upcoming: [] },
  squads: {
    premium: { squad: null, members: [] },
    standard: { squad: null, members: [] },
  },
  carouselCards: undefined,
  date: '',
  weekId: '',
  organizationId: null,
};

/**
 * Unified dashboard hook that fetches ALL homepage data in a single request
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Background revalidation without showing skeleton
 * - Automatic deduplication of requests
 */
export function useDashboard() {
  const { user, isLoaded } = useUser();
  
  // Check if on demo site (doesn't use hooks, safe to call here)
  const isDemo = isDemoSite();
  
  const today = new Date().toISOString().split('T')[0];
  // In demo mode, always fetch data even without a user
  const cacheKey = (user || isDemo) ? `/api/dashboard?date=${today}` : null;
  
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    cacheKey,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return response.json();
    },
    {
      // Cache for 1 minute, data changes frequently
      dedupingInterval: 60 * 1000,
      // Don't show loading state on focus, just refresh in background
      revalidateOnFocus: true,
      // Fallback data while loading
      fallbackData: initialData,
    }
  );

  // Use cached data or fallback
  const dashboardData = data ?? initialData;

  return {
    ...dashboardData,
    // Only show loading on INITIAL fetch (when no data exists)
    // In demo mode, consider loaded once SWR starts
    isLoading: isDemo ? (isLoading && !data) : (!isLoaded || (isLoading && !data)),
    error: error?.message ?? null,
    refetch: async () => { await mutate(); },
  };
}
