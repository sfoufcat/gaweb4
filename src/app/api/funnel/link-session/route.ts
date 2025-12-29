import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { FlowSession } from '@/types';

/**
 * POST /api/funnel/link-session
 * Link a userId to a flow session after signup
 * 
 * This is called after signup (especially from iframe on custom domains)
 * to associate the newly created user with their ongoing flow session.
 * 
 * Body:
 * - flowSessionId: string (required)
 * 
 * The userId is taken from the authenticated session (Clerk)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - must be authenticated to link session' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { flowSessionId } = body;

    if (!flowSessionId) {
      return NextResponse.json(
        { error: 'Flow session ID is required' },
        { status: 400 }
      );
    }

    // Validate session ID format
    if (!flowSessionId.startsWith('flow_')) {
      return NextResponse.json(
        { error: 'Invalid flow session ID format' },
        { status: 400 }
      );
    }

    // Get the flow session
    const sessionRef = adminDb.collection('flow_sessions').doc(flowSessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json(
        { error: 'Flow session not found' },
        { status: 404 }
      );
    }

    const session = sessionDoc.data() as FlowSession;

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Flow session has expired' },
        { status: 410 }
      );
    }

    // Check if already linked to a different user
    if (session.userId && session.userId !== userId) {
      return NextResponse.json(
        { error: 'This flow session is already linked to a different user' },
        { status: 400 }
      );
    }

    // Check if already linked to this user (idempotent)
    if (session.userId === userId) {
      return NextResponse.json({
        success: true,
        alreadyLinked: true,
        session,
      });
    }

    // Link the session to the user
    const now = new Date().toISOString();
    await sessionRef.update({
      userId,
      linkedAt: now,
      updatedAt: now,
    });

    console.log(`[FUNNEL_LINK_SESSION] Linked flow session ${flowSessionId} to user ${userId}`);

    // Return updated session
    const updatedDoc = await sessionRef.get();
    const updatedSession = updatedDoc.data() as FlowSession;

    return NextResponse.json({
      success: true,
      alreadyLinked: false,
      session: updatedSession,
    });
  } catch (error) {
    console.error('[FUNNEL_LINK_SESSION]', error);
    return NextResponse.json(
      { error: 'Failed to link flow session' },
      { status: 500 }
    );
  }
}








