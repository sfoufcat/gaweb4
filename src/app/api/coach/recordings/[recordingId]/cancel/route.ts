/**
 * Cancel Recording API
 *
 * Allows coaches to cancel/delete a stuck recording that's in progress.
 * This removes the uploaded_recordings document and optionally the storage file.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UserRole, OrgRole, ClerkPublicMetadata } from '@/types';

/**
 * DELETE /api/coach/recordings/[recordingId]/cancel
 *
 * Cancels a recording that's stuck in processing.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const { recordingId } = await params;

    // Get the recording document
    const recordingRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('uploaded_recordings')
      .doc(recordingId);

    const recordingDoc = await recordingRef.get();

    if (!recordingDoc.exists) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    const recording = recordingDoc.data();

    // Only allow cancelling recordings that are still in progress
    const cancellableStatuses = ['uploaded', 'transcribing', 'summarizing', 'failed'];
    if (!cancellableStatuses.includes(recording?.status)) {
      return NextResponse.json(
        { error: 'Cannot cancel a completed recording' },
        { status: 400 }
      );
    }

    // Try to delete the storage file if it exists
    if (recording?.storagePath) {
      try {
        const bucket = adminStorage.bucket();
        const file = bucket.file(recording.storagePath);
        await file.delete();
        console.log(`[CANCEL_RECORDING] Deleted storage file: ${recording.storagePath}`);
      } catch (storageErr) {
        // Log but don't fail - file might already be deleted or not exist
        console.warn(`[CANCEL_RECORDING] Could not delete storage file: ${storageErr}`);
      }
    }

    // Delete the recording document
    await recordingRef.delete();

    console.log(`[CANCEL_RECORDING] Cancelled recording ${recordingId} for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      message: 'Recording cancelled successfully',
    });
  } catch (error) {
    console.error('[CANCEL_RECORDING] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
