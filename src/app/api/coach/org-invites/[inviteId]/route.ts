import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { ProgramInvite } from '@/types';

/**
 * GET /api/coach/org-invites/[inviteId]
 * Get a specific invite
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { inviteId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    const inviteDoc = await adminDb.collection('program_invites').doc(inviteId).get();
    
    if (!inviteDoc.exists) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const invite = inviteDoc.data() as ProgramInvite;

    if (invite.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Invite not in your organization' }, { status: 403 });
    }

    return NextResponse.json({ invite: { ...invite, id: inviteDoc.id } });
  } catch (error) {
    console.error('[COACH_INVITE_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-invites/[inviteId]
 * Update an invite
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { inviteId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    const inviteDoc = await adminDb.collection('program_invites').doc(inviteId).get();
    
    if (!inviteDoc.exists) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const invite = inviteDoc.data() as ProgramInvite;

    if (invite.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Invite not in your organization' }, { status: 403 });
    }

    // Can't update if already used
    if (invite.usedBy) {
      return NextResponse.json({ error: 'Cannot modify a used invite' }, { status: 400 });
    }

    const body = await req.json();
    const { paymentStatus, prePaidNote, maxUses, expiresAt, targetSquadId, targetCohortId } = body;

    const updates: Partial<ProgramInvite> = {};

    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
    if (prePaidNote !== undefined) updates.prePaidNote = prePaidNote || undefined;
    if (maxUses !== undefined) updates.maxUses = maxUses || undefined;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt || undefined;
    if (targetSquadId !== undefined) updates.targetSquadId = targetSquadId || undefined;
    if (targetCohortId !== undefined) updates.targetCohortId = targetCohortId || undefined;

    await adminDb.collection('program_invites').doc(inviteId).update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_INVITE_PUT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-invites/[inviteId]
 * Delete an invite
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { inviteId } = await params;
    const { organizationId } = await requireCoachWithOrg();

    const inviteDoc = await adminDb.collection('program_invites').doc(inviteId).get();
    
    if (!inviteDoc.exists) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const invite = inviteDoc.data() as ProgramInvite;

    if (invite.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Invite not in your organization' }, { status: 403 });
    }

    await adminDb.collection('program_invites').doc(inviteId).delete();

    console.log(`[COACH_INVITE_DELETE] Deleted invite ${inviteId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_INVITE_DELETE]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
