import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { OrgCheckInFlow, CheckInStep, CheckInFlowType } from '@/types';

// Ensure this route is never cached - coaches expect immediate updates
export const dynamic = 'force-dynamic';

/**
 * GET /api/checkin/flows
 * Get available check-in flows for the authenticated user's organization
 * 
 * Query params:
 * - type?: 'morning' | 'evening' | 'weekly' (get specific flow type)
 * - enabledOnly?: 'true' (default: true - only get enabled flows)
 * 
 * Used by end-user app to determine which check-ins are available
 */
export async function GET(req: Request) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as CheckInFlowType | null;
    const enabledOnly = searchParams.get('enabledOnly') !== 'false';

    // Build query - only filter by organizationId and type in Firestore
    // Filter by enabled in memory to avoid composite index requirements
    let query = adminDb
      .collection('orgCheckInFlows')
      .where('organizationId', '==', orgId);

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();

    let flows = snapshot.docs.map(doc => {
      const data = doc.data() as Omit<OrgCheckInFlow, 'id'>;
      return {
        id: doc.id,
        name: data.name,
        type: data.type,
        description: data.description,
        enabled: data.enabled,
        stepCount: data.stepCount,
      };
    });

    // Filter by enabled status in memory (avoids needing composite index)
    // Use !== false to treat undefined/missing enabled field as true (default)
    if (enabledOnly) {
      flows = flows.filter(flow => flow.enabled !== false);
    }

    return NextResponse.json({ flows });
  } catch (error) {
    console.error('[CHECKIN_FLOWS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

