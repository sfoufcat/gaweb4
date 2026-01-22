/**
 * Google Calendar OAuth Callback
 *
 * GET /api/coach/integrations/google_calendar/callback
 *
 * Handles the OAuth callback from Google and stores the integration credentials.
 *
 * IMPORTANT: This callback receives requests on a fixed domain (calendar.coachful.co)
 * because Google OAuth requires exact redirect URI matching. The user's original
 * org info is preserved in the state parameter and used for storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { storeIntegration, type GoogleCalendarSettings } from '@/lib/integrations';

export async function GET(req: NextRequest) {
  // Decode state early to get originDomain for error redirects
  const searchParams = req.nextUrl.searchParams;
  const state = searchParams.get('state');

  let stateData: { orgId: string; userId: string; provider: string; originDomain?: string; timestamp?: number } | null = null;
  let redirectBase = req.url;

  if (state) {
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      if (stateData?.originDomain) {
        redirectBase = `https://${stateData.originDomain}`;
      }
    } catch {
      // Will handle below
    }
  }

  try {
    const { userId } = await auth();

    // Only require user authentication, not org context
    // The org context comes from the state parameter (original domain)
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', redirectBase));
    }

    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[GOOGLE_CALENDAR_CALLBACK] OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/coach/settings?tab=integrations&error=${encodeURIComponent(error)}&provider=google_calendar`, redirectBase)
      );
    }

    if (!code || !state || !stateData) {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=missing_params&provider=google_calendar', redirectBase)
      );
    }

    const { orgId: stateOrgId, userId: stateUserId, originDomain } = stateData;

    // Verify the authenticated user matches the one who started the OAuth flow
    if (stateUserId !== userId) {
      console.error('[GOOGLE_CALENDAR_CALLBACK] User mismatch:', { stateUserId, userId });
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=user_mismatch&provider=google_calendar', redirectBase)
      );
    }

    // Verify the user is a member of the organization from state
    // This is the security check - we trust stateOrgId but verify membership
    const client = await clerkClient();
    const memberships = await client.users.getOrganizationMembershipList({ userId });
    const isMember = memberships.data.some(m => m.organization.id === stateOrgId);

    if (!isMember) {
      console.error('[GOOGLE_CALENDAR_CALLBACK] User not member of org:', { userId, stateOrgId });
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=not_org_member&provider=google_calendar', redirectBase)
      );
    }

    // Use originDomain for redirect, falling back to current URL
    const finalRedirectBase = originDomain ? `https://${originDomain}` : redirectBase;

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    // Use calendar subdomain for OAuth callbacks to avoid auth issues on subdomains
    const baseUrl = process.env.GOOGLE_OAUTH_REDIRECT_BASE_URL || 'https://calendar.coachful.co';
    const redirectUri = `${baseUrl}/api/coach/integrations/google_calendar/callback`;

    if (!clientId || !clientSecret) {
      console.error('[GOOGLE_CALENDAR_CALLBACK] Missing OAuth credentials');
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=server_config&provider=google_calendar', redirectBase)
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
        new URL('/coach/settings?tab=integrations&error=token_exchange&provider=google_calendar', redirectBase)
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

    // Store the integration using the ORIGINAL org from state (not callback domain's org)
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
      stateOrgId,
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

    console.log(`[GOOGLE_CALENDAR_CALLBACK] Successfully connected for org ${stateOrgId}, redirecting to ${finalRedirectBase}`);

    // ALWAYS redirect back to origin domain to restore correct org context
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&connected=google_calendar', finalRedirectBase)
    );
  } catch (error) {
    console.error('[GOOGLE_CALENDAR_CALLBACK] Error:', error);
    // Use redirectBase (derived from state) for error redirect too
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=unknown&provider=google_calendar', redirectBase)
    );
  }
}
