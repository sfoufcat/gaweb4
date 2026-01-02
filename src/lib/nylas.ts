import Nylas from 'nylas';

/**
 * Nylas API Client
 * 
 * Handles integration with Nylas for calendar synchronization.
 * Requires the following environment variables:
 * - NYLAS_API_KEY: Your Nylas API key
 * - NYLAS_API_URI: Nylas API URI (defaults to https://api.us.nylas.com)
 * - NYLAS_CLIENT_ID: Your Nylas application client ID
 * - NYLAS_REDIRECT_URI: OAuth callback URL
 */

// Initialize Nylas configuration
const nylasApiKey = process.env.NYLAS_API_KEY;
const nylasApiUri = process.env.NYLAS_API_URI || 'https://api.us.nylas.com';
const nylasClientId = process.env.NYLAS_CLIENT_ID;
const nylasRedirectUri = process.env.NYLAS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/nylas/callback`;

// Check if Nylas is configured
export const isNylasConfigured = !!(nylasApiKey && nylasClientId);

// Initialize Nylas client
let nylasClient: Nylas | null = null;

if (isNylasConfigured) {
  nylasClient = new Nylas({
    apiKey: nylasApiKey!,
    apiUri: nylasApiUri,
  });
}

export { nylasClient };

/**
 * Get the Nylas OAuth authorization URL
 * @param state State parameter for OAuth (usually contains userId and orgId)
 * @param loginHint Optional email hint for the OAuth flow
 */
export function getAuthUrl(state: string, loginHint?: string): string {
  if (!nylasClient || !nylasClientId) {
    throw new Error('Nylas is not configured');
  }

  const params = new URLSearchParams({
    client_id: nylasClientId,
    response_type: 'code',
    redirect_uri: nylasRedirectUri,
    state,
    access_type: 'offline',
    scope: 'calendar',
  });

  if (loginHint) {
    params.set('login_hint', loginHint);
  }

  return `${nylasApiUri}/v3/connect/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token
 * @param code The authorization code from the OAuth callback
 */
export async function exchangeCodeForToken(code: string): Promise<{
  grantId: string;
  email: string;
  provider: string;
}> {
  if (!nylasClient || !nylasClientId) {
    throw new Error('Nylas is not configured');
  }

  const response = await fetch(`${nylasApiUri}/v3/connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${nylasApiKey}`,
    },
    body: JSON.stringify({
      client_id: nylasClientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: nylasRedirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to exchange code for token');
  }

  const data = await response.json();
  return {
    grantId: data.grant_id,
    email: data.email,
    provider: data.provider,
  };
}

/**
 * Get calendars for a user
 * @param grantId The Nylas grant ID
 */
export async function getCalendars(grantId: string): Promise<Array<{
  id: string;
  name: string;
  isPrimary: boolean;
  readOnly: boolean;
}>> {
  if (!nylasClient) {
    throw new Error('Nylas is not configured');
  }

  const response = await nylasClient.calendars.list({
    identifier: grantId,
  });

  return response.data.map(cal => ({
    id: cal.id,
    name: cal.name || 'Unnamed Calendar',
    isPrimary: cal.isPrimary || false,
    readOnly: cal.readOnly || false,
  }));
}

/**
 * Get free/busy times for a calendar
 * @param grantId The Nylas grant ID
 * @param calendarId The calendar ID
 * @param startTime Start of the time range (Unix timestamp in seconds)
 * @param endTime End of the time range (Unix timestamp in seconds)
 */
export async function getFreeBusy(
  grantId: string,
  calendarId: string,
  startTime: number,
  endTime: number
): Promise<Array<{ start: number; end: number; status: string }>> {
  if (!nylasClient) {
    throw new Error('Nylas is not configured');
  }

  const response = await nylasClient.calendars.getFreeBusy({
    identifier: grantId,
    requestBody: {
      startTime,
      endTime,
      emails: [], // Will use the grant's email
    },
  });

  // Extract busy times from the response
  const busyTimes: Array<{ start: number; end: number; status: string }> = [];
  
  for (const item of response.data) {
    if ('timeSlots' in item && item.timeSlots) {
      for (const slot of item.timeSlots) {
        if (slot.status !== 'free') {
          busyTimes.push({
            start: slot.startTime,
            end: slot.endTime,
            status: slot.status,
          });
        }
      }
    }
  }

  return busyTimes;
}

/**
 * Create a calendar event
 * @param grantId The Nylas grant ID
 * @param calendarId The calendar ID
 * @param event Event details
 */
export async function createEvent(
  grantId: string,
  calendarId: string,
  event: {
    title: string;
    description?: string;
    location?: string;
    startTime: number; // Unix timestamp in seconds
    endTime: number;
    participants?: Array<{ email: string; name?: string }>;
    conferencing?: {
      provider: 'Google Meet' | 'Zoom' | 'Microsoft Teams';
    };
  }
): Promise<{ id: string; htmlLink?: string; conferenceUrl?: string }> {
  if (!nylasClient) {
    throw new Error('Nylas is not configured');
  }

  const response = await nylasClient.events.create({
    identifier: grantId,
    queryParams: {
      calendarId,
    },
    requestBody: {
      title: event.title,
      description: event.description,
      location: event.location,
      when: {
        startTime: event.startTime,
        endTime: event.endTime,
      },
      participants: event.participants?.map(p => ({
        email: p.email,
        name: p.name,
      })),
      conferencing: event.conferencing ? {
        provider: event.conferencing.provider,
        autocreate: {},
      } : undefined,
    },
  });

  return {
    id: response.data.id,
    htmlLink: response.data.htmlLink,
    conferenceUrl: response.data.conferencing?.details?.url,
  };
}

/**
 * Update a calendar event
 * @param grantId The Nylas grant ID
 * @param calendarId The calendar ID
 * @param eventId The event ID
 * @param updates Event updates
 */
export async function updateEvent(
  grantId: string,
  calendarId: string,
  eventId: string,
  updates: {
    title?: string;
    description?: string;
    location?: string;
    startTime?: number;
    endTime?: number;
  }
): Promise<void> {
  if (!nylasClient) {
    throw new Error('Nylas is not configured');
  }

  await nylasClient.events.update({
    identifier: grantId,
    eventId,
    queryParams: {
      calendarId,
    },
    requestBody: {
      title: updates.title,
      description: updates.description,
      location: updates.location,
      when: updates.startTime && updates.endTime ? {
        startTime: updates.startTime,
        endTime: updates.endTime,
      } : undefined,
    },
  });
}

/**
 * Delete a calendar event
 * @param grantId The Nylas grant ID
 * @param calendarId The calendar ID
 * @param eventId The event ID
 */
export async function deleteEvent(
  grantId: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  if (!nylasClient) {
    throw new Error('Nylas is not configured');
  }

  await nylasClient.events.destroy({
    identifier: grantId,
    eventId,
    queryParams: {
      calendarId,
    },
  });
}

/**
 * Revoke a Nylas grant (disconnect calendar)
 * @param grantId The Nylas grant ID
 */
export async function revokeGrant(grantId: string): Promise<void> {
  if (!nylasClient) {
    throw new Error('Nylas is not configured');
  }

  await nylasClient.grants.destroy({
    grantId,
  });
}

