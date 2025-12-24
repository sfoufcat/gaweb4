import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { createPost, getOrgPosts, setupStreamUser } from '@/lib/stream-feeds';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/feed
 * Fetch posts from the organization's feed with pagination
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

    // Fetch posts from Stream
    const response = await getOrgPosts(organizationId, {
      limit,
      id_lt: cursor,
    });

    // Transform response for frontend
    const posts = response.results.map((activity) => {
      const activityData = activity as Record<string, unknown>;
      return {
        id: activityData.id as string,
        authorId: activityData.actor as string,
        text: activityData.text as string | undefined,
        images: activityData.images as string[] | undefined,
        videoUrl: activityData.videoUrl as string | undefined,
        createdAt: activityData.time as string,
        // Reaction counts from Stream's enriched data
        likeCount: (activityData.reaction_counts as Record<string, number>)?.like || 0,
        commentCount: (activityData.reaction_counts as Record<string, number>)?.comment || 0,
        repostCount: (activityData.reaction_counts as Record<string, number>)?.repost || 0,
        bookmarkCount: (activityData.reaction_counts as Record<string, number>)?.bookmark || 0,
        // User's own reactions
        hasLiked: (activityData.own_reactions as Record<string, unknown[]>)?.like?.length > 0,
        hasBookmarked: (activityData.own_reactions as Record<string, unknown[]>)?.bookmark?.length > 0,
        hasReposted: (activityData.own_reactions as Record<string, unknown[]>)?.repost?.length > 0,
        // Author data (enriched by Stream)
        author: activityData.actor_data as Record<string, unknown> | undefined,
      };
    });

    // Get next cursor for pagination
    const nextCursor = posts.length === limit ? posts[posts.length - 1]?.id : null;

    return NextResponse.json({
      posts,
      nextCursor,
      hasMore: posts.length === limit,
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
    const { text, images, videoUrl } = body;

    // Validate - must have text or media
    if (!text && !images?.length && !videoUrl) {
      return NextResponse.json(
        { error: 'Post must have text or media' },
        { status: 400 }
      );
    }

    // Get user data for Stream user setup
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (userData) {
      // Ensure user exists in Stream with profile data
      await setupStreamUser(userId, {
        name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User',
        profileImage: userData.avatarUrl || userData.imageUrl,
      });
    }

    // Create the post
    const result = await createPost(userId, organizationId, {
      text,
      images,
      videoUrl,
    });

    return NextResponse.json({
      success: true,
      post: {
        id: result.id,
        authorId: userId,
        text,
        images,
        videoUrl,
        createdAt: result.activity.time,
        likeCount: 0,
        commentCount: 0,
        repostCount: 0,
        bookmarkCount: 0,
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

