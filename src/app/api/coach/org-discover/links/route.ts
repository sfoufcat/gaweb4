/**
 * Coach API: Organization-scoped Links Management
 * 
 * GET /api/coach/org-discover/links - List links in coach's organization
 * POST /api/coach/org-discover/links - Create new link in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_LINKS] Fetching links for organization: ${organizationId}`);

    const linksSnapshot = await adminDb
      .collection('program_links')
      .where('organizationId', '==', organizationId)
      .orderBy('order', 'asc')
      .get();

    const links = linksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ 
      links,
      totalCount: links.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_LINKS_GET] Error:', error);
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
    
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    
    // Validate required fields
    if (!body.title) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 }
      );
    }

    if (!body.url) {
      return NextResponse.json(
        { error: 'Missing required field: url' },
        { status: 400 }
      );
    }

    const linkData = {
      title: body.title,
      description: body.description || '',
      url: body.url,
      thumbnailUrl: body.thumbnailUrl || null,
      programIds: Array.isArray(body.programIds) ? body.programIds : [],
      // Also store as programId for backwards compatibility with content API
      programId: Array.isArray(body.programIds) && body.programIds.length > 0 ? body.programIds[0] : null,
      order: body.order || 0,
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

    const docRef = await adminDb.collection('program_links').add(linkData);

    console.log(`[COACH_ORG_LINKS] Created link ${docRef.id} in organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      message: 'Link created successfully' 
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_ORG_LINKS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
  }
}

