import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { Squad, UserRole } from '@/types';

interface UseCoachSquadsReturn {
  squads: Squad[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isCoach: boolean;
}

/**
 * Hook to fetch all squads a coach manages
 * 
 * Returns:
 * - squads: Array of squads the coach manages
 * - isLoading: Loading state
 * - error: Error message if any
 * - refetch: Function to refetch the data
 * - isCoach: Whether the current user is a coach
 * 
 * For non-coaches, returns empty array and isCoach=false
 */
export function useCoachSquads(): UseCoachSquadsReturn {
  const { sessionClaims, isLoaded } = useAuth();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is a coach from session claims
  const publicMetadata = sessionClaims?.publicMetadata as {
    role?: UserRole;
  } | undefined;

  const isCoach = publicMetadata?.role === 'coach';

  const fetchCoachSquads = useCallback(async () => {
    // Not loaded yet or not a coach - don't fetch
    if (!isLoaded) {
      return;
    }

    if (!isCoach) {
      setSquads([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/coach/squads');
      if (!response.ok) {
        if (response.status === 403) {
          // User doesn't have coach access
          setSquads([]);
          return;
        }
        throw new Error('Failed to fetch coach squads');
      }

      const data = await response.json();
      setSquads(data.squads || []);
    } catch (err) {
      console.error('Error fetching coach squads:', err);
      setError(err instanceof Error ? err.message : 'Failed to load coach squads');
      setSquads([]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isCoach]);

  useEffect(() => {
    fetchCoachSquads();
  }, [fetchCoachSquads]);

  return {
    squads,
    isLoading,
    error,
    refetch: fetchCoachSquads,
    isCoach,
  };
}








