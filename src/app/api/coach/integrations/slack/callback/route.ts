/**
 * Slack OAuth Callback
 * 
 * Handles the OAuth callback from Slack after a coach authorizes
 * access to their Slack workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeSlackCodeForTokens } from '@/lib/integrations/slack';
import { storeIntegration } from '@/lib/integrations/token-manager';
import { type SlackSettings } from '@/lib/integrations/types';

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth error
    if (error) {
      console.error('[Slack OAuth] Error:', error);
      return NextResponse.redirect(
        new URL(`/coach/settings?tab=integrations&error=${error}`, request.url)
      );
    }

    // Validate required params
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=missing_params', request.url)
      );
    }

    // Verify state matches
    if (state !== orgId) {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=invalid_state', request.url)
      );
    }

    // Get redirect URI for token exchange
    const redirectUri = new URL(
      '/api/coach/integrations/slack/callback',
      request.url
    ).toString();

    // Exchange code for tokens
    const tokens = await exchangeSlackCodeForTokens(code, redirectUri);

    // Default settings for Slack
    const settings: SlackSettings = {
      provider: 'slack',
      teamId: tokens.team.id,
      notifyCheckins: true,
      notifyGoals: true,
      notifyPayments: true,
      notifyNewClients: true,
    };

    // Save integration to Firestore
    await storeIntegration(
      orgId,
      'slack',
      {
        accessToken: tokens.access_token,
        tokenType: tokens.token_type,
        scopes: tokens.scope.split(','),
        accountId: tokens.team.id,
        accountName: tokens.team.name,
        settings,
      },
      userId
    );

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&success=slack', request.url)
    );
  } catch (error) {
    console.error('[Slack OAuth] Callback error:', error);
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=oauth_failed', request.url)
    );
  }
}

