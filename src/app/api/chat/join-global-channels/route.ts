import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStreamServerClient } from '@/lib/stream-server';
import { ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID, SHARE_WINS_CHANNEL_ID } from '@/lib/chat-constants';

/**
 * POST /api/chat/join-global-channels
 * Adds the current user to the global Announcements, Social Corner, and Share Wins channels
 * Called when a user opens the chat page
 */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const streamClient = await getStreamServerClient();
    const clerk = await clerkClient();
    
    // Get user info from Clerk
    const clerkUser = await clerk.users.getUser(userId);
    
    // Upsert user in Stream Chat
    await streamClient.upsertUser({
      id: userId,
      name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
      image: clerkUser.imageUrl,
    });

    // Try to add user to Announcements channel
    try {
      const announcementsChannel = streamClient.channel('messaging', ANNOUNCEMENTS_CHANNEL_ID);
      await announcementsChannel.addMembers([userId]);
    } catch (error) {
      // Channel might not exist yet - that's okay
      console.log('Announcements channel not found or user already member');
    }

    // Try to add user to Social Corner channel
    try {
      const socialChannel = streamClient.channel('messaging', SOCIAL_CORNER_CHANNEL_ID);
      await socialChannel.addMembers([userId]);
    } catch (error) {
      // Channel might not exist yet - that's okay
      console.log('Social Corner channel not found or user already member');
    }

    // Try to add user to Share Wins channel
    try {
      const shareWinsChannel = streamClient.channel('messaging', SHARE_WINS_CHANNEL_ID, {
        name: 'Share your wins',
        created_by_id: userId,
      } as Record<string, unknown>);
      // Ensure channel exists (create if not)
      await shareWinsChannel.create();
      await shareWinsChannel.addMembers([userId]);
    } catch (error) {
      console.log('Share Wins channel issue:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[JOIN_GLOBAL_CHANNELS_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

