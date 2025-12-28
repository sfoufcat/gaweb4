/**
 * API Route: Get Single Article
 * 
 * GET /api/discover/articles/[id] - Get article by ID with ownership status
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs/server';
import type { DiscoverArticle } from '@/types/discover';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    
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











