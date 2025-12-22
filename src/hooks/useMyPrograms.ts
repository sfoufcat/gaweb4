'use client';

import { useState, useEffect, useCallback } from 'react';
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
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching user's enrolled programs (both group and individual)
 * 
 * Returns:
 * - groupProgram: User's active group program enrollment (max 1)
 * - individualProgram: User's active 1:1 program enrollment (max 1)
 * - enrollments: All enrollments array
 * - groupSquad: Squad from group program (for Squad tab)
 */
export function useMyPrograms(): UseMyProgramsReturn {
  const { user, isLoaded } = useUser();
  
  const [enrollments, setEnrollments] = useState<EnrolledProgramWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEnrollments = useCallback(async () => {
    if (!user) {
      setEnrollments([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/programs/my-programs');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch programs');
      }

      const data = await response.json();
      setEnrollments(data.enrollments || []);
    } catch (err) {
      console.error('Error fetching programs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch programs');
      setEnrollments([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setEnrollments([]);
      setIsLoading(false);
      return;
    }

    fetchEnrollments();
  }, [isLoaded, user, fetchEnrollments]);

  // Derive group and individual programs
  const groupProgram = enrollments.find(e => e.program.type === 'group') || null;
  const individualProgram = enrollments.find(e => e.program.type === 'individual') || null;
  
  // Get squad from group program
  const groupSquad = groupProgram?.squad || null;

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchEnrollments();
  }, [fetchEnrollments]);

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
    
    isLoading,
    error,
    refresh,
  };
}

