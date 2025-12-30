/**
 * API Route: Single Event CRUD
 * 
 * GET /api/events/[eventId] - Get event details with attendees
 * PATCH /api/events/[eventId] - Update event
 * DELETE /api/events/[eventId] - Cancel/delete event
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { scheduleEventJobs, cancelEventJobs, rescheduleEventJobs } from '@/lib/event-notifications';
import { updateFutureInstances, cancelFutureInstances, deleteAllInstances } from '@/lib/event-recurrence';
import type { UnifiedEvent, EventVote } from '@/types';

// ============================================================================
// GET - Get Event Details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    const { eventId } = await params;

    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = eventDoc.data();
    const attendeeIds = eventData?.attendeeIds || [];

    // Fetch attendee profiles (limited for performance)
    const attendees = [];
    if (attendeeIds.length > 0) {
      const userIdsToFetch = attendeeIds.slice(0, 20);
      for (const attendeeId of userIdsToFetch) {
        try {
          const userDoc = await adminDb.collection('users').doc(attendeeId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            attendees.push({
              userId: attendeeId,
              firstName: userData?.firstName || 'User',
              lastName: userData?.lastName || '',
              avatarUrl: userData?.profileImageUrl || userData?.imageUrl || null,
            });
          }
        } catch (err) {
          console.error(`Failed to fetch user ${attendeeId}:`, err);
        }
      }
    }

    // Get user's RSVP/vote status
    let isJoined = false;
    let userVote = null;

    if (userId) {
      isJoined = attendeeIds.includes(userId);

      // Check for vote if event requires voting
      if (eventData?.approvalType === 'voting') {
        const voteDoc = await adminDb
          .collection('eventVotes')
          .doc(`${eventId}_${userId}`)
          .get();
        if (voteDoc.exists) {
          userVote = (voteDoc.data() as EventVote).vote;
        }
      }
    }

    const event: UnifiedEvent = {
      id: eventDoc.id,
      ...eventData,
      createdAt: eventData?.createdAt?.toDate?.()?.toISOString?.() || eventData?.createdAt,
      updatedAt: eventData?.updatedAt?.toDate?.()?.toISOString?.() || eventData?.updatedAt,
    } as UnifiedEvent;

    return NextResponse.json({
      event,
      attendees,
      totalAttendees: attendeeIds.length,
      isJoined,
      userVote,
    });
  } catch (error) {
    console.error('[EVENT_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update Event
// ============================================================================

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

    // Get existing event
    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const existingEvent = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    // Check permissions
    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const isAdmin = role === 'coach' || role === 'super_admin' || role === 'admin';
    const isCreator = existingEvent.createdByUserId === userId;
    const isHost = existingEvent.hostUserId === userId;

    if (!isAdmin && !isCreator && !isHost) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if time is being changed
    const timeChanged = body.startDateTime && body.startDateTime !== existingEvent.startDateTime;

    // Build update object
    const updateData: Partial<UnifiedEvent> = {
      updatedAt: new Date().toISOString(),
    };

    // Allow updating specific fields
    const allowedFields = [
      'title', 'description', 'startDateTime', 'endDateTime', 'timezone', 'durationMinutes',
      'locationType', 'locationLabel', 'meetingLink',
      'visibility', 'maxAttendees', 'coverImageUrl', 'bulletPoints', 'additionalInfo',
      'recordingUrl', 'chatChannelId', 'sendChatReminders',
      'recurrence', 'isRecurring',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updateData as Record<string, unknown>)[field] = body[field];
      }
    }

    // Update the document
    await eventRef.update(updateData);

    // Handle notification rescheduling if time changed
    if (timeChanged && existingEvent.status === 'confirmed') {
      const updatedEvent = { ...existingEvent, ...updateData };
      await rescheduleEventJobs(updatedEvent as UnifiedEvent);
    }

    // If this is a recurring parent and updateFuture is true, update instances
    if (existingEvent.isRecurring && body.updateFutureInstances) {
      await updateFutureInstances(eventId, updateData);
    }

    console.log(`[EVENT_PATCH] Updated event ${eventId}`);

    return NextResponse.json({ 
      success: true,
      event: { ...existingEvent, ...updateData },
    });
  } catch (error) {
    console.error('[EVENT_PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Cancel/Delete Event
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';
    const cancelFuture = searchParams.get('cancelFuture') === 'true';

    // Get existing event
    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const existingEvent = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    // Check permissions
    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const isAdmin = role === 'coach' || role === 'super_admin' || role === 'admin';
    const isCreator = existingEvent.createdByUserId === userId;
    const isHost = existingEvent.hostUserId === userId;

    if (!isAdmin && !isCreator && !isHost) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cancel notification jobs
    await cancelEventJobs(eventId);

    if (hardDelete) {
      // Permanently delete
      await eventRef.delete();

      // Delete votes
      const votesSnapshot = await adminDb
        .collection('eventVotes')
        .where('eventId', '==', eventId)
        .get();
      
      const batch = adminDb.batch();
      votesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // If recurring parent, delete all instances
      if (existingEvent.isRecurring) {
        await deleteAllInstances(eventId);
      }

      console.log(`[EVENT_DELETE] Permanently deleted event ${eventId}`);
    } else {
      // Soft delete (mark as canceled)
      await eventRef.update({
        status: 'canceled',
        updatedAt: FieldValue.serverTimestamp(),
      });

      // If recurring parent and cancelFuture is true
      if (existingEvent.isRecurring && cancelFuture) {
        await cancelFutureInstances(eventId);
      }

      console.log(`[EVENT_DELETE] Canceled event ${eventId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[EVENT_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}








