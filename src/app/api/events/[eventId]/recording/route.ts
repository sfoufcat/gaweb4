/**
 * API Route: Event Recording Management
 *
 * PATCH /api/events/[eventId]/recording - Set recording URL on an event
 *
 * This endpoint allows coaches to attach a recording URL to an event
 * without triggering summary generation. Summary generation happens
 * separately via /api/events/[eventId]/generate-summary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UnifiedEvent } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const body = await request.json();
    const { recordingUrl } = body;

    if (!recordingUrl || typeof recordingUrl !== 'string') {
      return NextResponse.json(
        { error: 'recordingUrl is required and must be a string' },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(recordingUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid recording URL format' },
        { status: 400 }
      );
    }

    // Get existing event
    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const existingEvent = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    // Check permissions - must be host, creator, or coach/admin
    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const isAdmin = role === 'coach' || role === 'super_admin' || role === 'admin';
    const isCreator = existingEvent.createdByUserId === userId;
    const isHost = existingEvent.hostUserId === userId;

    if (!isAdmin && !isCreator && !isHost) {
      return NextResponse.json(
        { error: 'Only the event host or a coach can add recordings' },
        { status: 403 }
      );
    }

    // Update the event with recording info
    await eventRef.update({
      recordingUrl,
      hasCallRecording: true,
      recordingStatus: 'ready', // Ready for user to click "Get Summary"
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[EVENT_RECORDING] Recording URL set for event ${eventId} by user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Recording URL added successfully',
      eventId,
      recordingUrl,
    });
  } catch (error) {
    console.error('[EVENT_RECORDING] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update event recording' },
      { status: 500 }
    );
  }
}
