/**
 * Zoom Integration
 *
 * Provides functions for creating and managing Zoom meetings via the Zoom API.
 */

import { getIntegration, updateTokens } from './token-manager';

interface ZoomMeetingDetails {
  topic: string;
  startTime: string; // ISO datetime
  duration: number; // minutes
  timezone: string;
  agenda?: string;
}

interface ZoomMeetingResponse {
  success: boolean;
  meetingUrl?: string;
  meetingId?: string;
  error?: string;
}

/**
 * Refresh Zoom access token using refresh token
 */
async function refreshZoomTokens(
  orgId: string,
  integrationId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.ZOOM_OAUTH_CLIENT_ID;
  const clientSecret = process.env.ZOOM_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[ZOOM] Missing OAuth credentials for token refresh');
    return null;
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[ZOOM] Token refresh failed:', errorData);
      return null;
    }

    const tokens = await response.json();
    const { access_token, refresh_token: new_refresh_token, expires_in } = tokens;

    // Calculate new expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Update stored tokens
    await updateTokens(orgId, integrationId, {
      accessToken: access_token,
      refreshToken: new_refresh_token || refreshToken,
      expiresAt,
    });

    return access_token;
  } catch (error) {
    console.error('[ZOOM] Token refresh error:', error);
    return null;
  }
}

/**
 * Get a valid Zoom access token, refreshing if needed
 */
async function getValidZoomAccessToken(
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
        console.error('[ZOOM] Token expired and no refresh token available');
        return null;
      }
      return refreshZoomTokens(orgId, integrationId, refreshToken);
    }
  }

  return accessToken;
}

/**
 * Create a Zoom meeting
 */
export async function createZoomMeeting(
  orgId: string,
  details: ZoomMeetingDetails
): Promise<ZoomMeetingResponse> {
  try {
    // Get integration with decrypted tokens
    const integration = await getIntegration(orgId, 'zoom', true);

    if (!integration) {
      return { success: false, error: 'Zoom integration not connected' };
    }

    // Get valid access token
    const accessToken = await getValidZoomAccessToken(
      orgId,
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.expiresAt as Date | string | undefined
    );

    if (!accessToken) {
      return { success: false, error: 'Failed to get valid Zoom access token' };
    }

    // Create the meeting
    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: details.topic,
        type: 2, // Scheduled meeting
        start_time: details.startTime,
        duration: details.duration,
        timezone: details.timezone,
        agenda: details.agenda || '',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: false,
          audio: 'both',
          auto_recording: 'none',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[ZOOM] Meeting creation failed:', errorData);
      return {
        success: false,
        error: errorData.message || 'Failed to create Zoom meeting',
      };
    }

    const meeting = await response.json();

    return {
      success: true,
      meetingUrl: meeting.join_url,
      meetingId: String(meeting.id),
    };
  } catch (error) {
    console.error('[ZOOM] Meeting creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a Zoom meeting
 */
export async function deleteZoomMeeting(
  orgId: string,
  meetingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const integration = await getIntegration(orgId, 'zoom', true);

    if (!integration) {
      return { success: false, error: 'Zoom integration not connected' };
    }

    const accessToken = await getValidZoomAccessToken(
      orgId,
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.expiresAt as Date | string | undefined
    );

    if (!accessToken) {
      return { success: false, error: 'Failed to get valid Zoom access token' };
    }

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[ZOOM] Meeting deletion failed:', errorData);
      return {
        success: false,
        error: 'Failed to delete Zoom meeting',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[ZOOM] Meeting deletion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get Zoom meeting details
 */
export async function getZoomMeeting(
  orgId: string,
  meetingId: string
): Promise<{
  success: boolean;
  meeting?: {
    id: string;
    topic: string;
    startTime: string;
    duration: number;
    joinUrl: string;
    status: string;
  };
  error?: string;
}> {
  try {
    const integration = await getIntegration(orgId, 'zoom', true);

    if (!integration) {
      return { success: false, error: 'Zoom integration not connected' };
    }

    const accessToken = await getValidZoomAccessToken(
      orgId,
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.expiresAt as Date | string | undefined
    );

    if (!accessToken) {
      return { success: false, error: 'Failed to get valid Zoom access token' };
    }

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || 'Failed to get Zoom meeting',
      };
    }

    const data = await response.json();

    return {
      success: true,
      meeting: {
        id: String(data.id),
        topic: data.topic,
        startTime: data.start_time,
        duration: data.duration,
        joinUrl: data.join_url,
        status: data.status,
      },
    };
  } catch (error) {
    console.error('[ZOOM] Get meeting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
