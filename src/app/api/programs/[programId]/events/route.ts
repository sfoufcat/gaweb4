/**
 * API Route: Program Events
 * 
 * GET /api/programs/[programId]/events - Get events for a program
 * 
 * Returns:
 * - Events scoped to the program (scope: 'program')
 * - Squad calls with visibility: 'program_wide'
 * 
 * Filters out squad-only events that aren't visible to the full program.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { UnifiedEvent } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { programId } = await params;
    const { searchParams } = new URL(request.url);
    
    const upcoming = searchParams.get('upcoming') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Verify program exists
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Build query for program-scoped events
    // We need to get events that are either:
    // 1. Directly scoped to this program (scope: 'program', programId matches)
    // 2. Squad calls with visibility: 'program_wide' and programId matches
    
    const now = new Date().toISOString();
    
    // Query 1: Events directly scoped to program
    let programEventsQuery = adminDb.collection('events')
      .where('programId', '==', programId)
      .where('status', 'in', ['confirmed', 'live']);
    
    if (upcoming) {
      programEventsQuery = programEventsQuery.where('startDateTime', '>=', now);
    }
    
    programEventsQuery = programEventsQuery.orderBy('startDateTime', 'asc').limit(limit);
    
    const programEventsSnapshot = await programEventsQuery.get();
    
    // Query 2: Events with this program in programIds array
    let programIdsEventsQuery = adminDb.collection('events')
      .where('programIds', 'array-contains', programId)
      .where('status', 'in', ['confirmed', 'live']);
    
    if (upcoming) {
      programIdsEventsQuery = programIdsEventsQuery.where('startDateTime', '>=', now);
    }
    
    programIdsEventsQuery = programIdsEventsQuery.orderBy('startDateTime', 'asc').limit(limit);
    
    const programIdsEventsSnapshot = await programIdsEventsQuery.get();

    // Merge and deduplicate events
    const eventMap = new Map<string, UnifiedEvent>();
    
    const processDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      const event: UnifiedEvent = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      } as UnifiedEvent;
      
      // Filter: Only include if not a squad call OR if visibility is program_wide
      if (event.eventType === 'squad_call' && event.visibility !== 'program_wide') {
        return;
      }
      
      // Filter: Exclude recurring parents (we want instances)
      if (event.isRecurring) {
        return;
      }
      
      eventMap.set(doc.id, event);
    };
    
    programEventsSnapshot.docs.forEach(processDoc);
    programIdsEventsSnapshot.docs.forEach(processDoc);
    
    // Convert to array and sort by start time
    const events = Array.from(eventMap.values())
      .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime())
      .slice(0, limit);

    return NextResponse.json({ 
      events,
      programId,
      count: events.length,
    });
  } catch (error) {
    console.error('[PROGRAM_EVENTS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch program events', events: [] },
      { status: 500 }
    );
  }
}

