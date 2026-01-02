/**
 * Slack Integration
 * 
 * Allows coaches to receive notifications of client activity
 * in their Slack workspace channels.
 */

import { type SlackSettings, type WebhookEventType } from './types';

// =============================================================================
// OAUTH CONFIGURATION
// =============================================================================

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;

const SLACK_SCOPES = [
  'chat:write',
  'channels:read',
  'users:read',
];

// =============================================================================
// OAUTH HELPERS
// =============================================================================

/**
 * Get Slack OAuth URL for authorization
 */
export function getSlackAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID || '',
    redirect_uri: redirectUri,
    scope: SLACK_SCOPES.join(','),
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeSlackCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  token_type: string;
  scope: string;
  team: { id: string; name: string };
  authed_user: { id: string };
}> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID || '',
      client_secret: SLACK_CLIENT_SECRET || '',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(`Slack error: ${data.error}`);
  }

  return data;
}

// =============================================================================
// SLACK API HELPERS
// =============================================================================

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
}

/**
 * List channels the bot has access to
 */
export async function listSlackChannels(
  accessToken: string
): Promise<SlackChannel[]> {
  const response = await fetch('https://slack.com/api/conversations.list', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to list Slack channels');
  }

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(`Slack error: ${data.error}`);
  }

  return data.channels || [];
}

/**
 * Send a message to a Slack channel
 */
export async function sendSlackMessage(
  accessToken: string,
  channelId: string,
  text: string,
  blocks?: SlackBlock[]
): Promise<{ ts: string; channel: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      text,
      blocks,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to send Slack message');
  }

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(`Slack error: ${data.error}`);
  }

  return { ts: data.ts, channel: data.channel };
}

// =============================================================================
// NOTIFICATION HELPERS
// =============================================================================

type SlackBlock = 
  | { type: 'section'; text: { type: 'mrkdwn' | 'plain_text'; text: string } }
  | { type: 'divider' }
  | { type: 'context'; elements: Array<{ type: 'mrkdwn' | 'plain_text'; text: string }> }
  | { type: 'header'; text: { type: 'plain_text'; text: string } };

interface NotificationData {
  event: WebhookEventType;
  clientName?: string;
  clientEmail?: string;
  title?: string;
  details?: string;
  timestamp?: string;
}

/**
 * Build Slack blocks for a notification
 */
function buildNotificationBlocks(data: NotificationData): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  // Event header
  const eventLabels: Record<string, string> = {
    'client.checkin.completed': '✅ Check-in Completed',
    'client.checkin.missed': '⚠️ Check-in Missed',
    'client.goal.created': '🎯 New Goal Created',
    'client.goal.achieved': '🏆 Goal Achieved!',
    'client.goal.updated': '📝 Goal Updated',
    'client.habit.completed': '✨ Habit Completed',
    'coaching.session.scheduled': '📅 Session Scheduled',
    'coaching.session.completed': '✅ Session Completed',
    'coaching.session.cancelled': '❌ Session Cancelled',
    'payment.received': '💰 Payment Received',
    'payment.failed': '⚠️ Payment Failed',
    'program.purchased': '🛒 Program Purchased',
    'squad.member.joined': '👋 New Squad Member',
  };

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: eventLabels[data.event] || data.event,
    },
  });

  // Client info
  if (data.clientName) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Client:* ${data.clientName}${data.clientEmail ? ` (${data.clientEmail})` : ''}`,
      },
    });
  }

  // Title/details
  if (data.title) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${data.title}*`,
      },
    });
  }

  if (data.details) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: data.details,
      },
    });
  }

  // Timestamp
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `📅 ${data.timestamp || new Date().toISOString()}`,
      },
    ],
  });

  return blocks;
}

/**
 * Send a notification to Slack based on event type
 */
export async function sendSlackNotification(
  accessToken: string,
  settings: SlackSettings,
  event: WebhookEventType,
  data: {
    clientName?: string;
    clientEmail?: string;
    title?: string;
    details?: string;
  }
): Promise<boolean> {
  // Check if this event type should trigger a notification
  const eventCategory = event.split('.')[1]; // e.g., 'checkin', 'goal', etc.
  
  if (eventCategory === 'checkin' && !settings.notifyCheckins) return false;
  if (eventCategory === 'goal' && !settings.notifyGoals) return false;
  if (event === 'payment.received' && !settings.notifyPayments) return false;
  if (event === 'payment.failed' && !settings.notifyPayments) return false;

  const channelId = settings.defaultChannelId;
  if (!channelId) {
    console.warn('[Slack] No default channel configured');
    return false;
  }

  const blocks = buildNotificationBlocks({
    event,
    ...data,
    timestamp: new Date().toISOString(),
  });

  const eventLabels: Record<string, string> = {
    'client.checkin.completed': `${data.clientName} completed their check-in`,
    'client.goal.achieved': `${data.clientName} achieved their goal: ${data.title}`,
    'payment.received': `Payment received from ${data.clientName}`,
  };

  const fallbackText = eventLabels[event] || `${event} - ${data.clientName || 'Unknown'}`;

  try {
    await sendSlackMessage(accessToken, channelId, fallbackText, blocks);
    return true;
  } catch (error) {
    console.error('[Slack] Failed to send notification:', error);
    return false;
  }
}

/**
 * Check if Slack integration is configured
 */
export function isSlackConfigured(): boolean {
  return !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);
}


