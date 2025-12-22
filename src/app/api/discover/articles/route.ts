/**
 * API Route: Get Discover Articles
 * 
 * GET /api/discover/articles - Get all articles
 * 
 * Multi-tenancy: If user belongs to an organization, only show org's articles.
 * Otherwise, show all articles (default GA experience).
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { ClerkPublicMetadata } from '@/types';

export async function GET() {
  try {
    const { sessionClaims } = await auth();
    
    // MULTI-TENANCY: Get effective org ID (domain-based in tenant mode, session-based in platform mode)
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);
    
    let query: FirebaseFirestore.Query = adminDb.collection('articles');
    
    if (organizationId) {
      // User belongs to an org - show only their org's content
      query = query.where('organizationId', '==', organizationId);
    }
    // else: no org = show all content (global GA experience)
    
    const articlesSnapshot = await query.get();

    const articles = articlesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      publishedAt: doc.data().publishedAt?.toDate?.()?.toISOString?.() || doc.data().publishedAt,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    // Sort in memory by publishedAt descending
    articles.sort((a, b) => new Date(b.publishedAt as string).getTime() - new Date(a.publishedAt as string).getTime());

    return NextResponse.json({ articles });
  } catch (error) {
    console.error('[DISCOVER_ARTICLES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles', articles: [] },
      { status: 500 }
    );
  }
}











