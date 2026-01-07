import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { OrgCheckInFlow, CheckInStep, CheckInFlowType } from '@/types';

/**
 * GET /api/checkin/flows/by-type/[type]
 * Get the enabled check-in flow for a specific type (morning/evening/weekly)
 *
 * This is the primary endpoint for the check-in pages to load their flow
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org ID from tenant context (subdomain) for proper multi-tenancy
    const orgId = await getEffectiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 });
    }

    // Validate type
    if (!['morning', 'evening', 'weekly'].includes(type)) {
      return NextResponse.json({ error: 'Invalid flow type' }, { status: 400 });
    }

    // Find the enabled flow for this type
    const flowsSnapshot = await adminDb
      .collection('orgCheckInFlows')
      .where('organizationId', '==', orgId)
      .where('type', '==', type as CheckInFlowType)
      .where('enabled', '==', true)
      .where('isSystemDefault', '==', true) // Prioritize system default
      .limit(1)
      .get();

    // If no system default found, try any enabled flow of this type
    let flowDoc = flowsSnapshot.docs[0];
    if (!flowDoc) {
      const anyFlowSnapshot = await adminDb
        .collection('orgCheckInFlows')
        .where('organizationId', '==', orgId)
        .where('type', '==', type as CheckInFlowType)
        .where('enabled', '==', true)
        .limit(1)
        .get();
      
      flowDoc = anyFlowSnapshot.docs[0];
    }

    if (!flowDoc) {
      return NextResponse.json({ 
        error: 'No enabled check-in flow found for this type',
        flowDisabled: true,
      }, { status: 404 });
    }

    const flow = { id: flowDoc.id, ...flowDoc.data() } as OrgCheckInFlow;

    // Get steps
    const stepsSnapshot = await adminDb
      .collection('orgCheckInFlows')
      .doc(flow.id)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    const steps = stepsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CheckInStep[];

    return NextResponse.json({ 
      flow: {
        id: flow.id,
        name: flow.name,
        type: flow.type,
        description: flow.description,
      },
      steps,
    });
  } catch (error) {
    console.error('[CHECKIN_FLOW_BY_TYPE_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}









