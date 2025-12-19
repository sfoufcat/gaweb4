/**
 * Admin API: Single Article Management
 * 
 * GET /api/admin/discover/articles/[articleId] - Get article details
 * PATCH /api/admin/discover/articles/[articleId] - Update article
 * DELETE /api/admin/discover/articles/[articleId] - Delete article
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canManageDiscoverContent } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { articleId } = await params;
    const articleDoc = await adminDb.collection('articles').doc(articleId).get();

    if (!articleDoc.exists) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const articleData = articleDoc.data();
    const article = {
      id: articleDoc.id,
      ...articleData,
      publishedAt: articleData?.publishedAt?.toDate?.()?.toISOString?.() || articleData?.publishedAt,
      createdAt: articleData?.createdAt?.toDate?.()?.toISOString?.() || articleData?.createdAt,
      updatedAt: articleData?.updatedAt?.toDate?.()?.toISOString?.() || articleData?.updatedAt,
    };

    return NextResponse.json({ article });
  } catch (error) {
    console.error('[ADMIN_ARTICLE_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { articleId } = await params;
    const body = await request.json();

    // Check if article exists
    const articleDoc = await adminDb.collection('articles').doc(articleId).get();
    if (!articleDoc.exists) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Validate articleType if provided
    const validArticleTypes = ['playbook', 'trend', 'caseStudy'];
    if (body.articleType && !validArticleTypes.includes(body.articleType)) {
      return NextResponse.json(
        { error: `Invalid article type. Must be one of: ${validArticleTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate track if provided
    const validTracks = ['content_creator', 'saas', 'coach_consultant', 'ecom', 'agency', 'community_builder', 'general'];
    if (body.track && !validTracks.includes(body.track)) {
      return NextResponse.json(
        { error: `Invalid track. Must be one of: ${validTracks.join(', ')}` },
        { status: 400 }
      );
    }

    // Only update fields that are provided
    const allowedFields = [
      'title', 'coverImageUrl', 'content', 'authorName', 'authorTitle',
      'authorAvatarUrl', 'authorBio', 'publishedAt', 'category', 'articleType', 'track', 'featured', 'trending'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'publishedAt' && body[field]) {
          updateData[field] = new Date(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Recalculate reading time if content changed
    if (body.content) {
      const wordCount = body.content.split(/\s+/).length;
      updateData.readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
    }

    await adminDb.collection('articles').doc(articleId).update(updateData);

    return NextResponse.json({ 
      success: true, 
      message: 'Article updated successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_ARTICLE_PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update article' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { articleId } = await params;

    // Check if article exists
    const articleDoc = await adminDb.collection('articles').doc(articleId).get();
    if (!articleDoc.exists) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    await adminDb.collection('articles').doc(articleId).delete();

    return NextResponse.json({ 
      success: true, 
      message: 'Article deleted successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_ARTICLE_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete article' },
      { status: 500 }
    );
  }
}



