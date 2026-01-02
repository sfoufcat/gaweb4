import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { revokeGrant, isNylasConfigured } from '@/lib/nylas';
import type { NylasGrant } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/nylas/disconnect
 * Disconnect the calendar integration
 */
export async function POST() {
  try {
    if (!isNylasConfigured) {
      return NextResponse.json(
        { error: 'Calendar integration is not configured' },
        { status: 503 }
      );
    }

    const { userId, organizationId } = await requireCoachWithOrg();

    // Get the Nylas grant
    const grantRef = adminDb.collection('nylas_grants').doc(`${organizationId}_${userId}`);
    const grantDoc = await grantRef.get();

    if (!grantDoc.exists) {
      return NextResponse.json(
        { error: 'No calendar connected' },
        { status: 404 }
      );
    }

    const grant = grantDoc.data() as NylasGrant;

    // Revoke the grant in Nylas
    try {
      await revokeGrant(grant.grantId);
    } catch (err) {
      // Continue even if revoke fails - the grant may already be invalid
      console.warn('[NYLAS_DISCONNECT] Failed to revoke grant in Nylas:', err);
    }

    // Delete the grant from Firestore
    await grantRef.delete();

    // Update coach availability to remove calendar connection
    const now = new Date().toISOString();
    await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .update({
        nylasGrantId: FieldValue.delete(),
        connectedCalendarId: FieldValue.delete(),
        connectedCalendarName: FieldValue.delete(),
        updatedAt: now,
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NYLAS_DISCONNECT] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

