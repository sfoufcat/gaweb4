/**
 * API Route: Get Discover Articles
 * 
 * GET /api/discover/articles - Get all articles
 * 
 * Multi-tenancy: If user belongs to an organization, only show org's articles.
 * Otherwise, show all articles (default GA experience).
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateDemoDiscoverContent } from '@/lib/demo-data';

export async function GET() {
  try {
    // Demo mode: return demo articles
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const demoContent = generateDemoDiscoverContent();
      const demoArticles = demoContent.filter(c => c.type === 'article').map(a => ({
        id: a.id,
        organizationId: 'demo-org',
        title: a.title,
        description: a.description,
        content: `<p>${a.description}</p><p>This is sample article content for the demo.</p>`,
        coverImageUrl: a.imageUrl,
        author: a.author,
        isPublished: a.isPublished,
        isPremium: a.isPremium,
        readTime: a.readTime || 5,
        publishedAt: a.publishedAt,
        createdAt: a.publishedAt,
        updatedAt: a.publishedAt,
      }));
      return demoResponse({ articles: demoArticles });
    }
    
    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    
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











