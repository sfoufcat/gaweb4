/**
 * Coach API: Organization-scoped Articles Management
 * 
 * GET /api/coach/org-discover/articles - List articles in coach's organization
 * POST /api/coach/org-discover/articles - Create new article in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_ARTICLES] Fetching articles for organization: ${organizationId}`);

    const articlesSnapshot = await adminDb
      .collection('articles')
      .where('organizationId', '==', organizationId)
      .orderBy('publishedAt', 'desc')
      .get();

    const articles = articlesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      publishedAt: doc.data().publishedAt?.toDate?.()?.toISOString?.() || doc.data().publishedAt,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ 
      articles,
      totalCount: articles.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_ARTICLES_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['title', 'coverImageUrl', 'content', 'authorName', 'authorTitle'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Calculate reading time (rough estimate: 200 words per minute)
    const wordCount = body.content.split(/\s+/).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

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

    const articleData = {
      title: body.title,
      coverImageUrl: body.coverImageUrl,
      content: body.content,
      authorName: body.authorName,
      authorTitle: body.authorTitle,
      authorAvatarUrl: body.authorAvatarUrl || null,
      authorBio: body.authorBio || null,
      publishedAt: body.publishedAt || new Date().toISOString(),
      readingTimeMinutes,
      category: body.category || null,
      articleType: body.articleType || null,
      track: body.track || null,
      featured: body.featured || false,
      trending: body.trending || false,
      organizationId, // Scope to coach's organization
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('articles').add(articleData);

    console.log(`[COACH_ORG_ARTICLES] Created article ${docRef.id} in organization ${organizationId}`);

    return NextResponse.json({
      id: docRef.id,
      ...articleData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_ORG_ARTICLES_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}
