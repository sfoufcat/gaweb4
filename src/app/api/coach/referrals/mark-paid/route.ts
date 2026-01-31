import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';

/**
 * POST /api/coach/referrals/mark-paid
 *
 * Marks all pending monetary referrals for a referrer as paid.
 * Updates paymentStatus to 'paid' and records paidAt and paidAmount.
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    const { referrerId, amount } = body;

    if (!referrerId) {
      return NextResponse.json({ error: 'referrerId is required' }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    // Find all unpaid referrals for this referrer with monetary rewards
    const referralsSnapshot = await adminDb
      .collection('referrals')
      .where('organizationId', '==', organizationId)
      .where('referrerId', '==', referrerId)
      .where('status', 'in', ['completed', 'rewarded'])
      .get();

    const batch = adminDb.batch();
    let totalMarkedPaid = 0;
    let referralsUpdated = 0;

    for (const doc of referralsSnapshot.docs) {
      const data = doc.data();

      // Only process monetary rewards that haven't been paid
      if (data.rewardType === 'monetary' && data.paymentStatus !== 'paid') {
        const monetaryAmount = data.rewardDetails?.monetaryAmount || 0;

        batch.update(doc.ref, {
          paymentStatus: 'paid',
          paidAt: new Date().toISOString(),
          paidAmount: monetaryAmount,
          updatedAt: FieldValue.serverTimestamp(),
        });

        totalMarkedPaid += monetaryAmount;
        referralsUpdated++;
      }
    }

    if (referralsUpdated === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending payments found',
        referralsUpdated: 0,
        totalMarkedPaid: 0,
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      referralsUpdated,
      totalMarkedPaid,
    });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }

    console.error('Error marking referrals as paid:', error);
    return NextResponse.json(
      { error: 'Failed to mark referrals as paid' },
      { status: 500 }
    );
  }
}
