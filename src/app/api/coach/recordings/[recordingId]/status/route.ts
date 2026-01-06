/**
 * Recording Status API
 *
 * Returns the status of a recording upload and its associated call summary.
 * Used for polling during async processing.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UserRole, OrgRole, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/coach/recordings/[recordingId]/status
 *
 * Returns the current status of a recording upload.
 */
export async function GET(
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
    const recordingDoc = await adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('uploaded_recordings')
      .doc(recordingId)
      .get();

    if (!recordingDoc.exists) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    const recording = recordingDoc.data();

    return NextResponse.json({
      status: recording?.status || 'unknown',
      callSummaryId: recording?.callSummaryId || null,
      error: recording?.processingError || null,
      durationSeconds: recording?.durationSeconds || null,
    });
  } catch (error) {
    console.error('[RECORDING_STATUS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
