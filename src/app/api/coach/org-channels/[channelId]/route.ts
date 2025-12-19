import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getStreamServerClient } from '@/lib/stream-server';
import {
  getOrgChannel,
  updateOrgChannel,
  deleteOrgChannel,
  type UpdateOrgChannelInput,
} from '@/lib/org-channels';

/**
 * PUT /api/coach/org-channels/[channelId]
 * 
 * Update a channel's settings
 * 
 * Body (all optional):
 * - title?: string
 * - subtitle?: string
 * - icon?: string
 * - imageUrl?: string
 * - isPinned?: boolean
 * - allowMemberMessages?: boolean
 * - allowCalling?: boolean
 */
export async function PUT(
  req: Request,
  context: { params: Promise<{ channelId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { channelId } = await context.params;

    // Verify channel exists and belongs to this org
    const existingChannel = await getOrgChannel(channelId);
    if (!existingChannel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }
    if (existingChannel.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Channel does not belong to your organization' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updates: UpdateOrgChannelInput = {};

    // Only include provided fields
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.subtitle !== undefined) updates.subtitle = body.subtitle?.trim();
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
    if (body.isPinned !== undefined) updates.isPinned = body.isPinned;
    if (body.allowMemberMessages !== undefined) updates.allowMemberMessages = body.allowMemberMessages;
    if (body.allowCalling !== undefined) updates.allowCalling = body.allowCalling;
    if (body.order !== undefined) updates.order = body.order;

    // Update in Firestore
    const updatedChannel = await updateOrgChannel(channelId, updates);

    // Update Stream channel name if title changed
    if (updates.title && updates.title !== existingChannel.title) {
      try {
        const streamClient = await getStreamServerClient();
        const channel = streamClient.channel('messaging', existingChannel.streamChannelId);
        await channel.update({ name: updates.title } as Record<string, unknown>);
      } catch (streamError) {
        console.error('[COACH_ORG_CHANNELS] Error updating Stream channel:', streamError);
        // Don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      channel: updatedChannel,
    });
  } catch (error) {
    console.error('[COACH_ORG_CHANNELS_PUT_ERROR]', error);
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
 * DELETE /api/coach/org-channels/[channelId]
 * 
 * Delete a channel from the organization
 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ channelId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { channelId } = await context.params;

    // Verify channel exists and belongs to this org
    const existingChannel = await getOrgChannel(channelId);
    if (!existingChannel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }
    if (existingChannel.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Channel does not belong to your organization' },
        { status: 403 }
      );
    }

    // Delete from Firestore
    await deleteOrgChannel(channelId);

    // Optionally delete or archive the Stream channel
    // For now, we'll just delete the config - the Stream channel remains but won't be shown
    try {
      const streamClient = await getStreamServerClient();
      const channel = streamClient.channel('messaging', existingChannel.streamChannelId);
      // Archive/soft-delete by hiding from members
      await channel.update({
        deleted: true,
        deletedAt: new Date().toISOString(),
      } as Record<string, unknown>);
    } catch (streamError) {
      console.error('[COACH_ORG_CHANNELS] Error archiving Stream channel:', streamError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      message: 'Channel deleted',
    });
  } catch (error) {
    console.error('[COACH_ORG_CHANNELS_DELETE_ERROR]', error);
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
