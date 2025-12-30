/**
 * API Route: Get/Update Single Event
 * 
 * GET /api/discover/events/[id] - Get event by ID with attendee profiles and ownership status
 * POST /api/discover/events/[id] - Join/leave event (RSVP)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { DiscoverEvent } from '@/types/discover';

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
    
    // Get coach info if organizationId exists
    let coachName: string | undefined;
    let coachImageUrl: string | undefined;
    
    if (eventData?.organizationId) {
      const orgSettingsDoc = await adminDb
        .collection('org_settings')
        .doc(eventData.organizationId)
        .get();
      
      if (orgSettingsDoc.exists) {
        const orgSettings = orgSettingsDoc.data();
        coachName = orgSettings?.coachDisplayName;
        coachImageUrl = orgSettings?.coachAvatarUrl;
      }
    }
    
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
              avatarUrl: userData?.profileImageUrl || userData?.avatarUrl || userData?.imageUrl || null,
            });
          }
        } catch (err) {
          console.error(`Failed to fetch user ${attendeeId}:`, err);
        }
      }
    }

    const event: DiscoverEvent & { coachName?: string; coachImageUrl?: string } = {
      id: eventDoc.id,
      title: eventData?.title,
      coverImageUrl: eventData?.coverImageUrl,
      date: eventData?.date,
      startTime: eventData?.startTime,
      endTime: eventData?.endTime,
      timezone: eventData?.timezone,
      startDateTime: eventData?.startDateTime,
      endDateTime: eventData?.endDateTime,
      durationMinutes: eventData?.durationMinutes,
      meetingLink: eventData?.meetingLink,
      locationType: eventData?.locationType,
      locationLabel: eventData?.locationLabel,
      shortDescription: eventData?.shortDescription,
      longDescription: eventData?.longDescription,
      bulletPoints: eventData?.bulletPoints || [],
      additionalInfo: eventData?.additionalInfo || {},
      zoomLink: eventData?.zoomLink,
      recordingUrl: eventData?.recordingUrl,
      hostName: eventData?.hostName,
      hostAvatarUrl: eventData?.hostAvatarUrl,
      featured: eventData?.featured,
      category: eventData?.category,
      track: eventData?.track,
      programIds: eventData?.programIds,
      organizationId: eventData?.organizationId,
      attendeeIds: eventData?.attendeeIds || [],
      maxAttendees: eventData?.maxAttendees,
      createdAt: eventData?.createdAt?.toDate?.()?.toISOString?.() || eventData?.createdAt,
      updatedAt: eventData?.updatedAt?.toDate?.()?.toISOString?.() || eventData?.updatedAt,
      // Pricing & Gating
      priceInCents: eventData?.priceInCents,
      currency: eventData?.currency,
      purchaseType: eventData?.purchaseType,
      isPublic: eventData?.isPublic,
      keyOutcomes: eventData?.keyOutcomes,
      features: eventData?.features,
      testimonials: eventData?.testimonials,
      faqs: eventData?.faqs,
      // Coach info
      coachName,
      coachImageUrl,
    };

    // Check if current user has already RSVPed
    const isJoined = userId ? attendeeIds.includes(userId) : false;

    // Check ownership if user is signed in
    let isOwned = false;
    let includedInProgramName: string | undefined;

    if (userId) {
      // Check direct purchase
      const purchaseSnapshot = await adminDb
        .collection('user_content_purchases')
        .where('userId', '==', userId)
        .where('contentType', '==', 'event')
        .where('contentId', '==', id)
        .limit(1)
        .get();

      if (!purchaseSnapshot.empty) {
        isOwned = true;
        const purchase = purchaseSnapshot.docs[0].data();
        includedInProgramName = purchase.includedInProgramName;
      }

      // Check if included in an enrolled program
      if (!isOwned && event.programIds && event.programIds.length > 0) {
        const enrollmentSnapshot = await adminDb
          .collection('program_enrollments')
          .where('userId', '==', userId)
          .where('programId', 'in', event.programIds)
          .where('status', 'in', ['active', 'upcoming', 'completed'])
          .limit(1)
          .get();

        if (!enrollmentSnapshot.empty) {
          isOwned = true;
          const enrollment = enrollmentSnapshot.docs[0].data();
          
          // Get program name
          const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
          if (programDoc.exists) {
            includedInProgramName = programDoc.data()?.name;
          }
        }
      }
    }

    return NextResponse.json({ 
      event, 
      updates, 
      attendees,
      isJoined,
      totalAttendees: attendeeIds.length,
      isOwned,
      includedInProgramName,
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
