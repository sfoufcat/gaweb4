/**
 * Google Drive Integration
 *
 * Provides functions for finding Google Meet recordings stored in Google Drive.
 * Meet recordings are automatically saved to the user's Google Drive when enabled.
 */

import { getIntegration, updateTokens } from './token-manager';

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
    console.error('[GOOGLE_DRIVE] Missing OAuth credentials for token refresh');
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
      console.error('[GOOGLE_DRIVE] Token refresh failed:', errorData);
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
    console.error('[GOOGLE_DRIVE] Token refresh error:', error);
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
        console.error('[GOOGLE_DRIVE] Token expired and no refresh token available');
        return null;
      }
      return refreshGoogleTokens(orgId, integrationId, refreshToken);
    }
  }

  return accessToken;
}

/**
 * Find Google Meet recording in Google Drive
 *
 * Google Meet recordings are automatically saved to a folder called "Meet Recordings"
 * in the user's Google Drive. The file name typically includes the meeting title
 * or a date/time identifier.
 *
 * @param orgId - Organization ID
 * @param searchQuery - Search query (meeting title, date, or meeting code)
 * @returns Recording URL if found
 */
export async function findMeetRecording(
  orgId: string,
  searchQuery: string
): Promise<{
  success: boolean;
  recordingUrl?: string;
  /** File ID for downloading via getGoogleDriveDownloadInfo */
  fileId?: string;
  files?: Array<{
    id: string;
    name: string;
    webViewLink: string;
    mimeType: string;
    createdTime: string;
  }>;
  error?: string;
}> {
  try {
    // Get Google Calendar integration (which now includes Drive scope)
    const integration = await getIntegration(orgId, 'google_calendar', true);

    if (!integration) {
      return { success: false, error: 'Google Calendar integration not connected' };
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

    // Search for video files in Drive that match the search query
    // Meet recordings are typically MP4 files in the "Meet Recordings" folder
    const query = encodeURIComponent(
      `(mimeType='video/mp4' or mimeType='video/webm') and name contains '${searchQuery.replace(/'/g, "\\'")}'`
    );

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,mimeType,createdTime)&orderBy=createdTime desc&pageSize=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[GOOGLE_DRIVE] Search failed:', errorData);
      return {
        success: false,
        error: errorData.error?.message || 'Failed to search Google Drive',
      };
    }

    const data = await response.json();
    const files = data.files || [];

    if (files.length === 0) {
      return {
        success: true,
        files: [],
        error: 'No recordings found in Google Drive',
      };
    }

    // Return the most recent matching file
    return {
      success: true,
      recordingUrl: files[0].webViewLink,
      fileId: files[0].id,
      files: files.map((f: { id: string; name: string; webViewLink: string; mimeType: string; createdTime: string }) => ({
        id: f.id,
        name: f.name,
        webViewLink: f.webViewLink,
        mimeType: f.mimeType,
        createdTime: f.createdTime,
      })),
    };
  } catch (error) {
    console.error('[GOOGLE_DRIVE] Search error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Find Google Meet recording by Calendar event ID
 *
 * This approach first looks up the Calendar event to get the meeting title/details,
 * then searches Drive for a recording matching that event.
 *
 * @param orgId - Organization ID
 * @param eventId - Google Calendar event ID
 * @returns Recording URL if found
 */
export async function findMeetRecordingByEventId(
  orgId: string,
  eventId: string
): Promise<{
  success: boolean;
  recordingUrl?: string;
  /** File ID for downloading via getGoogleDriveDownloadInfo */
  fileId?: string;
  error?: string;
}> {
  try {
    // Get Google Calendar integration
    const integration = await getIntegration(orgId, 'google_calendar', true);

    if (!integration) {
      return { success: false, error: 'Google Calendar integration not connected' };
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

    // First, get the calendar event details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = integration.settings as any;
    const calendarId = settings?.calendarId || 'primary';

    const eventResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!eventResponse.ok) {
      return {
        success: false,
        error: 'Could not find the calendar event',
      };
    }

    const eventData = await eventResponse.json();
    const eventTitle = eventData.summary || '';
    const eventDate = eventData.start?.dateTime || eventData.start?.date || '';

    // Format date for search (e.g., "2024-01-15")
    const dateStr = eventDate ? new Date(eventDate).toISOString().split('T')[0] : '';

    // Search Drive for recordings matching the event
    // Try searching by title first, then by date if no results
    let searchQuery = eventTitle;
    let result = await findMeetRecording(orgId, searchQuery);

    if (!result.recordingUrl && dateStr) {
      // Try searching by date
      searchQuery = dateStr;
      result = await findMeetRecording(orgId, searchQuery);
    }

    return result;
  } catch (error) {
    console.error('[GOOGLE_DRIVE] Find recording by event error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get download info for a Google Drive file
 *
 * Returns the download URL and access token needed to download the file.
 * This is used to store recordings to Bunny for permanent access.
 *
 * @param orgId - Organization ID
 * @param fileId - Google Drive file ID
 * @returns Download URL and access token, or null if unavailable
 */
export async function getGoogleDriveDownloadInfo(
  orgId: string,
  fileId: string
): Promise<{ downloadUrl: string; accessToken: string } | null> {
  try {
    const integration = await getIntegration(orgId, 'google_calendar', true);
    if (!integration) {
      console.error('[GOOGLE_DRIVE] No Google Calendar integration found');
      return null;
    }

    const accessToken = await getValidGoogleAccessToken(
      orgId,
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.expiresAt as Date | string | undefined
    );

    if (!accessToken) {
      console.error('[GOOGLE_DRIVE] Failed to get valid access token');
      return null;
    }

    // Google Drive API download URL format
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    return { downloadUrl, accessToken };
  } catch (error) {
    console.error('[GOOGLE_DRIVE] Error getting download info:', error);
    return null;
  }
}
