import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { notifyCallProposed } from '@/lib/scheduling-notifications';
import { calculateProgramDayForDate } from '@/lib/calendar-weeks';
import type { UnifiedEvent, ProposedTime, SchedulingStatus, ProgramInstance } from '@/types';

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
 * - instanceId?: string - Program instance ID to link the call to
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
      instanceId: bodyInstanceId,
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
    const clientAvatarUrl = clientData?.imageUrl || clientData?.avatarUrl;

    // Get coach availability for timezone
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();
    const timezone = availabilityDoc.exists
      ? (availabilityDoc.data()?.timezone || 'America/New_York')
      : 'America/New_York';

    const now = new Date().toISOString();

    // Program instance linking - calculate week/day if instanceId is provided
    let instanceId: string | undefined = bodyInstanceId;
    let weekIndex: number | undefined;
    let dayIndex: number | undefined;
    let instanceData: ProgramInstance | null = null;
    let programId: string | undefined;

    // Use the first proposed time for calculating program day
    const firstProposedStart = proposedTimes[0]?.startDateTime;

    if (instanceId && firstProposedStart) {
      try {
        // Fetch the program instance to get start date and program info
        const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();
        if (instanceDoc.exists) {
          instanceData = instanceDoc.data() as ProgramInstance;
          programId = instanceData.programId;

          // We need program info to get totalDays and includeWeekends
          if (instanceData.programId) {
            const programDoc = await adminDb.collection('programs').doc(instanceData.programId).get();
            if (programDoc.exists) {
              const programData = programDoc.data();
              const totalDays = programData?.lengthDays || 30;
              const includeWeekends = programData?.includeWeekends !== false;
              const instanceStartDate = instanceData.startDate;

              if (instanceStartDate) {
                // Extract date part from startDateTime (it's in ISO format)
                const eventDate = new Date(firstProposedStart).toISOString().split('T')[0];

                const dayInfo = calculateProgramDayForDate(
                  instanceStartDate,
                  eventDate,
                  totalDays,
                  includeWeekends
                );

                if (dayInfo) {
                  weekIndex = dayInfo.weekIndex;
                  dayIndex = dayInfo.globalDayIndex; // Use global day index (1-based across program)
                  console.log(`[SCHEDULING_PROPOSE] Calculated program position: week ${weekIndex}, day ${dayIndex}`);
                } else {
                  console.log(`[SCHEDULING_PROPOSE] Event date ${eventDate} is outside program range`);
                }
              }
            }
          }
        } else {
          console.log(`[SCHEDULING_PROPOSE] Instance ${instanceId} not found, skipping program linking`);
          instanceId = undefined;
        }
      } catch (err) {
        console.error('[SCHEDULING_PROPOSE] Error calculating program day:', err);
        // Don't fail the request, just skip program linking
        instanceId = undefined;
      }
    }

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
      programId: programId || undefined,
      // Program instance linking (for 1:1 calls linked to program days)
      instanceId: instanceId || undefined,
      weekIndex,
      dayIndex,
      isRecurring,
      recurrence: isRecurring ? recurrence : undefined,
      createdByUserId: userId,
      hostUserId: userId,
      hostName: coachName,
      hostAvatarUrl: coachAvatarUrl,
      isCoachLed: true,
      clientUserId: clientId,
      clientName,
      clientAvatarUrl,
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

    // Link event to program instance week/day if applicable
    if (instanceId && weekIndex !== undefined && dayIndex !== undefined && instanceData) {
      try {
        const instanceRef = adminDb.collection('program_instances').doc(instanceId);
        const instanceDoc = await instanceRef.get();

        if (instanceDoc.exists) {
          const currentData = instanceDoc.data() as ProgramInstance;
          const weeks = [...(currentData.weeks || [])];

          if (weeks[weekIndex]) {
            // Add to week's linkedCallEventIds
            const weekLinkedCallEventIds = weeks[weekIndex].linkedCallEventIds || [];
            if (!weekLinkedCallEventIds.includes(eventRef.id)) {
              weeks[weekIndex].linkedCallEventIds = [...weekLinkedCallEventIds, eventRef.id];
            }

            // Find the day within the week and add to linkedEventIds
            const days = weeks[weekIndex].days || [];
            // dayIndex is globalDayIndex (1-based), we need to find the day within this week
            const weekStartDayIndex = weeks[weekIndex].startDayIndex || 1;
            const dayIndexInWeek = dayIndex - weekStartDayIndex;

            if (days[dayIndexInWeek]) {
              const dayLinkedEventIds = days[dayIndexInWeek].linkedEventIds || [];
              if (!dayLinkedEventIds.includes(eventRef.id)) {
                days[dayIndexInWeek].linkedEventIds = [...dayLinkedEventIds, eventRef.id];
              }
              weeks[weekIndex].days = days;
            }

            await instanceRef.update({
              weeks,
              updatedAt: FieldValue.serverTimestamp(),
            });

            console.log(`[SCHEDULING_PROPOSE] Linked event ${eventRef.id} to instance ${instanceId} week ${weekIndex} day ${dayIndex}`);
          }
        }
      } catch (err) {
        console.error('[SCHEDULING_PROPOSE] Error linking event to instance:', err);
        // Don't fail the request, the event was created successfully
      }
    }

    // Send notification to client about proposed call
    try {
      await notifyCallProposed(eventData, clientId);
    } catch (notifyErr) {
      console.error('[SCHEDULING_PROPOSE] Failed to send notification:', notifyErr);
      // Don't fail the request if notification fails
    }

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

