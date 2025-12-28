import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { OrgCheckInFlow, CheckInStep, CheckInStepConfig } from '@/types';

/**
 * GET /api/coach/org-checkin-flows/[flowId]/steps
 * Get all steps for a check-in flow
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;
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

    // Get steps
    const stepsSnapshot = await adminDb
      .collection('orgCheckInFlows')
      .doc(flowId)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    const steps = stepsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CheckInStep[];

    return NextResponse.json({ steps });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_STEPS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-checkin-flows/[flowId]/steps
 * Add a new step to a check-in flow
 * 
 * Body:
 * - type: CheckInStepType
 * - config: CheckInStepConfig
 * - name?: string
 * - order?: number (default: append to end)
 * - conditions?: CheckInStepCondition[]
 * - conditionLogic?: 'and' | 'or'
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;
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

    const body = await req.json();
    const { type, config, name, order: requestedOrder, conditions, conditionLogic } = body;

    if (!type) {
      return NextResponse.json({ error: 'Step type is required' }, { status: 400 });
    }

    // Get current steps
    const stepsSnapshot = await flowRef.collection('steps').get();
    const currentCount = stepsSnapshot.size;
    
    // Find completion step - no steps can be added after it
    const completionStep = stepsSnapshot.docs.find(doc => {
      const data = doc.data() as CheckInStep;
      return data.type === 'completion' || data.type === 'goal_achieved';
    });
    const completionOrder = completionStep ? (completionStep.data() as CheckInStep).order : null;
    
    // Calculate order - default to before completion step if it exists
    let order: number;
    if (requestedOrder !== undefined) {
      order = requestedOrder;
    } else if (completionOrder !== null) {
      order = completionOrder; // Insert before completion
    } else {
      order = currentCount; // Append to end
    }
    
    // Validate: cannot add steps at or after completion step position (except if it's a completion-type step)
    if (completionOrder !== null && type !== 'completion' && type !== 'goal_achieved' && order >= completionOrder) {
      return NextResponse.json({ error: 'Cannot add steps after the completion step' }, { status: 400 });
    }

    // If inserting at a specific position, shift existing steps
    if (requestedOrder !== undefined && requestedOrder < currentCount) {
      const batch = adminDb.batch();
      const stepsToShift = await flowRef
        .collection('steps')
        .where('order', '>=', requestedOrder)
        .get();

      stepsToShift.docs.forEach(doc => {
        batch.update(doc.ref, { order: (doc.data() as CheckInStep).order + 1 });
      });
      await batch.commit();
    }

    const now = new Date().toISOString();
    const stepData: Omit<CheckInStep, 'id'> = {
      flowId,
      order,
      type,
      name: name || undefined,
      config: { type, config } as CheckInStepConfig,
      conditions: conditions || undefined,
      conditionLogic: conditionLogic || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const stepRef = await flowRef.collection('steps').add(stepData);

    // Update flow step count
    await flowRef.update({ 
      stepCount: currentCount + 1,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      step: { id: stepRef.id, ...stepData },
    });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_STEPS_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-checkin-flows/[flowId]/steps
 * Bulk update steps (reorder)
 * 
 * Body:
 * - steps: Array of { id: string, order: number }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;
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

    const body = await req.json();
    const { steps } = body;

    if (!Array.isArray(steps)) {
      return NextResponse.json({ error: 'Steps array is required' }, { status: 400 });
    }

    // Get current steps to find completion step
    const existingStepsSnapshot = await flowRef.collection('steps').get();
    const existingStepsMap = new Map<string, CheckInStep>();
    existingStepsSnapshot.docs.forEach(doc => {
      existingStepsMap.set(doc.id, { id: doc.id, ...doc.data() } as CheckInStep);
    });
    
    // Validate: completion step must remain last after reordering
    const completionStepEntry = steps.find((s: { id: string; order: number }) => {
      const existing = existingStepsMap.get(s.id);
      return existing?.type === 'completion' || existing?.type === 'goal_achieved';
    });
    
    if (completionStepEntry) {
      const maxOrder = Math.max(...steps.map((s: { id: string; order: number }) => s.order));
      if (completionStepEntry.order !== maxOrder) {
        return NextResponse.json({ error: 'Completion step must remain the last step' }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const batch = adminDb.batch();

    steps.forEach((step: { id: string; order: number }) => {
      const stepRef = flowRef.collection('steps').doc(step.id);
      batch.update(stepRef, { order: step.order, updatedAt: now });
    });

    batch.update(flowRef, { updatedAt: now });
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_STEPS_PUT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}





