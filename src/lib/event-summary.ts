/**
 * Event Summary Generation
 *
 * Shared logic for generating AI summaries from event recordings.
 * Used by both on-demand generation (API route) and auto-generation (cron job).
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  transcribeCallWithGroq,
  checkCreditsAvailable,
  deductCredits,
  refundCredits,
  calculateCreditsUsed,
} from '@/lib/platform-transcription';
import { processCallSummary, autoFillWeekFromSummary } from '@/lib/ai/call-summary';
import type { UnifiedEvent, ProgramEnrollment } from '@/types';

// Default duration if we can't calculate (30 minutes)
const DEFAULT_DURATION_SECONDS = 1800;

export interface GenerateSummaryResult {
  success: boolean;
  summaryId?: string;
  creditsUsed?: number;
  error?: string;
  creditsRefunded?: boolean;
}

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

/**
 * Generate summary for an event with a recording
 *
 * This handles the full flow:
 * 1. Check credits
 * 2. Deduct credits
 * 3. Transcribe recording
 * 4. Generate summary
 * 5. Link summary to event
 * 6. Refund credits on failure
 *
 * @param eventId - The event ID to generate summary for
 * @param skipAuthCheck - Skip authentication check (for cron job usage)
 */
export async function generateSummaryForEvent(
  eventId: string,
  skipAuthCheck = false
): Promise<GenerateSummaryResult> {
  try {
    // Get event
    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return { success: false, error: 'Event not found' };
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;
    const organizationId = event.organizationId;

    if (!organizationId) {
      return { success: false, error: 'Organization not found' };
    }

    // Validate: must have recording URL
    if (!event.recordingUrl) {
      return { success: false, error: 'No recording available for this event' };
    }

    // Validate: summary doesn't already exist
    if (event.callSummaryId) {
      return { success: false, error: 'Summary already exists for this event' };
    }

    // Validate: not already processing
    if (event.recordingStatus === 'processing') {
      return { success: false, error: 'Summary is already being generated' };
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
      // For auto-summary, mark the event with failure reason
      await adminDb.collection('events').doc(eventId).update({
        autoSummaryFailed: true,
        autoSummaryFailedReason: 'insufficient_credits',
        updatedAt: FieldValue.serverTimestamp(),
      });
      return {
        success: false,
        error: `Insufficient credits: need ${creditsNeeded}, have ${remainingMinutes}`,
      };
    }

    // Deduct credits
    const deductResult = await deductCredits(organizationId, creditsNeeded);
    if (!deductResult.success) {
      return { success: false, error: 'Failed to deduct credits' };
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
        event.recordingUrl,
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

      // Auto-fill week from summary if enabled (event-level or program-level setting)
      let shouldAutoFill = event.autoFillWeek;

      // Check program-level autoGenerateSummary (which also enables auto-fill)
      if (!shouldAutoFill && event.programId) {
        try {
          const programDoc = await adminDb.collection('programs').doc(event.programId).get();
          const program = programDoc.data();
          if (program?.autoGenerateSummary) {
            shouldAutoFill = true;
            console.log(`[GENERATE_SUMMARY] Program-level autoGenerateSummary enables auto-fill for event ${eventId}`);
          }
        } catch (err) {
          console.error(`[GENERATE_SUMMARY] Error checking program settings:`, err);
        }
      }

      if (shouldAutoFill && event.instanceId && event.programId) {
        try {
          // Get enrollment data if available
          let enrollment: ProgramEnrollment | undefined;
          if (event.enrollmentId) {
            const enrollmentDoc = await adminDb
              .collection('program_enrollments')
              .doc(event.enrollmentId)
              .get();
            if (enrollmentDoc.exists) {
              enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;
            }
          }

          // Calculate week index from event data or default to 0
          const weekIndex = event.weekIndex ?? 0;

          const fillResult = await autoFillWeekFromSummary(
            organizationId,
            summaryResult.summaryId,
            {
              programId: event.programId,
              instanceId: event.instanceId,
              weekIndex,
              autoFillTarget: event.autoFillTarget || 'until_call',
              cohortId: event.cohortId,
              enrollment,
            }
          );

          if (fillResult.success) {
            console.log(`[GENERATE_SUMMARY] Auto-filled ${fillResult.daysUpdated} days for event ${eventId}`);
          } else {
            // Log error but don't fail the summary generation
            console.error(`[GENERATE_SUMMARY] Auto-fill failed for event ${eventId}:`, fillResult.error);
            // Fall back to notification (existing behavior)
          }
        } catch (autoFillError) {
          // Log error but don't fail the summary generation
          console.error(`[GENERATE_SUMMARY] Auto-fill error for event ${eventId}:`, autoFillError);
        }
      }

      return {
        success: true,
        summaryId: summaryResult.summaryId,
        creditsUsed: creditsNeeded,
      };
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
        autoSummaryFailed: true,
        autoSummaryFailedReason: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Summary generation failed',
        creditsRefunded: true,
      };
    }
  } catch (error) {
    console.error('[GENERATE_SUMMARY] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
