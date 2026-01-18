'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CoachIntegration, IntegrationProvider, IntegrationStatus } from '@/lib/integrations/types';

/**
 * Simplified integration status for UI display
 */
interface IntegrationInfo {
  connected: boolean;
  status: IntegrationStatus | null;
  accountEmail?: string;
  accountName?: string;
}

interface UseCoachIntegrationsReturn {
  /** Zoom integration status */
  zoom: IntegrationInfo;
  /** Google Meet (via Google Calendar) integration status */
  googleMeet: IntegrationInfo;
  /** Whether the data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the integration status */
  refetch: () => Promise<void>;
}

const defaultInfo: IntegrationInfo = {
  connected: false,
  status: null,
};

/**
 * Hook for fetching coach's video meeting integrations (Zoom and Google Meet)
 *
 * Google Meet links are created through Google Calendar integration,
 * so we check for google_calendar provider with enableMeetLinks setting.
 */
export function useCoachIntegrations(): UseCoachIntegrationsReturn {
  const [integrations, setIntegrations] = useState<{
    zoom: IntegrationInfo;
    googleMeet: IntegrationInfo;
  }>({
    zoom: defaultInfo,
    googleMeet: defaultInfo,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/coach/integrations');

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated as coach
          setIntegrations({ zoom: defaultInfo, googleMeet: defaultInfo });
          return;
        }
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch integrations');
      }

      const data = await response.json();
      const allIntegrations: CoachIntegration[] = data.integrations || [];

      // Find Zoom integration
      const zoomIntegration = allIntegrations.find(
        (i) => i.provider === 'zoom' && i.status === 'connected'
      );

      // Find Google Calendar integration with Meet links enabled
      const googleCalendarIntegration = allIntegrations.find(
        (i) => i.provider === 'google_calendar' && i.status === 'connected'
      );

      // Check if Google Calendar has Meet links enabled
      const googleMeetEnabled = googleCalendarIntegration?.settings &&
        'enableMeetLinks' in googleCalendarIntegration.settings &&
        googleCalendarIntegration.settings.enableMeetLinks;

      setIntegrations({
        zoom: zoomIntegration
          ? {
              connected: true,
              status: zoomIntegration.status,
              accountEmail: zoomIntegration.accountEmail,
              accountName: zoomIntegration.accountName,
            }
          : defaultInfo,
        googleMeet: googleMeetEnabled
          ? {
              connected: true,
              status: googleCalendarIntegration!.status,
              accountEmail: googleCalendarIntegration!.accountEmail,
              accountName: googleCalendarIntegration!.accountName,
            }
          : defaultInfo,
      });
    } catch (err) {
      console.error('[useCoachIntegrations] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch integrations');
      setIntegrations({ zoom: defaultInfo, googleMeet: defaultInfo });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  return {
    zoom: integrations.zoom,
    googleMeet: integrations.googleMeet,
    isLoading,
    error,
    refetch: fetchIntegrations,
  };
}
