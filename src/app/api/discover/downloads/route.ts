/**
 * API Route: Get Discover Downloads
 * 
 * GET /api/discover/downloads - Get all public downloads
 * 
 * Multi-tenancy: If user belongs to an organization, only show org's downloads.
 * Otherwise, show all downloads (default GA experience).
 * 
 * Excludes downloads the user has already purchased (handled client-side for now).
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateDemoDiscoverContent } from '@/lib/demo-data';
import type { DiscoverDownload } from '@/types/discover';

export async function GET() {
  try {
    // Demo mode: return demo downloads
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const demoContent = generateDemoDiscoverContent();
      const demoDownloads = demoContent.filter(c => c.type === 'download').map((d, i) => ({
        id: d.id,
        organizationId: 'demo-org',
        title: d.title,
        description: d.description,
        fileUrl: '#',
        fileType: 'pdf',
        fileSize: 1024 * (500 + i * 200), // 500KB - 900KB
        thumbnailUrl: d.imageUrl,
        isPublic: true,
        priceInCents: d.priceInCents || 0,
        currency: d.currency || 'usd',
        purchaseType: d.purchaseType || 'popup',
        coachName: d.author,
        coachImageUrl: d.authorImageUrl,
        createdAt: d.publishedAt,
        updatedAt: d.publishedAt,
      }));
      return demoResponse({ downloads: demoDownloads });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    
    let query: FirebaseFirestore.Query = adminDb.collection('program_downloads');
    
    if (organizationId) {
      // User belongs to an org - show only their org's content
      query = query.where('organizationId', '==', organizationId);
    }
    // else: no org = show all content (global GA experience)
    
    const downloadsSnapshot = await query.get();

    const downloads: DiscoverDownload[] = [];
    
    for (const doc of downloadsSnapshot.docs) {
      const data = doc.data();
      
      // Only include public downloads (isPublic undefined or true)
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
      
      downloads.push({
        id: doc.id,
        title: data.title,
        description: data.description,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
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
    downloads.sort((a, b) => {
      if (a.order !== b.order) {
        return (a.order || 0) - (b.order || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ downloads });
  } catch (error) {
    console.error('[DISCOVER_DOWNLOADS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch downloads', downloads: [] },
      { status: 500 }
    );
  }
}

