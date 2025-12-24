import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/feed/bookmarks
 * Get user's bookmarked posts
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Check if feed is enabled
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data();
    
    if (!orgSettings?.feedEnabled) {
      return NextResponse.json({ error: 'Feed is not enabled' }, { status: 403 });
    }

    // Parse pagination
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const cursor = searchParams.get('cursor') || undefined;

    // Get user's bookmark reactions
    let query = adminDb
      .collection('feed_reactions')
      .where('userId', '==', userId)
      .where('type', '==', 'bookmark')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);

    if (cursor) {
      const cursorDoc = await adminDb.collection('feed_reactions').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const bookmarksSnapshot = await query.get();
    const hasMore = bookmarksSnapshot.docs.length > limit;
    const bookmarkDocs = hasMore ? bookmarksSnapshot.docs.slice(0, limit) : bookmarksSnapshot.docs;

    // Get the actual posts for each bookmark
    const postIds = bookmarkDocs.map(doc => doc.data().postId);
    
    if (postIds.length === 0) {
      return NextResponse.json({
        posts: [],
        nextCursor: null,
        hasMore: false,
      });
    }

    // Batch fetch posts
    const postDocs = await Promise.all(
      postIds.map(id => adminDb.collection('feed_posts').doc(id).get())
    );

    // Get unique author IDs
    const authorIds = [...new Set(
      postDocs.filter(doc => doc.exists).map(doc => doc.data()!.authorId)
    )];
    
    // Batch fetch author data
    const authorDocs = await Promise.all(
      authorIds.map(id => adminDb.collection('users').doc(id).get())
    );
    const authorMap = new Map(
      authorDocs.filter(doc => doc.exists).map(doc => [doc.id, doc.data()])
    );

    // Build posts with bookmark info
    const posts = bookmarkDocs.map((bookmarkDoc, index) => {
      const postDoc = postDocs[index];
      if (!postDoc.exists) return null;

      const bookmarkData = bookmarkDoc.data();
      const postData = postDoc.data()!;
      const author = authorMap.get(postData.authorId);

      return {
        id: postDoc.id,
        authorId: postData.authorId,
        text: postData.text,
        images: postData.images,
        videoUrl: postData.videoUrl,
        createdAt: postData.createdAt,
        bookmarkedAt: bookmarkData.createdAt,
        likeCount: postData.likeCount || 0,
        commentCount: postData.commentCount || 0,
        repostCount: postData.repostCount || 0,
        bookmarkCount: postData.bookmarkCount || 0,
        hasLiked: false, // Would need another query to check
        hasBookmarked: true,
        hasReposted: false,
        author: author ? {
          id: postData.authorId,
          firstName: author.firstName,
          lastName: author.lastName,
          imageUrl: author.avatarUrl || author.imageUrl,
          name: `${author.firstName || ''} ${author.lastName || ''}`.trim(),
        } : undefined,
      };
    }).filter(Boolean);

    const nextCursor = hasMore && bookmarkDocs.length > 0 
      ? bookmarkDocs[bookmarkDocs.length - 1].id 
      : null;

    return NextResponse.json({
      posts,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('[FEED_BOOKMARKS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get bookmarks' },
      { status: 500 }
    );
  }
}
