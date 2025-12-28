import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getStreamServerClient } from '@/lib/stream-server';
import { setupDefaultOrgChannels, getOrgChannels } from '@/lib/org-channels';

/**
 * POST /api/coach/org-channels/setup-defaults
 * 
 * Setup default channels (Announcements, Social Corner, Share Wins) for an organization.
 * This is called automatically when a coach's organization is created.
 * 
 * Idempotent - if channels already exist, returns existing channels.
 */
export async function POST() {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();

    console.log(`[SETUP_ORG_CHANNELS] Setting up default channels for org ${organizationId}`);

    // Setup default channels in Firestore
    const channels = await setupDefaultOrgChannels(organizationId);

    // Create Stream Chat channels for each
    const streamClient = await getStreamServerClient();
    
    for (const channel of channels) {
      try {
        const streamChannel = streamClient.channel('messaging', channel.streamChannelId, {
          name: channel.title,
          created_by_id: userId,
          // Custom data for our app
          organizationId,
          channelType: channel.type,
          isOrgChannel: true,
          subtitle: channel.subtitle,
        } as Record<string, unknown>);

        await streamChannel.create();

        // Add coach as member and moderator
        await streamChannel.addMembers([userId]);
        
        // Make coach a moderator for announcement channels
        if (!channel.allowMemberMessages) {
          await streamChannel.addModerators([userId]);
        }

        console.log(`[SETUP_ORG_CHANNELS] Created Stream channel: ${channel.streamChannelId}`);
      } catch (streamError) {
        // Channel might already exist - that's okay
        console.log(`[SETUP_ORG_CHANNELS] Stream channel may already exist: ${channel.streamChannelId}`, streamError);
      }
    }

    return NextResponse.json({
      success: true,
      channels,
      organizationId,
    });
  } catch (error) {
    console.error('[SETUP_ORG_CHANNELS_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * GET /api/coach/org-channels/setup-defaults
 * 
 * Check if default channels have been set up for the organization
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const channels = await getOrgChannels(organizationId);
    const hasDefaultChannels = channels.length >= 3;

    return NextResponse.json({
      organizationId,
      hasDefaultChannels,
      channelCount: channels.length,
      channels: hasDefaultChannels ? channels : [],
    });
  } catch (error) {
    console.error('[SETUP_ORG_CHANNELS_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



