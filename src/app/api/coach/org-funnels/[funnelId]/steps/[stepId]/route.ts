import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCoachRole, getCoachOrganizationId } from '@/lib/admin-utils-clerk';
import type { Funnel, FunnelStep } from '@/types';

/**
 * GET /api/coach/org-funnels/[funnelId]/steps/[stepId]
 * Get a specific step
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ funnelId: string; stepId: string }> }
) {
  try {
    const { funnelId, stepId } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isCoach = await verifyCoachRole(userId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = await getCoachOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Verify funnel belongs to org
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }
    const funnel = funnelDoc.data() as Funnel;
    if (funnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get step
    const stepDoc = await adminDb
      .collection('funnels')
      .doc(funnelId)
      .collection('steps')
      .doc(stepId)
      .get();

    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    return NextResponse.json({
      step: { id: stepDoc.id, ...stepDoc.data() },
    });
  } catch (error) {
    console.error('[COACH_FUNNEL_STEP_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-funnels/[funnelId]/steps/[stepId]
 * Update a specific step
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ funnelId: string; stepId: string }> }
) {
  try {
    const { funnelId, stepId } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isCoach = await verifyCoachRole(userId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = await getCoachOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Verify funnel belongs to org
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }
    const funnel = funnelDoc.data() as Funnel;
    if (funnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify step exists
    const stepRef = adminDb
      .collection('funnels')
      .doc(funnelId)
      .collection('steps')
      .doc(stepId);
    const stepDoc = await stepRef.get();

    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const body = await req.json();
    const { type, config, showIf } = body;

    const now = new Date().toISOString();
    const updates: Partial<FunnelStep> = {
      updatedAt: now,
    };

    if (type !== undefined) {
      updates.type = type;
    }
    if (config !== undefined) {
      updates.config = { type: type || stepDoc.data()?.type, config };
    }
    if (showIf !== undefined) {
      updates.showIf = showIf || undefined;
    }

    await stepRef.update(updates);

    // Update funnel timestamp
    await adminDb.collection('funnels').doc(funnelId).update({ updatedAt: now });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_FUNNEL_STEP_PUT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-funnels/[funnelId]/steps/[stepId]
 * Delete a specific step
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ funnelId: string; stepId: string }> }
) {
  try {
    const { funnelId, stepId } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isCoach = await verifyCoachRole(userId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = await getCoachOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

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

    // Get step to delete
    const stepRef = funnelRef.collection('steps').doc(stepId);
    const stepDoc = await stepRef.get();

    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const deletedStep = stepDoc.data() as FunnelStep;
    const deletedOrder = deletedStep.order;

    // Delete the step
    await stepRef.delete();

    // Reorder remaining steps
    const stepsToReorder = await funnelRef
      .collection('steps')
      .where('order', '>', deletedOrder)
      .get();

    if (!stepsToReorder.empty) {
      const batch = adminDb.batch();
      stepsToReorder.docs.forEach(doc => {
        batch.update(doc.ref, { order: (doc.data() as FunnelStep).order - 1 });
      });
      await batch.commit();
    }

    // Update funnel step count
    const now = new Date().toISOString();
    await funnelRef.update({
      stepCount: Math.max(0, (funnel.stepCount || 0) - 1),
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_FUNNEL_STEP_DELETE]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

