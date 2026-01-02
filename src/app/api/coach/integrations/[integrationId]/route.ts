/**
 * Single Integration API
 * 
 * GET /api/coach/integrations/[integrationId] - Get integration details
 * PATCH /api/coach/integrations/[integrationId] - Update integration settings
 * DELETE /api/coach/integrations/[integrationId] - Disconnect integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  getIntegrationById,
  updateIntegrationSettings,
  disconnectIntegration,
} from '@/lib/integrations';

interface RouteParams {
  params: Promise<{
    integrationId: string;
  }>;
}

/**
 * GET /api/coach/integrations/[integrationId]
 * 
 * Get integration details
 */
export async function GET(
  _req: NextRequest,
  context: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { integrationId } = await context.params;

    const integration = await getIntegrationById(organizationId, integrationId);

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      integration,
    });
  } catch (error) {
    console.error('[COACH_INTEGRATION_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/integrations/[integrationId]
 * 
 * Update integration settings
 * 
 * Body:
 * - settings: Partial<IntegrationSettings>
 */
export async function PATCH(
  req: NextRequest,
  context: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { integrationId } = await context.params;

    const body = await req.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 }
      );
    }

    // Verify integration exists
    const integration = await getIntegrationById(organizationId, integrationId);

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Update settings
    await updateIntegrationSettings(organizationId, integrationId, settings);

    // Get updated integration
    const updated = await getIntegrationById(organizationId, integrationId);

    return NextResponse.json({
      success: true,
      integration: updated,
    });
  } catch (error) {
    console.error('[COACH_INTEGRATION_PATCH_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/integrations/[integrationId]
 * 
 * Disconnect (delete) an integration
 */
export async function DELETE(
  _req: NextRequest,
  context: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { integrationId } = await context.params;

    // Verify integration exists
    const integration = await getIntegrationById(organizationId, integrationId);

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    await disconnectIntegration(organizationId, integrationId);

    return NextResponse.json({
      success: true,
      message: 'Integration disconnected',
    });
  } catch (error) {
    console.error('[COACH_INTEGRATION_DELETE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}


