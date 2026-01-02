/**
 * Asana OAuth Callback
 * 
 * GET /api/coach/integrations/asana/callback
 * 
 * Handles the OAuth callback from Asana and stores the integration credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeIntegration, type AsanaSettings } from '@/lib/integrations';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[ASANA_CALLBACK] OAuth error:', error);
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
    const clientId = process.env.ASANA_OAUTH_CLIENT_ID;
    const clientSecret = process.env.ASANA_OAUTH_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/coach/integrations/asana/callback`;

    if (!clientId || !clientSecret) {
      console.error('[ASANA_CALLBACK] Missing OAuth credentials');
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=server_config', req.url)
      );
    }

    const tokenResponse = await fetch('https://app.asana.com/-/oauth_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[ASANA_CALLBACK] Token exchange failed:', errorText);
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=token_exchange', req.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, token_type, data } = tokens;

    // Extract user info from token response
    let accountEmail = '';
    let accountName = '';
    let accountId = '';
    let workspaceId = '';

    if (data) {
      accountEmail = data.email || '';
      accountName = data.name || '';
      accountId = data.gid || data.id || '';
    }

    // Get user's workspaces
    const workspacesResponse = await fetch('https://app.asana.com/api/1.0/workspaces', {
      headers: {
        Authorization: `${token_type || 'Bearer'} ${access_token}`,
      },
    });

    if (workspacesResponse.ok) {
      const workspacesData = await workspacesResponse.json();
      if (workspacesData.data && workspacesData.data.length > 0) {
        // Use the first workspace as default
        workspaceId = workspacesData.data[0].gid;
      }
    }

    // Calculate token expiry
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;

    // Store the integration
    const settings: AsanaSettings = {
      provider: 'asana',
      workspaceId,
      projectId: undefined,
      syncCompleted: true,
      sectionId: undefined,
    };

    await storeIntegration(
      orgId,
      'asana',
      {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenType: token_type || 'Bearer',
        expiresAt,
        scopes: [],
        accountId,
        accountEmail,
        accountName,
        settings,
      },
      userId
    );

    console.log(`[ASANA_CALLBACK] Successfully connected for org ${orgId}`);

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&connected=asana', req.url)
    );
  } catch (error) {
    console.error('[ASANA_CALLBACK] Error:', error);
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=unknown', req.url)
    );
  }
}


