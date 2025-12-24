import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import { notifyUser } from '@/lib/notifications';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Get original post
    const originalPostDoc = await adminDb.collection('feed_posts').doc(postId).get();
    if (!originalPostDoc.exists) {
      return NextResponse.json({ error: 'Original post not found' }, { status: 404 });
    }

    const originalPost = originalPostDoc.data()!;
    const originalAuthorId = originalPost.authorId;

    // Check if user has already reposted this post
    const existingRepost = await adminDb
      .collection('feed_reactions')
      .where('postId', '==', postId)
      .where('userId', '==', userId)
      .where('type', '==', 'repost')
      .limit(1)
      .get();

    if (!existingRepost.empty) {
      return NextResponse.json({ success: true, message: 'Already reposted' });
    }

    const now = new Date().toISOString();

    // Add repost reaction
    const reactionRef = adminDb.collection('feed_reactions').doc();
    await reactionRef.set({
      postId,
      userId,
      type: 'repost',
      organizationId,
      createdAt: now,
    });

    // Increment repost count on original post
    await adminDb.collection('feed_posts').doc(postId).update({
      repostCount: FieldValue.increment(1),
    });

    // Create a new post that references the original (if quote provided, or as a share)
    const repostRef = adminDb.collection('feed_posts').doc();
    await repostRef.set({
      authorId: userId,
      organizationId,
      text: quote || null,
      images: [],
      videoUrl: null,
      isRepost: true,
      originalPostId: postId,
      originalAuthorId,
      originalText: originalPost.text,
      originalImages: originalPost.images || [],
      originalVideoUrl: originalPost.videoUrl || null,
      likeCount: 0,
      commentCount: 0,
      repostCount: 0,
      bookmarkCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Notify original author (fire-and-forget)
    notifyOriginalAuthor(originalAuthorId, userId, postId, organizationId).catch(console.error);

    return NextResponse.json({
      success: true,
      repost: {
        id: repostRef.id,
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
