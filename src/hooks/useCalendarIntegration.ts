import { useState, useEffect, useCallback } from 'react';

interface CalendarIntegration {
  connected: boolean;
  provider: 'google_calendar' | 'outlook_calendar' | null;
  accountEmail?: string;
  accountName?: string;
  calendarName?: string;
  settings?: {
    syncDirection: 'one_way' | 'two_way';
    autoCreateEvents: boolean;
  };
}

interface UseCalendarIntegrationReturn {
  /** Current integration status */
  integration: CalendarIntegration | null;
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
  /** Disconnect the current calendar */
  disconnect: () => Promise<void>;
  /** Refresh the integration status */
  refetch: () => Promise<void>;
}

/**
 * Hook for managing calendar integration (Google or Microsoft)
 *
 * Replaces useNylasGrant - uses direct OAuth instead of Nylas
 */
export function useCalendarIntegration(): UseCalendarIntegrationReturn {
  const [integration, setIntegration] = useState<CalendarIntegration | null>(null);
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
          setIntegration({ connected: false, provider: null });
          return;
        }
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch calendar status');
      }

      const data = await response.json();
      setIntegration(data);
    } catch (err) {
      console.error('[useCalendarIntegration] Error fetching status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar status');
      setIntegration({ connected: false, provider: null });
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

  // Disconnect calendar
  const disconnect = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect calendar');
      }

      // Clear local state
      setIntegration({ connected: false, provider: null });
    } catch (err) {
      console.error('[useCalendarIntegration] Error disconnecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect calendar');
      throw err;
    }
  }, []);

  return {
    integration,
    isLoading,
    error,
    isGoogleConfigured,
    isMicrosoftConfigured,
    connectGoogle,
    connectMicrosoft,
    disconnect,
    refetch: fetchStatus,
  };
}
