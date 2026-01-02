import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import type { OnboardingStep, OnboardingStepType } from '@/types';

/**
 * GET /api/coach/org-onboarding-flow/steps
 * Get all steps for an onboarding flow
 * 
 * Query params:
 * - flowId: string (required)
 */
export async function GET(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(req.url);
    const flowId = searchParams.get('flowId');

    if (!flowId) {
      return NextResponse.json({ error: 'flowId is required' }, { status: 400 });
    }

    // Verify the flow belongs to this org
    const flowDoc = await adminDb.collection('org_onboarding_flows').doc(flowId).get();
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    if (flowDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get steps
    const snapshot = await adminDb
      .collection('org_onboarding_flows')
      .doc(flowId)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    const steps = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as OnboardingStep[];

    return NextResponse.json({ steps });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_ONBOARDING_STEPS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-onboarding-flow/steps
 * Add a new step to an onboarding flow
 * 
 * Body:
 * - flowId: string
 * - type: OnboardingStepType
 * - name?: string
 * - config: object
 */
export async function POST(req: Request) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();

    const body = await req.json();
    const { flowId, type, name, config } = body as {
      flowId: string;
      type: OnboardingStepType;
      name?: string;
      config: unknown;
    };

    if (!flowId || !type || !config) {
      return NextResponse.json({ 
        error: 'flowId, type, and config are required' 
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

    // Get current step count to determine order
    const stepsSnapshot = await flowRef.collection('steps').count().get();
    const order = stepsSnapshot.data().count;

    const now = new Date().toISOString();

    // Create the step
    const stepRef = flowRef.collection('steps').doc();
    const stepData = {
      flowId,
      order,
      type,
      name: name || type,
      config,
      createdAt: now,
      updatedAt: now,
    };

    await stepRef.set(stepData);

    // Update flow step count
    await flowRef.update({
      stepCount: order + 1,
      updatedAt: now,
      lastEditedByUserId: userId,
    });

    const step: OnboardingStep = {
      id: stepRef.id,
      ...stepData,
    } as OnboardingStep;

    console.log(`[COACH_ORG_ONBOARDING_STEPS] Added step ${step.id} to flow ${flowId}`);

    return NextResponse.json({ step }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_ONBOARDING_STEPS_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



