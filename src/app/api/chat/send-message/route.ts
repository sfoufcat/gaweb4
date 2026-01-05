import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getStreamServerClient } from '@/lib/stream-server';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { ClerkPublicMetadata } from '@/types';

/**
 * POST /api/chat/send-message
 *
 * Sends a message to an existing Stream Chat channel.
 * Used by coaches to send messages to coaching channels.
 *
 * Request body:
 *   - channelId: string - The channel ID to send to
 *   - message: string - The message text
 *
 * Response:
 *   - success: boolean
 *   - messageId?: string
 *   - error?: string
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check coach access
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { channelId, message } = body;

    // Validate request
    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'message must be 2000 characters or less' }, { status: 400 });
    }

    // Get Stream Chat client
    const streamClient = await getStreamServerClient();

    // Get the channel and verify it exists
    const channel = streamClient.channel('messaging', channelId);

    // Query the channel to verify it exists and user has access
    const channelState = await channel.query({ state: true, members: { limit: 10 } });

    if (!channelState.channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // Send the message
    const response = await channel.sendMessage({
      text: message.trim(),
      user_id: userId,
    });

    console.log(`[CHAT_SEND_MESSAGE] Sent message to channel ${channelId} by user ${userId}`);

    return NextResponse.json({
      success: true,
      messageId: response.message?.id,
    });
  } catch (error) {
    console.error('[CHAT_SEND_MESSAGE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
