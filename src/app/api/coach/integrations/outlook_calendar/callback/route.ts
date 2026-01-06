/**
 * Outlook Calendar OAuth Callback
 * 
 * GET /api/coach/integrations/outlook_calendar/callback
 * 
 * Handles the OAuth callback from Microsoft and stores the integration credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeIntegration, type OutlookCalendarSettings } from '@/lib/integrations';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('[OUTLOOK_CALENDAR_CALLBACK] OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/coach/settings?tab=integrations&error=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=missing_params', req.url)
      );
    }

    // Decode state to get orgId, userId, and originDomain
    let stateData: { orgId: string; userId: string; provider: string; originDomain?: string; timestamp?: number };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=invalid_state', req.url)
      );
    }

    const { orgId, userId, originDomain } = stateData;

    // Determine redirect base URL - use originDomain if available, otherwise fallback
    const redirectBase = originDomain ? `https://${originDomain}` : req.url;

    // Exchange code for tokens
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/coach/integrations/outlook_calendar/callback`;

    if (!clientId || !clientSecret) {
      console.error('[OUTLOOK_CALENDAR_CALLBACK] Missing OAuth credentials');
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=server_config', req.url)
      );
    }

    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
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
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[OUTLOOK_CALENDAR_CALLBACK] Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=token_exchange', req.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, token_type } = tokens;

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `${token_type} ${access_token}`,
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

    // Get default calendar ID
    const calendarsResponse = await fetch(
      'https://graph.microsoft.com/v1.0/me/calendars',
      {
        headers: {
          Authorization: `${token_type} ${access_token}`,
        },
      }
    );

    let calendarId = 'calendar'; // Default
    if (calendarsResponse.ok) {
      const calendarsData = await calendarsResponse.json();
      const defaultCalendar = calendarsData.value?.find(
        (cal: { isDefaultCalendar?: boolean }) => cal.isDefaultCalendar
      );
      if (defaultCalendar?.id) {
        calendarId = defaultCalendar.id;
      }
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Store the integration
    const settings: OutlookCalendarSettings = {
      provider: 'outlook_calendar',
      calendarId,
      syncDirection: 'one_way',
      autoCreateEvents: true,
      eventPrefix: '',
      reminderMinutes: 30,
    };

    await storeIntegration(
      orgId,
      'outlook_calendar',
      {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenType: token_type,
        expiresAt,
        scopes: ['Calendars.ReadWrite', 'offline_access'],
        accountId,
        accountEmail,
        accountName,
        settings,
      },
      userId
    );

    console.log(`[OUTLOOK_CALENDAR_CALLBACK] Successfully connected for org ${orgId}, redirecting to ${redirectBase}`);

    // Redirect back to settings with success (use originDomain to go back to user's org)
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&connected=outlook_calendar', redirectBase)
    );
  } catch (error) {
    console.error('[OUTLOOK_CALENDAR_CALLBACK] Error:', error);
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=unknown', req.url)
    );
  }
}



