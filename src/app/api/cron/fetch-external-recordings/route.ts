/**
 * Fetch External Recordings Cron Job
 *
 * Runs every 15 minutes to check for completed Zoom and Google Meet calls
 * and fetch their recording URLs.
 *
 * If the event has `autoGenerateSummary: true`, will automatically trigger
 * summary generation (deducting credits at generation time).
 *
 * Otherwise, summaries are generated on-demand when coach clicks "Get Summary" button.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getZoomRecordings } from '@/lib/integrations/zoom';
import { findMeetRecordingByEventId } from '@/lib/integrations/google-drive';
import { generateSummaryForEvent } from '@/lib/event-summary';
import type { UnifiedEvent } from '@/types';

const CRON_SECRET = process.env.CRON_SECRET;

// Time window for checking completed events (30-90 minutes ago)
// Give external providers time to process recordings
const MIN_MINUTES_AFTER_END = 30;
const MAX_MINUTES_AFTER_END = 90;

interface ProcessingResult {
  eventId: string;
  success: boolean;
  provider: string;
  recordingFound: boolean;
  autoSummaryTriggered?: boolean;
  error?: string;
}

/**
 * GET /api/cron/fetch-external-recordings
 * Fetch recording URLs from Zoom and Google Meet (no summary generation)
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        console.warn('[CRON_RECORDINGS] Invalid cron secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[CRON_RECORDINGS] Starting external recordings fetch...');

    // Calculate time window
    const now = new Date();
    const minCutoff = new Date(now.getTime() - MAX_MINUTES_AFTER_END * 60 * 1000);
    const maxCutoff = new Date(now.getTime() - MIN_MINUTES_AFTER_END * 60 * 1000);

    // Find events that:
    // - Use zoom or google_meet
    // - Have an externalMeetingId
    // - Ended within our time window
    // - Don't have a recordingUrl yet
    // - Are confirmed (completed)
    const eventsSnapshot = await adminDb
      .collection('events')
      .where('meetingProvider', 'in', ['zoom', 'google_meet'])
      .where('endDateTime', '>=', minCutoff.toISOString())
      .where('endDateTime', '<=', maxCutoff.toISOString())
      .get();

    const eligibleEvents = eventsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as UnifiedEvent))
      .filter(event =>
        event.externalMeetingId &&
        event.organizationId &&
        !event.recordingUrl &&
        event.status === 'confirmed'
      );

    console.log(`[CRON_RECORDINGS] Found ${eligibleEvents.length} events to check`);

    const results: ProcessingResult[] = [];

    for (const event of eligibleEvents) {
      try {
        const result = await fetchEventRecording(event);
        results.push(result);
      } catch (error) {
        console.error(`[CRON_RECORDINGS] Error fetching recording for event ${event.id}:`, error);
        results.push({
          eventId: event.id,
          success: false,
          provider: event.meetingProvider || 'unknown',
          recordingFound: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const recordingsFound = results.filter(r => r.recordingFound).length;
    const autoSummariesTriggered = results.filter(r => r.autoSummaryTriggered).length;
    const duration = Date.now() - startTime;

    console.log(`[CRON_RECORDINGS] Completed: ${recordingsFound} recordings found, ${autoSummariesTriggered} auto-summaries triggered, ${failed} failed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      checked: eligibleEvents.length,
      recordingsFound,
      autoSummariesTriggered,
      failed,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON_RECORDINGS] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch recording URL for a single event (no summary generation)
 */
async function fetchEventRecording(event: UnifiedEvent): Promise<ProcessingResult> {
  const { id: eventId, meetingProvider, externalMeetingId, organizationId } = event;

  if (!externalMeetingId || !organizationId) {
    return {
      eventId,
      success: false,
      provider: meetingProvider || 'unknown',
      recordingFound: false,
      error: 'Missing externalMeetingId or organizationId',
    };
  }

  console.log(`[CRON_RECORDINGS] Checking ${meetingProvider} recording for event ${eventId}`);

  // Fetch recording URL based on provider
  let recordingUrl: string | undefined;

  if (meetingProvider === 'zoom') {
    const result = await getZoomRecordings(organizationId, externalMeetingId);
    if (result.success && result.recordingUrl) {
      recordingUrl = result.recordingUrl;
    } else if (result.error?.includes('No cloud recordings')) {
      // No recording available - this is expected if recording wasn't enabled
      console.log(`[CRON_RECORDINGS] No Zoom recording for event ${eventId}`);
      return { eventId, success: true, provider: 'zoom', recordingFound: false };
    } else if (!result.success) {
      return { eventId, success: false, provider: 'zoom', recordingFound: false, error: result.error };
    }
  } else if (meetingProvider === 'google_meet') {
    const result = await findMeetRecordingByEventId(organizationId, externalMeetingId);
    if (result.success && result.recordingUrl) {
      recordingUrl = result.recordingUrl;
    } else if (result.error?.includes('No recordings found')) {
      // No recording available
      console.log(`[CRON_RECORDINGS] No Meet recording for event ${eventId}`);
      return { eventId, success: true, provider: 'google_meet', recordingFound: false };
    } else if (!result.success) {
      return { eventId, success: false, provider: 'google_meet', recordingFound: false, error: result.error };
    }
  }

  if (!recordingUrl) {
    return { eventId, success: true, provider: meetingProvider || 'unknown', recordingFound: false };
  }

  console.log(`[CRON_RECORDINGS] Found recording for event ${eventId}, saving URL`);

  // Update event with recording URL - mark as 'ready' for user to generate summary
  await adminDb.collection('events').doc(eventId).update({
    recordingUrl,
    hasCallRecording: true,
    recordingStatus: 'ready', // Ready for user to click "Get Summary"
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`[CRON_RECORDINGS] Saved recording URL for event ${eventId}`);

  // Check if auto-summary generation is enabled
  if (event.autoGenerateSummary) {
    console.log(`[CRON_RECORDINGS] Auto-summary enabled for event ${eventId}, triggering generation`);
    const summaryResult = await generateSummaryForEvent(eventId, true);
    return {
      eventId,
      success: true,
      provider: meetingProvider || 'unknown',
      recordingFound: true,
      autoSummaryTriggered: summaryResult.success,
      error: summaryResult.error,
    };
  }

  return { eventId, success: true, provider: meetingProvider || 'unknown', recordingFound: true };
}
