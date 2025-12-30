import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { MarketplaceListing, Funnel, OrgCustomDomain, PlatformSettings, DecoyListing } from '@/types';
import { getAllDecoys } from '@/lib/config/decoy-listings';

/**
 * GET /api/marketplace/listings
 * Get all enabled marketplace listings (public endpoint)
 * 
 * Query params:
 * - search?: string (search query)
 * - category?: string (filter by category)
 * - limit?: number (default 50)
 * 
 * Also includes decoy listings if enabled in platform settings.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase().trim();
    const category = searchParams.get('category');
    const limitParam = searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '50', 10), 100);

    // Check if decoys are enabled via platform settings
    let decoysEnabled = false;
    try {
      const settingsDoc = await adminDb
        .collection('platform_settings')
        .doc('global')
        .get();
      
      if (settingsDoc.exists) {
        const settings = settingsDoc.data() as PlatformSettings;
        decoysEnabled = settings.marketplaceDecoysEnabled ?? false;
      }
    } catch (err) {
      console.error('[MARKETPLACE_LISTINGS] Failed to fetch platform settings:', err);
      // Continue without decoys if settings fetch fails
    }

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

    // Add decoy listings if enabled
    let allListings: Array<typeof filteredListings[number] | (DecoyListing & { funnelSlug: null; programSlug: null; customDomain: null })> = [...filteredListings];
    
    if (decoysEnabled) {
      let decoys = getAllDecoys();
      
      // Filter decoys by category if category filter is applied
      if (category && category !== 'all') {
        decoys = decoys.filter(d => d.categories.includes(category as never));
      }
      
      // Filter decoys by search if search is applied
      if (search) {
        decoys = decoys.filter(d => 
          d.title?.toLowerCase().includes(search) ||
          d.description?.toLowerCase().includes(search) ||
          d.coachName?.toLowerCase().includes(search)
        );
      }
      
      // Convert decoys to match listing format (add null fields for URLs)
      const decoyListings = decoys.map(d => ({
        ...d,
        funnelSlug: null as null,
        programSlug: null as null,
        customDomain: null as null,
      }));
      
      // Mix decoys with real listings (insert at various positions for natural feel)
      // Strategy: Insert a decoy after every 2-3 real listings
      const mixed: typeof allListings = [];
      let decoyIndex = 0;
      
      for (let i = 0; i < filteredListings.length; i++) {
        mixed.push(filteredListings[i]);
        
        // Insert a decoy after every 2 real listings (if we have decoys left)
        if ((i + 1) % 2 === 0 && decoyIndex < decoyListings.length) {
          mixed.push(decoyListings[decoyIndex]);
          decoyIndex++;
        }
      }
      
      // Add any remaining decoys at the end
      while (decoyIndex < decoyListings.length) {
        mixed.push(decoyListings[decoyIndex]);
        decoyIndex++;
      }
      
      allListings = mixed;
    }

    return NextResponse.json({ 
      listings: allListings,
      totalCount: allListings.length,
    });
  } catch (error) {
    console.error('[MARKETPLACE_LISTINGS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

