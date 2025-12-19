import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStreamServerClient } from '@/lib/stream-server';

/**
 * POST /api/chat/dm
 * 
 * Creates or finds an existing 1:1 DM channel between the current user
 * and another user. Returns the channel ID for navigation.
 */
export async function POST(request: Request) {
  try {
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { otherUserId } = body;

    if (!otherUserId) {
      return NextResponse.json(
        { error: 'otherUserId is required' },
        { status: 400 }
      );
    }

    if (otherUserId === currentUserId) {
      return NextResponse.json(
        { error: 'Cannot create DM with yourself' },
        { status: 400 }
      );
    }

    // Get Stream Chat server client
    const streamClient = await getStreamServerClient();

    // Fetch user info from Clerk to create proper Stream users
    const clerk = await clerkClient();
    const [currentClerkUser, otherClerkUser] = await Promise.all([
      clerk.users.getUser(currentUserId),
      clerk.users.getUser(otherUserId),
    ]);

    // Upsert both users in Stream Chat (create if they don't exist)
    await streamClient.upsertUsers([
      {
        id: currentUserId,
        name: `${currentClerkUser.firstName || ''} ${currentClerkUser.lastName || ''}`.trim() || 'User',
        image: currentClerkUser.imageUrl,
      },
      {
        id: otherUserId,
        name: `${otherClerkUser.firstName || ''} ${otherClerkUser.lastName || ''}`.trim() || 'User',
        image: otherClerkUser.imageUrl,
      },
    ]);

    // Create a unique channel ID for this DM pair (sorted to ensure consistency)
    // Stream Chat has a 64-char limit on channel IDs, so we use shortened IDs
    const memberIds = [currentUserId, otherUserId].sort();
    
    // Create shorter IDs by taking last 16 chars of each user ID (unique enough)
    const shortId1 = memberIds[0].slice(-16);
    const shortId2 = memberIds[1].slice(-16);
    const channelId = `dm-${shortId1}-${shortId2}`; // ~36 chars, well under 64 limit

    // Create or get the channel
    // Using "messaging" type for DMs
    const channel = streamClient.channel('messaging', channelId, {
      members: memberIds,
      created_by_id: currentUserId,
      // Flag to identify this as a direct message channel (enables calling)
      isDirectMessage: true,
    } as Record<string, unknown>);

    // This will create the channel if it doesn't exist, or return existing one
    await channel.create();

    return NextResponse.json({
      channelId: channel.id,
      channelType: channel.type,
      cid: channel.cid,
    });

  } catch (error) {
    console.error('[CHAT_DM_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

