/**
 * Google Sheets OAuth Callback
 * 
 * Handles the OAuth callback from Google after a coach authorizes
 * access to their Google Sheets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeGoogleSheetsCodeForTokens } from '@/lib/integrations/google-sheets';
import { saveIntegration } from '@/lib/integrations/token-manager';
import { type GoogleSheetsSettings } from '@/lib/integrations/types';

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
      console.error('[Google Sheets OAuth] Error:', error);
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

    // Verify state matches (should be verified against stored state)
    // For now, state contains orgId for validation
    if (state !== orgId) {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=invalid_state', request.url)
      );
    }

    // Get redirect URI for token exchange
    const redirectUri = new URL(
      '/api/coach/integrations/google_sheets/callback',
      request.url
    ).toString();

    // Exchange code for tokens
    const tokens = await exchangeGoogleSheetsCodeForTokens(code, redirectUri);

    // Get user info from Google
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );
    const userInfo = await userInfoResponse.json();

    // Default settings for Google Sheets
    const settings: GoogleSheetsSettings = {
      provider: 'google_sheets',
      autoExport: false,
      exportClients: true,
      exportCheckins: true,
      exportGoals: true,
      exportPayments: false,
    };

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Save integration to Firestore
    await saveIntegration(orgId, {
      provider: 'google_sheets',
      status: 'connected',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresAt,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
      accountEmail: userInfo.email,
      accountName: userInfo.name,
      syncEnabled: true,
      settings,
      connectedBy: userId,
    });

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&success=google_sheets', request.url)
    );
  } catch (error) {
    console.error('[Google Sheets OAuth] Callback error:', error);
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=oauth_failed', request.url)
    );
  }
}

