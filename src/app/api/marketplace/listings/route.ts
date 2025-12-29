import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { MarketplaceListing, Funnel } from '@/types';

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

    // Fetch funnel slugs for each listing to build proper URLs
    const listingsWithFunnelUrls = await Promise.all(
      listings.map(async (listing) => {
        let funnelSlug: string | null = null;
        let programSlug: string | null = null;
        
        if (listing.funnelId) {
          try {
            const funnelDoc = await adminDb.collection('funnels').doc(listing.funnelId).get();
            if (funnelDoc.exists) {
              const funnelData = funnelDoc.data() as Funnel;
              funnelSlug = funnelData.slug || null;
              
              // If funnel has a programId, get the program slug too
              if (funnelData.programId) {
                const programDoc = await adminDb.collection('programs').doc(funnelData.programId).get();
                if (programDoc.exists) {
                  programSlug = programDoc.data()?.slug || null;
                }
              }
            }
          } catch (err) {
            console.error(`[MARKETPLACE_LISTINGS] Failed to fetch funnel ${listing.funnelId}:`, err);
          }
        }
        
        return {
          ...listing,
          funnelSlug,
          programSlug,
        };
      })
    );

    // Client-side search filter (Firestore doesn't support full-text search)
    let filteredListings = listingsWithFunnelUrls;
    if (search) {
      filteredListings = listingsWithFunnelUrls.filter(listing => 
        listing.searchableText?.includes(search) ||
        listing.title?.toLowerCase().includes(search) ||
        listing.description?.toLowerCase().includes(search) ||
        listing.coachName?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ 
      listings: filteredListings,
      totalCount: filteredListings.length,
    });
  } catch (error) {
    console.error('[MARKETPLACE_LISTINGS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

