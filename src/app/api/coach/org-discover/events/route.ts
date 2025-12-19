/**
 * Coach API: Organization-scoped Events Management
 * 
 * GET /api/coach/org-discover/events - List events in coach's organization
 * POST /api/coach/org-discover/events - Create new event in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_EVENTS] Fetching events for organization: ${organizationId}`);

    const eventsSnapshot = await adminDb
      .collection('events')
      .where('organizationId', '==', organizationId)
      .orderBy('date', 'asc')
      .get();

    const events = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ 
      events,
      totalCount: events.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_EVENTS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

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
      additionalInfo: body.additionalInfo || {
        type: 'Workshop',
        language: 'English',
        difficulty: 'All Levels',
      },
      zoomLink: body.zoomLink || null,
      recordingUrl: body.recordingUrl || null,
      hostName: body.hostName,
      hostAvatarUrl: body.hostAvatarUrl || null,
      featured: body.featured || false,
      category: body.category || null,
      track: body.track || null,
      attendeeIds: [],
      maxAttendees: body.maxAttendees || null,
      organizationId, // Scope to coach's organization
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('events').add(eventData);

    console.log(`[COACH_ORG_EVENTS] Created event ${docRef.id} in organization ${organizationId}`);

    return NextResponse.json({
      id: docRef.id,
      ...eventData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_ORG_EVENTS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
