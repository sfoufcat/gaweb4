import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getIntegration } from '@/lib/integrations/token-manager';
import type { GoogleCalendarSettings, OutlookCalendarSettings } from '@/lib/integrations/types';

/**
 * GET /api/calendar/status
 * Get the current calendar integration status for both Google and Microsoft
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Check both integrations in parallel
    const [googleIntegration, microsoftIntegration] = await Promise.all([
      getIntegration(organizationId, 'google_calendar'),
      getIntegration(organizationId, 'outlook_calendar'),
    ]);

    // Build Google status
    let google: {
      connected: boolean;
      accountEmail?: string;
      accountName?: string;
      calendarName?: string;
      settings?: { syncDirection: string; autoCreateEvents: boolean };
    } = { connected: false };

    if (googleIntegration && googleIntegration.status === 'connected') {
      const settings = googleIntegration.settings as GoogleCalendarSettings;
      google = {
        connected: true,
        accountEmail: googleIntegration.accountEmail,
        accountName: googleIntegration.accountName,
        calendarName: settings.calendarId === 'primary' ? 'Primary Calendar' : settings.calendarId,
        settings: {
          syncDirection: settings.syncDirection,
          autoCreateEvents: settings.autoCreateEvents,
        },
      };
    }

    // Build Microsoft status
    let microsoft: {
      connected: boolean;
      accountEmail?: string;
      accountName?: string;
      calendarName?: string;
      settings?: { syncDirection: string; autoCreateEvents: boolean };
    } = { connected: false };

    if (microsoftIntegration && microsoftIntegration.status === 'connected') {
      const settings = microsoftIntegration.settings as OutlookCalendarSettings;
      microsoft = {
        connected: true,
        accountEmail: microsoftIntegration.accountEmail,
        accountName: microsoftIntegration.accountName,
        calendarName: 'Outlook Calendar',
        settings: {
          syncDirection: settings.syncDirection,
          autoCreateEvents: settings.autoCreateEvents,
        },
      };
    }

    return NextResponse.json({
      google,
      microsoft,
    });
  } catch (error) {
    console.error('[CALENDAR_STATUS] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
