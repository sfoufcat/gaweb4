import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import { notifyUser } from '@/lib/notifications';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Check if already liked
    const existingLike = await adminDb
      .collection('feed_reactions')
      .where('postId', '==', postId)
      .where('userId', '==', userId)
      .where('type', '==', 'like')
      .limit(1)
      .get();

    if (!existingLike.empty) {
      return NextResponse.json({ success: true, message: 'Already liked' });
    }

    // Add like reaction
    const reactionRef = adminDb.collection('feed_reactions').doc();
    await reactionRef.set({
      postId,
      userId,
      type: 'like',
      organizationId,
      createdAt: new Date().toISOString(),
    });

    // Increment like count on post
    await adminDb.collection('feed_posts').doc(postId).update({
      likeCount: FieldValue.increment(1),
    });

    // Get post author to send notification (fire-and-forget)
    notifyPostAuthor(postId, userId, organizationId).catch(console.error);

    return NextResponse.json({
      success: true,
      reactionId: reactionRef.id,
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

    // Find user's like
    const likeSnapshot = await adminDb
      .collection('feed_reactions')
      .where('postId', '==', postId)
      .where('userId', '==', userId)
      .where('type', '==', 'like')
      .limit(1)
      .get();

    if (likeSnapshot.empty) {
      return NextResponse.json({ success: true, message: 'Not liked' });
    }

    // Delete the like
    await likeSnapshot.docs[0].ref.delete();

    // Decrement like count on post
    await adminDb.collection('feed_posts').doc(postId).update({
      likeCount: FieldValue.increment(-1),
    });

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
  organizationId: string
) {
  try {
    // Get the post to find the author
    const postDoc = await adminDb.collection('feed_posts').doc(postId).get();
    if (!postDoc.exists) return;

    const postData = postDoc.data()!;
    const authorId = postData.authorId;

    // Don't notify yourself
    if (authorId === likerId) return;

    // Get liker's name
    const likerDoc = await adminDb.collection('users').doc(likerId).get();
    const likerData = likerDoc.data();
    const likerName = likerData?.firstName || 'Someone';

    // Get post preview
    const postText = postData.text || 'your post';
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
