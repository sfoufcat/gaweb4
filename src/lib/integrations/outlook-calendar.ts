/**
 * Outlook Calendar Integration
 * 
 * Handles syncing events to Microsoft Outlook/365 Calendar.
 */

import { 
  getIntegration, 
  updateTokens, 
  updateSyncStatus,
  updateIntegrationStatus,
} from './token-manager';
import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { OutlookCalendarSettings, CalendarSyncRecord } from './types';

// =============================================================================
// TYPES
// =============================================================================

interface OutlookCalendarEvent {
  subject: string;
  body?: {
    contentType: 'HTML' | 'Text';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    type: 'required' | 'optional';
  }>;
  isReminderOn?: boolean;
  reminderMinutesBeforeStart?: number;
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
 * Refresh Microsoft OAuth tokens
 */
async function refreshMicrosoftTokens(
  orgId: string,
  integrationId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[OUTLOOK_CALENDAR] Missing OAuth credentials for refresh');
    return null;
  }

  try {
    const response = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: 'Calendars.ReadWrite offline_access',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[OUTLOOK_CALENDAR] Token refresh failed:', error);
      await updateIntegrationStatus(orgId, integrationId, 'expired', 'Token refresh failed');
      return null;
    }

    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await updateTokens(orgId, integrationId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken,
      expiresAt,
    });

    return tokens.access_token;
  } catch (error) {
    console.error('[OUTLOOK_CALENDAR] Error refreshing tokens:', error);
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
  expiresAt: Date | string | undefined
): Promise<string | null> {
  // Check if token is still valid (with 5 minute buffer)
  if (expiresAt) {
    const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiry.getTime() - now.getTime() > fiveMinutes) {
      return accessToken;
    }
  }

  // Token is expired or expiring soon, refresh it
  if (refreshToken) {
    return await refreshMicrosoftTokens(orgId, integrationId, refreshToken);
  }

  return null;
}

// =============================================================================
// CALENDAR API OPERATIONS
// =============================================================================

/**
 * Create an event in Outlook Calendar
 */
export async function createOutlookCalendarEvent(
  orgId: string,
  event: InternalEvent
): Promise<{ success: boolean; externalEventId?: string; error?: string }> {
  try {
    // Get the integration with decrypted tokens
    const integration = await getIntegration(orgId, 'outlook_calendar', true);
    
    if (!integration) {
      return { success: false, error: 'Outlook Calendar not connected' };
    }

    if (integration.status !== 'connected') {
      return { success: false, error: `Integration status: ${integration.status}` };
    }

    const settings = integration.settings as OutlookCalendarSettings;
    const calendarId = settings.calendarId || 'calendar';

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
    const outlookEvent: OutlookCalendarEvent = {
      subject: settings.eventPrefix 
        ? `${settings.eventPrefix} ${event.title}` 
        : event.title,
      start: {
        dateTime: event.startDateTime,
        timeZone: event.timezone || 'UTC',
      },
      end: {
        dateTime: event.endDateTime,
        timeZone: event.timezone || 'UTC',
      },
    };

    if (event.description) {
      outlookEvent.body = {
        contentType: 'Text',
        content: event.description,
      };
    }

    if (event.location) {
      outlookEvent.location = {
        displayName: event.location,
      };
    }

    if (event.attendees?.length) {
      outlookEvent.attendees = event.attendees.map((a) => ({
        emailAddress: {
          address: a.email,
          name: a.name,
        },
        type: 'required' as const,
      }));
    }

    if (settings.reminderMinutes) {
      outlookEvent.isReminderOn = true;
      outlookEvent.reminderMinutesBeforeStart = settings.reminderMinutes;
    }

    // Create the event
    const apiUrl = calendarId === 'calendar'
      ? 'https://graph.microsoft.com/v1.0/me/events'
      : `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(outlookEvent),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[OUTLOOK_CALENDAR] Create event failed:', error);
      await updateSyncStatus(orgId, integration.id, 'error', error.error?.message);
      return { success: false, error: error.error?.message || 'Failed to create event' };
    }

    const createdEvent = await response.json();

    // Store sync record
    await storeSyncRecord(orgId, integration.id, 'outlook_calendar', event, createdEvent.id, calendarId);

    await updateSyncStatus(orgId, integration.id, 'success');

    console.log(`[OUTLOOK_CALENDAR] Created event ${createdEvent.id} for org ${orgId}`);

    return { success: true, externalEventId: createdEvent.id };
  } catch (error) {
    console.error('[OUTLOOK_CALENDAR] Error creating event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Update an event in Outlook Calendar
 */
export async function updateOutlookCalendarEvent(
  orgId: string,
  event: InternalEvent
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the sync record to find the external event ID
    const syncRecord = await getSyncRecord(orgId, event.type, event.id);
    
    if (!syncRecord) {
      // Event not synced yet, create it instead
      const result = await createOutlookCalendarEvent(orgId, event);
      return { success: result.success, error: result.error };
    }

    const integration = await getIntegration(orgId, 'outlook_calendar', true);
    
    if (!integration) {
      return { success: false, error: 'Outlook Calendar not connected' };
    }

    const settings = integration.settings as OutlookCalendarSettings;

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
    const outlookEvent: Partial<OutlookCalendarEvent> = {
      subject: settings.eventPrefix 
        ? `${settings.eventPrefix} ${event.title}` 
        : event.title,
      start: {
        dateTime: event.startDateTime,
        timeZone: event.timezone || 'UTC',
      },
      end: {
        dateTime: event.endDateTime,
        timeZone: event.timezone || 'UTC',
      },
    };

    if (event.description) {
      outlookEvent.body = {
        contentType: 'Text',
        content: event.description,
      };
    }

    if (event.location) {
      outlookEvent.location = {
        displayName: event.location,
      };
    }

    // Update the event
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${syncRecord.externalEventId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(outlookEvent),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[OUTLOOK_CALENDAR] Update event failed:', error);
      return { success: false, error: error.error?.message || 'Failed to update event' };
    }

    // Update sync record
    await updateSyncRecord(orgId, syncRecord.id);

    await updateSyncStatus(orgId, integration.id, 'success');

    return { success: true };
  } catch (error) {
    console.error('[OUTLOOK_CALENDAR] Error updating event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete an event from Outlook Calendar
 */
export async function deleteOutlookCalendarEvent(
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

    const integration = await getIntegration(orgId, 'outlook_calendar', true);
    
    if (!integration) {
      return { success: false, error: 'Outlook Calendar not connected' };
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
      `https://graph.microsoft.com/v1.0/me/events/${syncRecord.externalEventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 404 is also success (already deleted)
    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      console.error('[OUTLOOK_CALENDAR] Delete event failed:', error);
      return { success: false, error: error.error?.message || 'Failed to delete event' };
    }

    // Delete sync record
    await deleteSyncRecord(orgId, syncRecord.id);

    return { success: true };
  } catch (error) {
    console.error('[OUTLOOK_CALENDAR] Error deleting event:', error);
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
    .where('provider', '==', 'outlook_calendar')
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
 * Sync a coaching session to Outlook Calendar
 */
export async function syncCoachingSessionToOutlookCalendar(
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
  const integration = await getIntegration(orgId, 'outlook_calendar');
  
  if (!integration || integration.status !== 'connected') {
    return; // No calendar connected
  }

  const settings = integration.settings as OutlookCalendarSettings;
  
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

  await createOutlookCalendarEvent(orgId, event);
}

/**
 * Sync a squad call to Outlook Calendar
 */
export async function syncSquadCallToOutlookCalendar(
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
  const integration = await getIntegration(orgId, 'outlook_calendar');
  
  if (!integration || integration.status !== 'connected') {
    return;
  }

  const settings = integration.settings as OutlookCalendarSettings;
  
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

  await createOutlookCalendarEvent(orgId, event);
}

