import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UnifiedEvent, EventType } from '@/types';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateDemoCalendarEvents } from '@/lib/demo-data';

/**
 * Compute startDateTime for events that use date + startTime format (discover events)
 * Returns ISO string or null if cannot be computed
 */
function computeStartDateTime(event: UnifiedEvent): string | null {
  // If startDateTime is already set, use it
  if (event.startDateTime) return event.startDateTime;
  
  // Try to compute from date + startTime (discover events format)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventData = event as any;
  if (eventData.date && eventData.startTime) {
    try {
      // Format: date="2026-01-04", startTime="10:00"
      // Create datetime string and parse it
      const dateTimeStr = `${eventData.date}T${eventData.startTime}:00`;
      const computed = new Date(dateTimeStr);
      
      if (!isNaN(computed.getTime())) {
        return computed.toISOString();
      }
    } catch (err) {
      console.error('[SCHEDULING_EVENTS] Error computing startDateTime:', err);
    }
  }
  
  return null;
}

/**
 * Compute endDateTime for events that use date + endTime format
 */
function computeEndDateTime(event: UnifiedEvent): string | null {
  if (event.endDateTime) return event.endDateTime;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventData = event as any;
  if (eventData.date && eventData.endTime) {
    try {
      const dateTimeStr = `${eventData.date}T${eventData.endTime}:00`;
      const computed = new Date(dateTimeStr);
      
      if (!isNaN(computed.getTime())) {
        return computed.toISOString();
      }
    } catch (err) {
      console.error('[SCHEDULING_EVENTS] Error computing endDateTime:', err);
    }
  }
  
  return null;
}

/**
 * GET /api/scheduling/events
 * Get scheduled events for the calendar view
 * 
 * Query params:
 * - startDate: ISO date (required) - start of date range
 * - endDate: ISO date (required) - end of date range
 * - types?: string - comma-separated event types to filter (coaching_1on1, squad_call, community_event)
 * - status?: string - comma-separated statuses to filter (confirmed, proposed, etc.)
 * - role?: 'host' | 'attendee' | 'all' - Filter by user's role (default: all)
 */
export async function GET(request: NextRequest) {
  try {
    // Demo mode: return demo calendar events
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const { searchParams } = new URL(request.url);
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const events = generateDemoCalendarEvents(startDate, endDate);
      return demoResponse({ events });
    }

    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role from session claims
    const publicMetadata = sessionClaims?.publicMetadata as { role?: string; orgRole?: string } | undefined;
    const userRole = publicMetadata?.orgRole || publicMetadata?.role || 'user';

    // Use tenant context for org filtering (consistent with /api/events)
    const orgId = await getEffectiveOrgId();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const typesParam = searchParams.get('types');
    const statusParam = searchParams.get('status');
    const roleParam = searchParams.get('role') || 'all';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Parse dates
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    // Parse filters
    const types = typesParam ? typesParam.split(',') as EventType[] : undefined;
    const statuses = statusParam ? statusParam.split(',') : ['confirmed', 'proposed', 'pending_response', 'counter_proposed'];

    // Map to track events by ID (for deduplication)
    const eventsMap = new Map<string, UnifiedEvent>();

    // Get user's squad memberships from BOTH sources:
    // 1. User's squadIds array (may be out of sync)
    // 2. Squad documents where user is in memberIds (authoritative)
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userSquadIdsFromDoc: string[] = userData?.squadIds || [];
    
    // Also query squads where user is in memberIds (handles data sync issues)
    const squadMembershipQuery = await adminDb.collection('squads')
      .where('memberIds', 'array-contains', userId)
      .get();
    const squadIdsFromMembership = squadMembershipQuery.docs.map(doc => doc.id);
    
    // Combine both sources (deduplicated)
    const userSquadIds = [...new Set([...userSquadIdsFromDoc, ...squadIdsFromMembership])];

    // Also fetch squads where user is the coach (for host role filtering)
    const coachedSquadsQuery = await adminDb.collection('squads')
      .where('coachId', '==', userId)
      .get();
    const coachedSquadIds = coachedSquadsQuery.docs.map(doc => doc.id);

    // Query 1: Events with startDateTime in range (scheduling events)
    const schedulingQuery = adminDb
      .collection('events')
      .where('startDateTime', '>=', rangeStart.toISOString())
      .where('startDateTime', '<=', rangeEnd.toISOString());

    const schedulingSnapshot = await schedulingQuery.get();
    
    for (const doc of schedulingSnapshot.docs) {
      const event = { id: doc.id, ...doc.data() } as UnifiedEvent;
      eventsMap.set(doc.id, event);
    }

    // Query 2: Events where user is an attendee (discover events user has joined)
    // These may not have startDateTime set, so we query by attendeeIds
    const attendeeQuery = adminDb
      .collection('events')
      .where('attendeeIds', 'array-contains', userId);

    const attendeeSnapshot = await attendeeQuery.get();
    
    for (const doc of attendeeSnapshot.docs) {
      // Skip if already in map
      if (eventsMap.has(doc.id)) continue;
      
      const event = { id: doc.id, ...doc.data() } as UnifiedEvent;
      
      // Compute startDateTime if not present
      const computedStartDateTime = computeStartDateTime(event);
      if (computedStartDateTime) {
        event.startDateTime = computedStartDateTime;
        
        // Compute endDateTime as well
        const computedEndDateTime = computeEndDateTime(event);
        if (computedEndDateTime) {
          event.endDateTime = computedEndDateTime;
        }
        
        // Check if within date range
        const eventStart = new Date(computedStartDateTime);
        if (eventStart >= rangeStart && eventStart <= rangeEnd) {
          eventsMap.set(doc.id, event);
        }
      }
    }

    // Query 3: Events where user is host (in case they don't have startDateTime)
    const hostQuery = adminDb
      .collection('events')
      .where('hostUserId', '==', userId);

    const hostSnapshot = await hostQuery.get();
    
    for (const doc of hostSnapshot.docs) {
      // Skip if already in map
      if (eventsMap.has(doc.id)) continue;
      
      const event = { id: doc.id, ...doc.data() } as UnifiedEvent;
      
      // Compute startDateTime if not present
      const computedStartDateTime = computeStartDateTime(event);
      if (computedStartDateTime) {
        event.startDateTime = computedStartDateTime;
        
        const computedEndDateTime = computeEndDateTime(event);
        if (computedEndDateTime) {
          event.endDateTime = computedEndDateTime;
        }
        
        // Check if within date range
        const eventStart = new Date(computedStartDateTime);
        if (eventStart >= rangeStart && eventStart <= rangeEnd) {
          eventsMap.set(doc.id, event);
        }
      }
    }

    // Query 4: Events for squads the user is a member of (squad calls)
    // This ensures squad call events show up in member calendars even if they're not in attendeeIds
    if (userSquadIds.length > 0) {
      // Firestore 'in' query supports max 30 values, batch if needed
      const batchSize = 30;
      for (let i = 0; i < userSquadIds.length; i += batchSize) {
        const batch = userSquadIds.slice(i, i + batchSize);
        
        const squadEventsQuery = adminDb
          .collection('events')
          .where('squadId', 'in', batch);

        const squadEventsSnapshot = await squadEventsQuery.get();
        
        for (const doc of squadEventsSnapshot.docs) {
          // Skip if already in map
          if (eventsMap.has(doc.id)) continue;
          
          const event = { id: doc.id, ...doc.data() } as UnifiedEvent;
          
          // Compute startDateTime if not present
          let eventStartDateTime = event.startDateTime;
          if (!eventStartDateTime) {
            const computed = computeStartDateTime(event);
            if (computed) {
              eventStartDateTime = computed;
              event.startDateTime = computed;
              
              const computedEnd = computeEndDateTime(event);
              if (computedEnd) {
                event.endDateTime = computedEnd;
              }
            }
          }
          
          // Check if within date range
          if (eventStartDateTime) {
            const eventStart = new Date(eventStartDateTime);
            if (eventStart >= rangeStart && eventStart <= rangeEnd) {
              eventsMap.set(doc.id, event);
            }
          }
        }
      }
    }

    // Query 5: Community/discover events for the user's organization (for coaches)
    // These events may not have hostUserId set, so we query by organizationId
    // We query all org events and filter for community events (with or without eventType set)
    if (orgId) {
      const orgEventsQuery = adminDb
        .collection('events')
        .where('organizationId', '==', orgId);

      const orgEventsSnapshot = await orgEventsQuery.get();

      for (const doc of orgEventsSnapshot.docs) {
        // Skip if already in map
        if (eventsMap.has(doc.id)) continue;

        const data = doc.data();

        // Identify discover/community events:
        // 1. Has eventType: 'community_event', OR
        // 2. Has 'date' and 'startTime' fields (legacy discover event format) without other event types
        const hasDiscoverFormat = data.date && data.startTime;
        const isDiscoverEventType = data.eventType === 'community_event';
        const isOtherEventType = data.eventType && data.eventType !== 'community_event';

        // Skip if it's a known non-discover event type (coaching_1on1, squad_call, etc.)
        if (isOtherEventType) continue;

        // Only include if it's a discover event
        if (!isDiscoverEventType && !hasDiscoverFormat) continue;

        const event = { id: doc.id, ...data } as UnifiedEvent;

        // Set eventType if not already set (for legacy events)
        if (!event.eventType && hasDiscoverFormat) {
          event.eventType = 'community_event';
        }

        // Compute startDateTime if not present
        let eventStartDateTime = event.startDateTime;
        if (!eventStartDateTime) {
          const computed = computeStartDateTime(event);
          if (computed) {
            eventStartDateTime = computed;
            event.startDateTime = computed;

            const computedEnd = computeEndDateTime(event);
            if (computedEnd) {
              event.endDateTime = computedEnd;
            }
          }
        }

        // Check if within date range
        if (eventStartDateTime) {
          const eventStart = new Date(eventStartDateTime);
          if (eventStart >= rangeStart && eventStart <= rangeEnd) {
            eventsMap.set(doc.id, event);
          }
        }
      }
    }

    // Convert map to array
    let events = Array.from(eventsMap.values());

    // Filter by organization if in org context
    if (orgId) {
      events = events.filter(e => e.organizationId === orgId);
    }

    // Check if current user is a coach in this org
    const isOrgCoach = coachedSquadIds.length > 0 || userRole === 'coach' || userRole === 'super_coach' || userRole === 'admin';

    // Filter by user participation based on role
    // Note: For squad events, user is considered a participant if they're in the squad
    // Note: For coaches, include events from their coached squads even if hostUserId is null
    // Note: For org coaches, include community_event types in their organization
    events = events.filter(e => {
      const attendeeIds = e.attendeeIds || [];
      const isSquadMember = e.squadId && userSquadIds.includes(e.squadId);
      const isSquadCoach = e.squadId && coachedSquadIds.includes(e.squadId);
      // Include org community events for coaches (both new format with eventType and legacy format with date field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventData = e as any;
      const isCommunityEvent = e.eventType === 'community_event' || (eventData.date && eventData.startTime && !e.eventType);
      const isOrgCommunityEvent = isOrgCoach && isCommunityEvent && e.organizationId === orgId;

      if (roleParam === 'host') {
        // Include events where user is host OR where user is coach of the squad OR org community events
        return e.hostUserId === userId || isSquadCoach || isOrgCommunityEvent;
      } else if (roleParam === 'attendee') {
        return (attendeeIds.includes(userId) || isSquadMember) && e.hostUserId !== userId;
      } else {
        // 'all' - user is either host, attendee, squad member, squad coach, or org coach viewing community events
        return e.hostUserId === userId || attendeeIds.includes(userId) || isSquadMember || isSquadCoach || isOrgCommunityEvent;
      }
    });

    // Filter by event types if specified
    if (types && types.length > 0) {
      events = events.filter(e => types.includes(e.eventType));
    }

    // Filter by status - include discover events that don't have schedulingStatus
    if (statuses.length > 0) {
      events = events.filter(e => {
        // Check both schedulingStatus and regular status
        const schedulingMatch = e.schedulingStatus && statuses.includes(e.schedulingStatus);
        const statusMatch = e.status && statuses.includes(e.status);
        
        // Also include events without explicit status (discover events default to "confirmed")
        const isDiscoverEvent = !e.schedulingStatus && !e.status;
        
        return schedulingMatch || statusMatch || isDiscoverEvent;
      });
    }

    // Filter out events without valid startDateTime (safety check)
    events = events.filter(e => e && e.startDateTime);

    // Sort by start time
    events.sort((a, b) => {
      const aTime = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
      const bTime = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
      return aTime - bTime;
    });

    return NextResponse.json({
      events,
      count: events.length,
      range: {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error('[SCHEDULING_EVENTS] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/scheduling/events
 * Get pending call proposals and requests
 * Returns both:
 * - events: proposals requiring user response (from others)
 * - myRequests: user's own pending requests awaiting response
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use tenant context for org filtering (consistent with /api/events)
    const orgId = await getEffectiveOrgId();

    // Get events where user needs to respond (proposed to them)
    const snapshot = await adminDb
      .collection('events')
      .where('schedulingStatus', 'in', ['proposed', 'counter_proposed'])
      .where('attendeeIds', 'array-contains', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    let allEvents = snapshot.docs.map(doc => doc.data() as UnifiedEvent);

    // Filter by organization if in org context
    if (orgId) {
      allEvents = allEvents.filter(e => e.organizationId === orgId);
    }

    // Split into two groups:
    // 1. Events where user needs to respond (not the proposer)
    const pendingResponses = allEvents.filter(e => e.proposedBy !== userId);

    // 2. Events where user IS the proposer (their own pending requests)
    const myRequests = allEvents.filter(e => e.proposedBy === userId);

    return NextResponse.json({
      events: pendingResponses,  // Keep backwards compatibility
      myRequests,
      count: pendingResponses.length,
      myRequestsCount: myRequests.length,
    });
  } catch (error) {
    console.error('[SCHEDULING_EVENTS_PENDING] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


