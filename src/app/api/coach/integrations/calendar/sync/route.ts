/**
 * Calendar Sync API
 * 
 * POST /api/coach/integrations/calendar/sync
 * 
 * Manually trigger a calendar sync for a specific event.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  syncCoachingSessionToCalendar,
  syncSquadCallToCalendar,
  syncCoachingSessionToOutlookCalendar,
  syncSquadCallToOutlookCalendar,
} from '@/lib/integrations';

interface SyncRequestBody {
  eventType: 'coaching_session' | 'squad_call';
  eventId: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timezone?: string;
  location?: string;
  clientEmail?: string;
  clientName?: string;
  squadName?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body: SyncRequestBody = await req.json();
    const {
      eventType,
      eventId,
      title,
      description,
      startDateTime,
      endDateTime,
      timezone,
      location,
      clientEmail,
      clientName,
      squadName,
    } = body;

    if (!eventType || !eventId || !title || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: 'Missing required fields: eventType, eventId, title, startDateTime, endDateTime' },
        { status: 400 }
      );
    }

    // Sync to both calendar providers if connected
    const results = {
      googleCalendar: false,
      outlookCalendar: false,
    };

    if (eventType === 'coaching_session') {
      const sessionData = {
        sessionId: eventId,
        title,
        description,
        startDateTime,
        endDateTime,
        timezone,
        location,
        clientEmail,
        clientName,
      };

      // Try Google Calendar
      try {
        await syncCoachingSessionToCalendar(organizationId, sessionData);
        results.googleCalendar = true;
      } catch (error) {
        console.error('[CALENDAR_SYNC] Google Calendar error:', error);
      }

      // Try Outlook Calendar
      try {
        await syncCoachingSessionToOutlookCalendar(organizationId, sessionData);
        results.outlookCalendar = true;
      } catch (error) {
        console.error('[CALENDAR_SYNC] Outlook Calendar error:', error);
      }
    } else if (eventType === 'squad_call') {
      const callData = {
        callId: eventId,
        squadName: squadName || title,
        description,
        startDateTime,
        endDateTime,
        timezone,
        location,
      };

      // Try Google Calendar
      try {
        await syncSquadCallToCalendar(organizationId, callData);
        results.googleCalendar = true;
      } catch (error) {
        console.error('[CALENDAR_SYNC] Google Calendar error:', error);
      }

      // Try Outlook Calendar
      try {
        await syncSquadCallToOutlookCalendar(organizationId, callData);
        results.outlookCalendar = true;
      } catch (error) {
        console.error('[CALENDAR_SYNC] Outlook Calendar error:', error);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[CALENDAR_SYNC_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



