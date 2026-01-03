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
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import type { DiscoverLink } from '@/types/discover';

export async function GET() {
  try {
    // Demo mode: return demo links
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const demoLinks = [
        {
          id: 'demo-link-1',
          organizationId: 'demo-org',
          title: 'Recommended Reading List',
          description: 'Curated list of must-read books for personal growth',
          url: 'https://example.com/reading-list',
          thumbnailUrl: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400&h=300&fit=crop',
          isPublic: true,
          priceInCents: 0,
          currency: 'usd',
          purchaseType: 'popup' as const,
          coachName: 'Coach Adam',
          coachImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'demo-link-2',
          organizationId: 'demo-org',
          title: 'Productivity Tools Guide',
          description: 'My favorite tools for staying organized and focused',
          url: 'https://example.com/tools-guide',
          thumbnailUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=300&fit=crop',
          isPublic: true,
          priceInCents: 0,
          currency: 'usd',
          purchaseType: 'popup' as const,
          coachName: 'Coach Adam',
          coachImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      return demoResponse({ links: demoLinks });
    }

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

