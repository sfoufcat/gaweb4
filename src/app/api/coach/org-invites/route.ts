import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCoachRole, getCoachOrganizationId } from '@/lib/admin-utils-clerk';
import { nanoid } from 'nanoid';
import type { ProgramInvite, Funnel } from '@/types';

/**
 * GET /api/coach/org-invites
 * Get all invites for the coach's organization
 * 
 * Query params:
 * - programId?: string (filter by program)
 * - funnelId?: string (filter by funnel)
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isCoach = await verifyCoachRole(userId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Forbidden - Coach access required' }, { status: 403 });
    }

    const organizationId = await getCoachOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get('programId');
    const funnelId = searchParams.get('funnelId');

    // Build query
    let query = adminDb
      .collection('program_invites')
      .where('organizationId', '==', organizationId);

    if (programId) {
      query = query.where('programId', '==', programId);
    }
    if (funnelId) {
      query = query.where('funnelId', '==', funnelId);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').limit(100).get();

    const invites = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ProgramInvite[];

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('[COACH_ORG_INVITES_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-invites
 * Create a new invite code
 * 
 * Body:
 * - funnelId: string (required)
 * - email?: string (for email invite)
 * - name?: string (invitee name)
 * - paymentStatus?: 'required' | 'pre_paid' | 'free'
 * - prePaidNote?: string
 * - targetSquadId?: string
 * - targetCohortId?: string
 * - maxUses?: number
 * - expiresAt?: string (ISO date)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isCoach = await verifyCoachRole(userId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Forbidden - Coach access required' }, { status: 403 });
    }

    const organizationId = await getCoachOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const body = await req.json();
    const { 
      funnelId, 
      email, 
      name,
      paymentStatus = 'required',
      prePaidNote,
      targetSquadId,
      targetCohortId,
      maxUses,
      expiresAt,
    } = body;

    if (!funnelId) {
      return NextResponse.json({ error: 'Funnel ID is required' }, { status: 400 });
    }

    // Verify funnel belongs to org and get programId
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }
    const funnel = funnelDoc.data() as Funnel;
    if (funnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Funnel not in your organization' }, { status: 403 });
    }

    // Generate invite code
    const inviteCode = nanoid(8).toUpperCase();

    const now = new Date().toISOString();
    const inviteData: ProgramInvite = {
      id: inviteCode,
      funnelId,
      programId: funnel.programId,
      organizationId,
      createdBy: userId,
      email: email?.trim().toLowerCase() || undefined,
      name: name?.trim() || undefined,
      paymentStatus,
      prePaidNote: prePaidNote?.trim() || undefined,
      targetSquadId: targetSquadId || undefined,
      targetCohortId: targetCohortId || undefined,
      maxUses: maxUses || undefined,
      useCount: 0,
      expiresAt: expiresAt || undefined,
      createdAt: now,
    };

    // Save invite
    await adminDb.collection('program_invites').doc(inviteCode).set(inviteData);

    console.log(`[COACH_ORG_INVITES] Created invite ${inviteCode} for funnel ${funnelId}`);

    return NextResponse.json({
      success: true,
      invite: inviteData,
    });
  } catch (error) {
    console.error('[COACH_ORG_INVITES_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

