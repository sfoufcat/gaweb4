/**
 * API Route: Get Single Article
 * 
 * GET /api/discover/articles/[id] - Get article by ID with ownership status
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs/server';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateDemoDiscoverContent, generateAvatarUrl } from '@/lib/demo-data';
import type { DiscoverArticle } from '@/types/discover';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Demo mode: return demo article
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const content = generateDemoDiscoverContent();
      const articles = content.filter(item => item.type === 'article');
      const article = articles.find(a => a.id === id) || articles[0];
      
      return demoResponse({
        article: {
          id: article.id,
          title: article.title,
          coverImageUrl: article.imageUrl,
          thumbnailUrl: article.imageUrl,
          content: `<h2>Introduction</h2><p>${article.description}</p><p>This is demo content for the article "${article.title}". In a real implementation, this would contain the full article content with rich text formatting, images, and detailed insights.</p><h2>Key Takeaways</h2><ul><li>Important point one</li><li>Important point two</li><li>Important point three</li></ul><h2>Conclusion</h2><p>Apply these insights to your daily routine and watch your results transform.</p>`,
          authorId: 'demo-coach-user',
          authorName: article.author,
          authorTitle: 'Professional Coach',
          authorAvatarUrl: generateAvatarUrl(article.author),
          authorBio: 'Helping you achieve your goals through proven strategies and daily action.',
          publishedAt: article.publishedAt,
          readingTimeMinutes: article.readTime || 5,
          category: 'growth',
          articleType: 'long_form',
          organizationId: 'demo-org',
          featured: false,
          trending: false,
          createdAt: article.publishedAt,
          updatedAt: article.publishedAt,
          isPublic: !article.isPremium,
          coachName: 'Coach Adam',
          coachImageUrl: generateAvatarUrl('Coach Adam'),
        },
        isOwned: true, // In demo mode, user "owns" all content
      });
    }
    
    const { userId } = await auth();
    
    const articleDoc = await adminDb.collection('articles').doc(id).get();
    
    if (!articleDoc.exists) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    const articleData = articleDoc.data();
    
    // Get coach info if organizationId exists
    let coachName: string | undefined;
    let coachImageUrl: string | undefined;
    
    if (articleData?.organizationId) {
      const orgSettingsDoc = await adminDb
        .collection('org_settings')
        .doc(articleData.organizationId)
        .get();
      
      if (orgSettingsDoc.exists) {
        const orgSettings = orgSettingsDoc.data();
        coachName = orgSettings?.coachDisplayName;
        coachImageUrl = orgSettings?.coachAvatarUrl;
      }
    }

    const article: DiscoverArticle & { coachName?: string; coachImageUrl?: string } = {
      id: articleDoc.id,
      title: articleData?.title,
      coverImageUrl: articleData?.coverImageUrl,
      thumbnailUrl: articleData?.thumbnailUrl,
      content: articleData?.content,
      authorId: articleData?.authorId,
      authorName: articleData?.authorName,
      authorTitle: articleData?.authorTitle,
      authorAvatarUrl: articleData?.authorAvatarUrl,
      authorBio: articleData?.authorBio,
      publishedAt: articleData?.publishedAt?.toDate?.()?.toISOString?.() || articleData?.publishedAt,
      readingTimeMinutes: articleData?.readingTimeMinutes,
      category: articleData?.category,
      articleType: articleData?.articleType,
      track: articleData?.track,
      programIds: articleData?.programIds,
      organizationId: articleData?.organizationId,
      featured: articleData?.featured,
      trending: articleData?.trending,
      createdAt: articleData?.createdAt?.toDate?.()?.toISOString?.() || articleData?.createdAt,
      updatedAt: articleData?.updatedAt?.toDate?.()?.toISOString?.() || articleData?.updatedAt,
      // Pricing & Gating
      priceInCents: articleData?.priceInCents,
      currency: articleData?.currency,
      purchaseType: articleData?.purchaseType,
      isPublic: articleData?.isPublic,
      keyOutcomes: articleData?.keyOutcomes,
      features: articleData?.features,
      testimonials: articleData?.testimonials,
      faqs: articleData?.faqs,
      // Coach info
      coachName,
      coachImageUrl,
    };

    // Check ownership if user is signed in
    let isOwned = false;
    let includedInProgramName: string | undefined;

    if (userId) {
      // Check direct purchase
      const purchaseSnapshot = await adminDb
        .collection('user_content_purchases')
        .where('userId', '==', userId)
        .where('contentType', '==', 'article')
        .where('contentId', '==', id)
        .limit(1)
        .get();

      if (!purchaseSnapshot.empty) {
        isOwned = true;
        const purchase = purchaseSnapshot.docs[0].data();
        includedInProgramName = purchase.includedInProgramName;
      }

      // Check if included in an enrolled program
      if (!isOwned && article.programIds && article.programIds.length > 0) {
        const enrollmentSnapshot = await adminDb
          .collection('program_enrollments')
          .where('userId', '==', userId)
          .where('programId', 'in', article.programIds)
          .where('status', 'in', ['active', 'upcoming', 'completed'])
          .limit(1)
          .get();

        if (!enrollmentSnapshot.empty) {
          isOwned = true;
          const enrollment = enrollmentSnapshot.docs[0].data();
          
          // Get program name
          const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
          if (programDoc.exists) {
            includedInProgramName = programDoc.data()?.name;
          }
        }
      }
    }

    return NextResponse.json({ 
      article,
      isOwned,
      includedInProgramName,
    });
  } catch (error) {
    console.error('[DISCOVER_ARTICLE_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}











