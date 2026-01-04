import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getIntegration, updateTokens, updateIntegrationStatus } from '@/lib/integrations/token-manager';
import type { GoogleCalendarSettings, OutlookCalendarSettings } from '@/lib/integrations/types';

/**
 * GET /api/calendar/busy-times
 * Get busy times from the connected external calendar (Google or Microsoft)
 *
 * Query params:
 * - startDate: ISO date (required)
 * - endDate: ISO date (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Try Google Calendar first
    const googleIntegration = await getIntegration(organizationId, 'google_calendar', true);
    if (googleIntegration && googleIntegration.status === 'connected') {
      const busyTimes = await getGoogleBusyTimes(
        organizationId,
        googleIntegration,
        startDate,
        endDate
      );
      return NextResponse.json({ busyTimes, provider: 'google_calendar' });
    }

    // Try Microsoft/Outlook Calendar
    const microsoftIntegration = await getIntegration(organizationId, 'outlook_calendar', true);
    if (microsoftIntegration && microsoftIntegration.status === 'connected') {
      const busyTimes = await getMicrosoftBusyTimes(
        organizationId,
        microsoftIntegration,
        startDate,
        endDate
      );
      return NextResponse.json({ busyTimes, provider: 'outlook_calendar' });
    }

    // No calendar connected
    return NextResponse.json({ busyTimes: [], provider: null });
  } catch (error) {
    console.error('[CALENDAR_BUSY_TIMES] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Return empty array on error to not break availability calculation
    return NextResponse.json({ busyTimes: [], provider: null });
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
): Promise<Array<{ start: string; end: string; status: string }>> {
  let accessToken = integration.accessToken;

  // Check if token needs refresh
  if (integration.expiresAt) {
    const expiry = new Date(integration.expiresAt as string);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiry.getTime() - now.getTime() < fiveMinutes && integration.refreshToken) {
      // Refresh the token
      const newToken = await refreshGoogleToken(orgId, integration.id, integration.refreshToken);
      if (newToken) {
        accessToken = newToken;
      }
    }
  }

  const settings = integration.settings as GoogleCalendarSettings;
  const calendarId = settings.calendarId || 'primary';

  // Call Google Calendar freebusy API
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

    // If unauthorized, mark integration as expired
    if (response.status === 401) {
      await updateIntegrationStatus(orgId, integration.id, 'expired', 'Token expired');
    }

    return [];
  }

  const data = await response.json();
  const busyTimes: Array<{ start: string; end: string; status: string }> = [];

  // Extract busy times from response
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
): Promise<Array<{ start: string; end: string; status: string }>> {
  let accessToken = integration.accessToken;

  // Check if token needs refresh
  if (integration.expiresAt) {
    const expiry = new Date(integration.expiresAt as string);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiry.getTime() - now.getTime() < fiveMinutes && integration.refreshToken) {
      // Refresh the token
      const newToken = await refreshMicrosoftToken(orgId, integration.id, integration.refreshToken);
      if (newToken) {
        accessToken = newToken;
      }
    }
  }

  // Call Microsoft Graph calendar view API to get events
  // (Microsoft doesn't have a direct freebusy endpoint for personal calendars)
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

    // If unauthorized, mark integration as expired
    if (response.status === 401) {
      await updateIntegrationStatus(orgId, integration.id, 'expired', 'Token expired');
    }

    return [];
  }

  const data = await response.json();
  const busyTimes: Array<{ start: string; end: string; status: string }> = [];

  // Extract busy times from events
  for (const event of data.value || []) {
    // Only include events that show as busy, tentative, or out of office
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
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

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
      refreshToken: tokens.refresh_token, // Microsoft may return a new refresh token
      expiresAt,
    });

    return tokens.access_token;
  } catch (error) {
    console.error('[MICROSOFT_TOKEN_REFRESH] Error:', error);
    return null;
  }
}
