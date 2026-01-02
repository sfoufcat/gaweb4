/**
 * Discord Notification API
 * 
 * Sends notifications to Discord via webhook.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getIntegration, storeWebhookIntegration, updateIntegrationSettings } from '@/lib/integrations/token-manager';
import { sendDiscordNotification, validateDiscordWebhook } from '@/lib/integrations/discord';
import { type DiscordSettings, type WebhookEventType } from '@/lib/integrations/types';

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
    const { event, clientName, clientEmail, title, details, webhookUrl } = body;

    if (!event) {
      return NextResponse.json(
        { error: 'Event type is required' },
        { status: 400 }
      );
    }

    // Get the Discord integration
    const integration = await getIntegration(orgId, 'discord');
    
    if (!integration || integration.status !== 'connected') {
      return NextResponse.json(
        { error: 'Discord not connected' },
        { status: 400 }
      );
    }

    const settings = integration.settings as DiscordSettings;
    const targetWebhookUrl = webhookUrl || integration.webhookUrl;

    if (!targetWebhookUrl) {
      return NextResponse.json(
        { error: 'No webhook URL configured' },
        { status: 400 }
      );
    }

    const success = await sendDiscordNotification(
      targetWebhookUrl,
      settings,
      event as WebhookEventType,
      { clientName, clientEmail, title, details }
    );

    return NextResponse.json({ success });
  } catch (error) {
    console.error('[Discord Notify] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send Discord notification' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Configure/validate webhook URL
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { webhookUrl } = body;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
        { status: 400 }
      );
    }

    // Validate webhook URL
    const validation = await validateDiscordWebhook(webhookUrl);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid Discord webhook URL' },
        { status: 400 }
      );
    }

    // Get or create Discord integration
    let integration = await getIntegration(orgId, 'discord');
    
    // Create new integration with webhook (storeWebhookIntegration handles update too)
    const settings: DiscordSettings = {
      provider: 'discord',
      guildId: validation.guildId,
      notifyCheckins: integration?.settings ? (integration.settings as DiscordSettings).notifyCheckins : true,
      notifyGoals: integration?.settings ? (integration.settings as DiscordSettings).notifyGoals : true,
      notifyPayments: integration?.settings ? (integration.settings as DiscordSettings).notifyPayments : true,
      notifyNewClients: integration?.settings ? (integration.settings as DiscordSettings).notifyNewClients : true,
    };

    await storeWebhookIntegration(
      orgId,
      'discord' as 'zapier', // Type workaround
      webhookUrl,
      settings as unknown as import('@/lib/integrations/types').WebhookSettings,
      userId
    );

    return NextResponse.json({
      success: true,
      guildId: validation.guildId,
      channelId: validation.channelId,
      name: validation.name,
    });
  } catch (error) {
    console.error('[Discord Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Failed to configure Discord webhook' },
      { status: 500 }
    );
  }
}

