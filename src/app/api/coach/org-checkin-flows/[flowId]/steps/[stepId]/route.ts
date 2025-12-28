import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { OrgCheckInFlow, CheckInStep } from '@/types';

/**
 * GET /api/coach/org-checkin-flows/[flowId]/steps/[stepId]
 * Get a specific step
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ flowId: string; stepId: string }> }
) {
  try {
    const { flowId, stepId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Verify flow belongs to org
    const flowDoc = await adminDb.collection('orgCheckInFlows').doc(flowId).get();
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    const flow = flowDoc.data() as OrgCheckInFlow;
    if (flow.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get step
    const stepDoc = await adminDb
      .collection('orgCheckInFlows')
      .doc(flowId)
      .collection('steps')
      .doc(stepId)
      .get();

    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const step = { id: stepDoc.id, ...stepDoc.data() } as CheckInStep;

    return NextResponse.json({ step });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_STEP_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-checkin-flows/[flowId]/steps/[stepId]
 * Update a step's configuration
 * 
 * Body:
 * - config?: object (step-specific config)
 * - name?: string
 * - enabled?: boolean
 * - conditions?: CheckInStepCondition[]
 * - conditionLogic?: 'and' | 'or'
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ flowId: string; stepId: string }> }
) {
  try {
    const { flowId, stepId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Verify flow belongs to org
    const flowRef = adminDb.collection('orgCheckInFlows').doc(flowId);
    const flowDoc = await flowRef.get();
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    const flow = flowDoc.data() as OrgCheckInFlow;
    if (flow.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get step
    const stepRef = flowRef.collection('steps').doc(stepId);
    const stepDoc = await stepRef.get();
    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const existingStep = stepDoc.data() as CheckInStep;

    const body = await req.json();
    const { config, name, enabled, conditions, conditionLogic } = body;

    const now = new Date().toISOString();
    const updates: Partial<CheckInStep> = {
      updatedAt: now,
    };

    if (config !== undefined) {
      // Merge config while preserving type
      updates.config = {
        type: existingStep.type,
        config,
      } as CheckInStep['config'];
    }

    if (name !== undefined) {
      updates.name = name || undefined;
    }

    if (enabled !== undefined) {
      updates.enabled = enabled;
    }

    if (conditions !== undefined) {
      updates.conditions = conditions || undefined;
    }

    if (conditionLogic !== undefined) {
      updates.conditionLogic = conditionLogic || undefined;
    }

    await stepRef.update(updates);

    // Update flow's updatedAt
    await flowRef.update({ updatedAt: now });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_STEP_PUT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-checkin-flows/[flowId]/steps/[stepId]
 * Delete a step from a flow
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ flowId: string; stepId: string }> }
) {
  try {
    const { flowId, stepId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Verify flow belongs to org
    const flowRef = adminDb.collection('orgCheckInFlows').doc(flowId);
    const flowDoc = await flowRef.get();
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    const flow = flowDoc.data() as OrgCheckInFlow;
    if (flow.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get step
    const stepRef = flowRef.collection('steps').doc(stepId);
    const stepDoc = await stepRef.get();
    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const step = stepDoc.data() as CheckInStep;
    const deletedOrder = step.order;

    // Delete the step
    await stepRef.delete();

    // Reorder remaining steps
    const remainingSteps = await flowRef
      .collection('steps')
      .where('order', '>', deletedOrder)
      .get();

    if (!remainingSteps.empty) {
      const batch = adminDb.batch();
      remainingSteps.docs.forEach(doc => {
        batch.update(doc.ref, { order: (doc.data() as CheckInStep).order - 1 });
      });
      await batch.commit();
    }

    // Update flow step count
    const now = new Date().toISOString();
    await flowRef.update({ 
      stepCount: Math.max(0, flow.stepCount - 1),
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_STEP_DELETE]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

