import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { deletePost, getStreamFeedsClient } from '@/lib/stream-feeds';
import { adminDb } from '@/lib/firebase-admin';
import { isAdmin, canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { UserRole, OrgRole } from '@/types';

/**
 * DELETE /api/feed/[postId]
 * Delete a post (author or coach/admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org from tenant context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Get user role
    const publicMetadata = sessionClaims?.publicMetadata as {
      role?: UserRole;
      orgRole?: OrgRole;
    } | undefined;
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;
    const canModerate = isAdmin(role) || canAccessCoachDashboard(role, orgRole);

    // Get the post to check ownership
    const client = getStreamFeedsClient();
    
    // We need to find who owns this post to delete it from their feed
    // For now, try to delete from the requester's feed (they can only delete their own)
    // Coaches can delete from anyone's feed
    
    if (!canModerate) {
      // Regular user - can only delete their own posts
      try {
        await deletePost(userId, postId);
      } catch {
        return NextResponse.json(
          { error: 'You can only delete your own posts' },
          { status: 403 }
        );
      }
    } else {
      // Coach/Admin - can delete any post
      // We need to find the activity and delete it
      try {
        // Get activity details first
        const cleanOrgId = organizationId.replace('org_', '');
        const orgFeed = client.feed('org', cleanOrgId);
        
        // Delete the activity by ID
        await orgFeed.removeActivity(postId);
      } catch (error) {
        console.error('[FEED_DELETE] Error deleting post:', error);
        return NextResponse.json(
          { error: 'Failed to delete post' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FEED_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feed/[postId]
 * Get a single post by ID
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

    // Get org from tenant context
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

    // Get the activity from Stream
    const client = getStreamFeedsClient();
    const cleanOrgId = organizationId.replace('org_', '');
    const orgFeed = client.feed('org', cleanOrgId);
    
    // Get activities with this ID
    const response = await orgFeed.get({
      id_lte: postId,
      id_gte: postId,
      limit: 1,
      enrich: true,
    });

    if (!response.results.length) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const activity = response.results[0] as Record<string, unknown>;
    
    const post = {
      id: activity.id as string,
      authorId: activity.actor as string,
      text: activity.text as string | undefined,
      images: activity.images as string[] | undefined,
      videoUrl: activity.videoUrl as string | undefined,
      createdAt: activity.time as string,
      likeCount: (activity.reaction_counts as Record<string, number>)?.like || 0,
      commentCount: (activity.reaction_counts as Record<string, number>)?.comment || 0,
      repostCount: (activity.reaction_counts as Record<string, number>)?.repost || 0,
      bookmarkCount: (activity.reaction_counts as Record<string, number>)?.bookmark || 0,
      hasLiked: (activity.own_reactions as Record<string, unknown[]>)?.like?.length > 0,
      hasBookmarked: (activity.own_reactions as Record<string, unknown[]>)?.bookmark?.length > 0,
      hasReposted: (activity.own_reactions as Record<string, unknown[]>)?.repost?.length > 0,
      author: activity.actor_data as Record<string, unknown> | undefined,
    };

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[FEED_GET_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get post' },
      { status: 500 }
    );
  }
}

