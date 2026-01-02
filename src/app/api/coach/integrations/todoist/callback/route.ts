/**
 * Todoist OAuth Callback
 * 
 * GET /api/coach/integrations/todoist/callback
 * 
 * Handles the OAuth callback from Todoist and stores the integration credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeIntegration, type TodoistSettings } from '@/lib/integrations';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[TODOIST_CALLBACK] OAuth error:', error);
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
    const clientId = process.env.TODOIST_OAUTH_CLIENT_ID;
    const clientSecret = process.env.TODOIST_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[TODOIST_CALLBACK] Missing OAuth credentials');
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=server_config', req.url)
      );
    }

    const tokenResponse = await fetch('https://todoist.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[TODOIST_CALLBACK] Token exchange failed:', errorText);
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=token_exchange', req.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, token_type } = tokens;

    // Get user info from Todoist Sync API
    const syncResponse = await fetch('https://api.todoist.com/sync/v9/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `${token_type || 'Bearer'} ${access_token}`,
      },
      body: new URLSearchParams({
        sync_token: '*',
        resource_types: '["user", "projects"]',
      }),
    });

    let accountEmail = '';
    let accountName = '';
    let accountId = '';
    let defaultProjectId: string | undefined;

    if (syncResponse.ok) {
      const syncData = await syncResponse.json();
      if (syncData.user) {
        accountEmail = syncData.user.email || '';
        accountName = syncData.user.full_name || '';
        accountId = String(syncData.user.id) || '';
      }
      // Find Inbox project as default
      if (syncData.projects) {
        const inbox = syncData.projects.find(
          (p: { inbox_project?: boolean }) => p.inbox_project
        );
        if (inbox?.id) {
          defaultProjectId = String(inbox.id);
        }
      }
    }

    // Store the integration
    // Note: Todoist tokens don't expire
    const settings: TodoistSettings = {
      provider: 'todoist',
      projectId: defaultProjectId,
      syncCompleted: true,
      labelId: undefined,
    };

    await storeIntegration(
      orgId,
      'todoist',
      {
        accessToken: access_token,
        tokenType: token_type || 'Bearer',
        scopes: ['data:read_write'],
        accountId,
        accountEmail,
        accountName,
        settings,
      },
      userId
    );

    console.log(`[TODOIST_CALLBACK] Successfully connected for org ${orgId}`);

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&connected=todoist', req.url)
    );
  } catch (error) {
    console.error('[TODOIST_CALLBACK] Error:', error);
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=unknown', req.url)
    );
  }
}


