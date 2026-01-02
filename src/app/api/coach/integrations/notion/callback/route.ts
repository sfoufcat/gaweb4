/**
 * Notion OAuth Callback
 * 
 * GET /api/coach/integrations/notion/callback
 * 
 * Handles the OAuth callback from Notion and stores the integration credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeIntegration, type NotionSettings } from '@/lib/integrations';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[NOTION_CALLBACK] OAuth error:', error);
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
    const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
    const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/coach/integrations/notion/callback`;

    if (!clientId || !clientSecret) {
      console.error('[NOTION_CALLBACK] Missing OAuth credentials');
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=server_config', req.url)
      );
    }

    // Notion uses Basic Auth for token exchange
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[NOTION_CALLBACK] Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=token_exchange', req.url)
      );
    }

    const tokens = await tokenResponse.json();
    const {
      access_token,
      workspace_id,
      workspace_name,
      bot_id,
      owner,
    } = tokens;

    // Extract owner info
    const accountEmail = owner?.user?.person?.email || '';
    const accountName = owner?.user?.name || workspace_name || '';
    const accountId = bot_id || '';

    // Store the integration
    // Note: Notion tokens don't expire and there's no refresh token
    const settings: NotionSettings = {
      provider: 'notion',
      workspaceId: workspace_id,
      databaseId: undefined,
      templatePageId: undefined,
      autoExport: false,
      exportCheckins: true,
      exportSessionNotes: true,
    };

    await storeIntegration(
      orgId,
      'notion',
      {
        accessToken: access_token,
        tokenType: 'Bearer',
        scopes: [],
        accountId,
        accountEmail,
        accountName,
        settings,
      },
      userId
    );

    console.log(`[NOTION_CALLBACK] Successfully connected for org ${orgId}`);

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&connected=notion', req.url)
    );
  } catch (error) {
    console.error('[NOTION_CALLBACK] Error:', error);
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=unknown', req.url)
    );
  }
}

