/**
 * Google Sheets OAuth Callback
 * 
 * Handles the OAuth callback from Google after a coach authorizes
 * access to their Google Sheets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeGoogleSheetsCodeForTokens } from '@/lib/integrations/google-sheets';
import { storeIntegration } from '@/lib/integrations/token-manager';
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

    // Decode state to get orgId, userId, and originDomain
    let stateData: { orgId: string; userId: string; provider: string; originDomain?: string; timestamp?: number };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=invalid_state', request.url)
      );
    }

    const { originDomain } = stateData;

    // Verify state orgId matches authenticated user's orgId
    if (stateData.orgId !== orgId) {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=invalid_state', request.url)
      );
    }

    // Determine redirect base URL - use originDomain if available
    const redirectBase = originDomain ? `https://${originDomain}` : request.url;

    // Get redirect URI for token exchange - must match authorization URL
    const baseUrl = process.env.GOOGLE_OAUTH_REDIRECT_BASE_URL || 'https://calendar.coachful.co';
    const redirectUri = `${baseUrl}/api/coach/integrations/google_sheets/callback`;

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
    await storeIntegration(
      orgId,
      'google_sheets',
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenType: tokens.token_type,
        expiresAt: new Date(expiresAt),
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
        accountEmail: userInfo.email,
        accountName: userInfo.name,
        settings,
      },
      userId
    );

    console.log(`[Google Sheets OAuth] Successfully connected for org ${orgId}, redirecting to ${redirectBase}`);

    // Redirect back to settings with success (use originDomain to go back to user's org)
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&success=google_sheets', redirectBase)
    );
  } catch (error) {
    console.error('[Google Sheets OAuth] Callback error:', error);
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=oauth_failed', request.url)
    );
  }
}

