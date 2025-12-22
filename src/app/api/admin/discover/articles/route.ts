/**
 * Admin API: Discover Articles Management
 * 
 * GET /api/admin/discover/articles - List all articles
 * POST /api/admin/discover/articles - Create new article
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canManageDiscoverContent } from '@/lib/admin-utils-shared';
import { getCurrentUserRole } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const articlesSnapshot = await adminDb
      .collection('articles')
      .orderBy('publishedAt', 'desc')
      .get();

    const articles = articlesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      publishedAt: doc.data().publishedAt?.toDate?.()?.toISOString?.() || doc.data().publishedAt,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ articles });
  } catch (error) {
    console.error('[ADMIN_ARTICLES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
      authorAvatarUrl: body.authorAvatarUrl || '',
      authorBio: body.authorBio || '',
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : FieldValue.serverTimestamp(),
      readingTimeMinutes,
      category: body.category || '',
      articleType: body.articleType || 'playbook', // Default to playbook
      track: body.track || null, // Track-specific content (deprecated)
      programIds: Array.isArray(body.programIds) ? body.programIds : [], // New: program association
      featured: body.featured || false,
      trending: body.trending || false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('articles').add(articleData);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      message: 'Article created successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_ARTICLES_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create article' },
      { status: 500 }
    );
  }
}



