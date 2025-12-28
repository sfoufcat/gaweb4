'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { OrgMembership, OrgRole, UserTier, UserTrack } from '@/types';

/**
 * Current organization membership data
 */
interface CurrentOrgMembership {
  id: string;
  organizationId: string;
  orgRole: OrgRole;
  tier: UserTier;
  track: UserTrack | null;
  squadId: string | null;
  premiumSquadId: string | null;
  isActive: boolean;
  joinedAt: string;
}

interface OrganizationContextValue {
  // Current org membership (for the active organization)
  currentMembership: CurrentOrgMembership | null;
  
  // All user's organizations
  organizations: Array<{
    id: string;
    name: string;
    isPrimary: boolean;
  }>;
  
  // Current organization ID
  organizationId: string | null;
  
  // Loading state
  isLoading: boolean;
  
  // Error state
  error: string | null;
  
  // Actions
  refreshMembership: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<boolean>;
  
  // Helper functions
  isSuperCoach: () => boolean;
  isCoach: () => boolean;
  hasAccess: (requiredTier?: UserTier) => boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

interface OrganizationProviderProps {
  children: ReactNode;
  initialOrganizationId?: string | null;
}

export function OrganizationProvider({ 
  children, 
  initialOrganizationId 
}: OrganizationProviderProps) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  
  const [currentMembership, setCurrentMembership] = useState<CurrentOrgMembership | null>(null);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; isPrimary: boolean }>>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(initialOrganizationId || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch current org membership
  const fetchMembership = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch user's organizations
      const orgsResponse = await fetch('/api/user/organizations');
      if (!orgsResponse.ok) {
        throw new Error('Failed to fetch organizations');
      }
      
      const orgsData = await orgsResponse.json();
      setOrganizations(orgsData.organizations.map((org: { id: string; name: string; isPrimary: boolean }) => ({
        id: org.id,
        name: org.name,
        isPrimary: org.isPrimary,
      })));
      
      // Find the current/primary org
      const primaryOrg = orgsData.organizations.find((org: { isPrimary: boolean }) => org.isPrimary);
      if (primaryOrg) {
        setOrganizationId(primaryOrg.id);
        setCurrentMembership({
          id: primaryOrg.membership.id,
          organizationId: primaryOrg.id,
          orgRole: primaryOrg.membership.orgRole as OrgRole,
          tier: primaryOrg.membership.tier as UserTier,
          track: primaryOrg.membership.track as UserTrack | null,
          squadId: null, // Would need to fetch from full membership
          premiumSquadId: null,
          isActive: true,
          joinedAt: primaryOrg.membership.joinedAt,
        });
      }
    } catch (err) {
      console.error('[ORG_CONTEXT] Error fetching membership:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organization data');
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn, userId]);
  
  // Initial fetch
  useEffect(() => {
    fetchMembership();
  }, [fetchMembership]);
  
  // Refresh membership
  const refreshMembership = useCallback(async () => {
    await fetchMembership();
  }, [fetchMembership]);
  
  // Switch organization
  const switchOrganization = useCallback(async (orgId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/user/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to switch organization');
      }
      
      // Refresh data
      await fetchMembership();
      return true;
    } catch (err) {
      console.error('[ORG_CONTEXT] Error switching org:', err);
      return false;
    }
  }, [fetchMembership]);
  
  // Helper: Check if user is super_coach
  const isSuperCoach = useCallback(() => {
    return currentMembership?.orgRole === 'super_coach';
  }, [currentMembership]);
  
  // Helper: Check if user is coach or super_coach
  const isCoach = useCallback(() => {
    return currentMembership?.orgRole === 'coach' || currentMembership?.orgRole === 'super_coach';
  }, [currentMembership]);
  
  // Helper: Check if user has required tier access
  const hasAccess = useCallback((requiredTier?: UserTier): boolean => {
    if (!currentMembership) return false;
    if (!requiredTier) return true;
    
    const tierHierarchy: UserTier[] = ['free', 'standard', 'premium'];
    const userTierIndex = tierHierarchy.indexOf(currentMembership.tier);
    const requiredTierIndex = tierHierarchy.indexOf(requiredTier);
    
    return userTierIndex >= requiredTierIndex;
  }, [currentMembership]);
  
  const value: OrganizationContextValue = {
    currentMembership,
    organizations,
    organizationId,
    isLoading,
    error,
    refreshMembership,
    switchOrganization,
    isSuperCoach,
    isCoach,
    hasAccess,
  };
  
  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

/**
 * Hook to access organization context
 */
export function useOrganization() {
  const context = useContext(OrganizationContext);
  
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  
  return context;
}

/**
 * Hook to get current membership (shorthand)
 */
export function useCurrentMembership() {
  const { currentMembership, isLoading } = useOrganization();
  return { membership: currentMembership, isLoading };
}






