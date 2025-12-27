import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import type { OrgCheckInFlow, CheckInFlowType, CheckInFlowTemplate } from '@/types';

/**
 * GET /api/coach/org-checkin-flows
 * Get all check-in flows for the coach's organization
 * 
 * Query params:
 * - type?: 'morning' | 'evening' | 'weekly' | 'custom' (filter by type)
 */
export async function GET(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as CheckInFlowType | null;

    // Build query
    let query = adminDb
      .collection('orgCheckInFlows')
      .where('organizationId', '==', organizationId);

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    const flows = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as OrgCheckInFlow[];

    return NextResponse.json({ flows });
  } catch (error) {
    // Handle tenant required error
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_CHECKIN_FLOWS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-checkin-flows
 * Create a new check-in flow
 * 
 * Body:
 * - name: string
 * - type: 'morning' | 'evening' | 'weekly' | 'custom'
 * - description?: string
 * - fromTemplateId?: string (to copy from a template)
 * - fromFlowId?: string (to duplicate an existing flow)
 */
export async function POST(req: Request) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();

    const body = await req.json();
    const { 
      name, 
      type = 'custom' as CheckInFlowType,
      description, 
      fromTemplateId,
      fromFlowId,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Validate type
    if (!['morning', 'evening', 'weekly', 'custom'].includes(type)) {
      return NextResponse.json({ error: 'Invalid flow type' }, { status: 400 });
    }

    const now = new Date().toISOString();
    
    // Build flow data
    const flowData: Omit<OrgCheckInFlow, 'id'> = {
      organizationId,
      name: name.trim(),
      type,
      description: description?.trim() || undefined,
      enabled: true,
      stepCount: 0,
      isSystemDefault: false,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    };

    // Get steps to copy if duplicating from template or existing flow
    let stepsToCopy: Omit<import('@/types').CheckInStep, 'id' | 'flowId' | 'createdAt' | 'updatedAt'>[] = [];

    if (fromTemplateId) {
      // Copy from template
      const templateDoc = await adminDb.collection('checkInFlowTemplates').doc(fromTemplateId).get();
      if (!templateDoc.exists) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      const template = templateDoc.data() as CheckInFlowTemplate;
      stepsToCopy = template.defaultSteps;
      flowData.createdFromTemplateId = fromTemplateId;
      flowData.templateVersion = template.version;
    } else if (fromFlowId) {
      // Duplicate from existing flow
      const existingFlowDoc = await adminDb.collection('orgCheckInFlows').doc(fromFlowId).get();
      if (!existingFlowDoc.exists) {
        return NextResponse.json({ error: 'Flow to duplicate not found' }, { status: 404 });
      }
      const existingFlow = existingFlowDoc.data() as OrgCheckInFlow;
      
      // Verify org ownership if not a template
      if (existingFlow.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Cannot duplicate flows from other organizations' }, { status: 403 });
      }

      // Get steps from existing flow
      const stepsSnapshot = await adminDb
        .collection('orgCheckInFlows')
        .doc(fromFlowId)
        .collection('steps')
        .orderBy('order', 'asc')
        .get();

      stepsToCopy = stepsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          order: data.order,
          type: data.type,
          name: data.name,
          config: data.config,
          conditions: data.conditions,
          conditionLogic: data.conditionLogic,
        };
      });
    }

    // Create the flow
    const flowRef = await adminDb.collection('orgCheckInFlows').add(flowData);

    // Create steps if copying from template or duplicating
    if (stepsToCopy.length > 0) {
      const batch = adminDb.batch();
      
      stepsToCopy.forEach((step, index) => {
        const stepRef = adminDb
          .collection('orgCheckInFlows')
          .doc(flowRef.id)
          .collection('steps')
          .doc();
        
        batch.set(stepRef, {
          flowId: flowRef.id,
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

      await batch.commit();

      // Update step count
      await flowRef.update({ stepCount: stepsToCopy.length });
    }

    console.log(`[COACH_ORG_CHECKIN_FLOWS] Created flow ${flowRef.id} for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      flow: { id: flowRef.id, ...flowData, stepCount: stepsToCopy.length },
    });
  } catch (error) {
    // Handle tenant required error
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_CHECKIN_FLOWS_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

