/**
 * Google Calendar Integration
 * 
 * Handles syncing events to Google Calendar.
 */

import { 
  getIntegration, 
  updateTokens, 
  updateSyncStatus,
  updateIntegrationStatus,
} from './token-manager';
import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { GoogleCalendarSettings, CalendarSyncRecord } from './types';

// =============================================================================
// TYPES
// =============================================================================

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  colorId?: string;
}

interface InternalEvent {
  id: string;
  type: 'coaching_session' | 'squad_call' | 'workshop' | 'event';
  title: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  timezone?: string;
  attendees?: Array<{ email: string; name?: string }>;
}

// =============================================================================
// TOKEN REFRESH
// =============================================================================

/**
 * Convert various timestamp formats to a Date object
 * Handles: Date, string, Firestore Timestamp, or object with _seconds
 */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  // Firestore Timestamp object (has toDate method)
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  // Plain object with _seconds (serialized Firestore Timestamp)
  if (typeof value === 'object' && '_seconds' in value) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  return null;
}

/**
 * Refresh Google OAuth tokens
 */
async function refreshGoogleTokens(
  orgId: string,
  integrationId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[GOOGLE_CALENDAR] Missing OAuth credentials for refresh');
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
      console.error('[GOOGLE_CALENDAR] Token refresh failed:', error);
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
    console.error('[GOOGLE_CALENDAR] Error refreshing tokens:', error);
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(
  orgId: string,
  integrationId: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: unknown
): Promise<string | null> {
  // Check if token is still valid (with 5 minute buffer)
  if (expiresAt) {
    const expiry = toDate(expiresAt);
    if (expiry) {
      const now = new Date();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiry.getTime() - now.getTime() > fiveMinutes) {
        return accessToken;
      }
    }
  }

  // Token is expired or expiring soon, refresh it
  if (refreshToken) {
    return await refreshGoogleTokens(orgId, integrationId, refreshToken);
  }

  return null;
}

/**
 * Attempt to refresh tokens for a Google Calendar integration
 * Returns true if refresh was successful or not needed, false if refresh failed
 */
export async function tryRefreshGoogleCalendarTokens(
  orgId: string,
  integrationId: string,
  refreshToken: string | undefined,
  expiresAt: unknown,
  status?: string
): Promise<boolean> {
  // Always try refresh if status is 'expired'
  if (status === 'expired') {
    if (refreshToken) {
      console.log('[GOOGLE_CALENDAR] Attempting to refresh expired token');
      const newToken = await refreshGoogleTokens(orgId, integrationId, refreshToken);
      return newToken !== null;
    }
    return false;
  }

  // Check if refresh is needed based on expiry time
  if (expiresAt) {
    const expiry = toDate(expiresAt);
    if (expiry) {
      const now = new Date();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiry.getTime() - now.getTime() > fiveMinutes) {
        // Token is still valid
        return true;
      }
    }
  }

  // Token needs refresh
  if (refreshToken) {
    const newToken = await refreshGoogleTokens(orgId, integrationId, refreshToken);
    return newToken !== null;
  }

  return false;
}

// =============================================================================
// CALENDAR API OPERATIONS
// =============================================================================

/**
 * Create an event in Google Calendar
 */
export async function createGoogleCalendarEvent(
  orgId: string,
  event: InternalEvent
): Promise<{ success: boolean; externalEventId?: string; error?: string }> {
  try {
    // Get the integration with decrypted tokens
    const integration = await getIntegration(orgId, 'google_calendar', true);
    
    if (!integration) {
      return { success: false, error: 'Google Calendar not connected' };
    }

    if (integration.status !== 'connected') {
      return { success: false, error: `Integration status: ${integration.status}` };
    }

    const settings = integration.settings as GoogleCalendarSettings;
    const calendarId = settings.calendarId || 'primary';

    // Get valid access token
    const accessToken = await getValidAccessToken(
      orgId,
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.expiresAt as Date | string | undefined
    );

    if (!accessToken) {
      return { success: false, error: 'Unable to get valid access token' };
    }

    // Build event payload
    const googleEvent: GoogleCalendarEvent = {
      summary: settings.eventPrefix 
        ? `${settings.eventPrefix} ${event.title}` 
        : event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.startDateTime,
        timeZone: event.timezone || 'UTC',
      },
      end: {
        dateTime: event.endDateTime,
        timeZone: event.timezone || 'UTC',
      },
      reminders: {
        useDefault: false,
        overrides: settings.reminderMinutes 
          ? [{ method: 'popup', minutes: settings.reminderMinutes }]
          : [],
      },
    };

    if (event.attendees?.length) {
      googleEvent.attendees = event.attendees.map((a) => ({
        email: a.email,
        displayName: a.name,
      }));
    }

    // Create the event
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(googleEvent),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[GOOGLE_CALENDAR] Create event failed:', error);
      await updateSyncStatus(orgId, integration.id, 'error', error.error?.message);
      return { success: false, error: error.error?.message || 'Failed to create event' };
    }

    const createdEvent = await response.json();

    // Store sync record
    await storeSyncRecord(orgId, integration.id, 'google_calendar', event, createdEvent.id, calendarId);

    await updateSyncStatus(orgId, integration.id, 'success');

    console.log(`[GOOGLE_CALENDAR] Created event ${createdEvent.id} for org ${orgId}`);

    return { success: true, externalEventId: createdEvent.id };
  } catch (error) {
    console.error('[GOOGLE_CALENDAR] Error creating event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Update an event in Google Calendar
 */
export async function updateGoogleCalendarEvent(
  orgId: string,
  event: InternalEvent
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the sync record to find the external event ID
    const syncRecord = await getSyncRecord(orgId, event.type, event.id);
    
    if (!syncRecord) {
      // Event not synced yet, create it instead
      const result = await createGoogleCalendarEvent(orgId, event);
      return { success: result.success, error: result.error };
    }

    const integration = await getIntegration(orgId, 'google_calendar', true);
    
    if (!integration) {
      return { success: false, error: 'Google Calendar not connected' };
    }

    const settings = integration.settings as GoogleCalendarSettings;

    // Get valid access token
    const accessToken = await getValidAccessToken(
      orgId,
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.expiresAt as Date | string | undefined
    );

    if (!accessToken) {
      return { success: false, error: 'Unable to get valid access token' };
    }

    // Build event payload
    const googleEvent: GoogleCalendarEvent = {
      summary: settings.eventPrefix 
        ? `${settings.eventPrefix} ${event.title}` 
        : event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.startDateTime,
        timeZone: event.timezone || 'UTC',
      },
      end: {
        dateTime: event.endDateTime,
        timeZone: event.timezone || 'UTC',
      },
    };

    // Update the event
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(syncRecord.externalCalendarId)}/events/${encodeURIComponent(syncRecord.externalEventId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(googleEvent),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[GOOGLE_CALENDAR] Update event failed:', error);
      return { success: false, error: error.error?.message || 'Failed to update event' };
    }

    // Update sync record
    await updateSyncRecord(orgId, syncRecord.id);

    await updateSyncStatus(orgId, integration.id, 'success');

    return { success: true };
  } catch (error) {
    console.error('[GOOGLE_CALENDAR] Error updating event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  orgId: string,
  eventType: InternalEvent['type'],
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the sync record
    const syncRecord = await getSyncRecord(orgId, eventType, eventId);
    
    if (!syncRecord) {
      // Event not synced, nothing to delete
      return { success: true };
    }

    const integration = await getIntegration(orgId, 'google_calendar', true);
    
    if (!integration) {
      return { success: false, error: 'Google Calendar not connected' };
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(
      orgId,
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.expiresAt as Date | string | undefined
    );

    if (!accessToken) {
      return { success: false, error: 'Unable to get valid access token' };
    }

    // Delete the event
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(syncRecord.externalCalendarId)}/events/${encodeURIComponent(syncRecord.externalEventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 410 Gone is also success (already deleted)
    if (!response.ok && response.status !== 410) {
      const error = await response.json();
      console.error('[GOOGLE_CALENDAR] Delete event failed:', error);
      return { success: false, error: error.error?.message || 'Failed to delete event' };
    }

    // Delete sync record
    await deleteSyncRecord(orgId, syncRecord.id);

    return { success: true };
  } catch (error) {
    console.error('[GOOGLE_CALENDAR] Error deleting event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// =============================================================================
// SYNC RECORDS
// =============================================================================

/**
 * Store a sync record
 */
async function storeSyncRecord(
  orgId: string,
  integrationId: string,
  provider: 'google_calendar' | 'outlook_calendar',
  event: InternalEvent,
  externalEventId: string,
  externalCalendarId: string
): Promise<void> {
  const syncRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('calendarSyncRecords');

  await syncRef.add({
    integrationId,
    provider,
    internalEventType: event.type,
    internalEventId: event.id,
    externalEventId,
    externalCalendarId,
    lastSyncedAt: FieldValue.serverTimestamp(),
    syncDirection: 'pushed',
    syncHash: createEventHash(event),
  });
}

/**
 * Get a sync record
 */
async function getSyncRecord(
  orgId: string,
  eventType: InternalEvent['type'],
  eventId: string
): Promise<CalendarSyncRecord | null> {
  const syncRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('calendarSyncRecords');

  const snapshot = await syncRef
    .where('internalEventType', '==', eventType)
    .where('internalEventId', '==', eventId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as CalendarSyncRecord;
}

/**
 * Update a sync record
 */
async function updateSyncRecord(orgId: string, recordId: string): Promise<void> {
  const syncRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('calendarSyncRecords')
    .doc(recordId);

  await syncRef.update({
    lastSyncedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Delete a sync record
 */
async function deleteSyncRecord(orgId: string, recordId: string): Promise<void> {
  const syncRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('calendarSyncRecords')
    .doc(recordId);

  await syncRef.delete();
}

/**
 * Create a hash of event data for change detection
 */
function createEventHash(event: InternalEvent): string {
  const data = `${event.title}|${event.startDateTime}|${event.endDateTime}|${event.location || ''}`;
  // Simple hash - in production might want crypto hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// =============================================================================
// SYNC HELPERS FOR COACH EVENTS
// =============================================================================

/**
 * Sync a coaching session to Google Calendar
 */
export async function syncCoachingSessionToCalendar(
  orgId: string,
  sessionData: {
    sessionId: string;
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    timezone?: string;
    clientEmail?: string;
    clientName?: string;
    location?: string;
  }
): Promise<void> {
  const integration = await getIntegration(orgId, 'google_calendar');
  
  if (!integration || integration.status !== 'connected') {
    return; // No calendar connected
  }

  const settings = integration.settings as GoogleCalendarSettings;
  
  if (!settings.autoCreateEvents) {
    return; // Auto-create disabled
  }

  const event: InternalEvent = {
    id: sessionData.sessionId,
    type: 'coaching_session',
    title: sessionData.title,
    description: sessionData.description,
    location: sessionData.location,
    startDateTime: sessionData.startDateTime,
    endDateTime: sessionData.endDateTime,
    timezone: sessionData.timezone,
    attendees: sessionData.clientEmail 
      ? [{ email: sessionData.clientEmail, name: sessionData.clientName }]
      : undefined,
  };

  await createGoogleCalendarEvent(orgId, event);
}

/**
 * Sync a squad call to Google Calendar
 */
export async function syncSquadCallToCalendar(
  orgId: string,
  callData: {
    callId: string;
    squadName: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    timezone?: string;
    location?: string;
  }
): Promise<void> {
  const integration = await getIntegration(orgId, 'google_calendar');
  
  if (!integration || integration.status !== 'connected') {
    return;
  }

  const settings = integration.settings as GoogleCalendarSettings;
  
  if (!settings.autoCreateEvents) {
    return;
  }

  const event: InternalEvent = {
    id: callData.callId,
    type: 'squad_call',
    title: `${callData.squadName} Call`,
    description: callData.description,
    location: callData.location,
    startDateTime: callData.startDateTime,
    endDateTime: callData.endDateTime,
    timezone: callData.timezone,
  };

  await createGoogleCalendarEvent(orgId, event);
}



