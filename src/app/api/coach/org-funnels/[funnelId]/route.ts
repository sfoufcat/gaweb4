import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Funnel, FunnelStep } from '@/types';

/**
 * GET /api/coach/org-funnels/[funnelId]
 * Get a specific funnel with its steps
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ funnelId: string }> }
) {
  try {
    const { funnelId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Get funnel
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    const funnel = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

    // Verify organization ownership
    if (funnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Funnel not in your organization' }, { status: 403 });
    }

    // Get steps
    const stepsSnapshot = await adminDb
      .collection('funnels')
      .doc(funnelId)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    const steps = stepsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FunnelStep[];

    return NextResponse.json({ funnel, steps });
  } catch (error) {
    console.error('[COACH_FUNNEL_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-funnels/[funnelId]
 * Update a funnel
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ funnelId: string }> }
) {
  try {
    const { funnelId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Verify funnel exists and belongs to org
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    const existingFunnel = funnelDoc.data() as Funnel;
    if (existingFunnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Funnel not in your organization' }, { status: 403 });
    }

    const body = await req.json();
    const { name, slug, description, isActive, isDefault, accessType, defaultPaymentStatus, branding } = body;

    const updates: Partial<Funnel> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || undefined;
    if (isActive !== undefined) updates.isActive = isActive;
    if (accessType !== undefined) updates.accessType = accessType;
    if (defaultPaymentStatus !== undefined) updates.defaultPaymentStatus = defaultPaymentStatus;
    if (branding !== undefined) updates.branding = branding;

    // Handle slug change
    if (slug !== undefined && slug !== existingFunnel.slug) {
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return NextResponse.json(
          { error: 'Slug can only contain lowercase letters, numbers, and hyphens' },
          { status: 400 }
        );
      }

      // Check uniqueness
      const existingSlugDoc = await adminDb
        .collection('funnels')
        .where('programId', '==', existingFunnel.programId)
        .where('slug', '==', slug)
        .limit(1)
        .get();

      if (!existingSlugDoc.empty && existingSlugDoc.docs[0].id !== funnelId) {
        return NextResponse.json(
          { error: 'A funnel with this slug already exists for this program' },
          { status: 400 }
        );
      }

      updates.slug = slug.toLowerCase();
    }

    // Handle isDefault change
    if (isDefault !== undefined && isDefault !== existingFunnel.isDefault) {
      if (isDefault) {
        // Unset existing default
        const existingDefaults = await adminDb
          .collection('funnels')
          .where('programId', '==', existingFunnel.programId)
          .where('isDefault', '==', true)
          .get();

        const batch = adminDb.batch();
        existingDefaults.docs.forEach(doc => {
          if (doc.id !== funnelId) {
            batch.update(doc.ref, { isDefault: false });
          }
        });
        await batch.commit();
      }
      updates.isDefault = isDefault;
    }

    await adminDb.collection('funnels').doc(funnelId).update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_FUNNEL_PUT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-funnels/[funnelId]
 * Delete a funnel and all its steps
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ funnelId: string }> }
) {
  try {
    const { funnelId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Verify funnel exists and belongs to org
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    const funnel = funnelDoc.data() as Funnel;
    if (funnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Funnel not in your organization' }, { status: 403 });
    }

    // Delete all steps first
    const stepsSnapshot = await adminDb
      .collection('funnels')
      .doc(funnelId)
      .collection('steps')
      .get();

    const batch = adminDb.batch();
    stepsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    batch.delete(funnelDoc.ref);
    await batch.commit();

    console.log(`[COACH_FUNNEL_DELETE] Deleted funnel ${funnelId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_FUNNEL_DELETE]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
