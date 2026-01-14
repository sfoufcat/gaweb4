/**
 * API Route: Unified Events
 * 
 * GET /api/events - List events with filters
 * POST /api/events - Create a new event
 * 
 * Supports filtering by:
 * - scope (global, organization, program, squad, private)
 * - eventType (community_event, squad_call, coaching_1on1)
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
import { calculateProgramDayForDate } from '@/lib/calendar-weeks';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateDemoEvents } from '@/lib/demo-data';
import type { UnifiedEvent, EventType, EventScope, EventStatus, ProgramInstance } from '@/types';

// ============================================================================
// GET - List Events
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Demo mode: return demo events
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const events = generateDemoEvents();
      return demoResponse({ events });
    }
    
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

    // Build query - use simple queries to avoid composite index requirements
    // Filter primarily by squadId or programId if provided (most common use case)
    let query: FirebaseFirestore.Query = adminDb.collection('events');

    // For squad-specific queries (like NextSquadCallCard), use squadId as primary filter
    // This avoids needing complex composite indexes
    if (squadId) {
      query = query.where('squadId', '==', squadId);
    } else if (programId) {
      query = query.where('programId', '==', programId);
    } else if (organizationId) {
      // Only filter by org if no squad/program specified
      query = query.where('organizationId', '==', organizationId);
    }

    // Execute query (keep it simple - filter the rest in memory)
    const eventsSnapshot = await query.get();

    let events = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as UnifiedEvent[];

    // Apply remaining filters in memory to avoid composite index requirements
    
    // Filter by organization (if squadId/programId was used as primary filter)
    if (organizationId && (squadId || programId)) {
      events = events.filter(e => e.organizationId === organizationId);
    }
    
    // Filter by scope
    if (scope) {
      events = events.filter(e => e.scope === scope);
    }

    // Filter by eventType
    if (eventType) {
      events = events.filter(e => e.eventType === eventType);
    }

    // Filter by status
    if (status) {
      events = events.filter(e => e.status === status);
    } else {
      // Default: exclude canceled and draft events
      events = events.filter(e => ['confirmed', 'live', 'completed'].includes(e.status || ''));
    }

    // Filter for upcoming events
    if (upcoming) {
      const now = new Date().toISOString();
      events = events.filter(e => e.startDateTime && e.startDateTime >= now);
    }

    // Filter out recurring parents if we want to show instances instead
    if (includeInstances) {
      events = events.filter(e => !e.isRecurring);
    }

    // Sort by start time
    events.sort((a, b) => (a.startDateTime || '').localeCompare(b.startDateTime || ''));

    // Apply limit
    events = events.slice(0, limit);

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

    // For 1:1 coaching calls, fetch client info from attendeeIds
    let clientUserId: string | undefined;
    let clientName: string | undefined;
    let clientAvatarUrl: string | undefined;

    const firstAttendeeId = body.attendeeIds?.[0];
    if (body.eventType === 'coaching_1on1' && firstAttendeeId) {
      // The client is the attendee (not the host/coach)
      clientUserId = firstAttendeeId;
      const clientDoc = await adminDb.collection('users').doc(firstAttendeeId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Client';
        clientAvatarUrl = clientData?.profileImageUrl || clientData?.imageUrl || undefined;
      }
    }

    // Determine if user is a coach
    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const isCoachLed = role === 'coach' || role === 'super_admin' || role === 'admin';

    const now = new Date().toISOString();

    // Program instance linking - calculate week/day if instanceId is provided
    let instanceId: string | undefined = body.instanceId;
    let weekIndex: number | undefined;
    let dayIndex: number | undefined;
    let instanceData: ProgramInstance | null = null;

    if (instanceId && body.startDateTime) {
      try {
        // Fetch the program instance to get start date and program info
        const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();
        if (instanceDoc.exists) {
          instanceData = instanceDoc.data() as ProgramInstance;

          // We need program info to get totalDays and includeWeekends
          if (instanceData.programId) {
            const programDoc = await adminDb.collection('programs').doc(instanceData.programId).get();
            if (programDoc.exists) {
              const programData = programDoc.data();
              const totalDays = programData?.lengthDays || 30;
              const includeWeekends = programData?.includeWeekends !== false;
              const instanceStartDate = instanceData.startDate;

              if (instanceStartDate) {
                // Extract date part from startDateTime (it's in ISO format)
                const eventDate = body.startDateTime.split('T')[0];

                const dayInfo = calculateProgramDayForDate(
                  instanceStartDate,
                  eventDate,
                  totalDays,
                  includeWeekends
                );

                if (dayInfo) {
                  weekIndex = dayInfo.weekIndex;
                  dayIndex = dayInfo.globalDayIndex; // Use global day index (1-based across program)
                  console.log(`[EVENTS_POST] Calculated program position: week ${weekIndex}, day ${dayIndex}`);
                } else {
                  console.log(`[EVENTS_POST] Event date ${eventDate} is outside program range`);
                }
              }
            }
          }
        } else {
          console.log(`[EVENTS_POST] Instance ${instanceId} not found, skipping program linking`);
          instanceId = undefined;
        }
      } catch (err) {
        console.error('[EVENTS_POST] Error calculating program day:', err);
        // Don't fail the request, just skip program linking
        instanceId = undefined;
      }
    }

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
      programId: body.programId || instanceData?.programId || undefined,
      programIds,
      squadId: body.squadId || undefined,
      cohortId: body.cohortId || undefined,

      // Program instance linking (for 1:1 calls linked to program days)
      instanceId: instanceId || undefined,
      weekIndex: weekIndex,
      dayIndex: dayIndex,

      isRecurring: body.isRecurring || false,
      recurrence: body.recurrence || undefined,
      parentEventId: undefined,
      instanceDate: undefined,
      
      createdByUserId: userId,
      hostUserId: body.hostUserId || userId,
      hostName: body.hostName || hostName,
      hostAvatarUrl: body.hostAvatarUrl || hostAvatarUrl,
      isCoachLed: body.isCoachLed ?? isCoachLed,

      // Client info for 1:1 coaching calls
      clientUserId: body.clientUserId || clientUserId,
      clientName: body.clientName || clientName,
      clientAvatarUrl: body.clientAvatarUrl || clientAvatarUrl,

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

    // Link event to program instance week/day if applicable
    if (instanceId && weekIndex !== undefined && dayIndex !== undefined && instanceData) {
      try {
        // Update the instance document to add event to week's linkedCallEventIds and day's linkedEventIds
        const instanceRef = adminDb.collection('program_instances').doc(instanceId);
        const instanceDoc = await instanceRef.get();

        if (instanceDoc.exists) {
          const currentData = instanceDoc.data() as ProgramInstance;
          const weeks = [...(currentData.weeks || [])];

          if (weeks[weekIndex]) {
            // Add to week's linkedCallEventIds
            const weekLinkedCallEventIds = weeks[weekIndex].linkedCallEventIds || [];
            if (!weekLinkedCallEventIds.includes(eventId)) {
              weeks[weekIndex].linkedCallEventIds = [...weekLinkedCallEventIds, eventId];
            }

            // Find the day within the week and add to linkedEventIds
            const days = weeks[weekIndex].days || [];
            // dayIndex is globalDayIndex (1-based), we need to find the day within this week
            const weekStartDayIndex = weeks[weekIndex].startDayIndex || 1;
            const dayIndexInWeek = dayIndex - weekStartDayIndex;

            if (days[dayIndexInWeek]) {
              const dayLinkedEventIds = days[dayIndexInWeek].linkedEventIds || [];
              if (!dayLinkedEventIds.includes(eventId)) {
                days[dayIndexInWeek].linkedEventIds = [...dayLinkedEventIds, eventId];
              }
              weeks[weekIndex].days = days;
            }

            await instanceRef.update({
              weeks,
              updatedAt: FieldValue.serverTimestamp(),
            });

            console.log(`[EVENTS_POST] Linked event ${eventId} to instance ${instanceId} week ${weekIndex} day ${dayIndex}`);
          }
        }
      } catch (err) {
        console.error('[EVENTS_POST] Error linking event to instance:', err);
        // Don't fail the request, the event was created successfully
      }
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

