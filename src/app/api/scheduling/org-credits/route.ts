/**
 * API Route: Organization Transcription Credits Check
 *
 * GET /api/scheduling/org-credits
 * Returns whether the organization has transcription credits available.
 * Used to warn users before joining non-program calls.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

interface OrgCreditsResponse {
  hasCredits: boolean;
  remainingMinutes: number;
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
        remainingMinutes: 0,
      } as OrgCreditsResponse);
    }

    // Calculate remaining minutes
    const allocatedMinutes = summaryCredits.allocatedMinutes ?? 0;
    const usedMinutes = summaryCredits.usedMinutes ?? 0;
    const purchasedMinutes = summaryCredits.purchasedMinutes ?? 0;
    const usedPurchasedMinutes = summaryCredits.usedPurchasedMinutes ?? 0;

    // Calculate remaining from plan allocation
    const planRemaining = Math.max(0, allocatedMinutes - usedMinutes);
    // Calculate remaining from purchased credits
    const purchasedRemaining = Math.max(0, purchasedMinutes - usedPurchasedMinutes);
    // Total remaining
    const totalRemaining = planRemaining + purchasedRemaining;

    const response: OrgCreditsResponse = {
      hasCredits: totalRemaining > 0,
      remainingMinutes: totalRemaining,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ORG_CREDITS_GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
