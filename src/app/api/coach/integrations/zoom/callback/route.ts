/**
 * Zoom OAuth Callback
 *
 * GET /api/coach/integrations/zoom/callback
 *
 * Handles the OAuth callback from Zoom and stores the integration credentials.
 *
 * IMPORTANT: This callback receives requests on a fixed domain (calendar.coachful.co)
 * because Zoom OAuth requires exact redirect URI matching. The user's original
 * org info is preserved in the state parameter and used for storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { storeIntegration, type ZoomSettings } from '@/lib/integrations';
import { getOrgDomain } from '@/lib/tenant/resolveTenant';

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
      console.error('[ZOOM_CALLBACK] OAuth error:', error);
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
      console.error('[ZOOM_CALLBACK] User mismatch:', { stateUserId, userId });
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
      console.error('[ZOOM_CALLBACK] User not member of org:', { userId, stateOrgId });
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=not_org_member', redirectBase)
      );
    }

    // Exchange code for tokens
    const clientId = process.env.ZOOM_OAUTH_CLIENT_ID;
    const clientSecret = process.env.ZOOM_OAUTH_CLIENT_SECRET;
    // Use calendar subdomain for OAuth callbacks to avoid auth issues on subdomains
    const baseUrl = process.env.ZOOM_OAUTH_REDIRECT_BASE_URL || 'https://calendar.coachful.co';
    const redirectUri = `${baseUrl}/api/coach/integrations/zoom/callback`;

    if (!clientId || !clientSecret) {
      console.error('[ZOOM_CALLBACK] Missing OAuth credentials');
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=server_config', redirectBase)
      );
    }

    // Zoom uses Basic auth for token exchange
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[ZOOM_CALLBACK] Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=token_exchange', redirectBase)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, token_type } = tokens;

    // Get user info from Zoom
    const userInfoResponse = await fetch('https://api.zoom.us/v2/users/me', {
      headers: {
        Authorization: `${token_type} ${access_token}`,
      },
    });

    let accountEmail = '';
    let accountName = '';
    let accountId = '';

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      accountEmail = userInfo.email || '';
      accountName = `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim();
      accountId = userInfo.id || '';
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Store the integration using the ORIGINAL org from state (not callback domain's org)
    const settings: ZoomSettings = {
      provider: 'zoom',
      autoCreateMeetings: true,
      defaultDurationMinutes: 60,
      enableWaitingRoom: false,
      enableRecording: false,
    };

    await storeIntegration(
      stateOrgId,
      'zoom',
      {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenType: token_type,
        expiresAt,
        scopes: ['meeting:write:admin', 'meeting:read:admin', 'user:read'],
        accountId,
        accountEmail,
        accountName,
        settings,
      },
      userId
    );

    console.log(`[ZOOM_CALLBACK] Successfully connected for org ${stateOrgId}`);

    // Two-step redirect pattern: subdomain first, then custom domain
    // This ensures Clerk session is established on *.coachful.co before redirecting to custom domain
    const orgDomain = await getOrgDomain(stateOrgId);

    // Default to origin domain if no subdomain found
    if (!orgDomain?.subdomain) {
      console.log(`[ZOOM_CALLBACK] No subdomain found for org ${stateOrgId}, redirecting to origin`);
      const redirectDomain = originDomain || 'app.coachful.co';
      const successUrl = new URL('/coach', `https://${redirectDomain}`);
      successUrl.searchParams.set('tab', 'scheduling');
      successUrl.searchParams.set('integration_connected', 'zoom');
      return NextResponse.redirect(successUrl);
    }

    const subdomain = orgDomain.subdomain;
    const subdomainHost = `${subdomain}.coachful.co`;

    const successUrl = new URL('/coach', `https://${subdomainHost}`);
    successUrl.searchParams.set('tab', 'scheduling');
    successUrl.searchParams.set('integration_connected', 'zoom');

    // If origin is different from subdomain, include redirect param for second hop
    if (originDomain && originDomain !== subdomainHost) {
      const finalUrl = new URL('/coach', `https://${originDomain}`);
      finalUrl.searchParams.set('tab', 'scheduling');
      finalUrl.searchParams.set('integration_connected', 'zoom');
      successUrl.searchParams.set('redirect', finalUrl.toString());
    }

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('[ZOOM_CALLBACK] Error:', error);
    // Use redirectBase (derived from state) for error redirect too
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=unknown', redirectBase)
    );
  }
}
