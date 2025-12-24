import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { searchPosts } from '@/lib/stream-feeds';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/feed/search
 * Search posts by text content
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

    // Search posts
    const results = await searchPosts(organizationId, query.trim(), { limit });

    // Transform results
    const posts = results.map((activity) => {
      const activityData = activity as Record<string, unknown>;
      return {
        id: activityData.id as string,
        authorId: activityData.actor as string,
        text: activityData.text as string | undefined,
        images: activityData.images as string[] | undefined,
        videoUrl: activityData.videoUrl as string | undefined,
        createdAt: activityData.time as string,
        likeCount: (activityData.reaction_counts as Record<string, number>)?.like || 0,
        commentCount: (activityData.reaction_counts as Record<string, number>)?.comment || 0,
        author: activityData.actor_data as Record<string, unknown> | undefined,
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

