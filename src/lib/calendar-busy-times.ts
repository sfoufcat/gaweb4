/**
 * Calendar Busy Times
 *
 * Shared logic for fetching busy times from Google/Microsoft calendars.
 * Can be called directly from server-side code without HTTP overhead.
 */

import { getIntegration, updateTokens, updateIntegrationStatus } from '@/lib/integrations/token-manager';
import type { GoogleCalendarSettings } from '@/lib/integrations/types';

interface BusyTime {
  start: string;
  end: string;
  status: string;
}

interface BusyTimesResult {
  busyTimes: BusyTime[];
  providers: {
    google: boolean;
    microsoft: boolean;
  };
}

/**
 * Get busy times from all connected external calendars (Google and/or Microsoft)
 * This is the core function that can be called directly from server-side code.
 * Fetches from both calendars in parallel and merges the results.
 */
export async function getCalendarBusyTimes(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<BusyTimesResult> {
  try {
    // Fetch both integrations in parallel
    const [googleIntegration, microsoftIntegration] = await Promise.all([
      getIntegration(organizationId, 'google_calendar', true),
      getIntegration(organizationId, 'outlook_calendar', true),
    ]);

    const hasGoogle = !!(googleIntegration && googleIntegration.status === 'connected');
    const hasMicrosoft = !!(microsoftIntegration && microsoftIntegration.status === 'connected');

    // Fetch busy times from both calendars in parallel
    const [googleBusy, microsoftBusy] = await Promise.all([
      hasGoogle
        ? getGoogleBusyTimes(organizationId, googleIntegration, startDate, endDate)
        : Promise.resolve([]),
      hasMicrosoft
        ? getMicrosoftBusyTimes(organizationId, microsoftIntegration, startDate, endDate)
        : Promise.resolve([]),
    ]);

    // Merge busy times from both calendars
    const busyTimes = [...googleBusy, ...microsoftBusy];

    return {
      busyTimes,
      providers: {
        google: hasGoogle,
        microsoft: hasMicrosoft,
      },
    };
  } catch (error) {
    console.error('[CALENDAR_BUSY_TIMES] Error:', error);
    return { busyTimes: [], providers: { google: false, microsoft: false } };
  }
}

/**
 * Get busy times from Google Calendar
 */
async function getGoogleBusyTimes(
  orgId: string,
  integration: { id: string; accessToken: string; refreshToken?: string; expiresAt?: unknown; settings: unknown },
  startDate: string,
  endDate: string
): Promise<BusyTime[]> {
  let accessToken = integration.accessToken;

  // Check if token needs refresh
  if (integration.expiresAt) {
    const expiry = new Date(integration.expiresAt as string);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiry.getTime() - now.getTime() < fiveMinutes && integration.refreshToken) {
      const newToken = await refreshGoogleToken(orgId, integration.id, integration.refreshToken);
      if (newToken) {
        accessToken = newToken;
      }
    }
  }

  const settings = integration.settings as GoogleCalendarSettings;
  const calendarId = settings.calendarId || 'primary';

  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: new Date(startDate).toISOString(),
      timeMax: new Date(endDate).toISOString(),
      items: [{ id: calendarId }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[GOOGLE_BUSY_TIMES] API error:', errorData);

    if (response.status === 401) {
      await updateIntegrationStatus(orgId, integration.id, 'expired', 'Token expired');
    }

    return [];
  }

  const data = await response.json();
  const busyTimes: BusyTime[] = [];

  const calendarBusy = data.calendars?.[calendarId]?.busy || [];
  for (const slot of calendarBusy) {
    busyTimes.push({
      start: slot.start,
      end: slot.end,
      status: 'busy',
    });
  }

  return busyTimes;
}

/**
 * Get busy times from Microsoft Calendar
 */
async function getMicrosoftBusyTimes(
  orgId: string,
  integration: { id: string; accessToken: string; refreshToken?: string; expiresAt?: unknown; settings: unknown },
  startDate: string,
  endDate: string
): Promise<BusyTime[]> {
  let accessToken = integration.accessToken;

  // Check if token needs refresh
  if (integration.expiresAt) {
    const expiry = new Date(integration.expiresAt as string);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiry.getTime() - now.getTime() < fiveMinutes && integration.refreshToken) {
      const newToken = await refreshMicrosoftToken(orgId, integration.id, integration.refreshToken);
      if (newToken) {
        accessToken = newToken;
      }
    }
  }

  const startDateTime = new Date(startDate).toISOString();
  const endDateTime = new Date(endDate).toISOString();

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&$select=start,end,showAs`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'outlook.timezone="UTC"',
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[MICROSOFT_BUSY_TIMES] API error:', errorData);

    if (response.status === 401) {
      await updateIntegrationStatus(orgId, integration.id, 'expired', 'Token expired');
    }

    return [];
  }

  const data = await response.json();
  const busyTimes: BusyTime[] = [];

  for (const event of data.value || []) {
    if (['busy', 'tentative', 'oof', 'workingElsewhere'].includes(event.showAs)) {
      busyTimes.push({
        start: event.start?.dateTime ? new Date(event.start.dateTime + 'Z').toISOString() : '',
        end: event.end?.dateTime ? new Date(event.end.dateTime + 'Z').toISOString() : '',
        status: event.showAs,
      });
    }
  }

  return busyTimes;
}

/**
 * Refresh Google OAuth token
 */
async function refreshGoogleToken(
  orgId: string,
  integrationId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[GOOGLE_TOKEN_REFRESH] Missing OAuth credentials');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[GOOGLE_TOKEN_REFRESH] Failed:', error);
      await updateIntegrationStatus(orgId, integrationId, 'expired', 'Token refresh failed');
      return null;
    }

    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await updateTokens(orgId, integrationId, {
      accessToken: tokens.access_token,
      expiresAt,
    });

    return tokens.access_token;
  } catch (error) {
    console.error('[GOOGLE_TOKEN_REFRESH] Error:', error);
    return null;
  }
}

/**
 * Refresh Microsoft OAuth token
 */
async function refreshMicrosoftToken(
  orgId: string,
  integrationId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[MICROSOFT_TOKEN_REFRESH] Missing OAuth credentials');
    return null;
  }

  try {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[MICROSOFT_TOKEN_REFRESH] Failed:', error);
      await updateIntegrationStatus(orgId, integrationId, 'expired', 'Token refresh failed');
      return null;
    }

    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await updateTokens(orgId, integrationId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    });

    return tokens.access_token;
  } catch (error) {
    console.error('[MICROSOFT_TOKEN_REFRESH] Error:', error);
    return null;
  }
}
