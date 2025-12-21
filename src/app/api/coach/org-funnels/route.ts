import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Funnel } from '@/types';

/**
 * GET /api/coach/org-funnels
 * Get all funnels for the coach's organization
 * 
 * Query params:
 * - programId?: string (filter by program)
 */
export async function GET(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get('programId');

    // Build query
    let query = adminDb
      .collection('funnels')
      .where('organizationId', '==', organizationId);

    if (programId) {
      query = query.where('programId', '==', programId);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    const funnels = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Funnel[];

    return NextResponse.json({ funnels });
  } catch (error) {
    console.error('[COACH_ORG_FUNNELS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-funnels
 * Create a new funnel
 * 
 * Body:
 * - name: string
 * - slug: string
 * - programId: string
 * - description?: string
 * - accessType?: 'public' | 'invite_only'
 * - isDefault?: boolean
 */
export async function POST(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { name, slug, programId, description, accessType = 'public', isDefault = false } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!slug?.trim()) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }
    if (!programId) {
      return NextResponse.json({ error: 'Program ID is required' }, { status: 400 });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug can only contain lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Check slug uniqueness within program
    const existingSlug = await adminDb
      .collection('funnels')
      .where('programId', '==', programId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!existingSlug.empty) {
      return NextResponse.json(
        { error: 'A funnel with this slug already exists for this program' },
        { status: 400 }
      );
    }

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const programData = programDoc.data();
    if (programData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not in your organization' }, { status: 403 });
    }

    // If this is being set as default, unset any existing default
    if (isDefault) {
      const existingDefaults = await adminDb
        .collection('funnels')
        .where('programId', '==', programId)
        .where('isDefault', '==', true)
        .get();

      const batch = adminDb.batch();
      existingDefaults.docs.forEach(doc => {
        batch.update(doc.ref, { isDefault: false });
      });
      await batch.commit();
    }

    const now = new Date().toISOString();
    const funnelData: Omit<Funnel, 'id'> = {
      organizationId,
      programId,
      slug: slug.toLowerCase(),
      name: name.trim(),
      description: description?.trim() || undefined,
      isDefault,
      isActive: true,
      accessType,
      defaultPaymentStatus: 'required',
      stepCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const funnelRef = await adminDb.collection('funnels').add(funnelData);

    console.log(`[COACH_ORG_FUNNELS] Created funnel ${funnelRef.id} for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      funnel: { id: funnelRef.id, ...funnelData },
    });
  } catch (error) {
    console.error('[COACH_ORG_FUNNELS_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
