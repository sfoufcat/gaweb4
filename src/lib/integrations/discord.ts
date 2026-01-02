/**
 * Discord Integration
 * 
 * Allows coaches to send notifications to their Discord community
 * using Discord webhooks.
 */

import { type DiscordSettings, type WebhookEventType } from './types';

// =============================================================================
// OAUTH CONFIGURATION (for future OAuth bot integration)
// =============================================================================

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

// =============================================================================
// OAUTH HELPERS (for bot-based integration)
// =============================================================================

/**
 * Get Discord OAuth URL for bot authorization
 */
export function getDiscordAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'bot webhook.incoming',
    permissions: '2048', // Send Messages permission
    state,
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeDiscordCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  guild: { id: string; name: string };
  webhook?: { id: string; token: string; url: string };
}> {
  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID || '',
      client_secret: DISCORD_CLIENT_SECRET || '',
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  return response.json();
}

// =============================================================================
// WEBHOOK HELPERS
// =============================================================================

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

// Color codes for different event types
const EVENT_COLORS: Record<string, number> = {
  success: 0x22c55e, // green
  warning: 0xf59e0b, // amber
  error: 0xef4444,   // red
  info: 0x3b82f6,    // blue
  celebration: 0xa855f7, // purple
};

/**
 * Send a message via Discord webhook
 */
export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send Discord webhook: ${error}`);
  }
}

/**
 * Build Discord embed for a notification
 */
function buildNotificationEmbed(
  event: WebhookEventType,
  data: {
    clientName?: string;
    clientEmail?: string;
    title?: string;
    details?: string;
  }
): DiscordEmbed {
  const eventConfig: Record<string, { title: string; color: number; emoji: string }> = {
    'client.checkin.completed': {
      title: 'Check-in Completed',
      color: EVENT_COLORS.success,
      emoji: '✅',
    },
    'client.checkin.missed': {
      title: 'Check-in Missed',
      color: EVENT_COLORS.warning,
      emoji: '⚠️',
    },
    'client.goal.created': {
      title: 'New Goal Created',
      color: EVENT_COLORS.info,
      emoji: '🎯',
    },
    'client.goal.achieved': {
      title: 'Goal Achieved!',
      color: EVENT_COLORS.celebration,
      emoji: '🏆',
    },
    'client.goal.updated': {
      title: 'Goal Updated',
      color: EVENT_COLORS.info,
      emoji: '📝',
    },
    'client.habit.completed': {
      title: 'Habit Completed',
      color: EVENT_COLORS.success,
      emoji: '✨',
    },
    'coaching.session.scheduled': {
      title: 'Session Scheduled',
      color: EVENT_COLORS.info,
      emoji: '📅',
    },
    'coaching.session.completed': {
      title: 'Session Completed',
      color: EVENT_COLORS.success,
      emoji: '✅',
    },
    'coaching.session.cancelled': {
      title: 'Session Cancelled',
      color: EVENT_COLORS.error,
      emoji: '❌',
    },
    'payment.received': {
      title: 'Payment Received',
      color: EVENT_COLORS.success,
      emoji: '💰',
    },
    'payment.failed': {
      title: 'Payment Failed',
      color: EVENT_COLORS.error,
      emoji: '⚠️',
    },
    'program.purchased': {
      title: 'Program Purchased',
      color: EVENT_COLORS.celebration,
      emoji: '🛒',
    },
    'squad.member.joined': {
      title: 'New Squad Member',
      color: EVENT_COLORS.info,
      emoji: '👋',
    },
  };

  const config = eventConfig[event] || {
    title: event,
    color: EVENT_COLORS.info,
    emoji: '📢',
  };

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (data.clientName) {
    fields.push({
      name: 'Client',
      value: data.clientName,
      inline: true,
    });
  }

  if (data.title) {
    fields.push({
      name: 'Details',
      value: data.title,
      inline: false,
    });
  }

  if (data.details) {
    fields.push({
      name: 'Notes',
      value: data.details,
      inline: false,
    });
  }

  return {
    title: `${config.emoji} ${config.title}`,
    color: config.color,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: 'Coaching Platform' },
  };
}

/**
 * Send a notification to Discord
 */
export async function sendDiscordNotification(
  webhookUrl: string,
  settings: DiscordSettings,
  event: WebhookEventType,
  data: {
    clientName?: string;
    clientEmail?: string;
    title?: string;
    details?: string;
  }
): Promise<boolean> {
  // Check if this event type should trigger a notification
  const eventCategory = event.split('.')[1];
  
  if (eventCategory === 'checkin' && !settings.notifyCheckins) return false;
  if (eventCategory === 'goal' && !settings.notifyGoals) return false;
  if (event === 'payment.received' && !settings.notifyPayments) return false;
  if (event === 'payment.failed' && !settings.notifyPayments) return false;

  const embed = buildNotificationEmbed(event, data);

  try {
    await sendDiscordWebhook(webhookUrl, {
      username: 'Coaching Bot',
      embeds: [embed],
    });
    return true;
  } catch (error) {
    console.error('[Discord] Failed to send notification:', error);
    return false;
  }
}

/**
 * Validate a Discord webhook URL
 */
export async function validateDiscordWebhook(webhookUrl: string): Promise<{
  valid: boolean;
  guildId?: string;
  channelId?: string;
  name?: string;
}> {
  try {
    const response = await fetch(webhookUrl);
    
    if (!response.ok) {
      return { valid: false };
    }

    const data = await response.json();
    
    return {
      valid: true,
      guildId: data.guild_id,
      channelId: data.channel_id,
      name: data.name,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Check if Discord integration is configured
 */
export function isDiscordConfigured(): boolean {
  // Discord uses webhook URLs, so it's always "configured" 
  // since users provide their own webhook URLs
  return true;
}



