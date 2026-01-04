import { useState, useEffect, useCallback } from 'react';
import type { NylasGrant, CoachAvailability } from '@/types';

interface UseNylasGrantReturn {
  /** The Nylas grant data (null if not connected) */
  grant: NylasGrant | null;
  /** Calendar sync settings from coach availability */
  syncSettings: {
    syncExternalBusy: boolean;
    pushEventsToCalendar: boolean;
    connectedCalendarName?: string;
  } | null;
  /** Whether the data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether Nylas integration is configured on the backend */
  isConfigured: boolean;
  /** Initiate calendar connection OAuth flow */
  connect: (loginHint?: string) => Promise<void>;
  /** Disconnect the calendar */
  disconnect: () => Promise<void>;
  /** Update sync settings */
  updateSyncSettings: (settings: { syncExternalBusy?: boolean; pushEventsToCalendar?: boolean }) => Promise<void>;
  /** Refresh the grant data */
  refetch: () => Promise<void>;
}

/**
 * Hook for managing Nylas calendar integration
 *
 * Provides functionality to:
 * - Check connection status
 * - Connect a calendar via OAuth
 * - Disconnect the calendar
 * - Update sync settings
 */
export function useNylasGrant(): UseNylasGrantReturn {
  const [grant, setGrant] = useState<NylasGrant | null>(null);
  const [syncSettings, setSyncSettings] = useState<UseNylasGrantReturn['syncSettings']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  // Fetch current grant status
  const fetchGrant = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch availability which includes calendar connection info
      const response = await fetch('/api/availability');

      if (response.status === 503) {
        // Service not configured
        setIsConfigured(false);
        setGrant(null);
        setSyncSettings(null);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch availability');
      }

      const data = await response.json();
      const availability = data.availability as CoachAvailability | null;

      if (availability?.nylasGrantId) {
        // Has a connected calendar
        setGrant({
          id: '', // Not needed for display
          odId: availability.odId,
          userId: availability.coachUserId,
          grantId: availability.nylasGrantId,
          email: '', // Will be fetched separately if needed
          provider: 'google', // Default, actual provider stored in grant doc
          calendarId: availability.connectedCalendarId,
          calendarName: availability.connectedCalendarName,
          scopes: ['calendar'],
          isActive: true,
          createdAt: '',
          updatedAt: '',
        });
        setSyncSettings({
          syncExternalBusy: availability.syncExternalBusy ?? false,
          pushEventsToCalendar: availability.pushEventsToCalendar ?? false,
          connectedCalendarName: availability.connectedCalendarName,
        });
      } else {
        setGrant(null);
        setSyncSettings(null);
      }
    } catch (err) {
      console.error('[useNylasGrant] Error fetching grant:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchGrant();
  }, [fetchGrant]);

  // Connect calendar - initiates OAuth flow
  const connect = useCallback(async (loginHint?: string) => {
    try {
      setError(null);

      const response = await fetch('/api/nylas/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginHint }),
      });

      if (response.status === 503) {
        setIsConfigured(false);
        throw new Error('Calendar integration is not configured');
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start calendar connection');
      }

      const data = await response.json();

      // Redirect to Nylas OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('[useNylasGrant] Error connecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect calendar');
      throw err;
    }
  }, []);

  // Disconnect calendar
  const disconnect = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/nylas/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect calendar');
      }

      // Clear local state
      setGrant(null);
      setSyncSettings(null);
    } catch (err) {
      console.error('[useNylasGrant] Error disconnecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect calendar');
      throw err;
    }
  }, []);

  // Update sync settings
  const updateSyncSettings = useCallback(async (settings: { syncExternalBusy?: boolean; pushEventsToCalendar?: boolean }) => {
    try {
      setError(null);

      const response = await fetch('/api/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      // Update local state
      setSyncSettings(prev => prev ? { ...prev, ...settings } : null);
    } catch (err) {
      console.error('[useNylasGrant] Error updating settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      throw err;
    }
  }, []);

  return {
    grant,
    syncSettings,
    isLoading,
    error,
    isConfigured,
    connect,
    disconnect,
    updateSyncSettings,
    refetch: fetchGrant,
  };
}
