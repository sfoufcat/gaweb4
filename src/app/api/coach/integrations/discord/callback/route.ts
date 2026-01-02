/**
 * Discord OAuth Callback
 * 
 * Handles the OAuth callback from Discord after a coach authorizes
 * the bot in their server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeDiscordCodeForTokens } from '@/lib/integrations/discord';
import { saveIntegration } from '@/lib/integrations/token-manager';
import { type DiscordSettings } from '@/lib/integrations/types';

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
      console.error('[Discord OAuth] Error:', error);
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
      '/api/coach/integrations/discord/callback',
      request.url
    ).toString();

    // Exchange code for tokens
    const tokens = await exchangeDiscordCodeForTokens(code, redirectUri);

    // Default settings for Discord
    const settings: DiscordSettings = {
      provider: 'discord',
      guildId: tokens.guild?.id,
      notifyCheckins: true,
      notifyGoals: true,
      notifyPayments: true,
      notifyNewClients: true,
    };

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Save integration to Firestore
    await saveIntegration(orgId, {
      provider: 'discord',
      status: 'connected',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresAt,
      scopes: tokens.scope.split(' '),
      accountId: tokens.guild?.id,
      accountName: tokens.guild?.name,
      webhookUrl: tokens.webhook?.url,
      webhookSecret: tokens.webhook?.token,
      syncEnabled: true,
      settings,
      connectedBy: userId,
    });

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&success=discord', request.url)
    );
  } catch (error) {
    console.error('[Discord OAuth] Callback error:', error);
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=oauth_failed', request.url)
    );
  }
}

