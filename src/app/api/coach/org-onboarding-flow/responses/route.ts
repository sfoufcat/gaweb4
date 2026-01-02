import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { clerkClient } from '@clerk/nextjs/server';
import type { OnboardingResponse } from '@/types';

interface ResponseWithUser extends OnboardingResponse {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    imageUrl?: string;
  };
}

/**
 * GET /api/coach/org-onboarding-flow/responses
 * Get all onboarding responses for the organization
 * 
 * Query params:
 * - flowId: string (required)
 * - status?: 'completed' | 'in_progress' | 'abandoned'
 * - limit?: number (default 50)
 */
export async function GET(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(req.url);
    const flowId = searchParams.get('flowId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

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

    // Build query
    let query = adminDb
      .collection('onboarding_responses')
      .where('organizationId', '==', organizationId)
      .where('flowId', '==', flowId);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get();

    const responses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as OnboardingResponse[];

    // Fetch user data for each response
    const userIds = [...new Set(responses.map(r => r.userId))];
    const clerk = await clerkClient();
    
    const usersMap = new Map<string, ResponseWithUser['user']>();
    
    // Batch fetch users (Clerk doesn't have a batch API, but we can use Promise.all)
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const user = await clerk.users.getUser(userId);
          usersMap.set(userId, {
            id: user.id,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.emailAddresses[0]?.emailAddress || '',
            imageUrl: user.imageUrl,
          });
        } catch (error) {
          console.error(`Failed to fetch user ${userId}:`, error);
        }
      })
    );

    // Combine responses with user data
    const responsesWithUsers: ResponseWithUser[] = responses.map(response => ({
      ...response,
      user: usersMap.get(response.userId),
    }));

    return NextResponse.json({ responses: responsesWithUsers });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_ONBOARDING_RESPONSES_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



