/**
 * Google Meet Integration
 *
 * Provides functions for creating Google Meet meetings via the Calendar API.
 * Google Meet links are created by adding conference data to calendar events.
 */

import { v4 as uuidv4 } from 'uuid';
import { getIntegration, updateTokens, type GoogleCalendarSettings } from './';

interface GoogleMeetMeetingDetails {
  summary: string;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  timezone: string;
  description?: string;
}

interface GoogleMeetMeetingResponse {
  success: boolean;
  meetingUrl?: string;
  eventId?: string;
  error?: string;
}

/**
 * Refresh Google access token using refresh token
 */
async function refreshGoogleTokens(
  orgId: string,
  integrationId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[GOOGLE_MEET] Missing OAuth credentials for token refresh');
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
      const errorData = await response.json();
      console.error('[GOOGLE_MEET] Token refresh failed:', errorData);
      return null;
    }

    const tokens = await response.json();
    const { access_token, expires_in } = tokens;

    // Calculate new expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Update stored tokens (Google doesn't always return a new refresh token)
    await updateTokens(orgId, integrationId, {
      accessToken: access_token,
      expiresAt,
    });

    return access_token;
  } catch (error) {
    console.error('[GOOGLE_MEET] Token refresh error:', error);
    return null;
  }
}

/**
 * Get a valid Google access token, refreshing if needed
 */
async function getValidGoogleAccessToken(
  orgId: string,
  integrationId: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: Date | string | undefined
): Promise<string | null> {
  // Check if token needs refresh (expired or expiring within 5 minutes)
  if (expiresAt) {
    const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiry <= fiveMinutesFromNow) {
      if (!refreshToken) {
        console.error('[GOOGLE_MEET] Token expired and no refresh token available');
        return null;
      }
      return refreshGoogleTokens(orgId, integrationId, refreshToken);
    }
  }

  return accessToken;
}

/**
 * Create a Google Meet meeting via Calendar API
 *
 * Google Meet links are created by adding conference data to calendar events
 * with conferenceDataVersion=1
 */
export async function createGoogleMeetMeeting(
  orgId: string,
  details: GoogleMeetMeetingDetails
): Promise<GoogleMeetMeetingResponse> {
  try {
    // Get Google Calendar integration with decrypted tokens (Meet links are part of Google Calendar)
    const integration = await getIntegration(orgId, 'google_calendar', true);

    if (!integration) {
      return { success: false, error: 'Google Calendar integration not connected' };
    }

    // Check if Meet links are enabled for this integration
    const settings = integration.settings as GoogleCalendarSettings;
    if (!settings?.enableMeetLinks) {
      return { success: false, error: 'Google Meet links are not enabled for this integration' };
    }

    // Get valid access token
    const accessToken = await getValidGoogleAccessToken(
      orgId,
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.expiresAt as Date | string | undefined
    );

    if (!accessToken) {
      return { success: false, error: 'Failed to get valid Google access token' };
    }

    // Get calendar ID from settings (settings already retrieved above)
    const calendarId = settings?.calendarId || 'primary';

    // Create calendar event with conference data
    const event = {
      summary: details.summary,
      description: details.description || '',
      start: {
        dateTime: details.startTime,
        timeZone: details.timezone,
      },
      end: {
        dateTime: details.endTime,
        timeZone: details.timezone,
      },
      conferenceData: {
        createRequest: {
          requestId: uuidv4(),
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    };

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[GOOGLE_MEET] Event creation failed:', errorData);
      return {
        success: false,
        error: errorData.error?.message || 'Failed to create Google Meet',
      };
    }

    const createdEvent = await response.json();

    // Extract the Meet URL from conference data
    const meetUrl =
      createdEvent.conferenceData?.entryPoints?.find(
        (ep: { entryPointType: string }) => ep.entryPointType === 'video'
      )?.uri || createdEvent.hangoutLink;

    if (!meetUrl) {
      console.error('[GOOGLE_MEET] No Meet URL in response:', createdEvent);
      return {
        success: false,
        error: 'Meeting created but no Meet URL was generated',
      };
    }

    return {
      success: true,
      meetingUrl: meetUrl,
      eventId: createdEvent.id,
    };
  } catch (error) {
    console.error('[GOOGLE_MEET] Meeting creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a Google Calendar event (and its associated Meet link)
 */
export async function deleteGoogleMeetEvent(
  orgId: string,
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get Google Calendar integration with decrypted tokens (Meet links are part of Google Calendar)
    const integration = await getIntegration(orgId, 'google_calendar', true);

    if (!integration) {
      return { success: false, error: 'Google Calendar integration not connected' };
    }

    const accessToken = await getValidGoogleAccessToken(
      orgId,
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.expiresAt as Date | string | undefined
    );

    if (!accessToken) {
      return { success: false, error: 'Failed to get valid Google access token' };
    }

    const settings = integration.settings as GoogleCalendarSettings;
    const calendarId = settings?.calendarId || 'primary';

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[GOOGLE_MEET] Event deletion failed:', errorData);
      return {
        success: false,
        error: 'Failed to delete Google Calendar event',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[GOOGLE_MEET] Event deletion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
