/**
 * API Route: Get Discover Events
 * 
 * GET /api/discover/events - Get all events
 * 
 * Multi-tenancy: If user belongs to an organization, only show org's events.
 * Otherwise, show all events (default GA experience).
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCurrentUserOrganizationId } from '@/lib/clerk-organizations';

export async function GET() {
  try {
    const { userId } = await auth();
    
    // Get user's organization (null if no org = default GA experience)
    const organizationId = userId ? await getCurrentUserOrganizationId() : null;
    
    let query: FirebaseFirestore.Query = adminDb.collection('events');
    
    if (organizationId) {
      // User belongs to an org - show only their org's content
      query = query.where('organizationId', '==', organizationId);
    }
    // else: no org = show all content (global GA experience)
    
    const eventsSnapshot = await query.get();

    const events = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamps to ISO strings
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

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











