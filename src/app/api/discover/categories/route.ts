/**
 * API Route: Get Discover Categories
 * 
 * GET /api/discover/categories - Get all categories
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const categoriesSnapshot = await adminDb
      .collection('discoverCategories')
      .get();

    const categories = categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('[DISCOVER_CATEGORIES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories', categories: [] },
      { status: 500 }
    );
  }
}











