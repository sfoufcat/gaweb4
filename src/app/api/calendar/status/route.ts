import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getIntegration } from '@/lib/integrations/token-manager';
import type { GoogleCalendarSettings, OutlookCalendarSettings } from '@/lib/integrations/types';

/**
 * GET /api/calendar/status
 * Get the current calendar integration status
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Check Google Calendar
    const googleIntegration = await getIntegration(organizationId, 'google_calendar');
    if (googleIntegration && googleIntegration.status === 'connected') {
      const settings = googleIntegration.settings as GoogleCalendarSettings;
      return NextResponse.json({
        connected: true,
        provider: 'google_calendar',
        accountEmail: googleIntegration.accountEmail,
        accountName: googleIntegration.accountName,
        calendarName: settings.calendarId === 'primary' ? 'Primary Calendar' : settings.calendarId,
        settings: {
          syncDirection: settings.syncDirection,
          autoCreateEvents: settings.autoCreateEvents,
        },
      });
    }

    // Check Microsoft/Outlook Calendar
    const microsoftIntegration = await getIntegration(organizationId, 'outlook_calendar');
    if (microsoftIntegration && microsoftIntegration.status === 'connected') {
      const settings = microsoftIntegration.settings as OutlookCalendarSettings;
      return NextResponse.json({
        connected: true,
        provider: 'outlook_calendar',
        accountEmail: microsoftIntegration.accountEmail,
        accountName: microsoftIntegration.accountName,
        calendarName: 'Outlook Calendar',
        settings: {
          syncDirection: settings.syncDirection,
          autoCreateEvents: settings.autoCreateEvents,
        },
      });
    }

    // No calendar connected
    return NextResponse.json({
      connected: false,
      provider: null,
    });
  } catch (error) {
    console.error('[CALENDAR_STATUS] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
