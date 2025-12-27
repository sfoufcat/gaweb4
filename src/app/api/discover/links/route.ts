/**
 * API Route: Get Discover Links
 * 
 * GET /api/discover/links - Get all public links
 * 
 * Multi-tenancy: If user belongs to an organization, only show org's links.
 * Otherwise, show all links (default GA experience).
 * 
 * Excludes links the user has already purchased (handled client-side for now).
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { DiscoverLink } from '@/types/discover';

export async function GET() {
  try {
    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    
    let query: FirebaseFirestore.Query = adminDb.collection('program_links');
    
    if (organizationId) {
      // User belongs to an org - show only their org's content
      query = query.where('organizationId', '==', organizationId);
    }
    // else: no org = show all content (global GA experience)
    
    const linksSnapshot = await query.get();

    const links: DiscoverLink[] = [];
    
    for (const doc of linksSnapshot.docs) {
      const data = doc.data();
      
      // Only include public links (isPublic undefined or true)
      if (data.isPublic === false) continue;
      
      // Get coach info if organizationId exists
      let coachName: string | undefined;
      let coachImageUrl: string | undefined;
      
      if (data.organizationId) {
        const orgSettingsDoc = await adminDb
          .collection('org_settings')
          .doc(data.organizationId)
          .get();
        
        if (orgSettingsDoc.exists) {
          const orgSettings = orgSettingsDoc.data();
          coachName = orgSettings?.coachDisplayName;
          coachImageUrl = orgSettings?.coachAvatarUrl;
        }
      }
      
      links.push({
        id: doc.id,
        title: data.title,
        description: data.description,
        url: data.url,
        thumbnailUrl: data.thumbnailUrl,
        programIds: data.programIds,
        organizationId: data.organizationId,
        order: data.order,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || new Date().toISOString(),
        // Pricing fields
        priceInCents: data.priceInCents,
        currency: data.currency,
        purchaseType: data.purchaseType,
        isPublic: data.isPublic,
        keyOutcomes: data.keyOutcomes,
        features: data.features,
        testimonials: data.testimonials,
        faqs: data.faqs,
        // Coach info
        coachName,
        coachImageUrl,
      });
    }

    // Sort by order, then by createdAt descending
    links.sort((a, b) => {
      if (a.order !== b.order) {
        return (a.order || 0) - (b.order || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ links });
  } catch (error) {
    console.error('[DISCOVER_LINKS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch links', links: [] },
      { status: 500 }
    );
  }
}

