import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { createEvent, updateEvent, deleteEvent, isNylasConfigured } from '@/lib/nylas';
import type { NylasGrant, UnifiedEvent, CoachAvailability } from '@/types';

/**
 * POST /api/nylas/sync-event
 * Push a scheduled event to the external calendar
 */
export async function POST(request: NextRequest) {
  try {
    if (!isNylasConfigured) {
      return NextResponse.json(
        { error: 'Calendar integration is not configured' },
        { status: 503 }
      );
    }

    const { userId, organizationId } = await requireCoachWithOrg();
    const body = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Get the event
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const event = eventDoc.data() as UnifiedEvent;

    // Verify the event belongs to this organization
    if (event.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Event does not belong to this organization' },
        { status: 403 }
      );
    }

    // Get coach availability to check calendar settings
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();

    if (!availabilityDoc.exists) {
      return NextResponse.json(
        { error: 'Availability settings not found' },
        { status: 404 }
      );
    }

    const availability = availabilityDoc.data() as CoachAvailability;

    if (!availability.pushEventsToCalendar || !availability.nylasGrantId || !availability.connectedCalendarId) {
      return NextResponse.json(
        { error: 'Calendar sync is not enabled or no calendar connected' },
        { status: 400 }
      );
    }

    // Get the Nylas grant
    const grantDoc = await adminDb
      .collection('nylas_grants')
      .doc(`${organizationId}_${userId}`)
      .get();

    if (!grantDoc.exists) {
      return NextResponse.json(
        { error: 'No calendar connected' },
        { status: 404 }
      );
    }

    const grant = grantDoc.data() as NylasGrant;

    if (!grant.isActive || !grant.calendarId) {
      return NextResponse.json(
        { error: 'Calendar connection is not active' },
        { status: 400 }
      );
    }

    // Convert event times to Unix timestamps
    const startTime = Math.floor(new Date(event.startDateTime).getTime() / 1000);
    const endTime = event.endDateTime 
      ? Math.floor(new Date(event.endDateTime).getTime() / 1000)
      : startTime + (event.durationMinutes || 60) * 60;

    // Get participant emails from attendee IDs
    const participantEmails: Array<{ email: string; name?: string }> = [];
    for (const attendeeId of event.attendeeIds) {
      if (attendeeId !== userId) {
        const userDoc = await adminDb.collection('users').doc(attendeeId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const email = userData?.email || userData?.primaryEmail;
          const name = userData?.firstName && userData?.lastName 
            ? `${userData.firstName} ${userData.lastName}` 
            : userData?.name;
          if (email) {
            participantEmails.push({ email, name });
          }
        }
      }
    }

    // Check if event already has a Nylas event ID (update vs create)
    if (event.nylasEventId) {
      // Update existing event
      await updateEvent(
        grant.grantId,
        grant.calendarId,
        event.nylasEventId,
        {
          title: event.title,
          description: event.description,
          location: event.meetingLink || event.locationLabel,
          startTime,
          endTime,
        }
      );

      return NextResponse.json({ 
        success: true, 
        action: 'updated',
        nylasEventId: event.nylasEventId 
      });
    } else {
      // Create new event
      const result = await createEvent(
        grant.grantId,
        grant.calendarId,
        {
          title: event.title,
          description: event.description,
          location: event.meetingLink || event.locationLabel,
          startTime,
          endTime,
          participants: participantEmails,
        }
      );

      // Update the event with the Nylas event ID
      await adminDb.collection('events').doc(eventId).update({
        nylasEventId: result.id,
        syncedToNylas: true,
        nylasCalendarId: grant.calendarId,
        meetingLink: event.meetingLink || result.conferenceUrl,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({ 
        success: true, 
        action: 'created',
        nylasEventId: result.id,
        conferenceUrl: result.conferenceUrl,
      });
    }
  } catch (error) {
    console.error('[NYLAS_SYNC_EVENT] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/nylas/sync-event
 * Remove an event from the external calendar
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isNylasConfigured) {
      return NextResponse.json(
        { error: 'Calendar integration is not configured' },
        { status: 503 }
      );
    }

    const { userId, organizationId } = await requireCoachWithOrg();
    const body = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Get the event
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const event = eventDoc.data() as UnifiedEvent;

    if (!event.nylasEventId || !event.nylasCalendarId) {
      return NextResponse.json(
        { error: 'Event is not synced to external calendar' },
        { status: 400 }
      );
    }

    // Get the Nylas grant
    const grantDoc = await adminDb
      .collection('nylas_grants')
      .doc(`${organizationId}_${userId}`)
      .get();

    if (!grantDoc.exists) {
      return NextResponse.json(
        { error: 'No calendar connected' },
        { status: 404 }
      );
    }

    const grant = grantDoc.data() as NylasGrant;

    // Delete the event from Nylas
    await deleteEvent(grant.grantId, event.nylasCalendarId, event.nylasEventId);

    // Update the event to remove Nylas references
    await adminDb.collection('events').doc(eventId).update({
      nylasEventId: null,
      syncedToNylas: false,
      nylasCalendarId: null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NYLAS_SYNC_EVENT_DELETE] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

