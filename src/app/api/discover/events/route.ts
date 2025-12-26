/**
 * API Route: Get Discover Events
 * 
 * GET /api/discover/events - Get all events
 * 
 * Multi-tenancy: If user belongs to an organization, only show org's events.
 * Otherwise, show all events (default GA experience).
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';

export async function GET() {
  try {
    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    
    let query: FirebaseFirestore.Query = adminDb.collection('events');
    
    if (organizationId) {
      // User belongs to an org - show only their org's content
      query = query.where('organizationId', '==', organizationId);
    }
    // else: no org = show all content (global GA experience)
    
    const eventsSnapshot = await query.get();

    const events = eventsSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore Timestamps to ISO strings
      let eventDate = data.date?.toDate?.()?.toISOString?.() || data.date;
      let startTime = data.startTime;
      let endTime = data.endTime;
      
      // Normalize unified events (with startDateTime) to legacy format (date, startTime, endTime)
      // This ensures squad calls created via the unified API display correctly
      if (data.startDateTime && !eventDate) {
        const startDt = new Date(data.startDateTime);
        eventDate = startDt.toISOString();
        startTime = startDt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        if (data.endDateTime) {
          const endDt = new Date(data.endDateTime);
          endTime = endDt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        } else if (data.durationMinutes) {
          const endDt = new Date(startDt.getTime() + data.durationMinutes * 60 * 1000);
          endTime = endDt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }
      }
      
      return {
        id: doc.id,
        ...data,
        date: eventDate,
        startTime,
        endTime,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      };
    });

    // Sort in memory by date ascending
    events.sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[DISCOVER_EVENTS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', events: [] },
      { status: 500 }
    );
  }
}











