/**
 * API Route: Unified Events
 * 
 * GET /api/events - List events with filters
 * POST /api/events - Create a new event
 * 
 * Supports filtering by:
 * - scope (global, organization, program, squad, private)
 * - eventType (workshop, community_event, squad_call, coaching_1on1)
 * - squadId
 * - programId
 * - status
 * - upcoming (boolean - only future events)
 * 
 * Multi-tenancy: Automatically scopes to user's organization if applicable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { scheduleEventJobs } from '@/lib/event-notifications';
import { generateRecurringInstances } from '@/lib/event-recurrence';
import type { UnifiedEvent, EventType, EventScope, EventStatus } from '@/types';

// ============================================================================
// GET - List Events
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse query params
    const scope = searchParams.get('scope') as EventScope | null;
    const eventType = searchParams.get('eventType') as EventType | null;
    const squadId = searchParams.get('squadId');
    const programId = searchParams.get('programId');
    const status = searchParams.get('status') as EventStatus | null;
    const upcoming = searchParams.get('upcoming') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const includeInstances = searchParams.get('includeInstances') !== 'false';

    // Get organization context
    const organizationId = await getEffectiveOrgId();

    // Build query
    let query: FirebaseFirestore.Query = adminDb.collection('events');

    // Filter by organization
    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    }

    // Apply filters
    if (scope) {
      query = query.where('scope', '==', scope);
    }

    if (eventType) {
      query = query.where('eventType', '==', eventType);
    }

    if (squadId) {
      query = query.where('squadId', '==', squadId);
    }

    if (programId) {
      query = query.where('programId', '==', programId);
    }

    if (status) {
      query = query.where('status', '==', status);
    } else {
      // Default: exclude canceled and draft events
      query = query.where('status', 'in', ['confirmed', 'live', 'completed']);
    }

    // Filter for upcoming events
    if (upcoming) {
      const now = new Date().toISOString();
      query = query.where('startDateTime', '>=', now);
    }

    // Exclude recurring parent events if we want instances
    if (includeInstances) {
      // We'll filter these in memory to avoid complex composite indexes
    }

    // Order by start time
    query = query.orderBy('startDateTime', 'asc');

    // Apply limit
    query = query.limit(limit);

    const eventsSnapshot = await query.get();

    let events = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as UnifiedEvent[];

    // Filter out recurring parents if we want to show instances instead
    if (includeInstances) {
      events = events.filter(e => !e.isRecurring);
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[EVENTS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', events: [] },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create Event
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['title', 'startDateTime', 'timezone', 'eventType', 'scope'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Get organization context
    const organizationId = await getEffectiveOrgId();

    // Get user info for host
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const hostName = userData 
      ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown'
      : 'Unknown';
    const hostAvatarUrl = userData?.profileImageUrl || userData?.imageUrl || undefined;

    // Determine if user is a coach
    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const isCoachLed = role === 'coach' || role === 'super_admin' || role === 'admin';

    const now = new Date().toISOString();

    // Auto-populate programIds from programId if not explicitly provided
    // This ensures the program content API's array-contains query finds the events
    let programIds: string[] = body.programIds || [];
    if (body.programId && (!programIds.length || !programIds.includes(body.programId))) {
      programIds = [body.programId, ...programIds];
    }

    // Auto-derive legacy date fields from startDateTime for backward compatibility
    // This ensures events show up in APIs that query by the legacy 'date' field
    let legacyDate = body.date;
    let legacyStartTime = body.startTime;
    let legacyEndTime = body.endTime;

    if (!legacyDate && body.startDateTime) {
      const startDt = new Date(body.startDateTime);
      legacyDate = startDt.toISOString().split('T')[0]; // YYYY-MM-DD
      legacyStartTime = legacyStartTime || startDt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      
      if (body.endDateTime) {
        const endDt = new Date(body.endDateTime);
        legacyEndTime = legacyEndTime || endDt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      } else if (body.durationMinutes) {
        const endDt = new Date(startDt.getTime() + (body.durationMinutes || 60) * 60 * 1000);
        legacyEndTime = legacyEndTime || endDt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      }
    }

    // Build event data
    const eventData: Omit<UnifiedEvent, 'id'> = {
      title: body.title,
      description: body.description || '',
      startDateTime: body.startDateTime,
      endDateTime: body.endDateTime || undefined,
      timezone: body.timezone,
      durationMinutes: body.durationMinutes || 60,
      
      locationType: body.locationType || 'online',
      locationLabel: body.locationLabel || 'Online',
      meetingLink: body.meetingLink || undefined,
      
      eventType: body.eventType,
      scope: body.scope,
      participantModel: body.participantModel || 'rsvp',
      approvalType: body.approvalType || 'none',
      status: body.approvalType === 'voting' ? 'pending_approval' : 'confirmed',
      
      visibility: body.visibility || 'squad_only',
      
      organizationId: organizationId || body.organizationId || undefined,
      programId: body.programId || undefined,
      programIds,
      squadId: body.squadId || undefined,
      cohortId: body.cohortId || undefined,
      
      isRecurring: body.isRecurring || false,
      recurrence: body.recurrence || undefined,
      parentEventId: undefined,
      instanceDate: undefined,
      
      createdByUserId: userId,
      hostUserId: body.hostUserId || userId,
      hostName: body.hostName || hostName,
      hostAvatarUrl: body.hostAvatarUrl || hostAvatarUrl,
      isCoachLed: body.isCoachLed ?? isCoachLed,
      
      attendeeIds: body.attendeeIds || [],
      maxAttendees: body.maxAttendees || undefined,
      
      votingConfig: body.approvalType === 'voting' ? {
        yesCount: 1, // Creator votes yes
        noCount: 0,
        requiredVotes: body.requiredVotes || 1,
        totalEligibleVoters: body.totalEligibleVoters || 1,
      } : undefined,
      confirmedAt: body.approvalType === 'voting' ? undefined : now,
      
      coverImageUrl: body.coverImageUrl || undefined,
      bulletPoints: body.bulletPoints || [],
      additionalInfo: body.additionalInfo || undefined,
      
      recordingUrl: undefined,
      
      chatChannelId: body.chatChannelId || undefined,
      sendChatReminders: body.sendChatReminders ?? true,
      
      // Legacy compatibility - auto-derived from startDateTime if not provided
      date: legacyDate,
      startTime: legacyStartTime,
      endTime: legacyEndTime,
      shortDescription: body.shortDescription || undefined,
      longDescription: body.longDescription || undefined,
      category: body.category || undefined,
      track: body.track || undefined,
      featured: body.featured || false,
      
      createdAt: now,
      updatedAt: now,
    };

    // Create the event document
    const docRef = await adminDb.collection('events').add(eventData);
    const eventId = docRef.id;

    const createdEvent: UnifiedEvent = { id: eventId, ...eventData };

    // If voting is required and creator voted yes, create their vote
    if (body.approvalType === 'voting') {
      await adminDb.collection('eventVotes').doc(`${eventId}_${userId}`).set({
        id: `${eventId}_${userId}`,
        eventId,
        userId,
        vote: 'yes',
        createdAt: now,
        updatedAt: now,
      });
    }

    // Schedule notification jobs (only for confirmed events)
    if (eventData.status === 'confirmed') {
      await scheduleEventJobs(createdEvent);
    }

    // If recurring, generate initial instances
    if (eventData.isRecurring && eventData.recurrence) {
      await generateRecurringInstances(createdEvent);
    }

    console.log(`[EVENTS_POST] Created event ${eventId} (${body.eventType})`);

    return NextResponse.json({ 
      success: true, 
      id: eventId,
      event: createdEvent,
    }, { status: 201 });
  } catch (error) {
    console.error('[EVENTS_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

