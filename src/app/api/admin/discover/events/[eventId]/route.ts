/**
 * Admin API: Single Event Management
 * 
 * GET /api/admin/discover/events/[eventId] - Get event details
 * PATCH /api/admin/discover/events/[eventId] - Update event
 * DELETE /api/admin/discover/events/[eventId] - Delete event
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canManageDiscoverContent } from '@/lib/admin-utils-shared';
import { getCurrentUserRole } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { eventId } = await params;
    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = eventDoc.data();
    const event = {
      id: eventDoc.id,
      ...eventData,
      createdAt: eventData?.createdAt?.toDate?.()?.toISOString?.() || eventData?.createdAt,
      updatedAt: eventData?.updatedAt?.toDate?.()?.toISOString?.() || eventData?.updatedAt,
    };

    return NextResponse.json({ event });
  } catch (error) {
    console.error('[ADMIN_EVENT_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { eventId } = await params;
    const body = await request.json();

    // Check if event exists
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Validate track if provided
    const validTracks = ['content_creator', 'saas', 'coach_consultant', 'ecom', 'agency', 'community_builder', 'general'];
    if (body.track && !validTracks.includes(body.track)) {
      return NextResponse.json(
        { error: `Invalid track. Must be one of: ${validTracks.join(', ')}` },
        { status: 400 }
      );
    }

    // Build update data (preserve attendeeIds and createdAt)
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only update fields that are provided
    const allowedFields = [
      'title', 'coverImageUrl', 'date', 'startTime', 'endTime', 'timezone',
      'locationType', 'locationLabel', 'shortDescription', 'longDescription',
      'bulletPoints', 'additionalInfo', 'zoomLink', 'recordingUrl', 'hostName', 'hostAvatarUrl',
      'featured', 'category', 'track', 'maxAttendees'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    await adminDb.collection('events').doc(eventId).update(updateData);

    return NextResponse.json({ 
      success: true, 
      message: 'Event updated successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_EVENT_PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { eventId } = await params;

    // Check if event exists
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await adminDb.collection('events').doc(eventId).delete();

    return NextResponse.json({ 
      success: true, 
      message: 'Event deleted successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_EVENT_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}

