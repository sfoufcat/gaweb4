import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { OrgCheckInFlow, CheckInStep, CheckInFlowTemplate } from '@/types';

/**
 * GET /api/coach/org-checkin-flows/[flowId]
 * Get a specific check-in flow with its steps
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Get flow
    const flowDoc = await adminDb.collection('orgCheckInFlows').doc(flowId).get();
    
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const flow = { id: flowDoc.id, ...flowDoc.data() } as OrgCheckInFlow;

    // Verify organization ownership
    if (flow.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Flow not in your organization' }, { status: 403 });
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

    return NextResponse.json({ flow, steps });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-checkin-flows/[flowId]
 * Update a check-in flow
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;
    const { organizationId, userId } = await requireCoachWithOrg();

    // Verify flow exists and belongs to org
    const flowDoc = await adminDb.collection('orgCheckInFlows').doc(flowId).get();
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const existingFlow = flowDoc.data() as OrgCheckInFlow;
    if (existingFlow.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Flow not in your organization' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, enabled } = body;

    const updates: Partial<OrgCheckInFlow> = {
      updatedAt: new Date().toISOString(),
      lastEditedByUserId: userId,
    };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || undefined;
    if (enabled !== undefined) updates.enabled = enabled;

    await adminDb.collection('orgCheckInFlows').doc(flowId).update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_PUT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-checkin-flows/[flowId]
 * Delete a check-in flow and all its steps
 * Note: System default flows (morning/evening/weekly) cannot be deleted
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    // Verify flow exists and belongs to org
    const flowDoc = await adminDb.collection('orgCheckInFlows').doc(flowId).get();
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const flow = flowDoc.data() as OrgCheckInFlow;
    if (flow.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Flow not in your organization' }, { status: 403 });
    }

    // Prevent deletion of system default flows
    if (flow.isSystemDefault) {
      return NextResponse.json(
        { error: 'Cannot delete system default check-in flows. You can disable them instead.' },
        { status: 400 }
      );
    }

    // Delete all steps first
    const stepsSnapshot = await adminDb
      .collection('orgCheckInFlows')
      .doc(flowId)
      .collection('steps')
      .get();

    const batch = adminDb.batch();
    stepsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    batch.delete(flowDoc.ref);
    await batch.commit();

    console.log(`[COACH_CHECKIN_FLOW_DELETE] Deleted flow ${flowId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_DELETE]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/org-checkin-flows/[flowId]
 * Special actions: reset to default template
 * 
 * Body:
 * - action: 'reset_to_default'
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;
    const { organizationId, userId } = await requireCoachWithOrg();

    // Verify flow exists and belongs to org
    const flowDoc = await adminDb.collection('orgCheckInFlows').doc(flowId).get();
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const flow = flowDoc.data() as OrgCheckInFlow;
    if (flow.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Flow not in your organization' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'reset_to_default') {
      // Only system default flows can be reset
      if (!flow.isSystemDefault) {
        return NextResponse.json(
          { error: 'Only system default flows can be reset to template' },
          { status: 400 }
        );
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

      const template = templatesSnapshot.docs[0].data() as CheckInFlowTemplate;
      const now = new Date().toISOString();

      // Delete existing steps
      const existingStepsSnapshot = await adminDb
        .collection('orgCheckInFlows')
        .doc(flowId)
        .collection('steps')
        .get();

      const batch = adminDb.batch();
      
      // Delete old steps
      existingStepsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Create new steps from template
      template.defaultSteps.forEach((step, index) => {
        const stepRef = adminDb
          .collection('orgCheckInFlows')
          .doc(flowId)
          .collection('steps')
          .doc();
        
        batch.set(stepRef, {
          flowId,
          order: step.order ?? index,
          type: step.type,
          name: step.name,
          config: step.config,
          conditions: step.conditions,
          conditionLogic: step.conditionLogic,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Update flow
      batch.update(flowDoc.ref, {
        stepCount: template.defaultSteps.length,
        templateVersion: template.version,
        lastEditedByUserId: userId,
        updatedAt: now,
      });

      await batch.commit();

      console.log(`[COACH_CHECKIN_FLOW_RESET] Reset flow ${flowId} to template version ${template.version}`);

      return NextResponse.json({ 
        success: true,
        message: 'Flow reset to default template',
        stepCount: template.defaultSteps.length,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[COACH_CHECKIN_FLOW_PATCH]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

