/**
 * Admin API: Discover Events Management
 * 
 * GET /api/admin/discover/events - List all events
 * POST /api/admin/discover/events - Create new event
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canManageDiscoverContent } from '@/lib/admin-utils-shared';
import { getCurrentUserRole } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const eventsSnapshot = await adminDb
      .collection('events')
      .orderBy('date', 'asc')
      .get();

    const events = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[ADMIN_EVENTS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['title', 'coverImageUrl', 'date', 'startTime', 'endTime', 'timezone', 'locationType', 'locationLabel', 'shortDescription', 'hostName'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate track if provided
    const validTracks = ['content_creator', 'saas', 'coach_consultant', 'ecom', 'agency', 'community_builder', 'general'];
    if (body.track && !validTracks.includes(body.track)) {
      return NextResponse.json(
        { error: `Invalid track. Must be one of: ${validTracks.join(', ')}` },
        { status: 400 }
      );
    }

    const eventData = {
      title: body.title,
      coverImageUrl: body.coverImageUrl,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      timezone: body.timezone,
      locationType: body.locationType,
      locationLabel: body.locationLabel,
      shortDescription: body.shortDescription,
      longDescription: body.longDescription || '',
      bulletPoints: body.bulletPoints || [],
      additionalInfo: body.additionalInfo || { type: '', language: '', difficulty: '' },
      zoomLink: body.zoomLink || '',
      recordingUrl: body.recordingUrl || '',
      hostName: body.hostName,
      hostAvatarUrl: body.hostAvatarUrl || '',
      featured: body.featured || false,
      category: body.category || '',
      track: body.track || null, // Track-specific content
      attendeeIds: [], // Always start empty
      maxAttendees: body.maxAttendees || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('events').add(eventData);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      message: 'Event created successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_EVENTS_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

