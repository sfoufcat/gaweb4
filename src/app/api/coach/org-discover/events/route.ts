/**
 * Coach API: Organization-scoped Events Management
 *
 * GET /api/coach/org-discover/events - List events in coach's organization
 * POST /api/coach/org-discover/events - Create new event in coach's organization
 *
 * Uses shared event-core logic for creation, which handles:
 * - Firestore write
 * - Notification scheduling
 * - Recurring event generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { requirePlanLimit, isEntitlementError, getEntitlementErrorStatus } from '@/lib/billing/server-enforcement';
import { isDemoRequest, demoResponse, demoNotAvailable } from '@/lib/demo-api';
import { generateDemoEvents } from '@/lib/demo-data';
import { createEventCore } from '@/lib/event-core';

export async function GET() {
  try {
    // Demo mode: return demo events
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const demoEvents = generateDemoEvents();
      // Map demo events to include the 'date' and 'startTime' fields expected by the table
      const events = demoEvents.map(event => ({
        ...event,
        // Extract date from startDateTime (format: YYYY-MM-DD)
        date: event.startDateTime.split('T')[0],
        // Extract start time (format: HH:MM)
        startTime: new Date(event.startDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        // Extract end time if available
        endTime: event.endDateTime 
          ? new Date(event.endDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : undefined,
      }));
      return demoResponse({ 
        events,
        totalCount: events.length,
        organizationId: 'demo-org',
      });
    }
    
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_EVENTS] Fetching events for organization: ${organizationId}`);

    // Query without orderBy to support events with either 'date' or 'startDateTime' fields
    const eventsSnapshot = await adminDb
      .collection('events')
      .where('organizationId', '==', organizationId)
      .get();

    const events = eventsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Explicitly include properties needed for sorting
        date: data.date as string | undefined,
        startDateTime: data.startDateTime as string | undefined,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      };
    });

    // Sort in memory using either 'date' or 'startDateTime' field
    events.sort((a, b) => {
      const dateA = a.date || (a.startDateTime ? a.startDateTime.split('T')[0] : '');
      const dateB = b.date || (b.startDateTime ? b.startDateTime.split('T')[0] : '');
      return dateA.localeCompare(dateB);
    });

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

// Compute startDateTime from date + time
function computeStartDateTime(date: string, time: string): string {
  try {
    const dateTimeStr = `${date}T${time}:00`;
    return new Date(dateTimeStr).toISOString();
  } catch {
    return new Date(`${date}T${time}:00`).toISOString();
  }
}

export async function POST(request: NextRequest) {
  try {
    // Demo mode: block write operations
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoNotAvailable('Creating events');
    }

    const { organizationId, userId } = await requireCoachWithOrg();

    // Enforce content item limit based on plan
    try {
      await requirePlanLimit(organizationId, 'maxContentItems');
    } catch (limitError) {
      if (isEntitlementError(limitError)) {
        return NextResponse.json(
          {
            error: 'Content item limit reached for your current plan',
            code: limitError.code,
            ...('currentCount' in limitError ? { currentCount: limitError.currentCount } : {}),
            ...('maxLimit' in limitError ? { maxLimit: limitError.maxLimit } : {}),
          },
          { status: getEntitlementErrorStatus(limitError) }
        );
      }
      throw limitError;
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

    // Compute calendar-compatible datetime fields
    const startDateTime = computeStartDateTime(body.date, body.startTime);
    const endDateTime = computeStartDateTime(body.date, body.endTime);

    // Use shared core function for event creation
    // This handles: Firestore write, notification scheduling, recurring instance generation
    const { eventId, event: createdEvent } = await createEventCore({
      userId,
      organizationId,

      // Core fields
      title: body.title,
      startDateTime,
      endDateTime,
      timezone: body.timezone,
      eventType: 'community_event',
      scope: 'organization',

      // Location
      locationType: body.locationType,
      locationLabel: body.locationLabel,
      meetingLink: body.meetingLink || body.zoomLink,

      // Participation (community events use RSVP)
      participantModel: 'rsvp',
      maxAttendees: body.maxAttendees,

      // Recurrence support (now works!)
      isRecurring: body.isRecurring,
      recurrence: body.recurrence,

      // Host info
      hostUserId: userId,
      hostName: body.hostName,
      hostAvatarUrl: body.hostAvatarUrl,
      isCoachLed: true,

      // Content
      shortDescription: body.shortDescription,
      longDescription: body.longDescription,
      coverImageUrl: body.coverImageUrl,
      bulletPoints: body.bulletPoints,
      additionalInfo: body.additionalInfo || {
        type: 'Workshop',
        language: 'English',
        difficulty: 'All Levels',
      },
      category: body.category,
      track: body.track,
      featured: body.featured,

      // Marketing/Discover fields
      priceInCents: body.priceInCents,
      currency: body.currency,
      purchaseType: body.purchaseType,
      isPublic: body.isPublic !== false,
      keyOutcomes: body.keyOutcomes,
      features: body.features,
      testimonials: body.testimonials,
      faqs: body.faqs,

      // Meeting provider
      meetingProvider: body.meetingProvider,
      externalMeetingId: body.externalMeetingId,
      recordingUrl: body.recordingUrl,

      // Legacy date fields (still needed for some UI)
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
    });

    console.log(`[COACH_ORG_EVENTS] Created event ${eventId} in organization ${organizationId}`);

    return NextResponse.json({
      ...createdEvent,
      id: eventId,
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
