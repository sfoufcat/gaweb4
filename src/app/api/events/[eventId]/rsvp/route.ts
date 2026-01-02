/**
 * API Route: Event RSVP
 * 
 * POST /api/events/[eventId]/rsvp - Join or leave an event
 * 
 * Body: { action: 'join' | 'leave' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UnifiedEvent } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const { action } = await request.json();

    if (!action || !['join', 'leave'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "join" or "leave"' },
        { status: 400 }
      );
    }

    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = eventDoc.data() as UnifiedEvent;

    // Check if event is in a state that allows RSVPs
    if (eventData.status === 'canceled' || eventData.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot RSVP to a canceled or completed event' },
        { status: 400 }
      );
    }

    // Check capacity for join action
    if (action === 'join' && eventData.maxAttendees) {
      const currentAttendees = eventData.attendeeIds?.length || 0;
      if (currentAttendees >= eventData.maxAttendees) {
        return NextResponse.json(
          { error: 'Event is at full capacity' },
          { status: 400 }
        );
      }
    }

    if (action === 'join') {
      await eventRef.update({
        attendeeIds: FieldValue.arrayUnion(userId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await eventRef.update({
        attendeeIds: FieldValue.arrayRemove(userId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Fetch updated attendee count
    const updatedDoc = await eventRef.get();
    const attendeeIds = updatedDoc.data()?.attendeeIds || [];

    console.log(`[EVENT_RSVP] User ${userId} ${action}ed event ${eventId}`);

    return NextResponse.json({
      success: true,
      action: action === 'join' ? 'joined' : 'left',
      totalAttendees: attendeeIds.length,
      isJoined: action === 'join',
    });
  } catch (error) {
    console.error('[EVENT_RSVP] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update RSVP' },
      { status: 500 }
    );
  }
}










