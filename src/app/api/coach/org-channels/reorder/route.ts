import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  getOrgChannels,
  reorderOrgChannels,
} from '@/lib/org-channels';

/**
 * PATCH /api/coach/org-channels/reorder
 * 
 * Reorder channels for the organization
 * 
 * Body:
 * - channelOrder: Array<{ channelId: string; order: number }>
 */
export async function PATCH(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { channelOrder } = body as {
      channelOrder: Array<{ channelId: string; order: number }>;
    };

    // Validation
    if (!Array.isArray(channelOrder) || channelOrder.length === 0) {
      return NextResponse.json(
        { error: 'channelOrder must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate all items have required fields
    for (const item of channelOrder) {
      if (!item.channelId || typeof item.order !== 'number') {
        return NextResponse.json(
          { error: 'Each item must have channelId and order' },
          { status: 400 }
        );
      }
    }

    // Verify all channels belong to this org
    const existingChannels = await getOrgChannels(organizationId);
    const existingIds = new Set(existingChannels.map(c => c.id));

    for (const item of channelOrder) {
      if (!existingIds.has(item.channelId)) {
        return NextResponse.json(
          { error: `Channel ${item.channelId} not found or doesn't belong to your organization` },
          { status: 400 }
        );
      }
    }

    // Perform reorder
    await reorderOrgChannels(organizationId, channelOrder);

    // Fetch updated channels
    const updatedChannels = await getOrgChannels(organizationId);

    return NextResponse.json({
      success: true,
      channels: updatedChannels,
    });
  } catch (error) {
    console.error('[COACH_ORG_CHANNELS_REORDER_ERROR]', error);
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






