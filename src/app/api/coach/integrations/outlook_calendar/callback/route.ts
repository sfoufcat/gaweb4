/**
 * Outlook Calendar OAuth Callback
 *
 * GET /api/coach/integrations/outlook_calendar/callback
 *
 * Handles the OAuth callback from Microsoft and stores the integration credentials.
 *
 * IMPORTANT: This callback receives requests on a fixed domain (calendar.coachful.co)
 * because Microsoft OAuth requires exact redirect URI matching. The user's original
 * org info is preserved in the state parameter and used for storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { storeIntegration, type OutlookCalendarSettings } from '@/lib/integrations';

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
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('[OUTLOOK_CALENDAR_CALLBACK] OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/coach/settings?tab=integrations&error=${encodeURIComponent(error)}`, redirectBase)
      );
    }

    if (!code || !state || !stateData) {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=missing_params', redirectBase)
      );
    }

    const { orgId: stateOrgId, userId: stateUserId, originDomain } = stateData;

    // Verify the authenticated user matches the one who started the OAuth flow
    if (stateUserId !== userId) {
      console.error('[OUTLOOK_CALENDAR_CALLBACK] User mismatch:', { stateUserId, userId });
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=user_mismatch', redirectBase)
      );
    }

    // Verify the user is a member of the organization from state
    // This is the security check - we trust stateOrgId but verify membership
    const client = await clerkClient();
    const memberships = await client.users.getOrganizationMembershipList({ userId });
    const isMember = memberships.data.some(m => m.organization.id === stateOrgId);

    if (!isMember) {
      console.error('[OUTLOOK_CALENDAR_CALLBACK] User not member of org:', { userId, stateOrgId });
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=not_org_member', redirectBase)
      );
    }

    // Use originDomain for redirect, falling back to current URL
    const finalRedirectBase = originDomain ? `https://${originDomain}` : redirectBase;

    // Exchange code for tokens - support multiple env var naming conventions
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID
      || process.env.MS_OAUTH_CLIENT_ID
      || process.env.AZURE_AD_CLIENT_ID
      || process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET
      || process.env.MS_OAUTH_CLIENT_SECRET
      || process.env.AZURE_AD_CLIENT_SECRET
      || process.env.MICROSOFT_CLIENT_SECRET;
    // Use fixed redirect domain (must match auth initiation)
    const baseUrl = process.env.MICROSOFT_OAUTH_REDIRECT_BASE_URL || 'https://calendar.coachful.co';
    const redirectUri = `${baseUrl}/api/coach/integrations/outlook_calendar/callback`;

    if (!clientId || !clientSecret) {
      console.error('[OUTLOOK_CALENDAR_CALLBACK] Missing OAuth credentials. Checked: MICROSOFT_OAUTH_CLIENT_ID, MS_OAUTH_CLIENT_ID, AZURE_AD_CLIENT_ID, MICROSOFT_CLIENT_ID');
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=server_config', redirectBase)
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
        new URL('/coach/settings?tab=integrations&error=token_exchange', redirectBase)
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

    // Store the integration using the ORIGINAL org from state (not callback domain's org)
    const settings: OutlookCalendarSettings = {
      provider: 'outlook_calendar',
      calendarId,
      syncDirection: 'one_way',
      autoCreateEvents: true,
      eventPrefix: '',
      reminderMinutes: 30,
    };

    await storeIntegration(
      stateOrgId,
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

    console.log(`[OUTLOOK_CALENDAR_CALLBACK] Successfully connected for org ${stateOrgId}, redirecting to ${finalRedirectBase}`);

    // ALWAYS redirect back to origin domain to restore correct org context
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&connected=outlook_calendar', finalRedirectBase)
    );
  } catch (error) {
    console.error('[OUTLOOK_CALENDAR_CALLBACK] Error:', error);
    // Use redirectBase (derived from state) for error redirect too
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=unknown', redirectBase)
    );
  }
}
