import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getIntegration, disconnectIntegration } from '@/lib/integrations/token-manager';

/**
 * POST /api/calendar/disconnect
 * Disconnect the connected calendar integration
 *
 * Body:
 * - provider: 'google_calendar' | 'outlook_calendar' (optional - disconnects any if not specified)
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json().catch(() => ({}));
    const { provider } = body;

    // If provider specified, disconnect that one
    if (provider) {
      const integration = await getIntegration(organizationId, provider);
      if (integration) {
        await disconnectIntegration(organizationId, integration.id);
        console.log(`[CALENDAR_DISCONNECT] Disconnected ${provider} for org ${organizationId}`);
      }
      return NextResponse.json({ success: true, provider });
    }

    // Otherwise, disconnect any calendar integration
    const googleIntegration = await getIntegration(organizationId, 'google_calendar');
    if (googleIntegration) {
      await disconnectIntegration(organizationId, googleIntegration.id);
      console.log(`[CALENDAR_DISCONNECT] Disconnected google_calendar for org ${organizationId}`);
      return NextResponse.json({ success: true, provider: 'google_calendar' });
    }

    const microsoftIntegration = await getIntegration(organizationId, 'outlook_calendar');
    if (microsoftIntegration) {
      await disconnectIntegration(organizationId, microsoftIntegration.id);
      console.log(`[CALENDAR_DISCONNECT] Disconnected outlook_calendar for org ${organizationId}`);
      return NextResponse.json({ success: true, provider: 'outlook_calendar' });
    }

    return NextResponse.json({ success: true, provider: null });
  } catch (error) {
    console.error('[CALENDAR_DISCONNECT] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
