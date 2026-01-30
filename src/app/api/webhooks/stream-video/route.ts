/**
 * Stream Video Webhook Handler
 *
 * Handles webhooks from Stream Video for call recording events.
 * Saves recording URL and marks event as 'ready' for on-demand summary generation.
 * Summaries are generated when coach clicks "Get Summary" button.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { storeRecordingToBunny } from '@/lib/recording-storage';

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
      instanceId?: string;
      isProgramCall?: boolean;
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
  const streamUrl = call_recording.url;
  const eventId = call.custom?.eventId;

  console.log(`[STREAM_VIDEO_WEBHOOK] Recording ready for call ${callId} in org ${organizationId}`);

  // Download from Stream and store to Bunny for permanent access
  // Stream URLs expire after ~2 weeks
  let recordingUrl = streamUrl;
  try {
    recordingUrl = await storeRecordingToBunny(streamUrl, organizationId, callId);
    console.log(`[STREAM_VIDEO_WEBHOOK] Stored recording to Bunny: ${recordingUrl}`);
  } catch (error) {
    console.error(`[STREAM_VIDEO_WEBHOOK] Failed to store to Bunny, using Stream URL:`, error);
    // Fallback to Stream URL if Bunny upload fails
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEDUPLICATION CHECK - Prevent double-processing of same recording
  // ═══════════════════════════════════════════════════════════════════════════
  const existingTranscription = await adminDb
    .collection('organizations')
    .doc(organizationId)
    .collection('platform_transcriptions')
    .where('callId', '==', callId)
    .where('status', 'in', ['completed', 'processing'])
    .limit(1)
    .get();

  if (!existingTranscription.empty) {
    const existingDoc = existingTranscription.docs[0];
    console.log(`[STREAM_VIDEO_WEBHOOK] Call ${callId} already processed (transcription ${existingDoc.id}, status: ${existingDoc.data()?.status}), skipping`);
    return;
  }

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

  // Update event with recording info - mark as 'ready' for on-demand summary generation
  // NO auto-summary generation - coach must click "Get Summary" button
  if (eventId) {
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (eventDoc.exists) {
      await adminDb.collection('events').doc(eventId).update({
        hasCallRecording: true,
        recordingUrl,
        recordingStatus: 'ready', // Ready for user to click "Get Summary"
        streamVideoCallId: callId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`[STREAM_VIDEO_WEBHOOK] Saved recording URL for event ${eventId}, ready for summary generation`);
    }
  }

  // Also save to organization's recordings collection for calls without events
  await adminDb
    .collection('organizations')
    .doc(organizationId)
    .collection('call_recordings')
    .doc(callId)
    .set({
      callId,
      recordingUrl,
      eventId: eventId || null,
      createdBy: call.created_by.id,
      durationSeconds,
      status: 'ready',
      createdAt: FieldValue.serverTimestamp(),
    });

  console.log(`[STREAM_VIDEO_WEBHOOK] Recording saved for call ${callId}, awaiting summary generation`);
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

