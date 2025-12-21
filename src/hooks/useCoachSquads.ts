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
 * - Full access coaches (global coach OR super_coach): calls /api/coach/org-squads (returns all org squads)
 * - Limited org coaches (orgRole === 'coach' without full access): calls /api/coach/squads (returns only squads they coach)
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

  // Check for global roles
  const role = publicMetadata?.role;
  const isGlobalCoach = role === 'coach';
  const isAdmin = role === 'admin' || role === 'super_admin';
  
  // Check for org-level coach roles
  const orgRole = publicMetadata?.orgRole;
  const isSuperCoach = orgRole === 'super_coach';
  const isRegularOrgCoach = orgRole === 'coach';
  const isOrgLevelCoach = isSuperCoach || isRegularOrgCoach;
  
  // Determine access level (same logic as coach dashboard)
  // Full access: global coach role, super_coach orgRole, admin, or super_admin
  const hasFullAccess = isGlobalCoach || isAdmin || isSuperCoach;
  
  // Limited org coach: has orgRole=coach but NOT full access
  const isLimitedOrgCoach = !hasFullAccess && isRegularOrgCoach;
  
  // User is considered a coach if they have either global or org-level coach access
  const isCoach = isGlobalCoach || isOrgLevelCoach || isAdmin;

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

      // Choose endpoint based on access level:
      // - Limited org coaches: use /api/coach/squads (returns only squads they coach)
      // - Full access coaches (global coach OR super_coach): use /api/coach/org-squads (returns all org squads)
      const endpoint = isLimitedOrgCoach ? '/api/coach/squads' : '/api/coach/org-squads';
      
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
  }, [isLoaded, isCoach, isLimitedOrgCoach]);

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








