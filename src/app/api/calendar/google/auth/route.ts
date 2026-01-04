import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';

/**
 * POST /api/calendar/google/auth
 * Initiate Google Calendar OAuth flow
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://app.coachful.co/api/calendar/google/callback';

    if (!clientId) {
      return NextResponse.json(
        { error: 'Google Calendar integration is not configured' },
        { status: 503 }
      );
    }

    const { userId, organizationId } = await requireCoachWithOrg();

    // Get origin domain for redirect back after OAuth
    const originDomain = request.headers.get('host') || 'app.coachful.co';

    // Create state parameter with user info for the callback
    const state = Buffer.from(JSON.stringify({
      userId,
      organizationId,
      originDomain,
      timestamp: Date.now(),
    })).toString('base64');

    // Google OAuth scopes for calendar
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent', // Force consent to get refresh token
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('[GOOGLE_CALENDAR_AUTH] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
