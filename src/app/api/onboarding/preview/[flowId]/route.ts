import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import type { OrgOnboardingFlow, OnboardingStep } from '@/types';

/**
 * GET /api/onboarding/preview/[flowId]
 * Get onboarding flow and steps for preview mode (coach only)
 *
 * Returns the flow and all its steps for rendering in preview mode.
 * This endpoint requires coach access to the organization that owns the flow.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { flowId } = await params;

    if (!flowId) {
      return NextResponse.json({ error: 'flowId is required' }, { status: 400 });
    }

    // Get the flow
    const flowDoc = await adminDb.collection('org_onboarding_flows').doc(flowId).get();

    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const flowData = flowDoc.data();

    // Verify the flow belongs to this org
    if (flowData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const flow: OrgOnboardingFlow = {
      id: flowDoc.id,
      ...flowData,
    } as OrgOnboardingFlow;

    // Get all steps for this flow
    const stepsSnapshot = await adminDb
      .collection('org_onboarding_flows')
      .doc(flowId)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    const steps = stepsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as OnboardingStep[];

    return NextResponse.json({
      flow: {
        id: flow.id,
        name: flow.name,
        enabled: flow.enabled,
      },
      steps,
    });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[ONBOARDING_PREVIEW_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
