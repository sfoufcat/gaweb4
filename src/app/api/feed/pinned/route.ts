import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/feed/pinned
 * Fetch posts pinned to the sidebar
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

    // Fetch posts pinned to sidebar, ordered by pinnedAt descending
    const snapshot = await adminDb
      .collection('feed_posts')
      .where('organizationId', '==', organizationId)
      .where('pinnedToSidebar', '==', true)
      .orderBy('pinnedAt', 'desc')
      .limit(limit)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ posts: [] });
    }

    // Get unique author IDs
    const authorIds = [...new Set(snapshot.docs.map(doc => doc.data().authorId))];
    
    // Batch fetch author data
    const authorDocs = await Promise.all(
      authorIds.map(id => adminDb.collection('users').doc(id).get())
    );
    const authorMap = new Map(
      authorDocs.filter(doc => doc.exists).map(doc => [doc.id, doc.data()])
    );

    // Get user's reactions for these posts
    const postIds = snapshot.docs.map(doc => doc.id);
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
    const posts = snapshot.docs.map(doc => {
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
        // Settings
        pinnedToFeed: data.pinnedToFeed || false,
        pinnedToSidebar: data.pinnedToSidebar || false,
        hideMetadata: data.hideMetadata || false,
        disableInteractions: data.disableInteractions || false,
        pinnedAt: data.pinnedAt || null,
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
    console.error('[FEED_PINNED] Error fetching pinned posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pinned posts' },
      { status: 500 }
    );
  }
}

