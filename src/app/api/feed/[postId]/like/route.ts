import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { addReaction, removeReaction, getStreamFeedsClient } from '@/lib/stream-feeds';
import { adminDb } from '@/lib/firebase-admin';
import { notifyUser } from '@/lib/notifications';

/**
 * POST /api/feed/[postId]/like
 * Like a post
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

    // Get org from tenant context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Add like reaction
    const reaction = await addReaction(userId, postId, 'like');

    // Get post author to send notification (fire-and-forget)
    notifyPostAuthor(postId, userId, organizationId, 'like').catch(console.error);

    return NextResponse.json({
      success: true,
      reactionId: reaction.id,
    });
  } catch (error) {
    console.error('[FEED_LIKE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to like post' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/feed/[postId]/like
 * Unlike a post
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

    // Find and remove the user's like reaction
    const client = getStreamFeedsClient();
    
    // Get reactions for this activity by this user
    const reactions = await client.reactions.filter({
      activity_id: postId,
      kind: 'like',
      user_id: userId,
      limit: 1,
    });

    if (reactions.results.length > 0) {
      await removeReaction(reactions.results[0].id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FEED_UNLIKE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to unlike post' },
      { status: 500 }
    );
  }
}

/**
 * Helper to notify post author of a like
 */
async function notifyPostAuthor(
  postId: string,
  likerId: string,
  organizationId: string,
  action: 'like'
) {
  try {
    // Get the activity to find the author
    const client = getStreamFeedsClient();
    const cleanOrgId = organizationId.replace('org_', '');
    const orgFeed = client.feed('org', cleanOrgId);
    
    const response = await orgFeed.get({
      id_lte: postId,
      id_gte: postId,
      limit: 1,
    });

    if (!response.results.length) return;

    const activity = response.results[0] as Record<string, unknown>;
    const authorId = activity.actor as string;

    // Don't notify yourself
    if (authorId === likerId) return;

    // Get liker's name
    const likerDoc = await adminDb.collection('users').doc(likerId).get();
    const likerData = likerDoc.data();
    const likerName = likerData?.firstName || 'Someone';

    // Get post preview
    const postText = (activity.text as string) || 'your post';
    const postPreview = postText.length > 50 ? postText.substring(0, 50) + '...' : postText;

    await notifyUser({
      userId: authorId,
      type: 'feed_like',
      title: `${likerName} liked your post`,
      body: postPreview,
      actionRoute: `/feed?post=${postId}`,
      organizationId,
    });
  } catch (error) {
    console.error('[FEED_LIKE_NOTIFY] Error:', error);
  }
}

