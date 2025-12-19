/**
 * API Route: Get Discover Articles
 * 
 * GET /api/discover/articles - Get all articles
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
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
    console.error('[DISCOVER_ARTICLES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles', articles: [] },
      { status: 500 }
    );
  }
}











