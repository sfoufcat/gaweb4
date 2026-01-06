import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getIntegration } from '@/lib/integrations/token-manager';
import { tryRefreshGoogleCalendarTokens } from '@/lib/integrations/google-calendar';
import { tryRefreshOutlookCalendarTokens } from '@/lib/integrations/outlook-calendar';
import type { GoogleCalendarSettings, OutlookCalendarSettings } from '@/lib/integrations/types';

/**
 * GET /api/calendar/status
 * Get the current calendar integration status for both Google and Microsoft
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Check both integrations in parallel (with decrypted tokens for refresh)
    let [googleIntegration, microsoftIntegration] = await Promise.all([
      getIntegration(organizationId, 'google_calendar', true), // decryptTokens = true
      getIntegration(organizationId, 'outlook_calendar', true),
    ]);

    // Debug logging
    console.log('[CALENDAR_STATUS] orgId:', organizationId);
    console.log('[CALENDAR_STATUS] google:', googleIntegration ? { status: googleIntegration.status, email: googleIntegration.accountEmail, expiresAt: googleIntegration.expiresAt } : 'NOT FOUND');
    console.log('[CALENDAR_STATUS] microsoft:', microsoftIntegration ? { status: microsoftIntegration.status, email: microsoftIntegration.accountEmail, expiresAt: microsoftIntegration.expiresAt } : 'NOT FOUND');

    // Auto-refresh tokens if needed (proactive refresh before expiry)
    // This ensures tokens stay valid and status remains 'connected'
    if (googleIntegration && googleIntegration.id) {
      try {
        const refreshed = await tryRefreshGoogleCalendarTokens(
          organizationId,
          googleIntegration.id,
          googleIntegration.refreshToken,
          googleIntegration.expiresAt as string | Date | undefined
        );
        if (refreshed) {
          // Re-fetch to get updated data after refresh
          googleIntegration = await getIntegration(organizationId, 'google_calendar');
          console.log('[CALENDAR_STATUS] Google tokens refreshed successfully');
        }
      } catch (err) {
        console.error('[CALENDAR_STATUS] Failed to refresh Google tokens:', err);
      }
    }

    if (microsoftIntegration && microsoftIntegration.id) {
      try {
        const refreshed = await tryRefreshOutlookCalendarTokens(
          organizationId,
          microsoftIntegration.id,
          microsoftIntegration.refreshToken,
          microsoftIntegration.expiresAt as string | Date | undefined
        );
        if (refreshed) {
          // Re-fetch to get updated data after refresh
          microsoftIntegration = await getIntegration(organizationId, 'outlook_calendar');
          console.log('[CALENDAR_STATUS] Microsoft tokens refreshed successfully');
        }
      } catch (err) {
        console.error('[CALENDAR_STATUS] Failed to refresh Microsoft tokens:', err);
      }
    }

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
