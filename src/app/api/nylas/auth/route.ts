import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getAuthUrl, isNylasConfigured } from '@/lib/nylas';

/**
 * POST /api/nylas/auth
 * Initiate the Nylas OAuth flow for connecting a calendar
 */
export async function POST(request: NextRequest) {
  try {
    if (!isNylasConfigured) {
      return NextResponse.json(
        { error: 'Calendar integration is not configured' },
        { status: 503 }
      );
    }

    const { userId, organizationId } = await requireCoachWithOrg();
    const body = await request.json();
    const { loginHint } = body;

    // Create state parameter with user info for the callback
    const state = Buffer.from(JSON.stringify({
      userId,
      organizationId,
      timestamp: Date.now(),
    })).toString('base64');

    const authUrl = getAuthUrl(state, loginHint);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('[NYLAS_AUTH] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

