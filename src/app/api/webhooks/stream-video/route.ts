/**
 * Stream Video Webhook Handler
 *
 * Handles webhooks from Stream Video for call recording events.
 * Triggers transcription and AI summary generation when recordings are ready.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { transcribeCallWithGroq, checkCreditsAvailable, deductCredits, refundCredits, calculateCreditsUsed } from '@/lib/platform-transcription';
import { processCallSummary } from '@/lib/ai/call-summary';

// =============================================================================
// TYPES
// =============================================================================

interface StreamWebhookPayload {
  type: string;
  call_cid: string;
  created_at: string;
  call?: {
    id: string;
    type: string;
    cid: string;
    created_by: {
      id: string;
      name?: string;
    };
    custom?: {
      organizationId?: string;
      eventId?: string;
      clientUserId?: string;
      programId?: string;
      programEnrollmentId?: string;
    };
    settings?: {
      recording?: {
        mode: string;
        quality: string;
      };
    };
    session?: {
      participants?: Array<{
        user_id: string;
        user?: {
          id: string;
          name?: string;
        };
      }>;
    };
    created_at: string;
    ended_at?: string;
  };
  call_recording?: {
    filename: string;
    url: string;
    start_time: string;
    end_time: string;
  };
}

// =============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// =============================================================================

function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STREAM_VIDEO_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[STREAM_VIDEO_WEBHOOK] Missing STREAM_VIDEO_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature');

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('[STREAM_VIDEO_WEBHOOK] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload: StreamWebhookPayload = JSON.parse(rawBody);
    console.log(`[STREAM_VIDEO_WEBHOOK] Received: ${payload.type}`);

    switch (payload.type) {
      case 'call.recording_ready':
        await handleRecordingReady(payload);
        break;

      case 'call.session_ended':
        await handleCallEnded(payload);
        break;

      default:
        console.log(`[STREAM_VIDEO_WEBHOOK] Unhandled event type: ${payload.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[STREAM_VIDEO_WEBHOOK] Error processing webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handle call.recording_ready event
 * Triggered when a call recording is ready for processing
 */
async function handleRecordingReady(payload: StreamWebhookPayload): Promise<void> {
  const { call, call_recording } = payload;

  if (!call || !call_recording) {
    console.error('[STREAM_VIDEO_WEBHOOK] Missing call or recording data');
    return;
  }

  const organizationId = call.custom?.organizationId;
  if (!organizationId) {
    console.error('[STREAM_VIDEO_WEBHOOK] Missing organizationId in call custom data');
    return;
  }

  const callId = call.id;
  const recordingUrl = call_recording.url;
  const eventId = call.custom?.eventId;

  console.log(`[STREAM_VIDEO_WEBHOOK] Recording ready for call ${callId} in org ${organizationId}`);

  // Calculate recording duration in seconds
  const startTime = new Date(call_recording.start_time).getTime();
  const endTime = new Date(call_recording.end_time).getTime();
  const durationSeconds = Math.round((endTime - startTime) / 1000);

  // Skip very short recordings (less than 2 minutes)
  if (durationSeconds < 120) {
    console.log(`[STREAM_VIDEO_WEBHOOK] Skipping short recording (${durationSeconds}s)`);
    return;
  }

  // Check if this is a 1-on-1 coaching call (2 participants max)
  const participants = call.session?.participants || [];
  if (participants.length > 2) {
    console.log(`[STREAM_VIDEO_WEBHOOK] Skipping group call (${participants.length} participants)`);
    return;
  }

  // Get organization settings to check if auto-generate is enabled
  const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
  if (!orgDoc.exists) {
    console.error(`[STREAM_VIDEO_WEBHOOK] Organization ${organizationId} not found`);
    return;
  }

  const orgData = orgDoc.data();
  const summarySettings = orgData?.summarySettings;

  // Check if auto-generate is enabled (default to true if not set)
  const autoGenerate = summarySettings?.autoGenerate !== false;

  // If event exists, check for per-event override
  let shouldGenerate = autoGenerate;
  if (eventId) {
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (eventDoc.exists) {
      const eventData = eventDoc.data();
      if (typeof eventData?.generateSummary === 'boolean') {
        shouldGenerate = eventData.generateSummary;
      }

      // Update event with recording info
      await adminDb.collection('events').doc(eventId).update({
        hasCallRecording: true,
        recordingUrl,
        recordingStatus: 'ready',
        streamVideoCallId: callId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  if (!shouldGenerate) {
    console.log(`[STREAM_VIDEO_WEBHOOK] Summary generation disabled for this call`);
    return;
  }

  // Check credits availability
  const creditsNeeded = calculateCreditsUsed(durationSeconds);
  const { available, remainingMinutes } = await checkCreditsAvailable(organizationId, creditsNeeded);

  if (!available) {
    console.log(`[STREAM_VIDEO_WEBHOOK] Insufficient credits (need ${creditsNeeded}, have ${remainingMinutes})`);
    return;
  }

  // Deduct credits before processing
  const deductResult = await deductCredits(organizationId, creditsNeeded);
  if (!deductResult.success) {
    console.error(`[STREAM_VIDEO_WEBHOOK] Failed to deduct credits: ${deductResult.error}`);
    return;
  }

  try {
    // Get participant info
    const hostUserId = call.created_by.id;
    const hostName = call.created_by.name || 'Coach';
    const clientUserId = call.custom?.clientUserId || participants.find(p => p.user_id !== hostUserId)?.user_id;
    const clientName = participants.find(p => p.user_id === clientUserId)?.user?.name;

    // Start transcription
    const transcriptionResult = await transcribeCallWithGroq(
      organizationId,
      callId,
      recordingUrl,
      eventId
    );

    if (!transcriptionResult.success || !transcriptionResult.transcriptionId) {
      throw new Error(transcriptionResult.error || 'Transcription failed');
    }

    // Wait for transcription to complete (poll for status)
    // In production, this would be better handled via a separate queue/worker
    const transcriptionId = transcriptionResult.transcriptionId;
    await waitForTranscription(organizationId, transcriptionId);

    // Process call summary
    const summaryResult = await processCallSummary(
      organizationId,
      callId,
      transcriptionId,
      {
        eventId,
        hostUserId,
        hostName,
        clientUserId,
        clientName,
        programId: call.custom?.programId,
        programEnrollmentId: call.custom?.programEnrollmentId,
        recordingUrl,
        callStartedAt: call.created_at,
        callEndedAt: call.ended_at || new Date().toISOString(),
      }
    );

    if (summaryResult.success && summaryResult.summaryId && eventId) {
      // Update event with summary ID
      await adminDb.collection('events').doc(eventId).update({
        callSummaryId: summaryResult.summaryId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    console.log(`[STREAM_VIDEO_WEBHOOK] Successfully processed recording for call ${callId}`);
  } catch (error) {
    // Refund credits on failure
    await refundCredits(organizationId, creditsNeeded);
    console.error(`[STREAM_VIDEO_WEBHOOK] Error processing recording, credits refunded:`, error);
  }
}

/**
 * Handle call.session_ended event
 */
async function handleCallEnded(payload: StreamWebhookPayload): Promise<void> {
  const { call } = payload;

  if (!call) {
    return;
  }

  const organizationId = call.custom?.organizationId;
  const eventId = call.custom?.eventId;

  if (eventId && organizationId) {
    // Update event status
    await adminDb.collection('events').doc(eventId).update({
      streamVideoCallId: call.id,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[STREAM_VIDEO_WEBHOOK] Call ${call.id} ended, updated event ${eventId}`);
  }
}

/**
 * Wait for transcription to complete
 * Polls the transcription status until it's completed or failed
 */
async function waitForTranscription(
  orgId: string,
  transcriptionId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const doc = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('platform_transcriptions')
      .doc(transcriptionId)
      .get();

    if (!doc.exists) {
      throw new Error('Transcription not found');
    }

    const status = doc.data()?.status;

    if (status === 'completed') {
      return;
    }

    if (status === 'failed') {
      throw new Error(doc.data()?.error || 'Transcription failed');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Transcription timeout');
}
