import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { getStreamFeedsClient } from '@/lib/stream-feeds';
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
    const client = getStreamFeedsClient();
    
    const reactions = await client.reactions.filter({
      user_id: userId,
      kind: 'bookmark',
      limit,
      id_lt: cursor,
    });

    // Get the actual posts for each bookmark
    const cleanOrgId = organizationId.replace('org_', '');
    const orgFeed = client.feed('org', cleanOrgId);
    
    const posts = await Promise.all(
      reactions.results.map(async (reaction) => {
        try {
          const activityId = reaction.activity_id;
          const response = await orgFeed.get({
            id_lte: activityId,
            id_gte: activityId,
            limit: 1,
            enrich: true,
          });
          
          if (!response.results.length) return null;
          
          const activity = response.results[0] as Record<string, unknown>;
          return {
            id: activity.id as string,
            authorId: activity.actor as string,
            text: activity.text as string | undefined,
            images: activity.images as string[] | undefined,
            videoUrl: activity.videoUrl as string | undefined,
            createdAt: activity.time as string,
            bookmarkedAt: reaction.created_at,
            likeCount: (activity.reaction_counts as Record<string, number>)?.like || 0,
            commentCount: (activity.reaction_counts as Record<string, number>)?.comment || 0,
            author: activity.actor_data as Record<string, unknown> | undefined,
            hasBookmarked: true,
          };
        } catch {
          // Post may have been deleted
          return null;
        }
      })
    );

    // Filter out nulls (deleted posts)
    const validPosts = posts.filter(Boolean);

    const nextCursor = reactions.results.length === limit 
      ? reactions.results[reactions.results.length - 1]?.id 
      : null;

    return NextResponse.json({
      posts: validPosts,
      nextCursor,
      hasMore: reactions.results.length === limit,
    });
  } catch (error) {
    console.error('[FEED_BOOKMARKS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get bookmarks' },
      { status: 500 }
    );
  }
}

