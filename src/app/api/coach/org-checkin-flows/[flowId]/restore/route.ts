import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { OrgCheckInFlow, CheckInFlowTemplate } from '@/types';

/**
 * POST /api/coach/org-checkin-flows/[flowId]/restore
 * Restore a check-in flow to its default template steps
 *
 * This deletes all current steps and recreates them from the template.
 * Only affects this organization's flow, not other orgs.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Get the flow document
    const flowRef = adminDb.collection('orgCheckInFlows').doc(flowId);
    const flowDoc = await flowRef.get();

    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const flow = flowDoc.data() as OrgCheckInFlow;

    // Verify this flow belongs to the coach's organization
    if (flow.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the template for this flow type
    const templatesSnapshot = await adminDb
      .collection('checkInFlowTemplates')
      .where('key', '==', flow.type)
      .limit(1)
      .get();

    if (templatesSnapshot.empty) {
      return NextResponse.json(
        { error: `No template found for flow type: ${flow.type}` },
        { status: 404 }
      );
    }

    const template = {
      id: templatesSnapshot.docs[0].id,
      ...templatesSnapshot.docs[0].data(),
    } as CheckInFlowTemplate;

    // Delete all existing steps
    const existingStepsSnapshot = await flowRef.collection('steps').get();

    const deleteBatch = adminDb.batch();
    existingStepsSnapshot.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();

    // Create new steps from template
    const now = new Date().toISOString();
    const createBatch = adminDb.batch();

    template.defaultSteps.forEach((step, index) => {
      const stepRef = flowRef.collection('steps').doc();
      createBatch.set(stepRef, {
        flowId,
        order: step.order ?? index,
        type: step.type,
        name: step.name,
        config: step.config,
        conditions: step.conditions || null,
        conditionLogic: step.conditionLogic || null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    await createBatch.commit();

    // Update flow metadata
    await flowRef.update({
      stepCount: template.defaultSteps.length,
      templateVersion: template.version,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      stepCount: template.defaultSteps.length,
      message: 'Flow restored to defaults',
    });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_RESTORE]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
