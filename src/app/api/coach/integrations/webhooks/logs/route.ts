/**
 * Webhook Logs API
 * 
 * GET /api/coach/integrations/webhooks/logs
 * 
 * Get recent webhook delivery logs for the coach's organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getWebhookLogs } from '@/lib/integrations';

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const logs = await getWebhookLogs(organizationId, limit);

    return NextResponse.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('[WEBHOOK_LOGS_GET_ERROR]', error);
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

