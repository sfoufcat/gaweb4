/**
 * API Route: Get Discover Events
 * 
 * GET /api/discover/events - Get all events
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const eventsSnapshot = await adminDb
      .collection('events')
      .orderBy('date', 'asc')
      .get();

    const events = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamps to ISO strings
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[DISCOVER_EVENTS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', events: [] },
      { status: 500 }
    );
  }
}











