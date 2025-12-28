'use client';

import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';

interface AvailableProgramsResponse {
  totalCount: number;
  groupPrograms: Array<{ id: string; userEnrollment?: { status: string } | null }>;
  individualPrograms: Array<{ id: string; userEnrollment?: { status: string } | null }>;
}

interface UseAvailableProgramsReturn {
  hasAvailablePrograms: boolean;
  availableCount: number;
  isLoading: boolean;
}

/**
 * Lightweight hook to check if any programs are available for the user to discover.
 * Filters out programs the user is already enrolled in.
 * 
 * @returns { hasAvailablePrograms, availableCount, isLoading }
 */
export function useAvailablePrograms(): UseAvailableProgramsReturn {
  const { user, isLoaded } = useUser();
  
  const { data, isLoading } = useSWR<AvailableProgramsResponse>(
    user ? '/api/discover/programs' : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch programs');
      }
      return response.json();
    },
    {
      // Cache for 5 minutes - program availability doesn't change often
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  // Filter out programs user is already enrolled in
  const availableGroup = (data?.groupPrograms || []).filter(p => !p.userEnrollment);
  const availableIndividual = (data?.individualPrograms || []).filter(p => !p.userEnrollment);
  const availableCount = availableGroup.length + availableIndividual.length;

  return {
    hasAvailablePrograms: availableCount > 0,
    availableCount,
    isLoading: !isLoaded || isLoading,
  };
}

export default useAvailablePrograms;




