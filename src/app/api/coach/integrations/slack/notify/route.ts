/**
 * Slack Notification API
 * 
 * Sends notifications to the connected Slack workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getIntegration } from '@/lib/integrations/token-manager';
import { sendSlackNotification, listSlackChannels } from '@/lib/integrations/slack';
import { type SlackSettings, type WebhookEventType } from '@/lib/integrations/types';

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { event, clientName, clientEmail, title, details } = body;

    if (!event) {
      return NextResponse.json(
        { error: 'Event type is required' },
        { status: 400 }
      );
    }

    // Get the Slack integration
    const integration = await getIntegration(orgId, 'slack');
    
    if (!integration || integration.status !== 'connected') {
      return NextResponse.json(
        { error: 'Slack not connected' },
        { status: 400 }
      );
    }

    const settings = integration.settings as SlackSettings;
    
    const success = await sendSlackNotification(
      integration.accessToken,
      settings,
      event as WebhookEventType,
      { clientName, clientEmail, title, details }
    );

    return NextResponse.json({ success });
  } catch (error) {
    console.error('[Slack Notify] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send Slack notification' },
      { status: 500 }
    );
  }
}

/**
 * GET - List available channels for configuration
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the Slack integration
    const integration = await getIntegration(orgId, 'slack');
    
    if (!integration || integration.status !== 'connected') {
      return NextResponse.json(
        { error: 'Slack not connected' },
        { status: 400 }
      );
    }

    const channels = await listSlackChannels(integration.accessToken);
    
    return NextResponse.json({
      channels: channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        isPrivate: ch.is_private,
      })),
    });
  } catch (error) {
    console.error('[Slack Channels] Error:', error);
    return NextResponse.json(
      { error: 'Failed to list Slack channels' },
      { status: 500 }
    );
  }
}

