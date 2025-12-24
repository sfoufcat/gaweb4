import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/feed/trending
 * Fetch trending posts from the last 7 days, sorted by like count
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org from tenant context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Check if feed is enabled for this org
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data();
    
    if (!orgSettings?.feedEnabled) {
      return NextResponse.json({ error: 'Feed is not enabled for this organization' }, { status: 403 });
    }

    // Parse limit param
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // Fetch posts from last 7 days with at least 1 like, ordered by likeCount
    // Note: Firestore doesn't support ordering by one field and filtering by another range,
    // so we fetch recent posts and sort in memory
    const snapshot = await adminDb
      .collection('feed_posts')
      .where('organizationId', '==', organizationId)
      .where('createdAt', '>=', sevenDaysAgoISO)
      .get();

    // Sort by likeCount descending and take top N
    const sortedDocs = snapshot.docs
      .map(doc => ({ doc, likeCount: doc.data().likeCount || 0 }))
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, limit)
      .map(item => item.doc);

    if (sortedDocs.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    // Get unique author IDs
    const authorIds = [...new Set(sortedDocs.map(doc => doc.data().authorId))];
    
    // Batch fetch author data
    const authorDocs = await Promise.all(
      authorIds.map(id => adminDb.collection('users').doc(id).get())
    );
    const authorMap = new Map(
      authorDocs.filter(doc => doc.exists).map(doc => [doc.id, doc.data()])
    );

    // Get user's reactions for these posts
    const postIds = sortedDocs.map(doc => doc.id);
    const userReactionsSnapshot = await adminDb
      .collection('feed_reactions')
      .where('userId', '==', userId)
      .where('postId', 'in', postIds)
      .get();
    
    const userReactions = new Map<string, Set<string>>();
    userReactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!userReactions.has(data.postId)) {
        userReactions.set(data.postId, new Set());
      }
      userReactions.get(data.postId)!.add(data.type);
    });

    // Transform to frontend format
    const posts = sortedDocs.map(doc => {
      const data = doc.data();
      const author = authorMap.get(data.authorId);
      const reactions = userReactions.get(doc.id) || new Set();
      
      return {
        id: doc.id,
        authorId: data.authorId,
        text: data.text,
        images: data.images,
        videoUrl: data.videoUrl,
        createdAt: data.createdAt,
        likeCount: data.likeCount || 0,
        commentCount: data.commentCount || 0,
        repostCount: data.repostCount || 0,
        bookmarkCount: data.bookmarkCount || 0,
        hasLiked: reactions.has('like'),
        hasBookmarked: reactions.has('bookmark'),
        hasReposted: reactions.has('repost'),
        author: author ? {
          id: data.authorId,
          firstName: author.firstName,
          lastName: author.lastName,
          imageUrl: author.avatarUrl || author.imageUrl,
          name: `${author.firstName || ''} ${author.lastName || ''}`.trim(),
        } : undefined,
      };
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[FEED_TRENDING] Error fetching trending posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending posts' },
      { status: 500 }
    );
  }
}

