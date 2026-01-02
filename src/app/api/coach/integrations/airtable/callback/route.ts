/**
 * Airtable OAuth Callback
 * 
 * Handles the OAuth callback from Airtable after a coach authorizes
 * access to their Airtable workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeAirtableCodeForTokens } from '@/lib/integrations/airtable';
import { storeIntegration } from '@/lib/integrations/token-manager';
import { type AirtableSettings } from '@/lib/integrations/types';

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
      console.error('[Airtable OAuth] Error:', error);
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
      '/api/coach/integrations/airtable/callback',
      request.url
    ).toString();

    // Exchange code for tokens
    const tokens = await exchangeAirtableCodeForTokens(code, redirectUri);

    // Default settings for Airtable
    const settings: AirtableSettings = {
      provider: 'airtable',
      autoExport: false,
    };

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Save integration to Firestore
    await storeIntegration(
      orgId,
      'airtable',
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenType: tokens.token_type,
        expiresAt: new Date(expiresAt),
        scopes: tokens.scope.split(' '),
        settings,
      },
      userId
    );

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&success=airtable', request.url)
    );
  } catch (error) {
    console.error('[Airtable OAuth] Callback error:', error);
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=oauth_failed', request.url)
    );
  }
}

