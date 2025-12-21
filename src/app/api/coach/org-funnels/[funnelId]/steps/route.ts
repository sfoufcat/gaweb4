import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Funnel, FunnelStep, FunnelStepConfig } from '@/types';

/**
 * GET /api/coach/org-funnels/[funnelId]/steps
 * Get all steps for a funnel
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ funnelId: string }> }
) {
  try {
    const { funnelId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Verify funnel belongs to org
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }
    const funnel = funnelDoc.data() as Funnel;
    if (funnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    return NextResponse.json({ steps });
  } catch (error) {
    console.error('[COACH_FUNNEL_STEPS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-funnels/[funnelId]/steps
 * Add a new step to a funnel
 * 
 * Body:
 * - type: FunnelStepType
 * - config: FunnelStepConfig
 * - order?: number (default: append to end)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ funnelId: string }> }
) {
  try {
    const { funnelId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Verify funnel belongs to org
    const funnelRef = adminDb.collection('funnels').doc(funnelId);
    const funnelDoc = await funnelRef.get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }
    const funnel = funnelDoc.data() as Funnel;
    if (funnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { type, config, order: requestedOrder, showIf } = body;

    if (!type) {
      return NextResponse.json({ error: 'Step type is required' }, { status: 400 });
    }

    // Get current step count for order
    const stepsSnapshot = await funnelRef.collection('steps').get();
    const currentCount = stepsSnapshot.size;
    const order = requestedOrder !== undefined ? requestedOrder : currentCount;

    // If inserting at a specific position, shift existing steps
    if (requestedOrder !== undefined && requestedOrder < currentCount) {
      const batch = adminDb.batch();
      const stepsToShift = await funnelRef
        .collection('steps')
        .where('order', '>=', requestedOrder)
        .get();

      stepsToShift.docs.forEach(doc => {
        batch.update(doc.ref, { order: (doc.data() as FunnelStep).order + 1 });
      });
      await batch.commit();
    }

    const now = new Date().toISOString();
    const stepData: Omit<FunnelStep, 'id'> = {
      funnelId,
      order,
      type,
      config: { type, config } as FunnelStepConfig,
      showIf: showIf || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const stepRef = await funnelRef.collection('steps').add(stepData);

    // Update funnel step count
    await funnelRef.update({ 
      stepCount: currentCount + 1,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      step: { id: stepRef.id, ...stepData },
    });
  } catch (error) {
    console.error('[COACH_FUNNEL_STEPS_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-funnels/[funnelId]/steps
 * Bulk update steps (reorder)
 * 
 * Body:
 * - steps: Array of { id: string, order: number }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ funnelId: string }> }
) {
  try {
    const { funnelId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Verify funnel belongs to org
    const funnelRef = adminDb.collection('funnels').doc(funnelId);
    const funnelDoc = await funnelRef.get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }
    const funnel = funnelDoc.data() as Funnel;
    if (funnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { steps } = body;

    if (!Array.isArray(steps)) {
      return NextResponse.json({ error: 'Steps array is required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const batch = adminDb.batch();

    steps.forEach((step: { id: string; order: number }) => {
      const stepRef = funnelRef.collection('steps').doc(step.id);
      batch.update(stepRef, { order: step.order, updatedAt: now });
    });

    batch.update(funnelRef, { updatedAt: now });
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_FUNNEL_STEPS_PUT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
