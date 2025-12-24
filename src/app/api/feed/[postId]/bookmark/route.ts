import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { addReaction, removeReaction, getStreamFeedsClient } from '@/lib/stream-feeds';

/**
 * POST /api/feed/[postId]/bookmark
 * Bookmark a post
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Add bookmark reaction
    const reaction = await addReaction(userId, postId, 'bookmark');

    return NextResponse.json({
      success: true,
      reactionId: reaction.id,
    });
  } catch (error) {
    console.error('[FEED_BOOKMARK] Error:', error);
    return NextResponse.json(
      { error: 'Failed to bookmark post' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/feed/[postId]/bookmark
 * Remove bookmark from a post
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Find and remove the user's bookmark reaction
    const client = getStreamFeedsClient();
    
    const reactions = await client.reactions.filter({
      activity_id: postId,
      kind: 'bookmark',
      user_id: userId,
      limit: 1,
    });

    if (reactions.results.length > 0) {
      await removeReaction(reactions.results[0].id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FEED_UNBOOKMARK] Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove bookmark' },
      { status: 500 }
    );
  }
}

