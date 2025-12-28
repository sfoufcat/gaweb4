/**
 * Coach API: Organization-scoped Single Event Management
 * 
 * GET /api/coach/org-discover/events/[eventId] - Get event details
 * PATCH /api/coach/org-discover/events/[eventId] - Update event
 * DELETE /api/coach/org-discover/events/[eventId] - Delete event
 * 
 * All operations verify the event belongs to the coach's organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { RecurrencePattern } from '@/types';

// Convert local time to UTC ISO string
function toUTCDateTime(date: string, time: string, timezone: string): string {
  const dateTimeStr = `${date}T${time}:00`;
  const localDate = new Date(dateTimeStr);
  const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
  const offset = tzDate.getTime() - utcDate.getTime();
  const resultDate = new Date(localDate.getTime() - offset);
  return resultDate.toISOString();
}

// Calculate end time from start and duration
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

// Calculate duration in minutes
function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { eventId } = await params;

    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = eventDoc.data();
    
    // Verify event belongs to coach's organization
    if (eventData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = {
      id: eventDoc.id,
      ...eventData,
      createdAt: eventData?.createdAt?.toDate?.()?.toISOString?.() || eventData?.createdAt,
      updatedAt: eventData?.updatedAt?.toDate?.()?.toISOString?.() || eventData?.updatedAt,
    };

    return NextResponse.json({ event });
  } catch (error) {
    console.error('[COACH_ORG_EVENT_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { eventId } = await params;
    const body = await request.json();

    // Check if event exists and belongs to organization
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const existingData = eventDoc.data();
    if (existingData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Handle date/time updates - convert to UnifiedEvent format
    if (body.date || body.startTime || body.time) {
      const date = body.date || existingData?.date;
      const startTime = body.startTime || body.time || existingData?.startTime || '10:00';
      const timezone = body.timezone || existingData?.timezone || 'America/New_York';
      const durationMinutes = body.durationMinutes || existingData?.durationMinutes || 60;
      const endTime = body.endTime || calculateEndTime(startTime, durationMinutes);

      if (date && startTime && timezone) {
        updateData.startDateTime = toUTCDateTime(date, startTime, timezone);
        updateData.endDateTime = toUTCDateTime(date, endTime, timezone);
        updateData.date = date;
        updateData.startTime = startTime;
        updateData.endTime = endTime;
        updateData.timezone = timezone;
        updateData.durationMinutes = calculateDurationMinutes(startTime, endTime);
      }
    }

    // Handle recurrence
    if (body.isRecurring !== undefined) {
      updateData.isRecurring = body.isRecurring;
      if (body.isRecurring && body.recurrence) {
        const recurrence: RecurrencePattern = {
          frequency: body.recurrence.frequency,
          dayOfWeek: body.recurrence.dayOfWeek,
          time: body.time || body.startTime || body.recurrence.time,
          timezone: body.timezone || body.recurrence.timezone,
          startDate: body.date || body.recurrence.startDate,
          endDate: body.recurrence.endDate || null,
        };
        updateData.recurrence = recurrence;
      } else if (!body.isRecurring) {
        updateData.recurrence = null;
      }
    }

    // Simple field updates
    const simpleFields = [
      'title', 'coverImageUrl', 'locationType', 'locationLabel', 'meetingLink',
      'shortDescription', 'longDescription', 'bulletPoints', 'additionalInfo',
      'hostUserId', 'hostName', 'hostAvatarUrl', 'featured', 'category',
      'programIds', 'maxAttendees', 'recordingUrl', 'visibility',
      // Pricing fields
      'priceInCents', 'currency', 'purchaseType', 'isPublic',
      'keyOutcomes', 'features', 'testimonials', 'faqs'
    ];

    for (const field of simpleFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Handle legacy zoomLink -> meetingLink
    if (body.zoomLink !== undefined && body.meetingLink === undefined) {
      updateData.meetingLink = body.zoomLink;
    }

    // Handle description -> shortDescription + longDescription
    if (body.description !== undefined) {
      updateData.shortDescription = body.description.substring(0, 200);
      updateData.longDescription = body.description;
    }

    await adminDb.collection('events').doc(eventId).update(updateData);

    // Handle recurrence instance regeneration if needed
    if (body.isRecurring && updateData.recurrence) {
      const { generateRecurringInstances, cancelFutureInstances } = await import('@/lib/event-recurrence');
      // Cancel old instances first
      await cancelFutureInstances(eventId);
      // Generate new instances with the full event data
      const updatedEventData = {
        id: eventId,
        ...existingData,
        ...updateData,
      } as unknown as import('@/types').UnifiedEvent;
      await generateRecurringInstances(updatedEventData);
    }

    console.log(`[COACH_ORG_EVENT] Updated event ${eventId} in organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Event updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_EVENT_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const cancelFuture = searchParams.get('cancelFuture') === 'true';

    // Check if event exists and belongs to organization
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = eventDoc.data();
    if (eventData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // If recurring and cancelFuture, cancel all future instances
    if (eventData?.isRecurring && cancelFuture) {
      const { cancelFutureInstances } = await import('@/lib/event-recurrence');
      await cancelFutureInstances(eventId);
    }

    // Delete child instances if this is a parent
    if (eventData?.isRecurring) {
      const instancesSnapshot = await adminDb
        .collection('events')
        .where('parentEventId', '==', eventId)
        .get();
      
      const batch = adminDb.batch();
      for (const doc of instancesSnapshot.docs) {
        batch.delete(doc.ref);
      }
      if (!instancesSnapshot.empty) {
        await batch.commit();
      }
    }

    await adminDb.collection('events').doc(eventId).delete();

    console.log(`[COACH_ORG_EVENT] Deleted event ${eventId} from organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Event deleted successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_EVENT_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}

