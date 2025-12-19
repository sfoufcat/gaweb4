import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStreamServerClient } from '@/lib/stream-server';
import { getCurrentUserOrganizationId } from '@/lib/clerk-organizations';
import { getOrgChannels } from '@/lib/org-channels';
import { ANNOUNCEMENTS_CHANNEL_ID, SOCIAL_CORNER_CHANNEL_ID, SHARE_WINS_CHANNEL_ID } from '@/lib/chat-constants';

/**
 * POST /api/chat/join-global-channels
 * 
 * Adds the current user to their chat channels.
 * 
 * If user belongs to an organization:
 *   - Joins org-specific channels (Announcements, Social Corner, Share Wins, custom)
 * 
 * If user has no organization:
 *   - Joins global channels (backward compatibility)
 * 
 * Called when a user opens the chat page.
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

    // Check if user belongs to an organization
    const organizationId = await getCurrentUserOrganizationId();
    
    if (organizationId) {
      // User belongs to an org - join org-specific channels
      console.log(`[JOIN_CHANNELS] User ${userId} belongs to org ${organizationId}, joining org channels`);
      
      const orgChannels = await getOrgChannels(organizationId);
      
      if (orgChannels.length > 0) {
        for (const channel of orgChannels) {
          try {
            const streamChannel = streamClient.channel('messaging', channel.streamChannelId, {
              name: channel.title,
              created_by_id: userId,
              organizationId,
              channelType: channel.type,
              isOrgChannel: true,
            } as Record<string, unknown>);
            
            // Ensure channel exists and join
            await streamChannel.watch();
            await streamChannel.addMembers([userId]);
            
            console.log(`[JOIN_CHANNELS] User ${userId} joined org channel: ${channel.streamChannelId}`);
          } catch (channelError) {
            console.log(`[JOIN_CHANNELS] Error joining org channel ${channel.streamChannelId}:`, channelError);
            // Continue with other channels
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          type: 'org',
          organizationId,
          channelsJoined: orgChannels.length,
        });
      } else {
        // Org has no channels set up - fall through to global channels
        console.log(`[JOIN_CHANNELS] Org ${organizationId} has no channels, falling back to global`);
      }
    }
    
    // No org or org has no channels - join global channels (backward compatibility)
    console.log(`[JOIN_CHANNELS] User ${userId} joining global channels`);

    // Try to add user to Announcements channel
    try {
      const announcementsChannel = streamClient.channel('messaging', ANNOUNCEMENTS_CHANNEL_ID);
      await announcementsChannel.addMembers([userId]);
    } catch (_error) {
      // Channel might not exist yet - that's okay
      console.log('Announcements channel not found or user already member');
    }

    // Try to add user to Social Corner channel
    try {
      const socialChannel = streamClient.channel('messaging', SOCIAL_CORNER_CHANNEL_ID);
      await socialChannel.addMembers([userId]);
    } catch (_error) {
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

    return NextResponse.json({ success: true, type: 'global' });
  } catch (error) {
    console.error('[JOIN_GLOBAL_CHANNELS_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

