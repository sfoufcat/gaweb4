/**
 * API Route: Get/Update Single Event
 * 
 * GET /api/discover/events/[id] - Get event by ID with attendee profiles
 * POST /api/discover/events/[id] - Join/leave event (RSVP)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs/server';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    
    const eventDoc = await adminDb.collection('events').doc(id).get();
    
    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const eventData = eventDoc.data();
    const attendeeIds = eventData?.attendeeIds || [];
    
    // Fetch updates subcollection
    const updatesSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('updates')
      .orderBy('createdAt', 'desc')
      .get();

    const updates = updatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
    }));

    // Fetch attendee profiles from users collection
    const attendees = [];
    if (attendeeIds.length > 0) {
      // Batch fetch user profiles (max 10 for display)
      const userIdsToFetch = attendeeIds.slice(0, 10);
      for (const attendeeId of userIdsToFetch) {
        try {
          const userDoc = await adminDb.collection('users').doc(attendeeId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            attendees.push({
              userId: attendeeId,
              firstName: userData?.firstName || 'User',
              lastName: userData?.lastName || '',
              avatarUrl: userData?.profileImageUrl || userData?.avatarUrl || null,
            });
          }
        } catch (err) {
          console.error(`Failed to fetch user ${attendeeId}:`, err);
        }
      }
    }

    const event = {
      id: eventDoc.id,
      ...eventData,
      createdAt: eventData?.createdAt?.toDate?.()?.toISOString?.() || eventData?.createdAt,
      updatedAt: eventData?.updatedAt?.toDate?.()?.toISOString?.() || eventData?.updatedAt,
    };

    // Check if current user has already RSVPed
    const isJoined = userId ? attendeeIds.includes(userId) : false;

    return NextResponse.json({ 
      event, 
      updates, 
      attendees,
      isJoined,
      totalAttendees: attendeeIds.length,
    });
  } catch (error) {
    console.error('[DISCOVER_EVENT_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { action } = await request.json();

    const eventRef = adminDb.collection('events').doc(id);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (action === 'join') {
      await eventRef.update({
        attendeeIds: FieldValue.arrayUnion(userId),
      });
      
      // Fetch updated attendee count
      const updatedDoc = await eventRef.get();
      const attendeeIds = updatedDoc.data()?.attendeeIds || [];
      
      return NextResponse.json({ 
        success: true, 
        action: 'joined',
        totalAttendees: attendeeIds.length,
      });
    } else if (action === 'leave') {
      await eventRef.update({
        attendeeIds: FieldValue.arrayRemove(userId),
      });
      
      // Fetch updated attendee count
      const updatedDoc = await eventRef.get();
      const attendeeIds = updatedDoc.data()?.attendeeIds || [];
      
      return NextResponse.json({ 
        success: true, 
        action: 'left',
        totalAttendees: attendeeIds.length,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "join" or "leave"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[DISCOVER_EVENT_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}
