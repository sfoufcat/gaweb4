import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
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
      content: data.content,
      contentHtml: data.contentHtml,
      images: data.images,
      videoUrl: data.videoUrl,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
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

/**
 * PUT /api/feed/[postId]
 * Update a post (author only)
 */
export async function PUT(
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

    // Get the post
    const postDoc = await adminDb.collection('feed_posts').doc(postId).get();
    if (!postDoc.exists) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const postData = postDoc.data()!;

    // Check ownership - only the author can edit
    if (postData.authorId !== userId) {
      return NextResponse.json(
        { error: 'You can only edit your own posts' },
        { status: 403 }
      );
    }

    // Cannot edit reposts
    if (postData.isRepost) {
      return NextResponse.json(
        { error: 'Cannot edit reposted content' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { text, images, videoUrl, content, contentHtml } = body;

    // Validate - must have either text/content or media
    const hasText = text?.trim() || content;
    const hasMedia = (images && images.length > 0) || videoUrl;
    
    if (!hasText && !hasMedia) {
      return NextResponse.json(
        { error: 'Post must have text or media' },
        { status: 400 }
      );
    }

    // Update the post
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only update fields that were provided
    if (text !== undefined) {
      updateData.text = text.trim();
    }
    if (content !== undefined) {
      updateData.content = content; // TipTap JSON content
    }
    if (contentHtml !== undefined) {
      updateData.contentHtml = contentHtml; // HTML for rendering
    }
    if (images !== undefined) {
      updateData.images = images;
    }
    if (videoUrl !== undefined) {
      updateData.videoUrl = videoUrl;
    }

    await postDoc.ref.update(updateData);

    // Return updated post
    const updatedDoc = await postDoc.ref.get();
    const updatedData = updatedDoc.data()!;

    return NextResponse.json({
      success: true,
      post: {
        id: postId,
        authorId: updatedData.authorId,
        text: updatedData.text,
        content: updatedData.content,
        contentHtml: updatedData.contentHtml,
        images: updatedData.images,
        videoUrl: updatedData.videoUrl,
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || updatedData.createdAt,
        updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[FEED_UPDATE_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    );
  }
}
