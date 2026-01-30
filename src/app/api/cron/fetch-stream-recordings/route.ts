/**
 * Fetch Stream Video Recordings Cron Job
 *
 * Runs periodically to check for completed in-app calls and fetch their recording URLs
 * from Stream Video API. This handles cases where the webhook didn't fire.
 *
 * Checks calls that ended 5-60 minutes ago.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { storeRecordingToBunny } from '@/lib/recording-storage';
import type { UnifiedEvent } from '@/types';

const CRON_SECRET = process.env.CRON_SECRET;

// Time window for checking completed events
const MIN_MINUTES_AFTER_END = 5;
const MAX_MINUTES_AFTER_END = 60;

// Get Stream Video server client
async function getStreamVideoServerClient() {
  const { StreamClient } = await import('@stream-io/node-sdk');

  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Stream API credentials not configured');
  }

  return new StreamClient(apiKey, apiSecret);
}

interface ProcessingResult {
  eventId: string;
  success: boolean;
  recordingFound: boolean;
  error?: string;
}

/**
 * GET /api/cron/fetch-stream-recordings
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[CRON_STREAM] Starting Stream recordings fetch...');

    const now = new Date();
    const minCutoff = new Date(now.getTime() - MAX_MINUTES_AFTER_END * 60 * 1000);
    const maxCutoff = new Date(now.getTime() - MIN_MINUTES_AFTER_END * 60 * 1000);

    // Find in-app call events without recordings
    const eventsSnapshot = await adminDb
      .collection('events')
      .where('endDateTime', '>=', minCutoff.toISOString())
      .where('endDateTime', '<=', maxCutoff.toISOString())
      .get();

    const eligibleEvents = eventsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as UnifiedEvent))
      .filter(event =>
        (event.locationType === 'chat' || event.meetingProvider === 'stream') &&
        event.organizationId &&
        !event.recordingUrl &&
        event.status === 'confirmed'
      );

    console.log(`[CRON_STREAM] Found ${eligibleEvents.length} eligible events`);

    if (eligibleEvents.length === 0) {
      return NextResponse.json({ success: true, processed: 0, duration: Date.now() - startTime });
    }

    const streamClient = await getStreamVideoServerClient();
    const results: ProcessingResult[] = [];

    for (const event of eligibleEvents) {
      try {
        const callPrefix = `event-${event.id}`;

        const { calls } = await streamClient.video.queryCalls({
          filter_conditions: {
            $or: [
              { 'custom.eventId': event.id },
              { id: { $gte: callPrefix } },
            ],
          },
          sort: [{ field: 'created_at', direction: -1 }],
          limit: 5,
        });

        let matchingCall = null;
        for (const call of calls) {
          if (call.call?.id?.startsWith(callPrefix) || call.call?.custom?.eventId === event.id) {
            matchingCall = call;
            break;
          }
        }

        if (!matchingCall) {
          results.push({ eventId: event.id, success: true, recordingFound: false, error: 'No matching call' });
          continue;
        }

        const callId = matchingCall.call?.id;
        const callType = matchingCall.call?.type || 'default';
        const call = streamClient.video.call(callType, callId!);
        const { recordings } = await call.listRecordings();

        if (!recordings?.length) {
          results.push({ eventId: event.id, success: true, recordingFound: false, error: 'No recordings yet' });
          continue;
        }

        const latestRecording = recordings[recordings.length - 1];
        const streamUrl = latestRecording.url;

        if (!streamUrl) {
          results.push({ eventId: event.id, success: true, recordingFound: false, error: 'Still processing' });
          continue;
        }

        const recStart = latestRecording.start_time ? new Date(latestRecording.start_time).getTime() : 0;
        const recEnd = latestRecording.end_time ? new Date(latestRecording.end_time).getTime() : 0;
        const durationSeconds = recStart && recEnd ? Math.round((recEnd - recStart) / 1000) : 0;

        if (durationSeconds < 120) {
          results.push({ eventId: event.id, success: true, recordingFound: false, error: `Too short (${durationSeconds}s)` });
          continue;
        }

        // Download from Stream and store to Bunny for permanent access
        let recordingUrl = streamUrl;
        try {
          recordingUrl = await storeRecordingToBunny(streamUrl, event.organizationId!, `event-${event.id}`);
          console.log(`[CRON_STREAM] Stored recording to Bunny for event ${event.id}`);
        } catch (storageError) {
          console.error(`[CRON_STREAM] Failed to store to Bunny for event ${event.id}:`, storageError);
          // Fallback to Stream URL if Bunny upload fails
        }

        await adminDb.collection('events').doc(event.id).update({
          hasCallRecording: true,
          recordingUrl,
          recordingStatus: 'ready',
          streamVideoCallId: callId,
          updatedAt: FieldValue.serverTimestamp(),
        });

        await adminDb
          .collection('organizations')
          .doc(event.organizationId!)
          .collection('call_recordings')
          .doc(callId!)
          .set({
            callId,
            recordingUrl,
            eventId: event.id,
            createdBy: matchingCall.call?.created_by?.id || event.hostUserId,
            durationSeconds,
            status: 'ready',
            createdAt: FieldValue.serverTimestamp(),
          }, { merge: true });

        console.log(`[CRON_STREAM] Found recording for event ${event.id}`);
        results.push({ eventId: event.id, success: true, recordingFound: true });

      } catch (error) {
        console.error(`[CRON_STREAM] Error for event ${event.id}:`, error);
        results.push({ eventId: event.id, success: false, recordingFound: false, error: String(error) });
      }
    }

    return NextResponse.json({
      success: true,
      processed: eligibleEvents.length,
      recordingsFound: results.filter(r => r.recordingFound).length,
      errors: results.filter(r => !r.success).length,
      results,
      duration: Date.now() - startTime,
    });

  } catch (error) {
    console.error('[CRON_STREAM] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
