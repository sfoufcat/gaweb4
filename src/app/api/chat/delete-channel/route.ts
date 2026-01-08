import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStreamServerClient } from '@/lib/stream-server';

/**
 * DELETE /api/chat/delete-channel
 *
 * Permanently deletes a DM channel. This uses the server-side admin client
 * which has permission to delete channels (client-side delete requires admin role).
 *
 * Only DM channels can be deleted, and the user must be a member of the channel.
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { channelId } = body;

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId is required' },
        { status: 400 }
      );
    }

    // Only allow deleting DM channels (those starting with 'dm-')
    if (!channelId.startsWith('dm-')) {
      return NextResponse.json(
        { error: 'Only DM channels can be deleted' },
        { status: 403 }
      );
    }

    const streamClient = await getStreamServerClient();

    // Get the channel to verify user is a member
    const channel = streamClient.channel('messaging', channelId);

    try {
      const response = await channel.query({});
      const members = response.members || [];
      const isMember = members.some((m) => m.user_id === userId);

      if (!isMember) {
        return NextResponse.json(
          { error: 'You are not a member of this channel' },
          { status: 403 }
        );
      }
    } catch (queryError) {
      console.error('[DELETE_CHANNEL] Failed to query channel:', queryError);
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Delete the channel using admin client
    await channel.delete();
    console.log(`[DELETE_CHANNEL] Channel ${channelId} deleted by ${userId}`);

    return NextResponse.json({ success: true, channelId });

  } catch (error) {
    console.error('[DELETE_CHANNEL_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
