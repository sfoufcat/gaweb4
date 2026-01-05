import { useState, useEffect, useCallback } from 'react';

interface CalendarIntegrationStatus {
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
  calendarName?: string;
  settings?: {
    syncDirection: 'one_way' | 'two_way';
    autoCreateEvents: boolean;
  };
}

interface CalendarIntegrations {
  google: CalendarIntegrationStatus;
  microsoft: CalendarIntegrationStatus;
}

interface UseCalendarIntegrationReturn {
  /** Google Calendar integration status */
  google: CalendarIntegrationStatus;
  /** Microsoft Calendar integration status */
  microsoft: CalendarIntegrationStatus;
  /** Whether any calendar is connected */
  hasAnyConnected: boolean;
  /** Whether the data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether Google Calendar is configured on the backend */
  isGoogleConfigured: boolean;
  /** Whether Microsoft Calendar is configured on the backend */
  isMicrosoftConfigured: boolean;
  /** Connect Google Calendar */
  connectGoogle: () => Promise<void>;
  /** Connect Microsoft Calendar */
  connectMicrosoft: () => Promise<void>;
  /** Disconnect Google Calendar */
  disconnectGoogle: () => Promise<void>;
  /** Disconnect Microsoft Calendar */
  disconnectMicrosoft: () => Promise<void>;
  /** Refresh the integration status */
  refetch: () => Promise<void>;
}

const defaultStatus: CalendarIntegrationStatus = { connected: false };

/**
 * Hook for managing calendar integrations (Google and Microsoft)
 *
 * Supports connecting both calendars simultaneously.
 * Replaces useNylasGrant - uses direct OAuth instead of Nylas.
 */
export function useCalendarIntegration(): UseCalendarIntegrationReturn {
  const [integrations, setIntegrations] = useState<CalendarIntegrations>({
    google: defaultStatus,
    microsoft: defaultStatus,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleConfigured, setIsGoogleConfigured] = useState(true);
  const [isMicrosoftConfigured, setIsMicrosoftConfigured] = useState(true);

  // Fetch current integration status
  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/calendar/status');

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated as coach
          setIntegrations({ google: defaultStatus, microsoft: defaultStatus });
          return;
        }
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch calendar status');
      }

      const data = await response.json();
      setIntegrations({
        google: data.google || defaultStatus,
        microsoft: data.microsoft || defaultStatus,
      });
    } catch (err) {
      console.error('[useCalendarIntegration] Error fetching status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar status');
      setIntegrations({ google: defaultStatus, microsoft: defaultStatus });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Connect Google Calendar
  const connectGoogle = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/calendar/google/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 503) {
        setIsGoogleConfigured(false);
        throw new Error('Google Calendar integration is not configured');
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start Google Calendar connection');
      }

      const data = await response.json();

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('[useCalendarIntegration] Error connecting Google:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect Google Calendar');
      throw err;
    }
  }, []);

  // Connect Microsoft Calendar
  const connectMicrosoft = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/calendar/microsoft/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 503) {
        setIsMicrosoftConfigured(false);
        throw new Error('Microsoft Calendar integration is not configured');
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start Microsoft Calendar connection');
      }

      const data = await response.json();

      // Redirect to Microsoft OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('[useCalendarIntegration] Error connecting Microsoft:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect Microsoft Calendar');
      throw err;
    }
  }, []);

  // Disconnect Google Calendar
  const disconnectGoogle = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google_calendar' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect Google Calendar');
      }

      // Update local state
      setIntegrations(prev => ({ ...prev, google: defaultStatus }));
    } catch (err) {
      console.error('[useCalendarIntegration] Error disconnecting Google:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect Google Calendar');
      throw err;
    }
  }, []);

  // Disconnect Microsoft Calendar
  const disconnectMicrosoft = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'outlook_calendar' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect Microsoft Calendar');
      }

      // Update local state
      setIntegrations(prev => ({ ...prev, microsoft: defaultStatus }));
    } catch (err) {
      console.error('[useCalendarIntegration] Error disconnecting Microsoft:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect Microsoft Calendar');
      throw err;
    }
  }, []);

  return {
    google: integrations.google,
    microsoft: integrations.microsoft,
    hasAnyConnected: integrations.google.connected || integrations.microsoft.connected,
    isLoading,
    error,
    isGoogleConfigured,
    isMicrosoftConfigured,
    connectGoogle,
    connectMicrosoft,
    disconnectGoogle,
    disconnectMicrosoft,
    refetch: fetchStatus,
  };
}
