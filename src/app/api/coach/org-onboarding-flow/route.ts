import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { withDemoMode, demoNotAvailable } from '@/lib/demo-api';
import type { OrgOnboardingFlow } from '@/types';

/**
 * GET /api/coach/org-onboarding-flow
 * Get the onboarding flow for the coach's organization
 * Each organization has at most one onboarding flow
 */
export async function GET() {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('org-onboarding-flow');
    if (demoData) return demoData;
    
    const { organizationId } = await requireCoachWithOrg();

    // Get the onboarding flow for this org (should only be one)
    const snapshot = await adminDb
      .collection('org_onboarding_flows')
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    let flow: OrgOnboardingFlow | null = null;
    let responseCount = 0;

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      flow = {
        id: doc.id,
        ...doc.data(),
      } as OrgOnboardingFlow;

      // Get response count
      const responsesSnapshot = await adminDb
        .collection('onboarding_responses')
        .where('organizationId', '==', organizationId)
        .where('flowId', '==', flow.id)
        .count()
        .get();
      
      responseCount = responsesSnapshot.data().count;
    }

    return NextResponse.json({ flow, responseCount });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_ONBOARDING_FLOW_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-onboarding-flow
 * Create a new onboarding flow for the organization
 * 
 * Body:
 * - name: string
 * - description?: string
 */
export async function POST(req: Request) {
  try {
    // Demo mode: block write operations
    const demoData = await withDemoMode('org-onboarding-flow');
    if (demoData) return demoNotAvailable('Creating onboarding flows');
    
    const { organizationId, userId } = await requireCoachWithOrg();

    const body = await req.json();
    const { name, description } = body as {
      name: string;
      description?: string;
    };

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check if a flow already exists
    const existingSnapshot = await adminDb
      .collection('org_onboarding_flows')
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      return NextResponse.json({ 
        error: 'An onboarding flow already exists for this organization' 
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create the flow
    const flowRef = adminDb.collection('org_onboarding_flows').doc();
    const flowData: Omit<OrgOnboardingFlow, 'id'> = {
      organizationId,
      name: name.trim(),
      description: description?.trim(),
      enabled: false, // Start disabled so coach can configure first
      stepCount: 0,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    };

    await flowRef.set(flowData);

    const flow: OrgOnboardingFlow = {
      id: flowRef.id,
      ...flowData,
    };

    console.log(`[COACH_ORG_ONBOARDING_FLOW] Created flow ${flow.id} for org ${organizationId}`);

    return NextResponse.json({ flow }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_ONBOARDING_FLOW_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-onboarding-flow
 * Update the onboarding flow settings (enable/disable, name, etc.)
 * 
 * Body (all optional):
 * - enabled?: boolean
 * - name?: string
 * - description?: string
 */
export async function PUT(req: Request) {
  try {
    // Demo mode: block write operations
    const demoData = await withDemoMode('org-onboarding-flow');
    if (demoData) return demoNotAvailable('Updating onboarding flows');
    
    const { organizationId, userId } = await requireCoachWithOrg();

    const body = await req.json();
    const { enabled, name, description } = body as {
      enabled?: boolean;
      name?: string;
      description?: string;
    };

    // Get the existing flow
    const snapshot = await adminDb
      .collection('org_onboarding_flows')
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'No onboarding flow found' }, { status: 404 });
    }

    const flowRef = snapshot.docs[0].ref;
    const now = new Date().toISOString();

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: now,
      lastEditedByUserId: userId,
    };

    if (typeof enabled === 'boolean') {
      updates.enabled = enabled;
    }
    if (name !== undefined) {
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = description.trim();
    }

    await flowRef.update(updates);

    // Fetch updated flow
    const updatedDoc = await flowRef.get();
    const flow = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as OrgOnboardingFlow;

    console.log(`[COACH_ORG_ONBOARDING_FLOW] Updated flow ${flow.id}: enabled=${flow.enabled}`);

    return NextResponse.json({ flow });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_ONBOARDING_FLOW_PUT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



