/**
 * Coach API: Bulk Direct Message
 * 
 * POST /api/coach/bulk-dm
 * 
 * Sends direct messages to multiple users at once.
 * Creates DM channels if they don't exist and sends the message.
 * 
 * Request body:
 *   - recipientIds: string[] - Array of user IDs to message
 *   - message: string - The message to send
 * 
 * Response:
 *   - successCount: number
 *   - failedCount: number
 *   - results: { userId: string, success: boolean, error?: string }[]
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getStreamServerClient } from '@/lib/stream-server';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { ClerkPublicMetadata } from '@/types';

interface BulkDMRequest {
  recipientIds: string[];
  message: string;
}

interface SendResult {
  userId: string;
  success: boolean;
  channelId?: string;
  error?: string;
}

const MAX_RECIPIENTS = 100; // Safety limit

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
    const body: BulkDMRequest = await request.json();
    const { recipientIds, message } = body;

    // Validate request
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json({ error: 'recipientIds is required and must be a non-empty array' }, { status: 400 });
    }

    if (recipientIds.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Maximum ${MAX_RECIPIENTS} recipients allowed` }, { status: 400 });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'message must be 2000 characters or less' }, { status: 400 });
    }

    // Filter out self from recipients
    const validRecipientIds = recipientIds.filter(id => id !== userId);

    if (validRecipientIds.length === 0) {
      return NextResponse.json({ error: 'No valid recipients' }, { status: 400 });
    }

    // Get Stream Chat client
    const streamClient = await getStreamServerClient();
    const clerk = await clerkClient();

    // Get current user info for Stream
    const currentUser = await clerk.users.getUser(userId);
    const currentUserName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Coach';

    // Ensure current user exists in Stream
    await streamClient.upsertUsers([{
      id: userId,
      name: currentUserName,
      image: currentUser.imageUrl,
    }]);

    // Fetch recipient info from Clerk in batches
    const recipientUserMap = new Map<string, { name: string; image?: string }>();
    
    // Fetch users in batches of 100
    const batchSize = 100;
    for (let i = 0; i < validRecipientIds.length; i += batchSize) {
      const batch = validRecipientIds.slice(i, i + batchSize);
      const users = await clerk.users.getUserList({
        userId: batch,
        limit: batchSize,
      });
      
      for (const user of users.data) {
        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
        recipientUserMap.set(user.id, {
          name,
          image: user.imageUrl,
        });
      }
    }

    // Send messages to each recipient
    const results: SendResult[] = [];
    const trimmedMessage = message.trim();

    for (const recipientId of validRecipientIds) {
      try {
        const recipientInfo = recipientUserMap.get(recipientId);
        
        if (!recipientInfo) {
          results.push({
            userId: recipientId,
            success: false,
            error: 'User not found',
          });
          continue;
        }

        // Ensure recipient exists in Stream
        await streamClient.upsertUsers([{
          id: recipientId,
          name: recipientInfo.name,
          image: recipientInfo.image,
        }]);

        // Create deterministic channel ID
        const memberIds = [userId, recipientId].sort();
        const shortId1 = memberIds[0].slice(-16);
        const shortId2 = memberIds[1].slice(-16);
        const channelId = `dm-${shortId1}-${shortId2}`;

        // Create or get channel
        const channel = streamClient.channel('messaging', channelId, {
          members: memberIds,
          created_by_id: userId,
          isDirectMessage: true,
        } as Record<string, unknown>);

        await channel.create();

        // Send message
        await channel.sendMessage({
          text: trimmedMessage,
          user_id: userId,
        });

        results.push({
          userId: recipientId,
          success: true,
          channelId,
        });
      } catch (err) {
        console.error(`[BULK_DM] Error sending to ${recipientId}:`, err);
        results.push({
          userId: recipientId,
          success: false,
          error: err instanceof Error ? err.message : 'Failed to send',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`[BULK_DM] Sent ${successCount}/${validRecipientIds.length} messages`);

    return NextResponse.json({
      successCount,
      failedCount,
      results,
    });
  } catch (error) {
    console.error('[BULK_DM] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send messages' },
      { status: 500 }
    );
  }
}

