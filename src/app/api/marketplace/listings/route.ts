import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { MarketplaceListing, Funnel, OrgCustomDomain } from '@/types';

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

    const listings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as MarketplaceListing[];

    // Collect unique organization IDs to batch-fetch custom domains
    const orgIds = [...new Set(listings.map(l => l.organizationId).filter(Boolean))];
    
    // Fetch all verified custom domains for these organizations in one query
    const customDomainsMap = new Map<string, string>();
    if (orgIds.length > 0) {
      // Firestore 'in' queries support up to 30 items, so batch if needed
      const batchSize = 30;
      for (let i = 0; i < orgIds.length; i += batchSize) {
        const batchOrgIds = orgIds.slice(i, i + batchSize);
        const customDomainsSnapshot = await adminDb
          .collection('org_custom_domains')
          .where('organizationId', 'in', batchOrgIds)
          .where('status', '==', 'verified')
          .get();
        
        customDomainsSnapshot.docs.forEach(doc => {
          const domainData = doc.data() as OrgCustomDomain;
          // Only set if not already set (first verified domain wins)
          if (!customDomainsMap.has(domainData.organizationId)) {
            customDomainsMap.set(domainData.organizationId, domainData.domain);
          }
        });
      }
    }

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
        
        // Get verified custom domain for this organization (preferred over subdomain)
        const customDomain = customDomainsMap.get(listing.organizationId) || null;
        
        return {
          ...listing,
          funnelSlug,
          programSlug,
          customDomain,
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

