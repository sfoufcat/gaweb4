import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/feed
 * Fetch posts from the organization's feed with pagination
 * Uses Firestore for storage (simpler than Stream Activity Feeds which requires dashboard setup)
 * 
 * On first page (no cursor), pinned posts are prepended to the feed
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

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const cursor = searchParams.get('cursor') || undefined;

    // On first page, fetch pinned posts
    // Note: We don't use orderBy('pinnedAt') in Firestore to avoid index requirements
    // and to handle documents where pinnedAt might be missing. Sort in memory instead.
    let pinnedDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (!cursor) {
      const pinnedSnapshot = await adminDb
        .collection('feed_posts')
        .where('organizationId', '==', organizationId)
        .where('pinnedToFeed', '==', true)
        .get();
      // Sort pinned posts by pinnedAt descending (fallback to createdAt if pinnedAt missing)
      pinnedDocs = pinnedSnapshot.docs.sort((a, b) => {
        const aData = a.data();
        const bData = b.data();
        const aTime = aData.pinnedAt || aData.createdAt || '';
        const bTime = bData.pinnedAt || bData.createdAt || '';
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    }

    // Get IDs of pinned posts to exclude from regular feed
    const pinnedIds = new Set(pinnedDocs.map(doc => doc.id));

    // Fetch regular posts from Firestore
    let query = adminDb
      .collection('feed_posts')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .limit(limit + 1 + pinnedIds.size); // Fetch extra to account for excluding pinned

    if (cursor) {
      const cursorDoc = await adminDb.collection('feed_posts').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    
    // Filter out pinned posts from regular results (they're shown at top)
    const regularDocs = snapshot.docs.filter(doc => !pinnedIds.has(doc.id));
    const hasMore = regularDocs.length > limit;
    const docs = hasMore ? regularDocs.slice(0, limit) : regularDocs;

    // Combine pinned + regular docs for data fetching
    const allDocs = [...pinnedDocs, ...docs];

    // Get unique author IDs
    const authorIds = [...new Set(allDocs.map(doc => doc.data().authorId))];
    
    // Batch fetch author data
    const authorDocs = await Promise.all(
      authorIds.map(id => adminDb.collection('users').doc(id).get())
    );
    const authorMap = new Map(
      authorDocs.filter(doc => doc.exists).map(doc => [doc.id, doc.data()])
    );

    // Get user's reactions for these posts
    const postIds = allDocs.map(doc => doc.id);
    const userReactionsSnapshot = await adminDb
      .collection('feed_reactions')
      .where('userId', '==', userId)
      .where('postId', 'in', postIds.length > 0 ? postIds : ['__none__'])
      .get();
    
    const userReactions = new Map<string, Set<string>>();
    userReactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!userReactions.has(data.postId)) {
        userReactions.set(data.postId, new Set());
      }
      userReactions.get(data.postId)!.add(data.type);
    });

    // Get poll IDs for batch fetch
    const pollIds = allDocs
      .map(doc => doc.data().pollId)
      .filter((id): id is string => !!id);
    
    // Batch fetch poll data
    const pollMap = new Map();
    if (pollIds.length > 0) {
      const pollDocs = await Promise.all(
        pollIds.map(id => adminDb.collection('polls').doc(id).get())
      );
      pollDocs.filter(doc => doc.exists).forEach(doc => {
        pollMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
    }

    // Helper to transform a doc to post format
    const transformPost = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      const author = authorMap.get(data.authorId);
      const reactions = userReactions.get(doc.id) || new Set();
      const pollData = data.pollId ? pollMap.get(data.pollId) : undefined;
      
      return {
        id: doc.id,
        authorId: data.authorId,
        text: data.text,
        content: data.content,
        contentHtml: data.contentHtml,
        images: data.images,
        videoUrl: data.videoUrl,
        pollId: data.pollId || undefined,
        pollData: pollData,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        likeCount: data.likeCount || 0,
        commentCount: data.commentCount || 0,
        repostCount: data.repostCount || 0,
        bookmarkCount: data.bookmarkCount || 0,
        hasLiked: reactions.has('like'),
        hasBookmarked: reactions.has('bookmark'),
        hasReposted: reactions.has('repost'),
        // Coach settings
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
    };

    // Transform pinned and regular posts
    const pinnedPosts = pinnedDocs.map(transformPost);
    const regularPosts = docs.map(transformPost);
    
    // Combine: pinned first, then regular (on first page only)
    const posts = cursor ? regularPosts : [...pinnedPosts, ...regularPosts];

    const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

    return NextResponse.json({
      posts,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('[FEED_GET] Error fetching feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feed
 * Create a new post in the organization's feed
 * Uses Firestore for storage
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { text, content, contentHtml, images, videoUrl, pollId } = body;

    // Validate - must have text or media or poll
    if (!text && !content && !images?.length && !videoUrl && !pollId) {
      return NextResponse.json(
        { error: 'Post must have text, media, or a poll' },
        { status: 400 }
      );
    }

    // Get user data for author info
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    const now = new Date().toISOString();
    
    // Create post in Firestore
    const postRef = adminDb.collection('feed_posts').doc();
    const postData = {
      authorId: userId,
      organizationId,
      text: text || null,
      content: content || null, // TipTap JSON
      contentHtml: contentHtml || null, // Pre-rendered HTML
      images: images || [],
      videoUrl: videoUrl || null,
      pollId: pollId || null,
      likeCount: 0,
      commentCount: 0,
      repostCount: 0,
      bookmarkCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    await postRef.set(postData);

    // Fetch poll data if pollId provided
    let pollData = null;
    if (pollId) {
      const pollDoc = await adminDb.collection('polls').doc(pollId).get();
      if (pollDoc.exists) {
        pollData = { id: pollDoc.id, ...pollDoc.data() };
      }
    }

    return NextResponse.json({
      success: true,
      post: {
        id: postRef.id,
        authorId: userId,
        text: postData.text,
        content: postData.content,
        contentHtml: postData.contentHtml,
        images: postData.images,
        videoUrl: postData.videoUrl,
        pollId: postData.pollId,
        pollData: pollData,
        createdAt: now,
        likeCount: 0,
        commentCount: 0,
        repostCount: 0,
        bookmarkCount: 0,
        hasLiked: false,
        hasBookmarked: false,
        hasReposted: false,
        // Coach settings (default to false for new posts)
        pinnedToFeed: false,
        pinnedToSidebar: false,
        hideMetadata: false,
        disableInteractions: false,
        pinnedAt: null,
        author: userData ? {
          id: userId,
          firstName: userData.firstName,
          lastName: userData.lastName,
          imageUrl: userData.avatarUrl || userData.imageUrl,
          name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
        } : undefined,
      },
    });
  } catch (error) {
    console.error('[FEED_POST] Error creating post:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}

