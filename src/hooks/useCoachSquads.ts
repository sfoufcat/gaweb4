import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { Squad, UserRole, OrgRole } from '@/types';

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
 * - isCoach: Whether the current user is a coach (global or org-level)
 * 
 * For non-coaches, returns empty array and isCoach=false
 * 
 * Multi-tenancy support:
 * - For super_coach (orgRole === 'super_coach'): calls /api/coach/org-squads (returns all org squads)
 * - For global coaches (role === 'coach'): calls /api/coach/squads (returns squads where coachId === userId)
 * - For regular org coaches (orgRole === 'coach'): calls /api/coach/squads (returns only squads they coach)
 */
export function useCoachSquads(): UseCoachSquadsReturn {
  const { sessionClaims, isLoaded } = useAuth();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is a coach from session claims (global role or org-level role)
  const publicMetadata = sessionClaims?.publicMetadata as {
    role?: UserRole;
    orgRole?: OrgRole;
    organizationId?: string;
    primaryOrganizationId?: string;
  } | undefined;

  // Check for global coach role
  const isGlobalCoach = publicMetadata?.role === 'coach';
  
  // Check for org-level coach roles
  const orgRole = publicMetadata?.orgRole;
  const isSuperCoach = orgRole === 'super_coach';
  const isRegularOrgCoach = orgRole === 'coach';
  const isOrgLevelCoach = isSuperCoach || isRegularOrgCoach;
  
  // Determine if user has an organization context
  const organizationId = publicMetadata?.organizationId || publicMetadata?.primaryOrganizationId;
  const hasOrgContext = !!organizationId;
  
  // User is considered a coach if they have either global or org-level coach access
  const isCoach = isGlobalCoach || isOrgLevelCoach;

  const fetchCoachSquads = useCallback(async () => {
    // Not loaded yet - don't fetch
    if (!isLoaded) {
      return;
    }

    // Not a coach (neither global nor org-level) - don't fetch
    if (!isCoach) {
      setSquads([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Choose endpoint based on coach type:
      // - Super coaches with org context: use /api/coach/org-squads (returns all org squads)
      // - Regular org coaches: use /api/coach/squads (returns only squads they are assigned to coach)
      // - Global coaches: use /api/coach/squads (returns only squads where coachId === userId)
      const shouldSeeAllOrgSquads = isSuperCoach && hasOrgContext;
      const endpoint = shouldSeeAllOrgSquads ? '/api/coach/org-squads' : '/api/coach/squads';
      
      const response = await fetch(endpoint);
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
  }, [isLoaded, isCoach, isSuperCoach, hasOrgContext]);

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








