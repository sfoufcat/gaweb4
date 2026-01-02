import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { OrgCheckInFlow } from '@/types';

/**
 * POST /api/checkin/sessions
 * Save a check-in session when a flow is completed
 * 
 * Body:
 * - flowId: string (required) - The flow that was completed
 * - sessionData?: object - Optional data collected during the flow
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization required' }, { status: 400 });
    }

    const body = await req.json();
    const { flowId, sessionData } = body;

    if (!flowId) {
      return NextResponse.json({ error: 'flowId is required' }, { status: 400 });
    }

    // Verify the flow exists and belongs to the user's organization
    const flowDoc = await adminDb.collection('orgCheckInFlows').doc(flowId).get();
    
    if (!flowDoc.exists) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const flow = flowDoc.data() as OrgCheckInFlow;
    
    if (flow.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Flow not available for your organization' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Create the session record
    const sessionRecord = {
      flowId,
      flowType: flow.type,
      flowName: flow.name,
      userId,
      organizationId,
      completedAt: now,
      createdAt: now,
      ...(sessionData && Object.keys(sessionData).length > 0 ? { sessionData } : {}),
    };

    const sessionRef = await adminDb.collection('checkInSessions').add(sessionRecord);

    return NextResponse.json({ 
      success: true, 
      sessionId: sessionRef.id,
    });
  } catch (error) {
    console.error('[CHECKIN_SESSIONS_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * GET /api/checkin/sessions
 * Get check-in sessions for the current user
 * 
 * Query params:
 * - flowId?: string - Filter by specific flow
 * - date?: string - Filter by date (YYYY-MM-DD)
 * - limit?: number - Max results (default: 50)
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization required' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const flowId = searchParams.get('flowId');
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let query = adminDb
      .collection('checkInSessions')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId);

    if (flowId) {
      query = query.where('flowId', '==', flowId);
    }

    if (date) {
      // Filter by date range
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;
      query = query
        .where('completedAt', '>=', startOfDay)
        .where('completedAt', '<=', endOfDay);
    }

    const snapshot = await query
      .orderBy('completedAt', 'desc')
      .limit(limit)
      .get();

    const sessions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[CHECKIN_SESSIONS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}









