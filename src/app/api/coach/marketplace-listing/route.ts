import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import type { MarketplaceListing, CreateMarketplaceListingInput, UpdateMarketplaceListingInput } from '@/types';

/**
 * GET /api/coach/marketplace-listing
 * Get the marketplace listing for the coach's organization
 * 
 * Returns null if no listing exists yet
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Get listing for this org (one per org)
    const listingsSnapshot = await adminDb
      .collection('marketplace_listings')
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (listingsSnapshot.empty) {
      return NextResponse.json({ listing: null });
    }

    const doc = listingsSnapshot.docs[0];
    const listing = { id: doc.id, ...doc.data() } as MarketplaceListing;

    return NextResponse.json({ listing });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_MARKETPLACE_LISTING_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/marketplace-listing
 * Create or update the marketplace listing for the coach's organization
 * 
 * Body:
 * - enabled: boolean
 * - title: string (required when enabled)
 * - description: string (required when enabled)
 * - coverImageUrl: string (required when enabled)
 * - funnelId: string (required when enabled)
 * - categories?: string[]
 */
export async function POST(req: Request) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();

    const body = await req.json();
    const { 
      enabled,
      title, 
      description, 
      coverImageUrl, 
      funnelId,
      categories,
    } = body as UpdateMarketplaceListingInput & { enabled?: boolean };

    // If enabling, validate required fields
    if (enabled) {
      if (!title?.trim()) {
        return NextResponse.json({ error: 'Title is required when enabling listing' }, { status: 400 });
      }
      if (!description?.trim()) {
        return NextResponse.json({ error: 'Description is required when enabling listing' }, { status: 400 });
      }
      if (!coverImageUrl) {
        return NextResponse.json({ error: 'Cover image is required when enabling listing' }, { status: 400 });
      }
      if (!funnelId) {
        return NextResponse.json({ error: 'Funnel selection is required when enabling listing' }, { status: 400 });
      }

      // Verify funnel belongs to this org
      const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
      if (!funnelDoc.exists) {
        return NextResponse.json({ error: 'Selected funnel not found' }, { status: 404 });
      }
      const funnelData = funnelDoc.data();
      if (funnelData?.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Funnel does not belong to your organization' }, { status: 403 });
      }
    }

    // Get org info for denormalized fields
    const orgDomainSnapshot = await adminDb
      .collection('org_domains')
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();
    
    const subdomain = orgDomainSnapshot.empty ? null : orgDomainSnapshot.docs[0].data().subdomain;

    // Get coach/org branding info
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
    const brandingData = brandingDoc.data();
    const coachName = brandingData?.appTitle || 'Coach';
    const coachAvatarUrl = brandingData?.logoUrl;

    // Build searchable text
    const searchableText = [
      title?.toLowerCase(),
      description?.toLowerCase(),
      coachName?.toLowerCase(),
    ].filter(Boolean).join(' ');

    const now = new Date().toISOString();

    // Check if listing already exists
    const existingSnapshot = await adminDb
      .collection('marketplace_listings')
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    let listing: MarketplaceListing;

    if (existingSnapshot.empty) {
      // Create new listing
      const listingData: Omit<MarketplaceListing, 'id'> = {
        organizationId,
        enabled: enabled ?? false,
        title: title?.trim() || '',
        description: description?.trim() || '',
        coverImageUrl: coverImageUrl || '',
        funnelId: funnelId || '',
        coachName,
        coachAvatarUrl,
        subdomain: subdomain || undefined,
        searchableText,
        categories: categories || [],
        viewCount: 0,
        clickCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await adminDb.collection('marketplace_listings').add(listingData);
      listing = { id: docRef.id, ...listingData };

      console.log(`[COACH_MARKETPLACE_LISTING] Created listing ${docRef.id} for org ${organizationId}`);
    } else {
      // Update existing listing
      const docRef = existingSnapshot.docs[0].ref;
      const existingData = existingSnapshot.docs[0].data() as MarketplaceListing;

      const updateData: Partial<MarketplaceListing> = {
        enabled: enabled ?? existingData.enabled,
        title: title?.trim() ?? existingData.title,
        description: description?.trim() ?? existingData.description,
        coverImageUrl: coverImageUrl ?? existingData.coverImageUrl,
        funnelId: funnelId ?? existingData.funnelId,
        coachName,
        coachAvatarUrl,
        subdomain: subdomain || undefined,
        searchableText,
        categories: categories ?? existingData.categories,
        updatedAt: now,
      };

      await docRef.update(updateData);
      listing = { ...existingData, ...updateData, id: existingSnapshot.docs[0].id };

      console.log(`[COACH_MARKETPLACE_LISTING] Updated listing ${listing.id} for org ${organizationId}`);
    }

    return NextResponse.json({ success: true, listing });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_MARKETPLACE_LISTING_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

