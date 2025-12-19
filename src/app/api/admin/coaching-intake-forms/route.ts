import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/admin-utils-shared';
import type { CoachingIntakeForm, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/admin/coaching-intake-forms
 * 
 * Fetches all coaching intake form submissions for the admin panel.
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

    // Fetch all coaching intake forms, sorted by createdAt descending
    const formsSnapshot = await adminDb
      .collection('coachingIntakeForms')
      .orderBy('createdAt', 'desc')
      .get();

    const forms: CoachingIntakeForm[] = formsSnapshot.docs.map(doc => ({
      ...doc.data() as CoachingIntakeForm,
      id: doc.id,
    }));

    return NextResponse.json({
      success: true,
      forms,
      total: forms.length,
    });

  } catch (error) {
    console.error('[ADMIN_COACHING_FORMS] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch coaching intake forms.';
    return NextResponse.json(
      { error: message }, 
      { status: 500 }
    );
  }
}









