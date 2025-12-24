import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/feed/search
 * Search posts by text content
 * 
 * Note: This is a basic text search using Firestore.
 * For production, consider using Algolia or Firebase Extensions for full-text search.
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const searchTerm = query.trim().toLowerCase();

    // Get recent posts from the org (basic search - filters client-side)
    // For better performance, use a search service like Algolia
    const snapshot = await adminDb
      .collection('feed_posts')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .limit(100) // Get more posts to filter
      .get();

    // Filter posts that contain the search term
    const matchingDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      const text = (data.text || '').toLowerCase();
      return text.includes(searchTerm);
    }).slice(0, limit);

    // Get unique author IDs
    const authorIds = [...new Set(matchingDocs.map(doc => doc.data().authorId))];
    
    // Batch fetch author data
    const authorDocs = await Promise.all(
      authorIds.map(id => adminDb.collection('users').doc(id).get())
    );
    const authorMap = new Map(
      authorDocs.filter(doc => doc.exists).map(doc => [doc.id, doc.data()])
    );

    // Get user's reactions for these posts
    const postIds = matchingDocs.map(doc => doc.id);
    const userReactionsSnapshot = postIds.length > 0 
      ? await adminDb
          .collection('feed_reactions')
          .where('userId', '==', userId)
          .where('postId', 'in', postIds)
          .get()
      : { docs: [] };
    
    const userReactions = new Map<string, Set<string>>();
    userReactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!userReactions.has(data.postId)) {
        userReactions.set(data.postId, new Set());
      }
      userReactions.get(data.postId)!.add(data.type);
    });

    // Transform to frontend format
    const posts = matchingDocs.map(doc => {
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

    return NextResponse.json({
      posts,
      query: query.trim(),
    });
  } catch (error) {
    console.error('[FEED_SEARCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search posts' },
      { status: 500 }
    );
  }
}
