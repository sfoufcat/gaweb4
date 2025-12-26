/**
 * Coach API: Single Article Management (Organization-scoped)
 * 
 * GET /api/coach/org-discover/articles/[articleId] - Get article details
 * PATCH /api/coach/org-discover/articles/[articleId] - Update article
 * DELETE /api/coach/org-discover/articles/[articleId] - Delete article
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { articleId } = await params;
    const articleDoc = await adminDb.collection('articles').doc(articleId).get();

    if (!articleDoc.exists) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const articleData = articleDoc.data();
    
    // Verify the article belongs to this organization
    if (articleData?.organizationId && articleData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const article = {
      id: articleDoc.id,
      ...articleData,
      publishedAt: articleData?.publishedAt?.toDate?.()?.toISOString?.() || articleData?.publishedAt,
      createdAt: articleData?.createdAt?.toDate?.()?.toISOString?.() || articleData?.createdAt,
      updatedAt: articleData?.updatedAt?.toDate?.()?.toISOString?.() || articleData?.updatedAt,
    };

    return NextResponse.json({ article });
  } catch (error) {
    console.error('[COACH_ORG_ARTICLE_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { articleId } = await params;
    const body = await request.json();

    // Check if article exists
    const articleDoc = await adminDb.collection('articles').doc(articleId).get();
    if (!articleDoc.exists) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const articleData = articleDoc.data();
    
    // Verify the article belongs to this organization
    if (articleData?.organizationId && articleData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Validate programIds if provided
    if (body.programIds && !Array.isArray(body.programIds)) {
      return NextResponse.json(
        { error: 'programIds must be an array' },
        { status: 400 }
      );
    }

    // Only update fields that are provided
    // Note: authorId is new for dynamic bio lookup
    // articleType and track are deprecated but still supported for backward compatibility
    const allowedFields = [
      'title', 'coverImageUrl', 'thumbnailUrl', 'content', 
      'authorId', 'authorName', 'authorTitle', 'authorAvatarUrl', 'authorBio',
      'publishedAt', 'category', 'articleType', 'track', 'programIds', 
      'featured', 'trending'
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

    console.log(`[COACH_ORG_ARTICLE] Updated article ${articleId} in organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Article updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_ARTICLE_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { articleId } = await params;

    // Check if article exists
    const articleDoc = await adminDb.collection('articles').doc(articleId).get();
    if (!articleDoc.exists) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const articleData = articleDoc.data();
    
    // Verify the article belongs to this organization
    if (articleData?.organizationId && articleData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    await adminDb.collection('articles').doc(articleId).delete();

    console.log(`[COACH_ORG_ARTICLE] Deleted article ${articleId} from organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Article deleted successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_ARTICLE_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}

