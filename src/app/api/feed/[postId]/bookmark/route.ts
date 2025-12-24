import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Check if already bookmarked
    const existingBookmark = await adminDb
      .collection('feed_reactions')
      .where('postId', '==', postId)
      .where('userId', '==', userId)
      .where('type', '==', 'bookmark')
      .limit(1)
      .get();

    if (!existingBookmark.empty) {
      return NextResponse.json({ success: true, message: 'Already bookmarked' });
    }

    // Add bookmark reaction
    const reactionRef = adminDb.collection('feed_reactions').doc();
    await reactionRef.set({
      postId,
      userId,
      type: 'bookmark',
      organizationId,
      createdAt: new Date().toISOString(),
    });

    // Increment bookmark count on post
    await adminDb.collection('feed_posts').doc(postId).update({
      bookmarkCount: FieldValue.increment(1),
    });

    return NextResponse.json({
      success: true,
      reactionId: reactionRef.id,
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

    // Find user's bookmark
    const bookmarkSnapshot = await adminDb
      .collection('feed_reactions')
      .where('postId', '==', postId)
      .where('userId', '==', userId)
      .where('type', '==', 'bookmark')
      .limit(1)
      .get();

    if (bookmarkSnapshot.empty) {
      return NextResponse.json({ success: true, message: 'Not bookmarked' });
    }

    // Delete the bookmark
    await bookmarkSnapshot.docs[0].ref.delete();

    // Decrement bookmark count on post
    await adminDb.collection('feed_posts').doc(postId).update({
      bookmarkCount: FieldValue.increment(-1),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FEED_UNBOOKMARK] Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove bookmark' },
      { status: 500 }
    );
  }
}
