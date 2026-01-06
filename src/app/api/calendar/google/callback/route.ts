import { NextRequest, NextResponse } from 'next/server';
import { storeIntegration } from '@/lib/integrations/token-manager';
import { getOrgDomain } from '@/lib/tenant/resolveTenant';
import type { GoogleCalendarSettings } from '@/lib/integrations/types';

/**
 * GET /api/calendar/google/callback
 * Handle OAuth callback from Google
 */
export async function GET(request: NextRequest) {
  // Default redirect for errors
  let errorRedirectBase = 'https://calendar.coachful.co';

  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://calendar.coachful.co/api/calendar/google/callback';

    if (!clientId || !clientSecret) {
      console.error('[GOOGLE_CALENDAR_CALLBACK] Missing OAuth credentials');
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=not_configured', errorRedirectBase));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('[GOOGLE_CALENDAR_CALLBACK] OAuth error:', error);
      return NextResponse.redirect(new URL(`/coach?tab=scheduling&error=${error}`, errorRedirectBase));
    }

    if (!code || !state) {
      console.error('[GOOGLE_CALENDAR_CALLBACK] Missing code or state');
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=invalid_callback', errorRedirectBase));
    }

    // Decode state
    let stateData: { userId: string; organizationId: string; originDomain: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      // Update error redirect to use origin domain
      errorRedirectBase = `https://${stateData.originDomain}`;
    } catch {
      console.error('[GOOGLE_CALENDAR_CALLBACK] Invalid state');
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=invalid_state', errorRedirectBase));
    }

    const { userId, organizationId, originDomain } = stateData;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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
      console.error('[GOOGLE_CALENDAR_CALLBACK] Token exchange failed:', errorData);
      return NextResponse.redirect(new URL('/coach?tab=scheduling&error=token_exchange_failed', `https://${originDomain}`));
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Get user info (email)
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    let accountEmail = '';
    let accountName = '';
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      accountEmail = userInfo.email || '';
      accountName = userInfo.name || '';
    }

    // Get primary calendar ID
    const calendarsResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    let primaryCalendarId = 'primary';
    let primaryCalendarName = 'Primary Calendar';
    if (calendarsResponse.ok) {
      const calendarsData = await calendarsResponse.json();
      const primaryCal = calendarsData.items?.find((cal: { primary?: boolean }) => cal.primary);
      if (primaryCal) {
        primaryCalendarId = primaryCal.id;
        primaryCalendarName = primaryCal.summary || 'Primary Calendar';
      }
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    // Store integration with encrypted tokens
    const settings: GoogleCalendarSettings = {
      provider: 'google_calendar',
      calendarId: primaryCalendarId,
      syncDirection: 'one_way',
      autoCreateEvents: true,
      eventPrefix: '',
      reminderMinutes: 15,
      // Feature toggles - default to calendar sync enabled, meet links disabled
      enableCalendarSync: true,
      enableMeetLinks: true,
    };

    await storeIntegration(
      organizationId,
      'google_calendar',
      {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenType: 'Bearer',
        expiresAt,
        scopes: [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events',
        ],
        accountEmail,
        accountName,
        settings,
      },
      userId
    );

    console.log(`[GOOGLE_CALENDAR_CALLBACK] Successfully connected calendar for org ${organizationId} (${accountEmail})`);

    // Look up subdomain for two-step redirect
    const orgDomain = await getOrgDomain(organizationId);

    // If no subdomain found, redirect directly to origin domain (skip two-step)
    if (!orgDomain?.subdomain) {
      console.log(`[GOOGLE_CALENDAR_CALLBACK] No subdomain found for org ${organizationId}, redirecting directly to origin`);
      const successUrl = new URL('/coach', `https://${originDomain}`);
      successUrl.searchParams.set('tab', 'scheduling');
      successUrl.searchParams.set('calendar_connected', 'google');
      return NextResponse.redirect(successUrl);
    }

    // Two-step redirect: subdomain first, then custom domain
    // This ensures Clerk session is established on *.coachful.co before redirecting to custom domain
    const subdomain = orgDomain.subdomain;
    const subdomainHost = `${subdomain}.coachful.co`;

    const successUrl = new URL('/coach', `https://${subdomainHost}`);
    successUrl.searchParams.set('tab', 'scheduling');
    successUrl.searchParams.set('calendar_connected', 'google');

    // If origin is different from subdomain, include redirect param for second hop
    if (originDomain !== subdomainHost) {
      const finalUrl = new URL('/coach', `https://${originDomain}`);
      finalUrl.searchParams.set('tab', 'scheduling');
      finalUrl.searchParams.set('calendar_connected', 'google');
      successUrl.searchParams.set('redirect', finalUrl.toString());
    }

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('[GOOGLE_CALENDAR_CALLBACK] Error:', error);
    return NextResponse.redirect(new URL('/coach?tab=scheduling&error=connection_failed', errorRedirectBase));
  }
}
