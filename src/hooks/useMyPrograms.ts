'use client';

import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';
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
}

interface MyProgramsResponse {
  enrollments: EnrolledProgramWithDetails[];
  isPlatformMode?: boolean;
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
  
  const cacheKey = user ? '/api/programs/my-programs' : null;
  
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

  const enrollments = data?.enrollments ?? [];
  const isPlatformMode = data?.isPlatformMode ?? false;
  
  // Derive group and individual programs
  const groupProgram = enrollments.find(e => e.program.type === 'group') || null;
  const individualProgram = enrollments.find(e => e.program.type === 'individual') || null;
  
  // Get squad from group program
  const groupSquad = groupProgram?.squad || null;

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
    
    // Only show loading on INITIAL fetch (when no data exists)
    isLoading: !isLoaded || (isLoading && !data),
    error: error?.message ?? null,
    refresh: () => mutate(),
  };
}
