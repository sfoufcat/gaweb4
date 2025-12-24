import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { nanoid } from 'nanoid';
import type { FlowSession, Funnel, ProgramInvite } from '@/types';

/**
 * POST /api/funnel/session
 * Create a new flow session for a funnel
 * 
 * Body:
 * - funnelId: string (required)
 * - inviteCode?: string (optional invite code)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { funnelId, inviteCode } = body;

    if (!funnelId) {
      return NextResponse.json(
        { error: 'Funnel ID is required' },
        { status: 400 }
      );
    }

    // Verify funnel exists and is active
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json(
        { error: 'Funnel not found' },
        { status: 404 }
      );
    }

    const funnel = funnelDoc.data() as Funnel;
    
    if (!funnel.isActive) {
      return NextResponse.json(
        { error: 'This funnel is no longer accepting new users' },
        { status: 403 }
      );
    }

    // Handle invite code if provided
    let invite: ProgramInvite | null = null;
    let inviteId: string | null = null;

    if (inviteCode) {
      const inviteDoc = await adminDb.collection('program_invites').doc(inviteCode.toUpperCase()).get();
      
      if (!inviteDoc.exists) {
        return NextResponse.json(
          { error: 'Invalid invite code' },
          { status: 400 }
        );
      }

      invite = inviteDoc.data() as ProgramInvite;
      
      // Check if invite is for this funnel or program
      if (invite.funnelId !== funnelId && invite.programId !== funnel.programId) {
        return NextResponse.json(
          { error: 'This invite code is not valid for this funnel' },
          { status: 400 }
        );
      }

      // Check if expired
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        return NextResponse.json(
          { error: 'This invite code has expired' },
          { status: 400 }
        );
      }

      // Check max uses
      if (invite.maxUses && invite.useCount >= invite.maxUses) {
        return NextResponse.json(
          { error: 'This invite code has reached its maximum uses' },
          { status: 400 }
        );
      }

      inviteId = inviteCode.toUpperCase();
    } else if (funnel.accessType === 'invite_only') {
      return NextResponse.json(
        { error: 'This funnel requires an invite code' },
        { status: 403 }
      );
    }

    // Get origin domain from headers
    const headersList = await headers();
    const originDomain = headersList.get('host') || headersList.get('x-forwarded-host') || 'unknown';

    // Generate session ID
    const sessionId = `flow_${nanoid(16)}`;

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const now = new Date().toISOString();

    const flowSession: FlowSession = {
      id: sessionId,
      funnelId,
      programId: funnel.programId,
      organizationId: funnel.organizationId,
      userId: null,
      linkedAt: null,
      inviteId,
      currentStepIndex: 0,
      completedStepIndexes: [],
      data: {},
      originDomain,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresAt.toISOString(),
    };

    // Save to Firestore
    await adminDb.collection('flow_sessions').doc(sessionId).set(flowSession);

    console.log(`[FUNNEL_SESSION] Created flow session ${sessionId} for funnel ${funnelId}`);

    return NextResponse.json({
      success: true,
      sessionId,
      session: flowSession,
      // Include invite details if applicable
      invite: invite ? {
        paymentStatus: invite.paymentStatus,
        targetSquadId: invite.targetSquadId,
        targetCohortId: invite.targetCohortId,
      } : null,
    });
  } catch (error) {
    console.error('[FUNNEL_SESSION_POST]', error);
    return NextResponse.json(
      { error: 'Failed to create flow session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/funnel/session
 * Retrieve a flow session
 * 
 * Query params:
 * - sessionId: string (required)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Validate session ID format
    if (!sessionId.startsWith('flow_')) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Get from Firestore
    const sessionDoc = await adminDb.collection('flow_sessions').doc(sessionId).get();

    if (!sessionDoc.exists) {
      return NextResponse.json(
        { session: null },
        { status: 200 }
      );
    }

    const session = sessionDoc.data() as FlowSession;

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { session: null, expired: true },
        { status: 200 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('[FUNNEL_SESSION_GET]', error);
    return NextResponse.json(
      { error: 'Failed to get flow session' },
      { status: 500 }
    );
  }
}


