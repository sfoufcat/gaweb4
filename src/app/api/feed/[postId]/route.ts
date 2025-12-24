import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
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

    // Get the post
    const postDoc = await adminDb.collection('feed_posts').doc(postId).get();
    if (!postDoc.exists) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const postData = postDoc.data()!;

    // Check ownership or moderation rights
    if (!canModerate && postData.authorId !== userId) {
      return NextResponse.json(
        { error: 'You can only delete your own posts' },
        { status: 403 }
      );
    }

    // Delete the post
    await postDoc.ref.delete();

    // Delete associated reactions
    const reactionsSnapshot = await adminDb
      .collection('feed_reactions')
      .where('postId', '==', postId)
      .get();
    
    const batch = adminDb.batch();
    reactionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete associated comments
    const commentsSnapshot = await adminDb
      .collection('feed_comments')
      .where('postId', '==', postId)
      .get();
    
    commentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();

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

    // Get the post from Firestore
    const postDoc = await adminDb.collection('feed_posts').doc(postId).get();
    if (!postDoc.exists) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const data = postDoc.data()!;

    // Get author data
    const authorDoc = await adminDb.collection('users').doc(data.authorId).get();
    const authorData = authorDoc.data();

    // Get user's reactions for this post
    const userReactionsSnapshot = await adminDb
      .collection('feed_reactions')
      .where('postId', '==', postId)
      .where('userId', '==', userId)
      .get();
    
    const userReactions = new Set(
      userReactionsSnapshot.docs.map(doc => doc.data().type)
    );

    const post = {
      id: postDoc.id,
      authorId: data.authorId,
      text: data.text,
      images: data.images,
      videoUrl: data.videoUrl,
      createdAt: data.createdAt,
      likeCount: data.likeCount || 0,
      commentCount: data.commentCount || 0,
      repostCount: data.repostCount || 0,
      bookmarkCount: data.bookmarkCount || 0,
      hasLiked: userReactions.has('like'),
      hasBookmarked: userReactions.has('bookmark'),
      hasReposted: userReactions.has('repost'),
      // Repost data
      isRepost: data.isRepost || false,
      originalPostId: data.originalPostId,
      originalAuthorId: data.originalAuthorId,
      originalText: data.originalText,
      originalImages: data.originalImages,
      originalVideoUrl: data.originalVideoUrl,
      // Author data
      author: authorData ? {
        id: data.authorId,
        firstName: authorData.firstName,
        lastName: authorData.lastName,
        imageUrl: authorData.avatarUrl || authorData.imageUrl,
        name: `${authorData.firstName || ''} ${authorData.lastName || ''}`.trim(),
      } : undefined,
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
