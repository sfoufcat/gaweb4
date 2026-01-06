/**
 * Google Calendar OAuth Callback
 * 
 * GET /api/coach/integrations/google_calendar/callback
 * 
 * Handles the OAuth callback from Google and stores the integration credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeIntegration, type GoogleCalendarSettings } from '@/lib/integrations';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[GOOGLE_CALENDAR_CALLBACK] OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/coach/settings?tab=integrations&error=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=missing_params', req.url)
      );
    }

    // Decode state to get orgId and userId
    let stateData: { orgId: string; userId: string; provider: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=invalid_state', req.url)
      );
    }

    const { orgId, userId } = stateData;

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    // Use calendar subdomain for OAuth callbacks to avoid auth issues on subdomains
    const baseUrl = process.env.GOOGLE_OAUTH_REDIRECT_BASE_URL || 'https://calendar.coachful.co';
    const redirectUri = `${baseUrl}/api/coach/integrations/google_calendar/callback`;

    if (!clientId || !clientSecret) {
      console.error('[GOOGLE_CALENDAR_CALLBACK] Missing OAuth credentials');
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=server_config', req.url)
      );
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[GOOGLE_CALENDAR_CALLBACK] Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=token_exchange', req.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, token_type } = tokens;

    // Get user info to store account details
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `${token_type} ${access_token}`,
        },
      }
    );

    let accountEmail = '';
    let accountName = '';
    let accountId = '';

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      accountEmail = userInfo.email || '';
      accountName = userInfo.name || '';
      accountId = userInfo.id || '';
    }

    // Get primary calendar ID
    const calendarsResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=10',
      {
        headers: {
          Authorization: `${token_type} ${access_token}`,
        },
      }
    );

    let calendarId = 'primary';
    if (calendarsResponse.ok) {
      const calendarsData = await calendarsResponse.json();
      const primaryCalendar = calendarsData.items?.find(
        (cal: { primary?: boolean }) => cal.primary
      );
      if (primaryCalendar?.id) {
        calendarId = primaryCalendar.id;
      }
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Store the integration
    const settings: GoogleCalendarSettings = {
      provider: 'google_calendar',
      calendarId,
      syncDirection: 'one_way',
      autoCreateEvents: true,
      eventPrefix: '',
      reminderMinutes: 30,
      // Feature toggles - default to calendar sync enabled, meet links disabled
      enableCalendarSync: true,
      enableMeetLinks: true,
    };

    await storeIntegration(
      orgId,
      'google_calendar',
      {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenType: token_type,
        expiresAt,
        scopes: [
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.readonly',
        ],
        accountId,
        accountEmail,
        accountName,
        settings,
      },
      userId
    );

    console.log(`[GOOGLE_CALENDAR_CALLBACK] Successfully connected for org ${orgId}`);

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&connected=google_calendar', req.url)
    );
  } catch (error) {
    console.error('[GOOGLE_CALENDAR_CALLBACK] Error:', error);
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=unknown', req.url)
    );
  }
}



