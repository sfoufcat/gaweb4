/**
 * Coach API: Organization-scoped Articles Management
 * 
 * GET /api/coach/org-discover/articles - List articles in coach's organization
 * POST /api/coach/org-discover/articles - Create new article in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { requirePlanLimit, isEntitlementError, getEntitlementErrorStatus } from '@/lib/billing/server-enforcement';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_ARTICLES] Fetching articles for organization: ${organizationId}`);

    const articlesSnapshot = await adminDb
      .collection('articles')
      .where('organizationId', '==', organizationId)
      .orderBy('publishedAt', 'desc')
      .get();

    const articles = articlesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      publishedAt: doc.data().publishedAt?.toDate?.()?.toISOString?.() || doc.data().publishedAt,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ 
      articles,
      totalCount: articles.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_ARTICLES_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    
    // Enforce content item limit based on plan
    try {
      await requirePlanLimit(organizationId, 'maxContentItems');
    } catch (limitError) {
      if (isEntitlementError(limitError)) {
        return NextResponse.json(
          { 
            error: 'Content item limit reached for your current plan',
            code: limitError.code,
            ...('currentCount' in limitError ? { currentCount: limitError.currentCount } : {}),
            ...('maxLimit' in limitError ? { maxLimit: limitError.maxLimit } : {}),
          },
          { status: getEntitlementErrorStatus(limitError) }
        );
      }
      throw limitError;
    }

    const body = await request.json();
    
    // Validate required fields (authorTitle is now optional)
    const requiredFields = ['title', 'coverImageUrl', 'content', 'authorName'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Calculate reading time (rough estimate: 200 words per minute)
    const wordCount = body.content.split(/\s+/).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    // Validate programIds if provided
    if (body.programIds && !Array.isArray(body.programIds)) {
      return NextResponse.json(
        { error: 'programIds must be an array' },
        { status: 400 }
      );
    }

    const articleData = {
      title: body.title,
      coverImageUrl: body.coverImageUrl,
      thumbnailUrl: body.thumbnailUrl || null, // Optional thumbnail for cards/lists
      content: body.content,
      // Author fields
      authorId: body.authorId || null, // New: User ID for dynamic bio lookup
      authorName: body.authorName,
      authorTitle: body.authorTitle || null, // Now optional
      // Deprecated author fields (kept for backward compatibility)
      authorAvatarUrl: body.authorAvatarUrl || null,
      authorBio: body.authorBio || null,
      publishedAt: body.publishedAt || new Date().toISOString(),
      readingTimeMinutes,
      category: body.category || null,
      // Deprecated fields (kept for backward compatibility)
      articleType: body.articleType || null,
      track: body.track || null,
      // Program association
      programIds: body.programIds || [],
      featured: body.featured || false,
      trending: body.trending || false,
      organizationId, // Scope to coach's organization
      // Pricing & Gating fields
      priceInCents: body.priceInCents || 0,
      currency: body.currency || 'usd',
      purchaseType: body.purchaseType || 'popup', // 'popup' or 'landing_page'
      isPublic: body.isPublic !== false, // Default true
      keyOutcomes: body.keyOutcomes || [],
      features: body.features || [],
      testimonials: body.testimonials || [],
      faqs: body.faqs || [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('articles').add(articleData);

    console.log(`[COACH_ORG_ARTICLES] Created article ${docRef.id} in organization ${organizationId}`);

    return NextResponse.json({
      id: docRef.id,
      ...articleData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_ORG_ARTICLES_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}

