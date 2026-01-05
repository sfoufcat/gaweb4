/**
 * Zoom OAuth Callback
 *
 * GET /api/coach/integrations/zoom/callback
 *
 * Handles the OAuth callback from Zoom and stores the integration credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeIntegration, type ZoomSettings } from '@/lib/integrations';
import { getOrgDomain } from '@/lib/tenant/resolveTenant';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[ZOOM_CALLBACK] OAuth error:', error);
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

    // Exchange code for tokens
    const clientId = process.env.ZOOM_OAUTH_CLIENT_ID;
    const clientSecret = process.env.ZOOM_OAUTH_CLIENT_SECRET;
    // Use calendar subdomain for OAuth callbacks to avoid auth issues on subdomains
    const baseUrl = process.env.ZOOM_OAUTH_REDIRECT_BASE_URL || 'https://calendar.coachful.co';
    const redirectUri = `${baseUrl}/api/coach/integrations/zoom/callback`;

    if (!clientId || !clientSecret) {
      console.error('[ZOOM_CALLBACK] Missing OAuth credentials');
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=server_config', req.url)
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
        new URL('/coach/settings?tab=integrations&error=token_exchange', req.url)
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

    // Store the integration
    const settings: ZoomSettings = {
      provider: 'zoom',
      autoCreateMeetings: true,
      defaultDurationMinutes: 60,
      enableWaitingRoom: false,
      enableRecording: false,
    };

    await storeIntegration(
      orgId,
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

    console.log(`[ZOOM_CALLBACK] Successfully connected for org ${orgId}`);

    // Two-step redirect pattern: subdomain first, then custom domain
    // This ensures Clerk session is established on *.coachful.co before redirecting to custom domain
    const orgDomain = await getOrgDomain(orgId);

    // Default to origin domain if no subdomain found
    if (!orgDomain?.subdomain) {
      console.log(`[ZOOM_CALLBACK] No subdomain found for org ${orgId}, redirecting to origin`);
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
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=unknown', req.url)
    );
  }
}
