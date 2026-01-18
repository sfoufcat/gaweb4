/**
 * API: Get upcoming 1:1 coaching call for a chat
 *
 * Returns the next scheduled coaching_1on1 event between the current user
 * and another user, along with the call state (none, scheduled, joinable).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { UnifiedEvent } from '@/types';

type CallState = 'none' | 'scheduled' | 'joinable';

interface UpcomingCallResponse {
  event: UnifiedEvent | null;
  callState: CallState;
}

export async function GET(request: NextRequest): Promise<NextResponse<UpcomingCallResponse | { error: string }>> {
  const { userId, orgId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const otherUserId = searchParams.get('otherUserId');

  if (!otherUserId) {
    return NextResponse.json({ error: 'otherUserId is required' }, { status: 400 });
  }

  try {
    const now = new Date();
    const nowISO = now.toISOString();

    // Query upcoming events where current user is host or attendee
    // We query for coaching_1on1 events that haven't started yet (or started within last 30 min for ongoing calls)
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    // Query 1: Events where current user is host
    const hostQuery = adminDb
      .collection('events')
      .where('hostUserId', '==', userId)
      .where('eventType', '==', 'coaching_1on1')
      .where('status', 'in', ['confirmed', 'pending'])
      .where('startDateTime', '>', thirtyMinAgo)
      .orderBy('startDateTime', 'asc')
      .limit(10);

    // Query 2: Events where current user is attendee
    const attendeeQuery = adminDb
      .collection('events')
      .where('attendeeIds', 'array-contains', userId)
      .where('eventType', '==', 'coaching_1on1')
      .where('status', 'in', ['confirmed', 'pending'])
      .where('startDateTime', '>', thirtyMinAgo)
      .orderBy('startDateTime', 'asc')
      .limit(10);

    const [hostSnapshot, attendeeSnapshot] = await Promise.all([
      hostQuery.get(),
      attendeeQuery.get(),
    ]);

    // Combine and deduplicate results
    const eventsMap = new Map<string, UnifiedEvent>();

    hostSnapshot.docs.forEach((doc) => {
      const event = { id: doc.id, ...doc.data() } as UnifiedEvent;
      eventsMap.set(doc.id, event);
    });

    attendeeSnapshot.docs.forEach((doc) => {
      if (!eventsMap.has(doc.id)) {
        const event = { id: doc.id, ...doc.data() } as UnifiedEvent;
        eventsMap.set(doc.id, event);
      }
    });

    // Filter to only events involving the other user
    const relevantEvents = Array.from(eventsMap.values()).filter((event) => {
      // Check if other user is host or in attendees
      const isOtherUserHost = event.hostUserId === otherUserId;
      const isOtherUserAttendee = event.attendeeIds?.includes(otherUserId);
      return isOtherUserHost || isOtherUserAttendee;
    });

    // Filter by organization if available
    const orgFilteredEvents = orgId
      ? relevantEvents.filter((event) => event.organizationId === orgId)
      : relevantEvents;

    // Sort by start time and get the nearest upcoming event
    const sortedEvents = orgFilteredEvents.sort(
      (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );

    // Find first event that hasn't ended
    const upcomingEvent = sortedEvents.find((event) => {
      const startTime = new Date(event.startDateTime);
      const durationMs = (event.durationMinutes || 60) * 60 * 1000;
      const endTime = new Date(startTime.getTime() + durationMs);
      // Include events that haven't ended yet
      return endTime > now;
    });

    if (!upcomingEvent) {
      return NextResponse.json({ event: null, callState: 'none' });
    }

    // Determine call state
    const startTime = new Date(upcomingEvent.startDateTime);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    let callState: CallState;
    if (startTime <= now) {
      // Event has started - joinable
      callState = 'joinable';
    } else if (startTime <= oneHourFromNow) {
      // Event starts within 1 hour - joinable
      callState = 'joinable';
    } else {
      // Event is more than 1 hour away - scheduled
      callState = 'scheduled';
    }

    return NextResponse.json({
      event: upcomingEvent,
      callState,
    });
  } catch (error) {
    console.error('[UPCOMING_CALL] Error fetching upcoming call:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch upcoming call' },
      { status: 500 }
    );
  }
}
