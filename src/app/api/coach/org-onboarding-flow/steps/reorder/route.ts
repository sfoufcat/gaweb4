import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';

/**
 * PUT /api/coach/org-onboarding-flow/steps/reorder
 * Reorder steps in an onboarding flow
 * 
 * Body:
 * - flowId: string
 * - stepIds: string[] (ordered list of step IDs)
 */
export async function PUT(req: Request) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();

    const body = await req.json();
    const { flowId, stepIds } = body as {
      flowId: string;
      stepIds: string[];
    };

    if (!flowId || !Array.isArray(stepIds)) {
      return NextResponse.json({ 
        error: 'flowId and stepIds array are required' 
      }, { status: 400 });
    }

    // Verify the flow belongs to this org
    const flowRef = adminDb.collection('org_onboarding_flows').doc(flowId);
    const flowDoc = await flowRef.get();
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    if (flowDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const batch = adminDb.batch();

    // Update each step's order
    stepIds.forEach((stepId, index) => {
      const stepRef = flowRef.collection('steps').doc(stepId);
      batch.update(stepRef, {
        order: index,
        updatedAt: now,
      });
    });

    // Update flow's updatedAt
    batch.update(flowRef, {
      updatedAt: now,
      lastEditedByUserId: userId,
    });

    await batch.commit();

    console.log(`[COACH_ORG_ONBOARDING_STEPS] Reordered ${stepIds.length} steps in flow ${flowId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_ONBOARDING_STEPS_REORDER]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



