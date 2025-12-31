import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import { notifyUser } from '@/lib/notifications';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/feed/[postId]/comment
 * Get comments for a post
 */
export async function GET(
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

    // Parse pagination
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const cursor = searchParams.get('cursor') || undefined;

    // Get comments from Firestore
    let query = adminDb
      .collection('feed_comments')
      .where('postId', '==', postId)
      .orderBy('createdAt', 'asc')
      .limit(limit + 1);

    if (cursor) {
      const cursorDoc = await adminDb.collection('feed_comments').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    // Get unique author IDs
    const authorIds = [...new Set(docs.map(doc => doc.data().authorId))];
    
    // Batch fetch author data
    const authorDocs = await Promise.all(
      authorIds.map(id => adminDb.collection('users').doc(id).get())
    );
    const authorMap = new Map(
      authorDocs.filter(doc => doc.exists).map(doc => [doc.id, doc.data()])
    );

    // Transform comments
    const comments = docs.map(doc => {
      const data = doc.data();
      const author = authorMap.get(data.authorId);
      
      // Parse firstName/lastName with fallback to 'name' field
      const firstName = author?.firstName || (author?.name?.split(' ')[0]) || '';
      const lastName = author?.lastName || (author?.name?.split(' ').slice(1).join(' ')) || '';
      
      return {
        id: doc.id,
        postId,
        authorId: data.authorId,
        text: data.text,
        parentCommentId: data.parentCommentId || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt || null,
        author: author ? {
          id: data.authorId,
          firstName,
          lastName,
          imageUrl: author.avatarUrl || author.imageUrl,
        } : null,
      };
    });

    const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

    return NextResponse.json({
      comments,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('[FEED_COMMENTS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get comments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feed/[postId]/comment
 * Add a comment to a post
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

    // Parse body
    const body = await request.json();
    const { text, parentCommentId } = body;

    if (!text?.trim()) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Add comment to Firestore
    const commentRef = adminDb.collection('feed_comments').doc();
    await commentRef.set({
      postId,
      authorId: userId,
      text: text.trim(),
      parentCommentId: parentCommentId || null,
      organizationId,
      createdAt: now,
    });

    // Increment comment count on post
    await adminDb.collection('feed_posts').doc(postId).update({
      commentCount: FieldValue.increment(1),
    });

    // Get commenter data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Parse firstName/lastName with fallback to 'name' field
    const firstName = userData?.firstName || (userData?.name?.split(' ')[0]) || '';
    const lastName = userData?.lastName || (userData?.name?.split(' ').slice(1).join(' ')) || '';

    // Notify post author (fire-and-forget)
    notifyPostAuthor(postId, userId, organizationId, text.trim()).catch(console.error);

    return NextResponse.json({
      success: true,
      comment: {
        id: commentRef.id,
        postId,
        authorId: userId,
        text: text.trim(),
        parentCommentId: parentCommentId || null,
        createdAt: now,
        author: userData ? {
          id: userId,
          firstName,
          lastName,
          imageUrl: userData.avatarUrl || userData.imageUrl,
        } : null,
      },
    });
  } catch (error) {
    console.error('[FEED_COMMENT_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/feed/[postId]/comment?commentId=xxx
 * Edit a comment
 */
export async function PATCH(
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

    // Get commentId from query params
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID required' }, { status: 400 });
    }

    // Parse body
    const body = await request.json();
    const { text } = body;

    if (!text?.trim()) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      );
    }

    // Get the comment to verify ownership
    const commentRef = adminDb.collection('feed_comments').doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const commentData = commentDoc.data()!;

    // Verify the comment belongs to this post
    if (commentData.postId !== postId) {
      return NextResponse.json({ error: 'Comment does not belong to this post' }, { status: 400 });
    }

    // Only the comment author can edit
    if (commentData.authorId !== userId) {
      return NextResponse.json({ error: 'Not authorized to edit this comment' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Update the comment
    await commentRef.update({
      text: text.trim(),
      updatedAt: now,
    });

    // Get user data for response
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Parse firstName/lastName with fallback to 'name' field
    const firstName = userData?.firstName || (userData?.name?.split(' ')[0]) || '';
    const lastName = userData?.lastName || (userData?.name?.split(' ').slice(1).join(' ')) || '';

    return NextResponse.json({
      success: true,
      comment: {
        id: commentId,
        postId,
        authorId: userId,
        text: text.trim(),
        parentCommentId: commentData.parentCommentId || null,
        createdAt: commentData.createdAt,
        updatedAt: now,
        author: userData ? {
          id: userId,
          firstName,
          lastName,
          imageUrl: userData.avatarUrl || userData.imageUrl,
        } : null,
      },
    });
  } catch (error) {
    console.error('[FEED_COMMENT_PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/feed/[postId]/comment?commentId=xxx
 * Delete a comment from a post
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

    // Get commentId from query params
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID required' }, { status: 400 });
    }

    // Get the comment to verify ownership
    const commentRef = adminDb.collection('feed_comments').doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const commentData = commentDoc.data()!;

    // Verify the comment belongs to this post
    if (commentData.postId !== postId) {
      return NextResponse.json({ error: 'Comment does not belong to this post' }, { status: 400 });
    }

    // Check if user is the comment author or the post author
    const postDoc = await adminDb.collection('feed_posts').doc(postId).get();
    const postData = postDoc.data();
    const isCommentAuthor = commentData.authorId === userId;
    const isPostAuthor = postData?.authorId === userId;

    if (!isCommentAuthor && !isPostAuthor) {
      return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 });
    }

    // Delete the comment
    await commentRef.delete();

    // Decrement comment count on post
    await adminDb.collection('feed_posts').doc(postId).update({
      commentCount: FieldValue.increment(-1),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FEED_COMMENT_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}

/**
 * Helper to notify post author of a comment
 */
async function notifyPostAuthor(
  postId: string,
  commenterId: string,
  organizationId: string,
  commentText: string
) {
  try {
    // Get the post to find the author
    const postDoc = await adminDb.collection('feed_posts').doc(postId).get();
    if (!postDoc.exists) return;

    const postData = postDoc.data()!;
    const authorId = postData.authorId;

    // Don't notify yourself
    if (authorId === commenterId) return;

    // Get commenter's name (with fallback to 'name' field)
    const commenterDoc = await adminDb.collection('users').doc(commenterId).get();
    const commenterData = commenterDoc.data();
    const commenterName = commenterData?.firstName || (commenterData?.name?.split(' ')[0]) || 'Someone';

    // Comment preview
    const commentPreview = commentText.length > 50 
      ? commentText.substring(0, 50) + '...' 
      : commentText;

    await notifyUser({
      userId: authorId,
      type: 'feed_comment',
      title: `${commenterName} commented on your post`,
      body: commentPreview,
      actionRoute: `/feed?post=${postId}`,
      organizationId,
    });
  } catch (error) {
    console.error('[FEED_COMMENT_NOTIFY] Error:', error);
  }
}
