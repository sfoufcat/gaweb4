import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { UnifiedEvent, ProposedTime, SchedulingStatus } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/scheduling/propose
 * Coach proposes a call to a client
 * 
 * Body:
 * - clientId: string - The client's user ID
 * - proposedTimes: Array<{ startDateTime: string, endDateTime: string }> - Proposed time slots
 * - title?: string - Optional call title
 * - description?: string - Optional description
 * - duration?: number - Call duration in minutes
 * - locationType: 'online' | 'chat' - Location type
 * - locationLabel?: string - e.g., "Zoom", "Google Meet"
 * - meetingLink?: string - Video call link
 * - schedulingNotes?: string - Notes for the client
 * - respondBy?: string - ISO date deadline for response
 * - isRecurring?: boolean - Whether this is a recurring call
 * - recurrence?: RecurrencePattern - Recurrence settings if recurring
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();
    const body = await request.json();

    const {
      clientId,
      proposedTimes,
      title,
      description,
      duration = 60,
      locationType = 'online',
      locationLabel = 'Video Call',
      meetingLink,
      schedulingNotes,
      respondBy,
      isRecurring = false,
      recurrence,
    } = body;

    // Validate required fields
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    if (!proposedTimes || !Array.isArray(proposedTimes) || proposedTimes.length === 0) {
      return NextResponse.json(
        { error: 'At least one proposed time is required' },
        { status: 400 }
      );
    }

    // Validate proposed times format
    for (const time of proposedTimes) {
      if (!time.startDateTime || !time.endDateTime) {
        return NextResponse.json(
          { error: 'Each proposed time must have startDateTime and endDateTime' },
          { status: 400 }
        );
      }
      const start = new Date(time.startDateTime);
      const end = new Date(time.endDateTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format for proposed times' },
          { status: 400 }
        );
      }
      if (start >= end) {
        return NextResponse.json(
          { error: 'Start time must be before end time' },
          { status: 400 }
        );
      }
    }

    // Get coach info
    const coachDoc = await adminDb.collection('users').doc(userId).get();
    const coachData = coachDoc.data();
    const coachName = coachData?.firstName && coachData?.lastName 
      ? `${coachData.firstName} ${coachData.lastName}`
      : coachData?.name || 'Coach';
    const coachAvatarUrl = coachData?.imageUrl || coachData?.avatarUrl;

    // Get client info
    const clientDoc = await adminDb.collection('users').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }
    const clientData = clientDoc.data();
    const clientName = clientData?.firstName && clientData?.lastName
      ? `${clientData.firstName} ${clientData.lastName}`
      : clientData?.name || 'Client';

    // Get coach availability for timezone
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();
    const timezone = availabilityDoc.exists 
      ? (availabilityDoc.data()?.timezone || 'America/New_York')
      : 'America/New_York';

    const now = new Date().toISOString();

    // Create proposed time objects
    const formattedProposedTimes: ProposedTime[] = proposedTimes.map((time: { startDateTime: string; endDateTime: string }, index: number) => ({
      id: `proposed_${Date.now()}_${index}`,
      startDateTime: new Date(time.startDateTime).toISOString(),
      endDateTime: new Date(time.endDateTime).toISOString(),
      proposedBy: userId,
      proposedAt: now,
      status: 'pending' as const,
    }));

    // Use the first proposed time as the initial event time
    const firstProposed = formattedProposedTimes[0];

    // Create the event
    const eventRef = adminDb.collection('events').doc();
    const eventData: UnifiedEvent = {
      id: eventRef.id,
      title: title || `Call with ${clientName}`,
      description: description || `1-on-1 coaching call proposed by ${coachName}`,
      startDateTime: firstProposed.startDateTime,
      endDateTime: firstProposed.endDateTime,
      timezone,
      durationMinutes: duration,
      locationType,
      locationLabel,
      meetingLink,
      eventType: 'coaching_1on1',
      scope: 'private',
      participantModel: 'invite_only',
      approvalType: 'none',
      status: 'pending_approval', // Needs client acceptance
      organizationId,
      isRecurring,
      recurrence: isRecurring ? recurrence : undefined,
      createdByUserId: userId,
      hostUserId: userId,
      hostName: coachName,
      hostAvatarUrl: coachAvatarUrl,
      isCoachLed: true,
      attendeeIds: [userId, clientId],
      sendChatReminders: true,
      // Scheduling-specific fields
      schedulingStatus: 'proposed',
      proposedBy: userId,
      proposedTimes: formattedProposedTimes,
      schedulingNotes,
      respondBy,
      createdAt: now,
      updatedAt: now,
    };

    await eventRef.set(eventData);

    // TODO: Send notification to client about proposed call
    // This will be implemented in the notifications phase

    return NextResponse.json({
      event: eventData,
      success: true,
      message: 'Call proposal sent to client',
    });
  } catch (error) {
    console.error('[SCHEDULING_PROPOSE] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

