/**
 * API Route: Get Single Article
 * 
 * GET /api/discover/articles/[id] - Get article by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const articleDoc = await adminDb.collection('articles').doc(id).get();
    
    if (!articleDoc.exists) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
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
    console.error('[DISCOVER_ARTICLE_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}











