import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStreamServerClient } from '@/lib/stream-server';
import { requireAdmin } from '@/lib/admin-utils-clerk';
import { ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID } from '@/lib/chat-constants';

/**
 * POST /api/chat/setup-global-channels
 * Creates the global Announcements and Social Corner channels (admin only)
 * This should be run once to set up the channels
 */
export async function POST() {
  try {
    // Only admins can set up global channels
    await requireAdmin();
    
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const streamClient = await getStreamServerClient();

    // Create Announcements channel (read-only for regular users)
    const announcementsChannel = streamClient.channel('messaging', ANNOUNCEMENTS_CHANNEL_ID, {
      name: 'Announcements',
      created_by_id: userId,
      // Custom data to identify this as a special channel
      is_announcements: true,
    } as Record<string, unknown>);
    
    await announcementsChannel.create();
    
    // Disable sending messages for regular members (only channel moderators/owners can post)
    await announcementsChannel.update({
      // Disable message sending for regular members
      config_overrides: {
        typing_events: false,
        read_events: true,
        connect_events: false,
        message_retention: 'infinite',
      },
    } as Record<string, unknown>);

    // Create Social Corner channel (everyone can message)
    const socialChannel = streamClient.channel('messaging', SOCIAL_CORNER_CHANNEL_ID, {
      name: 'Social Corner',
      created_by_id: userId,
      is_social_corner: true,
    } as Record<string, unknown>);
    
    await socialChannel.create();

    return NextResponse.json({
      success: true,
      channels: {
        announcements: ANNOUNCEMENTS_CHANNEL_ID,
        socialCorner: SOCIAL_CORNER_CHANNEL_ID,
      },
    });
  } catch (error) {
    console.error('[SETUP_GLOBAL_CHANNELS_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * GET /api/chat/setup-global-channels
 * Returns the global channel IDs
 */
export async function GET() {
  return NextResponse.json({
    announcements: ANNOUNCEMENTS_CHANNEL_ID,
    socialCorner: SOCIAL_CORNER_CHANNEL_ID,
  });
}

