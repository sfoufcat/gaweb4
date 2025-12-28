import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { FlowSession } from '@/types';

/**
 * PATCH /api/funnel/session/[sessionId]
 * Update a flow session (progress, data, etc.)
 * 
 * Body:
 * - currentStepIndex?: number
 * - completedStepIndex?: number (adds to completedStepIndexes)
 * - data?: Record<string, unknown> (merged with existing data)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await req.json();
    const { currentStepIndex, completedStepIndex, data } = body;

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

    // Get existing session
    const sessionRef = adminDb.collection('flow_sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = sessionDoc.data() as FlowSession;

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Session has expired' },
        { status: 410 }
      );
    }

    // Check if already completed
    if (session.completedAt) {
      return NextResponse.json(
        { error: 'Session has already been completed' },
        { status: 400 }
      );
    }

    // Build update object
    const updates: Partial<FlowSession> & { updatedAt: string } = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof currentStepIndex === 'number') {
      updates.currentStepIndex = currentStepIndex;
    }

    if (typeof completedStepIndex === 'number') {
      // Add to completed steps if not already there
      const completedSteps = session.completedStepIndexes || [];
      if (!completedSteps.includes(completedStepIndex)) {
        updates.completedStepIndexes = [...completedSteps, completedStepIndex];
      }
    }

    if (data && typeof data === 'object') {
      // Merge with existing data
      updates.data = {
        ...session.data,
        ...data,
      };
    }

    // Update in Firestore
    await sessionRef.update(updates);

    // Return updated session
    const updatedDoc = await sessionRef.get();
    const updatedSession = updatedDoc.data() as FlowSession;

    return NextResponse.json({
      success: true,
      session: updatedSession,
    });
  } catch (error) {
    console.error('[FUNNEL_SESSION_PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update flow session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/funnel/session/[sessionId]
 * Get a specific flow session by ID
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

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
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = sessionDoc.data() as FlowSession;

    // Check if expired
    const isExpired = new Date(session.expiresAt) < new Date();

    return NextResponse.json({
      session,
      isExpired,
    });
  } catch (error) {
    console.error('[FUNNEL_SESSION_GET]', error);
    return NextResponse.json(
      { error: 'Failed to get flow session' },
      { status: 500 }
    );
  }
}







