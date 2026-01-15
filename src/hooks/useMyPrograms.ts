'use client';

import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';
import { useDemoMode } from '@/contexts/DemoModeContext';
import type { 
  Program, 
  ProgramEnrollment, 
  ProgramCohort,
  Squad,
} from '@/types';

// Minimal member info for avatar display
export interface SquadMemberPreview {
  id: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
}

// Next call info for 1:1 programs (pre-fetched from API)
export interface NextCallInfo {
  datetime: string | null;
  timezone: string;
  location: string;
  title?: string;
}

// Coaching data for 1:1 programs (pre-fetched from API)
export interface CoachingDataPreview {
  focusAreas: string[];
  actionItems: Array<{ id: string; text: string; completed?: boolean }>;
  resources: Array<{ id: string; title: string; url: string; description?: string }>;
  chatChannelId?: string;
}

/**
 * Enrolled program with full details for display
 */
export interface EnrolledProgramWithDetails {
  enrollment: ProgramEnrollment;
  program: Program & {
    coachName: string;
    coachImageUrl?: string;
  };
  cohort?: ProgramCohort | null;
  squad?: Squad | null;
  squadMembers?: SquadMemberPreview[];
  progress: {
    currentDay: number;
    totalDays: number;
    percentage: number;
  };
  // For individual programs: pre-fetched to avoid UI flash
  nextCall?: NextCallInfo | null;
  coachingData?: CoachingDataPreview | null;
}

// Discovery program for users without enrollments
export interface DiscoveryProgram {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  type: 'group' | 'individual';
  lengthDays: number;
  priceInCents: number;
  currency?: string;
  coachName?: string;
  coachImageUrl?: string;
  nextCohort?: {
    id: string;
    name: string;
    startDate: string;
    spotsRemaining: number;
  } | null;
  userEnrollment?: {
    status: string;
    cohortId?: string;
  } | null;
}

interface MyProgramsResponse {
  enrollments: EnrolledProgramWithDetails[];
  isPlatformMode?: boolean;
  // Discovery programs for users without enrollments (pre-fetched)
  discoveryPrograms?: {
    groupPrograms: DiscoveryProgram[];
    individualPrograms: DiscoveryProgram[];
  };
}

export interface UseMyProgramsReturn {
  // Enrollment data
  enrollments: EnrolledProgramWithDetails[];
  groupProgram: EnrolledProgramWithDetails | null;
  individualProgram: EnrolledProgramWithDetails | null;

  // Convenience flags
  hasEnrollments: boolean;
  hasGroupProgram: boolean;
  hasIndividualProgram: boolean;
  hasBothPrograms: boolean;
  programCount: number;

  // Squad from group program (if any)
  groupSquad: Squad | null;
  hasGroupSquad: boolean;

  // Platform mode (no tenant context)
  isPlatformMode: boolean;

  // Discovery programs (for users without enrollments)
  discoveryGroupPrograms: DiscoveryProgram[];
  discoveryIndividualPrograms: DiscoveryProgram[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching user's enrolled programs (both group and individual)
 * 
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Background revalidation without showing skeleton
 * - Automatic deduplication of requests
 * 
 * Returns:
 * - groupProgram: User's active group program enrollment (max 1)
 * - individualProgram: User's active 1:1 program enrollment (max 1)
 * - enrollments: All enrollments array
 * - groupSquad: Squad from group program (for Squad tab)
 */
export function useMyPrograms(): UseMyProgramsReturn {
  const { user, isLoaded } = useUser();
  const { isDemoMode } = useDemoMode();
  
  // In demo mode, always fetch (API will return demo data)
  // Otherwise, only fetch when user is logged in
  const cacheKey = isDemoMode || user ? '/api/programs/my-programs' : null;
  
  const { data, error, isLoading, mutate } = useSWR<MyProgramsResponse>(
    cacheKey,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch programs');
      }
      return response.json();
    },
    {
      // Cache for 2 minutes, program data doesn't change frequently
      dedupingInterval: 2 * 60 * 1000,
      // Revalidate on focus but don't show loading
      revalidateOnFocus: true,
    }
  );

  const isPlatformMode = data?.isPlatformMode ?? false;

  // Sort enrollments: individual (1:1) programs first, then group programs
  const enrollments = [...(data?.enrollments ?? [])].sort((a, b) => {
    if (a.program.type === 'individual' && b.program.type !== 'individual') return -1;
    if (a.program.type !== 'individual' && b.program.type === 'individual') return 1;
    return 0;
  });

  // Derive group and individual programs
  const groupProgram = enrollments.find(e => e.program.type === 'group') || null;
  const individualProgram = enrollments.find(e => e.program.type === 'individual') || null;

  // Get squad from group program
  const groupSquad = groupProgram?.squad || null;

  // Discovery programs (pre-fetched for instant display)
  const discoveryGroupPrograms = data?.discoveryPrograms?.groupPrograms ?? [];
  const discoveryIndividualPrograms = data?.discoveryPrograms?.individualPrograms ?? [];

  return {
    enrollments,
    groupProgram,
    individualProgram,

    hasEnrollments: enrollments.length > 0,
    hasGroupProgram: !!groupProgram,
    hasIndividualProgram: !!individualProgram,
    hasBothPrograms: !!groupProgram && !!individualProgram,
    programCount: enrollments.length,

    groupSquad,
    hasGroupSquad: !!groupSquad,

    isPlatformMode,

    discoveryGroupPrograms,
    discoveryIndividualPrograms,

    // Only show loading on INITIAL fetch (when no data exists)
    // In demo mode, skip waiting for Clerk user to load
    isLoading: (!isDemoMode && !isLoaded) || (isLoading && !data),
    error: error?.message ?? null,
    refresh: async () => { await mutate(); },
  };
}
