import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getStreamServerClient } from '@/lib/stream-server';
import {
  getOrgChannels,
  createOrgChannel,
  type OrgChannelType,
} from '@/lib/org-channels';

/**
 * GET /api/coach/org-channels
 * 
 * Fetch all channels for the coach's organization
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const channels = await getOrgChannels(organizationId);

    return NextResponse.json({
      channels,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_CHANNELS_GET_ERROR]', error);
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
 * POST /api/coach/org-channels
 * 
 * Create a new channel for the coach's organization
 * 
 * Body:
 * - type: 'announcements' | 'social' | 'wins' | 'custom' (required)
 * - title: string (required)
 * - subtitle?: string
 * - icon?: string
 * - imageUrl?: string
 * - isPinned?: boolean
 * - allowMemberMessages?: boolean
 * - allowCalling?: boolean
 */
export async function POST(req: Request) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();

    const body = await req.json();
    const {
      type,
      title,
      subtitle,
      icon,
      imageUrl,
      isPinned,
      allowMemberMessages,
      allowCalling,
    } = body as {
      type: OrgChannelType;
      title: string;
      subtitle?: string;
      icon?: string;
      imageUrl?: string;
      isPinned?: boolean;
      allowMemberMessages?: boolean;
      allowCalling?: boolean;
    };

    // Validation
    if (!type || !['announcements', 'social', 'wins', 'custom'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid channel type. Must be: announcements, social, wins, or custom' },
        { status: 400 }
      );
    }

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Create channel in Firestore
    const channel = await createOrgChannel({
      organizationId,
      type,
      title: title.trim(),
      subtitle: subtitle?.trim(),
      icon,
      imageUrl,
      isPinned,
      allowMemberMessages,
      allowCalling,
    });

    // Create the actual Stream Chat channel
    try {
      const streamClient = await getStreamServerClient();
      
      const streamChannel = streamClient.channel('messaging', channel.streamChannelId, {
        name: channel.title,
        created_by_id: userId,
        // Custom data for our app
        organizationId,
        channelType: channel.type,
        isOrgChannel: true,
      } as Record<string, unknown>);

      await streamChannel.create();

      // Add creator as member
      await streamChannel.addMembers([userId]);

      console.log(`[COACH_ORG_CHANNELS] Created Stream channel: ${channel.streamChannelId}`);
    } catch (streamError) {
      console.error('[COACH_ORG_CHANNELS] Error creating Stream channel:', streamError);
      // Don't fail the request - the channel can be created lazily when users join
    }

    return NextResponse.json({
      success: true,
      channel,
    });
  } catch (error) {
    console.error('[COACH_ORG_CHANNELS_POST_ERROR]', error);
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






