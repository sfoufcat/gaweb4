import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { MarketplaceListing } from '@/types';

/**
 * GET /api/marketplace/listings
 * Get all enabled marketplace listings (public endpoint)
 * 
 * Query params:
 * - search?: string (search query)
 * - category?: string (filter by category)
 * - limit?: number (default 50)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase().trim();
    const category = searchParams.get('category');
    const limitParam = searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '50', 10), 100);

    // Build query - only enabled listings
    let query = adminDb
      .collection('marketplace_listings')
      .where('enabled', '==', true);

    // If category filter is applied
    if (category && category !== 'all') {
      query = query.where('categories', 'array-contains', category);
    }

    // Execute query
    const snapshot = await query
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();

    let listings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as MarketplaceListing[];

    // Client-side search filter (Firestore doesn't support full-text search)
    if (search) {
      listings = listings.filter(listing => 
        listing.searchableText?.includes(search) ||
        listing.title?.toLowerCase().includes(search) ||
        listing.description?.toLowerCase().includes(search) ||
        listing.coachName?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ 
      listings,
      totalCount: listings.length,
    });
  } catch (error) {
    console.error('[MARKETPLACE_LISTINGS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

