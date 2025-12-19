import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { StreamChat } from 'stream-chat';

/**
 * POST /api/stream/channel
 * Create or get a channel for the user
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId, channelName, members } = await req.json();

    // Initialize Stream Chat server-side client
    const apiKey = process.env.NEXT_PUBLIC_STREAM_KEY;
    const apiSecret = process.env.STREAM_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Stream API credentials not found');
      return NextResponse.json(
        { error: 'Stream configuration error' },
        { status: 500 }
      );
    }

    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    // Create or get channel
    const channel = serverClient.channel('messaging', channelId || `user-${userId}`, {
      created_by_id: userId,
      members: members || [userId],
    } as Record<string, unknown>);

    await channel.create();

    return NextResponse.json({
      channelId: channel.id,
      channelType: channel.type,
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json(
      { error: 'Failed to create channel' },
      { status: 500 }
    );
  }
}

