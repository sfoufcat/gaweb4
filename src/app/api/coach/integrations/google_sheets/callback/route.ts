/**
 * Google Sheets OAuth Callback
 *
 * Handles the OAuth callback from Google after a coach authorizes
 * access to their Google Sheets.
 *
 * IMPORTANT: This callback receives requests on a fixed domain (calendar.coachful.co)
 * because Google OAuth requires exact redirect URI matching. The user's original
 * org info is preserved in the state parameter and used for storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { exchangeGoogleSheetsCodeForTokens } from '@/lib/integrations/google-sheets';
import { storeIntegration } from '@/lib/integrations/token-manager';
import { type GoogleSheetsSettings } from '@/lib/integrations/types';

export async function GET(request: NextRequest) {
  // Decode state early to get originDomain for error redirects
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state');

  let stateData: { orgId: string; userId: string; provider: string; originDomain?: string; timestamp?: number } | null = null;
  let redirectBase = request.url;

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

    // Handle OAuth error
    if (error) {
      console.error('[Google Sheets OAuth] Error:', error);
      return NextResponse.redirect(
        new URL(`/coach/settings?tab=integrations&error=${error}`, redirectBase)
      );
    }

    // Validate required params
    if (!code || !state || !stateData) {
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=missing_params', redirectBase)
      );
    }

    const { originDomain, orgId: stateOrgId, userId: stateUserId } = stateData;

    // Verify the authenticated user matches the one who started the OAuth flow
    if (stateUserId !== userId) {
      console.error('[Google Sheets OAuth] User mismatch:', { stateUserId, userId });
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
      console.error('[Google Sheets OAuth] User not member of org:', { userId, stateOrgId });
      return NextResponse.redirect(
        new URL('/coach/settings?tab=integrations&error=not_org_member', redirectBase)
      );
    }

    // Use originDomain for redirect, falling back to current URL
    const finalRedirectBase = originDomain ? `https://${originDomain}` : redirectBase;

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

    // Save integration to Firestore using the ORIGINAL org from state (not callback domain's org)
    await storeIntegration(
      stateOrgId,
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

    console.log(`[Google Sheets OAuth] Successfully connected for org ${stateOrgId}, redirecting to ${finalRedirectBase}`);

    // ALWAYS redirect back to origin domain to restore correct org context
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&success=google_sheets', finalRedirectBase)
    );
  } catch (error) {
    console.error('[Google Sheets OAuth] Callback error:', error);
    // Use redirectBase (derived from state) for error redirect too
    return NextResponse.redirect(
      new URL('/coach/settings?tab=integrations&error=oauth_failed', redirectBase)
    );
  }
}

