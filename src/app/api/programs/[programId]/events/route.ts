/**
 * API Route: Program Events
 * 
 * GET /api/programs/[programId]/events - Get events for a specific program
 * 
 * Returns events that:
 * - Have programId matching this program
 * - Have programIds array containing this program
 * - Are squad_calls for squads belonging to this program
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
    
    const upcoming = searchParams.get('upcoming') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const now = new Date().toISOString();
    const events: UnifiedEvent[] = [];

    // Query 1: Events with programId directly
    let query1: FirebaseFirestore.Query = adminDb
      .collection('events')
      .where('programId', '==', programId)
      .where('status', 'in', ['confirmed', 'live', 'completed']);
    
    if (upcoming) {
      query1 = query1.where('startDateTime', '>=', now);
    }
    
    query1 = query1.orderBy('startDateTime', 'asc').limit(limit);
    
    const snapshot1 = await query1.get();
    snapshot1.docs.forEach(doc => {
      events.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      } as UnifiedEvent);
    });

    // Query 2: Events with programIds array containing this program
    // Note: Firestore array-contains with other conditions can be tricky
    // We'll do a separate query and merge
    let query2: FirebaseFirestore.Query = adminDb
      .collection('events')
      .where('programIds', 'array-contains', programId)
      .where('status', 'in', ['confirmed', 'live', 'completed']);
    
    if (upcoming) {
      query2 = query2.where('startDateTime', '>=', now);
    }
    
    query2 = query2.orderBy('startDateTime', 'asc').limit(limit);
    
    const snapshot2 = await query2.get();
    snapshot2.docs.forEach(doc => {
      // Avoid duplicates
      if (!events.find(e => e.id === doc.id)) {
        events.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
        } as UnifiedEvent);
      }
    });

    // Query 3: Get squad calls from squads belonging to this program
    // First, find squads for this program
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('programId', '==', programId)
      .get();
    
    const squadIds = squadsSnapshot.docs.map(doc => doc.id);
    
    // Fetch events for each squad (in batches if needed)
    // Note: Firestore doesn't allow two 'in' operators in the same query
    // So we can't do squadId IN [...] AND status IN [...] together
    // Instead, we fetch all events for the squadIds and filter by status in memory
    const allowedStatuses = ['confirmed', 'live', 'completed'];
    
    if (squadIds.length > 0) {
      // Firestore 'in' query supports max 30 values
      const batchSize = 30;
      for (let i = 0; i < squadIds.length; i += batchSize) {
        const batch = squadIds.slice(i, i + batchSize);
        
        let query3: FirebaseFirestore.Query = adminDb
          .collection('events')
          .where('squadId', 'in', batch);
        
        if (upcoming) {
          query3 = query3.where('startDateTime', '>=', now);
        }
        
        query3 = query3.orderBy('startDateTime', 'asc').limit(limit * 2); // Fetch extra to account for filtering
        
        const snapshot3 = await query3.get();
        snapshot3.docs.forEach(doc => {
          const data = doc.data();
          // Filter by status in memory (since we can't use two 'in' operators)
          if (!allowedStatuses.includes(data.status)) {
            return;
          }
          // Avoid duplicates
          if (!events.find(e => e.id === doc.id)) {
            events.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
              updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
            } as UnifiedEvent);
          }
        });
      }
    }

    // Sort all events by startDateTime
    events.sort((a, b) => 
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );

    // Apply final limit
    const finalEvents = events.slice(0, limit);

    return NextResponse.json(
      { events: finalEvents },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error) {
    console.error('[PROGRAM_EVENTS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', events: [] },
      { status: 500 }
    );
  }
}
