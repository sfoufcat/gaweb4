'use client';

import { useState, useEffect } from 'react';
import { useUser, useOrganization } from '@clerk/nextjs';
import type { OrgSettings } from '@/types';

interface UseOrgSettingsReturn {
  settings: OrgSettings | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch organization settings for the current user's org
 * 
 * Caches settings and provides real-time updates via refetch
 */
export function useOrgSettings(): UseOrgSettingsReturn {
  const { user, isLoaded: userLoaded } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get org ID from user metadata or Clerk organization
  const organizationId = (user?.publicMetadata as { primaryOrganizationId?: string })?.primaryOrganizationId 
    || organization?.id 
    || null;

  const fetchSettings = async () => {
    if (!organizationId) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/org/settings');
      
      if (!response.ok) {
        if (response.status === 404) {
          // No settings found - org might not have settings configured
          setSettings(null);
          setError(null);
        } else {
          throw new Error('Failed to fetch org settings');
        }
        return;
      }

      const data = await response.json();
      setSettings(data.settings || null);
      setError(null);
    } catch (err) {
      console.error('[useOrgSettings] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!userLoaded || !orgLoaded) return;
    
    if (!organizationId) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    fetchSettings();
  }, [userLoaded, orgLoaded, organizationId]);

  return {
    settings,
    isLoading,
    error,
    refetch: fetchSettings,
  };
}

export default useOrgSettings;

