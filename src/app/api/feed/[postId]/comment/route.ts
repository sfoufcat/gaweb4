import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { addComment, getComments, getStreamFeedsClient } from '@/lib/stream-feeds';
import { adminDb } from '@/lib/firebase-admin';
import { notifyUser } from '@/lib/notifications';

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

    // Get comments from Stream
    const response = await getComments(postId, { limit, id_lt: cursor });

    // Get user data for each commenter
    const commenterIds = [...new Set(response.results.map((r) => r.user_id))];
    const userDocs = await Promise.all(
      commenterIds.map((id) => adminDb.collection('users').doc(id as string).get())
    );
    const usersMap = new Map(
      userDocs.map((doc) => [doc.id, doc.data()])
    );

    // Transform comments
    const comments = response.results.map((reaction) => {
      const userData = usersMap.get(reaction.user_id as string);
      return {
        id: reaction.id,
        postId,
        authorId: reaction.user_id,
        text: (reaction.data as { text?: string })?.text || '',
        parentCommentId: (reaction.data as { parentCommentId?: string })?.parentCommentId,
        createdAt: reaction.created_at,
        author: userData ? {
          id: reaction.user_id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          imageUrl: userData.avatarUrl || userData.imageUrl,
        } : null,
      };
    });

    const nextCursor = comments.length === limit ? comments[comments.length - 1]?.id : null;

    return NextResponse.json({
      comments,
      nextCursor,
      hasMore: comments.length === limit,
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

    // Add comment
    const reaction = await addComment(userId, postId, text.trim(), parentCommentId);

    // Get commenter data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Notify post author (fire-and-forget)
    notifyPostAuthor(postId, userId, organizationId, text.trim()).catch(console.error);

    return NextResponse.json({
      success: true,
      comment: {
        id: reaction.id,
        postId,
        authorId: userId,
        text: text.trim(),
        parentCommentId,
        createdAt: reaction.created_at,
        author: userData ? {
          id: userId,
          firstName: userData.firstName,
          lastName: userData.lastName,
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
 * Helper to notify post author of a comment
 */
async function notifyPostAuthor(
  postId: string,
  commenterId: string,
  organizationId: string,
  commentText: string
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
    if (authorId === commenterId) return;

    // Get commenter's name
    const commenterDoc = await adminDb.collection('users').doc(commenterId).get();
    const commenterData = commenterDoc.data();
    const commenterName = commenterData?.firstName || 'Someone';

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

