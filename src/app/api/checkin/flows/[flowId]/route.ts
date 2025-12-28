import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { OrgCheckInFlow, CheckInStep } from '@/types';

/**
 * GET /api/checkin/flows/[flowId]
 * Get a specific check-in flow with all its steps
 * 
 * Used by the end-user CheckInFlowRenderer to load and execute a flow
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get flow
    const flowDoc = await adminDb.collection('orgCheckInFlows').doc(flowId).get();
    
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const flow = { id: flowDoc.id, ...flowDoc.data() } as OrgCheckInFlow;

    // Verify organization membership
    if (flow.organizationId !== orgId) {
      return NextResponse.json({ error: 'Flow not available for your organization' }, { status: 403 });
    }

    // Check if flow is enabled
    if (!flow.enabled) {
      return NextResponse.json({ error: 'This check-in flow is disabled' }, { status: 403 });
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
    console.error('[CHECKIN_FLOW_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}




