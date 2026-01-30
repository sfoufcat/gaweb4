/**
 * Generate Summary Endpoint
 *
 * On-demand summary generation for events with recordings.
 * Called when coach clicks "Get Summary" button.
 *
 * POST /api/events/[eventId]/generate-summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  transcribeCallWithGroq,
  checkCreditsAvailable,
  deductCredits,
  refundCredits,
  calculateCreditsUsed,
} from '@/lib/platform-transcription';
import { processCallSummary } from '@/lib/ai/call-summary';
import { getTranscriptionUrl } from '@/lib/bunny-stream';
import type { UnifiedEvent } from '@/types';

// Default duration if we can't calculate (30 minutes)
const DEFAULT_DURATION_SECONDS = 1800;

/**
 * Wait for transcription to complete
 */
async function waitForTranscription(
  organizationId: string,
  transcriptionId: string,
  maxAttempts = 60,
  intervalMs = 3000
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const transcriptionDoc = await adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('platform_transcriptions')
      .doc(transcriptionId)
      .get();

    const status = transcriptionDoc.data()?.status;

    if (status === 'completed') {
      return;
    }

    if (status === 'failed') {
      throw new Error('Transcription failed');
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Transcription timed out');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId, orgId } = await auth();
    const { eventId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get event
    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    // Get organizationId from event or auth
    const organizationId = event.organizationId || orgId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    // Validate: must have recording URL or bunnyVideoId
    if (!event.recordingUrl && !event.bunnyVideoId) {
      return NextResponse.json(
        { error: 'No recording available for this event' },
        { status: 400 }
      );
    }

    // Get transcription-compatible URL (Groq can't process HLS streams)
    const transcriptionUrl = await getTranscriptionUrl(event.bunnyVideoId, event.recordingUrl);
    if (!transcriptionUrl) {
      return NextResponse.json(
        { error: 'Recording is not available for transcription (encoding may still be in progress)' },
        { status: 400 }
      );
    }

    // Validate: summary doesn't already exist
    if (event.callSummaryId) {
      return NextResponse.json(
        { error: 'Summary already exists for this event' },
        { status: 400 }
      );
    }

    // Validate: not already processing
    if (event.recordingStatus === 'processing') {
      return NextResponse.json(
        { error: 'Summary is already being generated' },
        { status: 400 }
      );
    }

    // Calculate duration in seconds
    let durationSeconds = DEFAULT_DURATION_SECONDS;
    if (event.startDateTime && event.endDateTime) {
      const start = new Date(event.startDateTime).getTime();
      const end = new Date(event.endDateTime).getTime();
      durationSeconds = Math.floor((end - start) / 1000);
    } else if (event.durationMinutes) {
      durationSeconds = event.durationMinutes * 60;
    }

    // Flat rate: 1 credit per summary
    const creditsNeeded = calculateCreditsUsed(durationSeconds);

    // Check credits available
    const { available, remainingMinutes } = await checkCreditsAvailable(
      organizationId,
      creditsNeeded
    );

    if (!available) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          creditsRequired: creditsNeeded,
          creditsAvailable: remainingMinutes,
        },
        { status: 402 }
      );
    }

    // Deduct credits
    const deductResult = await deductCredits(organizationId, creditsNeeded);
    if (!deductResult.success) {
      return NextResponse.json(
        { error: 'Failed to deduct credits' },
        { status: 500 }
      );
    }

    console.log(`[GENERATE_SUMMARY] Deducted ${creditsNeeded} credits for event ${eventId}`);

    // Mark as processing
    await adminDb.collection('events').doc(eventId).update({
      recordingStatus: 'processing',
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      // Transcribe the recording
      const meetingProvider = event.meetingProvider || 'unknown';
      const transcriptionResult = await transcribeCallWithGroq(
        organizationId,
        `${meetingProvider}_${eventId}`,
        transcriptionUrl,
        eventId
      );

      if (!transcriptionResult.success || !transcriptionResult.transcriptionId) {
        throw new Error(transcriptionResult.error || 'Transcription failed');
      }

      // Wait for transcription to complete
      const transcriptionId = transcriptionResult.transcriptionId;
      await waitForTranscription(organizationId, transcriptionId);

      // Generate call summary
      const summaryResult = await processCallSummary(
        organizationId,
        `${meetingProvider}_${eventId}`,
        transcriptionId,
        {
          eventId,
          hostUserId: event.hostUserId,
          hostName: event.hostName,
          clientUserId: event.clientUserId,
          clientName: event.clientName,
          programId: event.programId,
          programEnrollmentId: event.enrollmentId,
          recordingUrl: event.recordingUrl,
          callStartedAt: event.startDateTime,
          callEndedAt: event.endDateTime || new Date().toISOString(),
          instanceId: event.instanceId,
          weekIndex: event.weekIndex,
          dayIndex: event.dayIndex,
        }
      );

      if (!summaryResult.success || !summaryResult.summaryId) {
        throw new Error(summaryResult.error || 'Summary generation failed');
      }

      // Update event with summary ID
      await adminDb.collection('events').doc(eventId).update({
        callSummaryId: summaryResult.summaryId,
        recordingStatus: 'completed',
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`[GENERATE_SUMMARY] Successfully generated summary for event ${eventId}`);

      return NextResponse.json({
        success: true,
        summaryId: summaryResult.summaryId,
        creditsUsed: creditsNeeded,
      });
    } catch (error) {
      // Refund credits on failure
      await refundCredits(organizationId, creditsNeeded);
      console.error(
        `[GENERATE_SUMMARY] Failed for event ${eventId}, ${creditsNeeded} credits refunded:`,
        error
      );

      // Mark as failed
      await adminDb.collection('events').doc(eventId).update({
        recordingStatus: 'failed',
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Summary generation failed',
          creditsRefunded: creditsNeeded,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[GENERATE_SUMMARY] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
