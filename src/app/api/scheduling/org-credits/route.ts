/**
 * API Route: Organization Credits Check
 *
 * GET /api/scheduling/org-credits
 * Returns whether the organization has credits available.
 * Used to warn users before joining non-program calls.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

interface OrgCreditsResponse {
  hasCredits: boolean;
  remainingCredits: number;
  purchaseUrl?: string;
}

export async function GET() {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    // Fetch organization to check summary credits
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();

    if (!orgDoc.exists) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgData = orgDoc.data();
    const summaryCredits = orgData?.summaryCredits;

    if (!summaryCredits) {
      // No credits configured
      return NextResponse.json({
        hasCredits: false,
        remainingCredits: 0,
      } as OrgCreditsResponse);
    }

    // Calculate remaining credits
    const allocatedCredits = summaryCredits.allocatedCredits ?? 0;
    const usedCredits = summaryCredits.usedCredits ?? 0;
    const purchasedCredits = summaryCredits.purchasedCredits ?? 0;
    const usedPurchasedCredits = summaryCredits.usedPurchasedCredits ?? 0;

    // Calculate remaining from plan allocation
    const planRemaining = Math.max(0, allocatedCredits - usedCredits);
    // Calculate remaining from purchased credits
    const purchasedRemaining = Math.max(0, purchasedCredits - usedPurchasedCredits);
    // Total remaining
    const totalRemaining = planRemaining + purchasedRemaining;

    const response: OrgCreditsResponse = {
      hasCredits: totalRemaining > 0,
      remainingCredits: totalRemaining,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ORG_CREDITS_GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
