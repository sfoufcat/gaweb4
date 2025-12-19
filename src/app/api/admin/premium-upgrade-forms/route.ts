import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/admin-utils-shared';
import type { PremiumUpgradeForm, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/admin/premium-upgrade-forms
 * 
 * Fetches all premium upgrade form submissions for the admin panel.
 * Only accessible by admins and super_admins.
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permissions
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    if (!isAdmin(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all premium upgrade forms, sorted by createdAt descending
    const formsSnapshot = await adminDb
      .collection('premiumUpgradeForms')
      .orderBy('createdAt', 'desc')
      .get();

    const forms: PremiumUpgradeForm[] = formsSnapshot.docs.map(doc => ({
      ...doc.data() as PremiumUpgradeForm,
      id: doc.id,
    }));

    return NextResponse.json({
      success: true,
      forms,
      total: forms.length,
    });

  } catch (error) {
    console.error('[ADMIN_PREMIUM_FORMS] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch premium upgrade forms.';
    return NextResponse.json(
      { error: message }, 
      { status: 500 }
    );
  }
}

