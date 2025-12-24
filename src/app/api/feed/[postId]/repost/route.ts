import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { addReaction, getStreamFeedsClient, createPost } from '@/lib/stream-feeds';
import { adminDb } from '@/lib/firebase-admin';
import { notifyUser } from '@/lib/notifications';

/**
 * POST /api/feed/[postId]/repost
 * Repost a post (with optional quote)
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

    // Parse body for optional quote
    const body = await request.json().catch(() => ({}));
    const { quote } = body;

    // Add repost reaction to track repost
    await addReaction(userId, postId, 'repost');

    // Get original post data
    const client = getStreamFeedsClient();
    const cleanOrgId = organizationId.replace('org_', '');
    const orgFeed = client.feed('org', cleanOrgId);
    
    const response = await orgFeed.get({
      id_lte: postId,
      id_gte: postId,
      limit: 1,
    });

    if (!response.results.length) {
      return NextResponse.json({ error: 'Original post not found' }, { status: 404 });
    }

    const originalPost = response.results[0] as Record<string, unknown>;
    const originalAuthorId = originalPost.actor as string;

    // Create a new post that references the original
    // The repost will show the original content plus optional quote
    const repostText = quote 
      ? `${quote}\n\n[Reposted from @${originalAuthorId}]`
      : `[Reposted from @${originalAuthorId}]`;

    // Create the repost as a new activity
    const userFeed = client.feed('user', userId);
    
    const repostActivity = {
      actor: userId,
      verb: 'repost',
      object: postId,
      text: repostText,
      originalPostId: postId,
      originalAuthorId,
      originalText: originalPost.text,
      originalImages: originalPost.images,
      originalVideoUrl: originalPost.videoUrl,
      quote: quote || null,
      organizationId,
      foreign_id: `repost:${userId}:${postId}:${Date.now()}`,
      time: new Date().toISOString(),
      to: [`org:${cleanOrgId}`],
    };

    const result = await userFeed.addActivity(repostActivity);

    // Notify original author (fire-and-forget)
    notifyOriginalAuthor(originalAuthorId, userId, postId, organizationId).catch(console.error);

    return NextResponse.json({
      success: true,
      repost: {
        id: result.id,
        originalPostId: postId,
        quote,
      },
    });
  } catch (error) {
    console.error('[FEED_REPOST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to repost' },
      { status: 500 }
    );
  }
}

/**
 * Helper to notify original post author of a repost
 */
async function notifyOriginalAuthor(
  originalAuthorId: string,
  reposterId: string,
  postId: string,
  organizationId: string
) {
  try {
    // Don't notify yourself
    if (originalAuthorId === reposterId) return;

    // Get reposter's name
    const reposterDoc = await adminDb.collection('users').doc(reposterId).get();
    const reposterData = reposterDoc.data();
    const reposterName = reposterData?.firstName || 'Someone';

    await notifyUser({
      userId: originalAuthorId,
      type: 'feed_repost',
      title: `${reposterName} reposted your post`,
      body: 'Your post was shared with their followers',
      actionRoute: `/feed?post=${postId}`,
      organizationId,
    });
  } catch (error) {
    console.error('[FEED_REPOST_NOTIFY] Error:', error);
  }
}

