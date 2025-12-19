import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { ClientCoachingData, Coach, UserRole } from '@/types';

interface UseCoachingDataReturn {
  coachingData: ClientCoachingData | null;
  coach: Coach | null;
  hasCoaching: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch the current user's coaching data
 * 
 * Returns:
 * - coachingData: The user's coaching data (if they have coaching access)
 * - coach: The assigned coach info
 * - hasCoaching: Whether the user has coaching access
 * - isLoading: Loading state
 * - error: Error message if any
 */
export function useCoachingData(): UseCoachingDataReturn {
  const { sessionClaims, isLoaded } = useAuth();
  const [coachingData, setCoachingData] = useState<ClientCoachingData | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user has coaching from session claims
  const publicMetadata = sessionClaims?.publicMetadata as {
    coaching?: boolean; // Legacy flag
    coachingStatus?: 'none' | 'active' | 'canceled' | 'past_due'; // New field
    role?: UserRole;
  } | undefined;

  // Check both new coachingStatus and legacy coaching flag for backward compatibility
  const hasCoaching = publicMetadata?.coachingStatus === 'active' || publicMetadata?.coaching === true;

  const fetchCoachingData = async () => {
    if (!isLoaded || !hasCoaching) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/coaching/data');
      if (!response.ok) {
        if (response.status === 403) {
          // User doesn't have coaching access
          setCoachingData(null);
          setCoach(null);
          return;
        }
        throw new Error('Failed to fetch coaching data');
      }

      const data = await response.json();
      setCoachingData(data.data);
      setCoach(data.coach);
    } catch (err) {
      console.error('Error fetching coaching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load coaching data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoachingData();
  }, [isLoaded, hasCoaching]);

  return {
    coachingData,
    coach,
    hasCoaching,
    isLoading,
    error,
    refetch: fetchCoachingData,
  };
}


