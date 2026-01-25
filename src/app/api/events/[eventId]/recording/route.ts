/**
 * API Route: Event Recording Management
 *
 * PATCH /api/events/[eventId]/recording - Set recording on an event
 *
 * Supports two modes:
 * 1. Bunny Stream: Pass bunnyVideoId - webhook will set URL when encoding completes
 * 2. Direct URL: Pass recordingUrl for external recordings (Zoom, etc.)
 *
 * Summary generation happens separately via /api/events/[eventId]/generate-summary.
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
    const { recordingUrl, bunnyVideoId } = body;

    // Must provide either recordingUrl or bunnyVideoId
    if (!recordingUrl && !bunnyVideoId) {
      return NextResponse.json(
        { error: 'Either recordingUrl or bunnyVideoId is required' },
        { status: 400 }
      );
    }

    // Validate recordingUrl if provided
    if (recordingUrl) {
      if (typeof recordingUrl !== 'string') {
        return NextResponse.json(
          { error: 'recordingUrl must be a string' },
          { status: 400 }
        );
      }
      try {
        new URL(recordingUrl);
      } catch {
        return NextResponse.json(
          { error: 'Invalid recording URL format' },
          { status: 400 }
        );
      }
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

    // Build update object based on what was provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (bunnyVideoId) {
      // Bunny upload - webhook will set recordingUrl when encoding completes
      updateData.bunnyVideoId = bunnyVideoId;
      updateData.recordingStatus = 'encoding'; // Will become 'ready' via webhook
      updateData.hasCallRecording = false; // Will become true via webhook

      console.log(
        `[EVENT_RECORDING] Bunny video ${bunnyVideoId} linked to event ${eventId} by user ${userId}`
      );
    } else if (recordingUrl) {
      // Direct URL (external recording like Zoom)
      updateData.recordingUrl = recordingUrl;
      updateData.hasCallRecording = true;
      updateData.recordingStatus = 'ready'; // Ready for user to click "Get Summary"

      console.log(
        `[EVENT_RECORDING] Recording URL set for event ${eventId} by user ${userId}`
      );
    }

    await eventRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: bunnyVideoId
        ? 'Recording upload started - will be ready after encoding'
        : 'Recording URL added successfully',
      eventId,
      bunnyVideoId: bunnyVideoId || undefined,
      recordingUrl: recordingUrl || undefined,
      status: bunnyVideoId ? 'encoding' : 'ready',
    });
  } catch (error) {
    console.error('[EVENT_RECORDING] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update event recording' },
      { status: 500 }
    );
  }
}
