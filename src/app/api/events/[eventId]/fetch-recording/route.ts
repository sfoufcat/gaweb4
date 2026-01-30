/**
 * Fetch Recording from Video Call Providers
 *
 * Manually fetches recording data for an event from:
 * - Stream (in-app calls)
 * - Zoom (cloud recordings)
 * - Google Meet (Drive recordings)
 *
 * This is a fallback when the webhook didn't fire or for on-demand checking.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getZoomRecordings } from '@/lib/integrations/zoom';
import { findMeetRecordingByEventId } from '@/lib/integrations/google-drive';

// Stream Video server-side client
async function getStreamVideoServerClient() {
  const { StreamClient } = await import('@stream-io/node-sdk');

  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Stream API credentials not configured');
  }

  return new StreamClient(apiKey, apiSecret);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;

  try {
    // Get the event
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventDoc.data();

    // Check if user is authorized (host or attendee)
    const isHost = event?.hostUserId === userId;
    const isAttendee = event?.attendeeIds?.includes(userId);
    if (!isHost && !isAttendee) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // If already has recording, return it
    if (event?.recordingUrl) {
      return NextResponse.json({
        success: true,
        recordingUrl: event.recordingUrl,
        message: 'Recording already available'
      });
    }

    const organizationId = event?.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Event has no organization' }, { status: 400 });
    }

    const meetingProvider = event?.meetingProvider;
    const externalMeetingId = event?.externalMeetingId;

    // Route to appropriate provider
    if (meetingProvider === 'zoom') {
      return await fetchZoomRecording(eventId, organizationId, externalMeetingId);
    } else if (meetingProvider === 'google_meet') {
      return await fetchGoogleMeetRecording(eventId, organizationId, externalMeetingId);
    } else {
      // Default to Stream (in-app calls)
      return await fetchStreamRecording(eventId, organizationId, event);
    }

  } catch (error) {
    console.error('[FETCH_RECORDING] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recording' },
      { status: 500 }
    );
  }
}

/**
 * Fetch recording from Zoom
 */
async function fetchZoomRecording(
  eventId: string,
  organizationId: string,
  externalMeetingId?: string
) {
  if (!externalMeetingId) {
    return NextResponse.json({
      success: false,
      message: 'No Zoom meeting ID linked to this event'
    });
  }

  const result = await getZoomRecordings(organizationId, externalMeetingId);

  if (!result.success) {
    return NextResponse.json({
      success: false,
      message: result.error || 'Failed to fetch Zoom recording'
    });
  }

  if (!result.recordingUrl) {
    return NextResponse.json({
      success: false,
      message: 'No cloud recordings found for this meeting. Recording may still be processing or cloud recording may not be enabled.'
    });
  }

  // Update event with recording
  await adminDb.collection('events').doc(eventId).update({
    hasCallRecording: true,
    recordingUrl: result.recordingUrl,
    recordingStatus: 'ready',
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    success: true,
    recordingUrl: result.recordingUrl,
    message: 'Zoom recording fetched successfully',
  });
}

/**
 * Fetch recording from Google Meet (via Drive)
 */
async function fetchGoogleMeetRecording(
  eventId: string,
  organizationId: string,
  externalMeetingId?: string
) {
  if (!externalMeetingId) {
    return NextResponse.json({
      success: false,
      message: 'No Google Calendar event ID linked to this event'
    });
  }

  const result = await findMeetRecordingByEventId(organizationId, externalMeetingId);

  if (!result.success) {
    return NextResponse.json({
      success: false,
      message: result.error || 'Failed to fetch Google Meet recording'
    });
  }

  if (!result.recordingUrl) {
    return NextResponse.json({
      success: false,
      message: 'No recordings found in Google Drive. Recording may still be processing or recording may not be enabled for this meeting.'
    });
  }

  // Update event with recording
  await adminDb.collection('events').doc(eventId).update({
    hasCallRecording: true,
    recordingUrl: result.recordingUrl,
    recordingStatus: 'ready',
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    success: true,
    recordingUrl: result.recordingUrl,
    message: 'Google Meet recording fetched successfully',
  });
}

/**
 * Fetch recording from Stream (in-app calls)
 */
async function fetchStreamRecording(
  eventId: string,
  organizationId: string,
  event: FirebaseFirestore.DocumentData | undefined
) {
  // Get Stream Video client
  const streamClient = await getStreamVideoServerClient();

  // Query calls that might be associated with this event
  // Stream stores calls with type:id format, and we used "event-{eventId}-{timestamp}" format
  const callPrefix = `event-${eventId}`;

  // Query recent calls from Stream
  // Note: Stream's queryCalls returns calls matching filters
  const { calls } = await streamClient.video.queryCalls({
    filter_conditions: {
      // Look for calls with this event in custom data or in the call ID
      $or: [
        { 'custom.eventId': eventId },
        { id: { $gte: callPrefix } },
      ],
    },
    sort: [{ field: 'created_at', direction: -1 }],
    limit: 10,
  });

  // Find a call that matches this event
  let matchingCall = null;
  for (const call of calls) {
    // Check if call ID starts with our event prefix
    if (call.call?.id?.startsWith(callPrefix)) {
      matchingCall = call;
      break;
    }
    // Check custom data
    if (call.call?.custom?.eventId === eventId) {
      matchingCall = call;
      break;
    }
  }

  if (!matchingCall) {
    // Also try looking in organization's call_recordings subcollection
    const recordingsSnapshot = await adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('call_recordings')
      .where('eventId', '==', eventId)
      .limit(1)
      .get();

    if (!recordingsSnapshot.empty) {
      const recording = recordingsSnapshot.docs[0].data();
      // Update event with recording from our collection
      await adminDb.collection('events').doc(eventId).update({
        hasCallRecording: true,
        recordingUrl: recording.recordingUrl,
        recordingStatus: 'ready',
        streamVideoCallId: recording.callId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        recordingUrl: recording.recordingUrl,
        message: 'Recording found in database',
      });
    }

    // Calculate time since event ended
    const eventEndTime = event?.endDateTime
      ? new Date(event.endDateTime).getTime()
      : new Date(event?.startDateTime).getTime() + (event?.durationMinutes || 60) * 60 * 1000;
    const timeSinceEnd = Math.round((Date.now() - eventEndTime) / 60000);

    if (timeSinceEnd > 30) {
      return NextResponse.json({
        success: false,
        message: 'No matching call found.'
      });
    }

    return NextResponse.json({
      success: false,
      message: 'No matching call found. Recording may not be ready yet - try again in a few minutes.'
    });
  }

  // Get call recordings from Stream
  const callId = matchingCall.call?.id;
  const callType = matchingCall.call?.type || 'default';

  const call = streamClient.video.call(callType, callId!);
  const { recordings } = await call.listRecordings();

  if (!recordings || recordings.length === 0) {
    // Check if recording was enabled on this call
    const recordingMode = matchingCall.call?.settings?.recording?.mode;
    const callEndedAt = matchingCall.call?.ended_at;
    const callCreatedAt = matchingCall.call?.created_at;

    // Calculate time since call ended - use event endDateTime as fallback
    let timeSinceEnd = Infinity;
    if (callEndedAt) {
      timeSinceEnd = Math.round((Date.now() - new Date(callEndedAt).getTime()) / 60000);
    } else if (event?.endDateTime) {
      timeSinceEnd = Math.round((Date.now() - new Date(event.endDateTime).getTime()) / 60000);
    } else if (callCreatedAt) {
      // Fallback: assume call lasted ~30 min from creation
      timeSinceEnd = Math.round((Date.now() - new Date(callCreatedAt).getTime()) / 60000) - 30;
    }

    // Provide contextual message
    if (recordingMode === 'disabled' || recordingMode === 'available' || !recordingMode) {
      // 'available' means recording was possible but not auto-started
      // No recordingMode or 'disabled' means recording wasn't enabled
      return NextResponse.json({
        success: false,
        message: 'Recording was not enabled for this call. Future calls will have recording enabled automatically.',
        details: { recordingMode: recordingMode || 'not set', callId }
      });
    } else if (timeSinceEnd < 10) {
      return NextResponse.json({
        success: false,
        message: `Recording is being processed. Please wait 5-10 minutes and try again.`,
        details: { recordingMode, timeSinceEnd, callId }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'No recording found. The call may have been too short (under 2 minutes) or recording failed to start.',
        details: { recordingMode, timeSinceEnd, callId, callCreatedAt }
      });
    }
  }

  // Get the most recent recording
  const latestRecording = recordings[recordings.length - 1];
  const recordingUrl = latestRecording.url;

  if (!recordingUrl) {
    return NextResponse.json({
      success: false,
      message: 'Recording is still processing. Try again in a few minutes.'
    });
  }

  // Calculate duration
  const startTime = latestRecording.start_time ? new Date(latestRecording.start_time).getTime() : 0;
  const endTime = latestRecording.end_time ? new Date(latestRecording.end_time).getTime() : 0;
  const durationSeconds = startTime && endTime ? Math.round((endTime - startTime) / 1000) : 0;

  // Update the event with recording info
  await adminDb.collection('events').doc(eventId).update({
    hasCallRecording: true,
    recordingUrl,
    recordingStatus: 'ready',
    streamVideoCallId: callId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Also save to organization's recordings collection
  await adminDb
    .collection('organizations')
    .doc(organizationId)
    .collection('call_recordings')
    .doc(callId!)
    .set({
      callId,
      recordingUrl,
      eventId,
      createdBy: matchingCall.call?.created_by?.id,
      durationSeconds,
      status: 'ready',
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

  return NextResponse.json({
    success: true,
    recordingUrl,
    durationSeconds,
    message: 'Recording fetched and saved successfully',
  });
}
