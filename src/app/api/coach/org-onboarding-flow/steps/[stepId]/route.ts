import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import type { OnboardingStep } from '@/types';

/**
 * PUT /api/coach/org-onboarding-flow/steps/[stepId]
 * Update a step's configuration
 * 
 * Body:
 * - config?: object
 * - name?: string
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();
    const { stepId } = await params;

    const body = await req.json();
    const { config, name } = body as {
      config?: unknown;
      name?: string;
    };

    // Find the step - we need to search across all flows for this org
    // First, get all flows for this org
    const flowsSnapshot = await adminDb
      .collection('org_onboarding_flows')
      .where('organizationId', '==', organizationId)
      .get();

    if (flowsSnapshot.empty) {
      return NextResponse.json({ error: 'No flows found' }, { status: 404 });
    }

    // Search for the step in each flow
    let stepRef: FirebaseFirestore.DocumentReference | null = null;
    let flowRef: FirebaseFirestore.DocumentReference | null = null;

    for (const flowDoc of flowsSnapshot.docs) {
      const candidateStepRef = flowDoc.ref.collection('steps').doc(stepId);
      const stepDoc = await candidateStepRef.get();
      if (stepDoc.exists) {
        stepRef = candidateStepRef;
        flowRef = flowDoc.ref;
        break;
      }
    }

    if (!stepRef || !flowRef) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    if (config !== undefined) {
      updates.config = config;
    }
    if (name !== undefined) {
      updates.name = name;
    }

    await stepRef.update(updates);

    // Update flow's updatedAt
    await flowRef.update({
      updatedAt: now,
      lastEditedByUserId: userId,
    });

    // Fetch updated step
    const updatedDoc = await stepRef.get();
    const step = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as OnboardingStep;

    console.log(`[COACH_ORG_ONBOARDING_STEPS] Updated step ${stepId}`);

    return NextResponse.json({ step });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_ONBOARDING_STEPS_PUT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-onboarding-flow/steps/[stepId]
 * Delete a step from an onboarding flow
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();
    const { stepId } = await params;

    // Find the step across all flows for this org
    const flowsSnapshot = await adminDb
      .collection('org_onboarding_flows')
      .where('organizationId', '==', organizationId)
      .get();

    if (flowsSnapshot.empty) {
      return NextResponse.json({ error: 'No flows found' }, { status: 404 });
    }

    let stepRef: FirebaseFirestore.DocumentReference | null = null;
    let flowRef: FirebaseFirestore.DocumentReference | null = null;
    let deletedStepOrder: number | null = null;

    for (const flowDoc of flowsSnapshot.docs) {
      const candidateStepRef = flowDoc.ref.collection('steps').doc(stepId);
      const stepDoc = await candidateStepRef.get();
      if (stepDoc.exists) {
        stepRef = candidateStepRef;
        flowRef = flowDoc.ref;
        deletedStepOrder = stepDoc.data()?.order ?? null;
        break;
      }
    }

    if (!stepRef || !flowRef) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Delete the step
    await stepRef.delete();

    // Reorder remaining steps if needed
    if (deletedStepOrder !== null) {
      const remainingSteps = await flowRef
        .collection('steps')
        .where('order', '>', deletedStepOrder)
        .get();

      const batch = adminDb.batch();
      remainingSteps.docs.forEach(doc => {
        batch.update(doc.ref, {
          order: (doc.data().order as number) - 1,
          updatedAt: now,
        });
      });

      if (!remainingSteps.empty) {
        await batch.commit();
      }
    }

    // Update flow step count
    const newStepCount = await flowRef.collection('steps').count().get();
    await flowRef.update({
      stepCount: newStepCount.data().count,
      updatedAt: now,
      lastEditedByUserId: userId,
    });

    console.log(`[COACH_ORG_ONBOARDING_STEPS] Deleted step ${stepId}`);

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
    console.error('[COACH_ORG_ONBOARDING_STEPS_DELETE]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



