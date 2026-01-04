import { NextRequest, NextResponse } from 'next/server';
import { storeIntegration } from '@/lib/integrations/token-manager';
import type { OutlookCalendarSettings } from '@/lib/integrations/types';

/**
 * GET /api/calendar/microsoft/callback
 * Handle OAuth callback from Microsoft
 */
export async function GET(request: NextRequest) {
  // Default redirect for errors
  let errorRedirectBase = 'https://app.coachful.co';

  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_CALENDAR_REDIRECT_URI || 'https://app.coachful.co/api/calendar/microsoft/callback';

    if (!clientId || !clientSecret) {
      console.error('[MICROSOFT_CALENDAR_CALLBACK] Missing OAuth credentials');
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=not_configured', errorRedirectBase));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('[MICROSOFT_CALENDAR_CALLBACK] OAuth error:', error, errorDescription);
      return NextResponse.redirect(new URL(`/coach?tab=scheduling&error=${error}`, errorRedirectBase));
    }

    if (!code || !state) {
      console.error('[MICROSOFT_CALENDAR_CALLBACK] Missing code or state');
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=invalid_callback', errorRedirectBase));
    }

    // Decode state
    let stateData: { userId: string; organizationId: string; originDomain: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      // Update error redirect to use origin domain
      errorRedirectBase = `https://${stateData.originDomain}`;
    } catch {
      console.error('[MICROSOFT_CALENDAR_CALLBACK] Invalid state');
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=invalid_state', errorRedirectBase));
    }

    const { userId, organizationId, originDomain } = stateData;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[MICROSOFT_CALENDAR_CALLBACK] Token exchange failed:', errorData);
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=token_exchange_failed', `https://${originDomain}`));
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Get user info
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    let accountEmail = '';
    let accountName = '';
    let accountId = '';
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      accountEmail = userInfo.mail || userInfo.userPrincipalName || '';
      accountName = userInfo.displayName || '';
      accountId = userInfo.id || '';
    }

    // Get primary calendar
    const calendarsResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    let primaryCalendarId = 'calendar';
    let primaryCalendarName = 'Calendar';
    if (calendarsResponse.ok) {
      const calendarsData = await calendarsResponse.json();
      // Find default calendar or use first one
      const defaultCal = calendarsData.value?.find((cal: { isDefaultCalendar?: boolean }) => cal.isDefaultCalendar);
      const firstCal = calendarsData.value?.[0];
      const selectedCal = defaultCal || firstCal;
      if (selectedCal) {
        primaryCalendarId = selectedCal.id;
        primaryCalendarName = selectedCal.name || 'Calendar';
      }
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    // Store integration with encrypted tokens
    const settings: OutlookCalendarSettings = {
      provider: 'outlook_calendar',
      calendarId: primaryCalendarId,
      syncDirection: 'one_way',
      autoCreateEvents: true,
      eventPrefix: '',
      reminderMinutes: 15,
    };

    await storeIntegration(
      organizationId,
      'outlook_calendar',
      {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenType: 'Bearer',
        expiresAt,
        scopes: ['Calendars.Read', 'Calendars.ReadWrite', 'User.Read', 'offline_access'],
        accountId,
        accountEmail,
        accountName,
        settings,
      },
      userId
    );

    console.log(`[MICROSOFT_CALENDAR_CALLBACK] Successfully connected calendar for org ${organizationId} (${accountEmail})`);

    // Redirect back to origin domain with success
    const successUrl = new URL('/coach', `https://${originDomain}`);
    successUrl.searchParams.set('tab', 'scheduling');
    successUrl.searchParams.set('calendar_connected', 'microsoft');

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('[MICROSOFT_CALENDAR_CALLBACK] Error:', error);
    return NextResponse.redirect(new URL('/coach?tab=scheduling&error=connection_failed', errorRedirectBase));
  }
}
