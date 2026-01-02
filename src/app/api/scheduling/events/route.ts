import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { UnifiedEvent, EventType } from '@/types';

/**
 * GET /api/scheduling/events
 * Get scheduled events for the calendar view
 * 
 * Query params:
 * - startDate: ISO date (required) - start of date range
 * - endDate: ISO date (required) - end of date range
 * - types?: string - comma-separated event types to filter (coaching_1on1, squad_call, workshop, etc.)
 * - status?: string - comma-separated statuses to filter (confirmed, proposed, etc.)
 * - role?: 'host' | 'attendee' | 'all' - Filter by user's role (default: all)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Build query
    let query = adminDb
      .collection('events')
      .where('startDateTime', '>=', rangeStart.toISOString())
      .where('startDateTime', '<=', rangeEnd.toISOString());

    // Execute query and filter in memory for complex conditions
    const snapshot = await query.get();
    
    let events = snapshot.docs.map(doc => doc.data() as UnifiedEvent);

    // Filter by organization if in org context
    if (orgId) {
      events = events.filter(e => e.organizationId === orgId);
    }

    // Filter by user participation
    events = events.filter(e => {
      if (roleParam === 'host') {
        return e.hostUserId === userId;
      } else if (roleParam === 'attendee') {
        return e.attendeeIds.includes(userId) && e.hostUserId !== userId;
      } else {
        // 'all' - user is either host or attendee
        return e.hostUserId === userId || e.attendeeIds.includes(userId);
      }
    });

    // Filter by event types if specified
    if (types && types.length > 0) {
      events = events.filter(e => types.includes(e.eventType));
    }

    // Filter by status
    if (statuses.length > 0) {
      events = events.filter(e => {
        // Check both schedulingStatus and regular status
        const schedulingMatch = e.schedulingStatus && statuses.includes(e.schedulingStatus);
        const statusMatch = statuses.includes(e.status);
        return schedulingMatch || statusMatch;
      });
    }

    // Sort by start time
    events.sort((a, b) => 
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );

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
 * GET /api/scheduling/events/pending
 * Get pending call proposals and requests that need response
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get events where user needs to respond
    const snapshot = await adminDb
      .collection('events')
      .where('schedulingStatus', 'in', ['proposed', 'counter_proposed'])
      .where('attendeeIds', 'array-contains', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    let events = snapshot.docs.map(doc => doc.data() as UnifiedEvent);

    // Filter to only events where user is NOT the proposer (they need to respond)
    events = events.filter(e => e.proposedBy !== userId);

    // Filter by organization if in org context
    if (orgId) {
      events = events.filter(e => e.organizationId === orgId);
    }

    return NextResponse.json({
      events,
      count: events.length,
    });
  } catch (error) {
    console.error('[SCHEDULING_EVENTS_PENDING] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


