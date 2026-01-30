/**
 * Platform Transcription Service
 *
 * Uses Groq Whisper Large V3 Turbo for transcription ($0.04/hr - cheapest option).
 * Platform-owned API key, no user integration required.
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { uploadToBunnyStorage } from './bunny-storage';

// =============================================================================
// TYPES
// =============================================================================

interface TranscriptionResult {
  text: string;
  durationSeconds: number;
  language?: string;
  segments?: TranscriptionSegment[];
}

interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

interface PlatformTranscription {
  id: string;
  organizationId: string;
  callId: string;
  eventId?: string;
  recordingUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transcript?: string;
  segments?: TranscriptionSegment[];
  durationSeconds?: number;
  language?: string;
  error?: string;
  createdAt: FirebaseFirestore.FieldValue | string;
  completedAt?: FirebaseFirestore.FieldValue | string;
}

// =============================================================================
// GROQ TRANSCRIPTION
// =============================================================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Transcribe audio using Groq Whisper Large V3 Turbo
 * This is the cheapest option at $0.04/hr
 *
 * Note: Groq supports up to 100MB for files provided via URL (paid tier).
 * We use the URL parameter to avoid the 25MB direct upload limit.
 * See: https://groq.com/blog/largest-most-capable-asr-model-now-faster-on-groqcloud
 */
async function transcribeWithGroq(audioUrl: string): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set');
  }

  // Use URL parameter with multipart/form-data to support up to 100MB files (dev tier)
  // Groq requires multipart/form-data even for URL-based requests
  const formData = new FormData();
  formData.append('url', audioUrl);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // Don't set Content-Type - fetch will set it automatically with boundary for FormData
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    // Provide cleaner error messages for common errors
    if (error.includes('request_too_large') || error.includes('Request Entity Too Large')) {
      throw new Error(
        'File size exceeds the limit for transcription. ' +
        'Please use a shorter recording or compress the audio.'
      );
    }
    throw new Error(`Groq transcription failed: ${error}`);
  }

  const result = await response.json();

  // Extract segments if available
  const segments: TranscriptionSegment[] = result.segments?.map((seg: {
    id: number;
    start: number;
    end: number;
    text: string;
    avg_logprob?: number;
  }) => ({
    id: seg.id,
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
    confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : undefined,
  })) || [];

  return {
    text: result.text || '',
    durationSeconds: result.duration || 0,
    language: result.language,
    segments,
  };
}

// =============================================================================
// MAIN TRANSCRIPTION FUNCTIONS
// =============================================================================

/**
 * Transcribe a call recording using Groq (platform service)
 * This creates a transcription record and processes the transcription.
 *
 * @param waitForCompletion - If true, awaits the transcription to complete before returning.
 *                            Use this in serverless environments where fire-and-forget won't work.
 */
export async function transcribeCallWithGroq(
  orgId: string,
  callId: string,
  recordingUrl: string,
  eventId?: string,
  waitForCompletion: boolean = true
): Promise<{ success: boolean; transcriptionId?: string; error?: string }> {
  try {
    // Create transcription record
    const transcriptionsRef = adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('platform_transcriptions');

    const transcriptionData: Omit<PlatformTranscription, 'id'> = {
      organizationId: orgId,
      callId,
      eventId,
      recordingUrl,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    };

    const docRef = await transcriptionsRef.add(transcriptionData);
    const transcriptionId = docRef.id;

    if (waitForCompletion) {
      // Process transcription synchronously (for serverless environments)
      await processTranscription(orgId, transcriptionId, recordingUrl);
    } else {
      // Process transcription asynchronously (fire-and-forget for long-running servers)
      processTranscription(orgId, transcriptionId, recordingUrl).catch((error) => {
        console.error(`[PLATFORM-TRANSCRIPTION] Error processing ${transcriptionId}:`, error);
      });
    }

    return { success: true, transcriptionId };
  } catch (error) {
    console.error('[PLATFORM-TRANSCRIPTION] Error starting transcription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process transcription (async)
 */
async function processTranscription(
  orgId: string,
  transcriptionId: string,
  recordingUrl: string
): Promise<void> {
  const transcriptionRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('platform_transcriptions')
    .doc(transcriptionId);

  try {
    // Update status to processing
    await transcriptionRef.update({
      status: 'processing',
    });

    // Perform transcription
    const result = await transcribeWithGroq(recordingUrl);

    // Store transcript in Bunny Storage (avoids Firestore 1MB limit, 18x cheaper)
    const transcriptUrl = await uploadToBunnyStorage(
      Buffer.from(result.text, 'utf-8'),
      `orgs/${orgId}/transcripts/${transcriptionId}.txt`,
      'text/plain'
    );

    // Update with results - store URL instead of full text
    await transcriptionRef.update({
      status: 'completed',
      transcriptUrl, // URL to Bunny Storage
      segments: result.segments || [],
      durationSeconds: result.durationSeconds,
      language: result.language,
      completedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[PLATFORM-TRANSCRIPTION] Completed transcription ${transcriptionId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await transcriptionRef.update({
      status: 'failed',
      error: errorMessage,
    });

    console.error(`[PLATFORM-TRANSCRIPTION] Failed transcription ${transcriptionId}:`, error);

    // Re-throw so callers know transcription failed (especially in serverless where we await)
    throw error;
  }
}

/**
 * Get transcription by ID
 */
export async function getTranscription(
  orgId: string,
  transcriptionId: string
): Promise<PlatformTranscription | null> {
  const doc = await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('platform_transcriptions')
    .doc(transcriptionId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as PlatformTranscription;
}

/**
 * Get transcription by call ID
 */
export async function getTranscriptionByCallId(
  orgId: string,
  callId: string
): Promise<PlatformTranscription | null> {
  const snapshot = await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('platform_transcriptions')
    .where('callId', '==', callId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as PlatformTranscription;
}

/**
 * Calculate credits usage for a summary
 * Flat rate: 1 credit per summary regardless of duration
 */
export function calculateCreditsUsed(durationSeconds: number): number {
  return 1;
}

/**
 * Check if organization has sufficient credits
 */
export async function checkCreditsAvailable(
  orgId: string,
  requiredCredits: number
): Promise<{ available: boolean; remainingCredits: number }> {
  const orgDoc = await adminDb
    .collection('organizations')
    .doc(orgId)
    .get();

  if (!orgDoc.exists) {
    return { available: false, remainingCredits: 0 };
  }

  const data = orgDoc.data();
  const rawCredits = data?.summaryCredits;

  if (!rawCredits) {
    return { available: false, remainingCredits: 0 };
  }

  // Handle partial objects with defaults for each field
  const credits = {
    allocatedCredits: rawCredits.allocatedCredits ?? 0,
    usedCredits: rawCredits.usedCredits ?? 0,
    purchasedCredits: rawCredits.purchasedCredits ?? 0,
    usedPurchasedCredits: rawCredits.usedPurchasedCredits ?? 0,
  };

  // Calculate remaining from plan allocation
  const planRemaining = credits.allocatedCredits - credits.usedCredits;
  // Calculate remaining from purchased credits
  const purchasedRemaining = credits.purchasedCredits - credits.usedPurchasedCredits;
  // Total remaining
  const totalRemaining = planRemaining + purchasedRemaining;

  return {
    available: totalRemaining >= requiredCredits,
    remainingCredits: totalRemaining,
  };
}

/**
 * Deduct credits from organization
 * Uses plan credits first, then purchased credits
 */
export async function deductCredits(
  orgId: string,
  creditsToDeduct: number
): Promise<{ success: boolean; error?: string }> {
  const orgRef = adminDb.collection('organizations').doc(orgId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const orgDoc = await transaction.get(orgRef);
      if (!orgDoc.exists) {
        throw new Error('Organization not found');
      }

      const data = orgDoc.data();
      const rawCredits = data?.summaryCredits;

      if (!rawCredits) {
        throw new Error('No credits configured');
      }

      // Handle partial objects with defaults
      const credits = {
        allocatedCredits: rawCredits.allocatedCredits ?? 0,
        usedCredits: rawCredits.usedCredits ?? 0,
        purchasedCredits: rawCredits.purchasedCredits ?? 0,
        usedPurchasedCredits: rawCredits.usedPurchasedCredits ?? 0,
      };

      // Calculate how much plan credit is remaining
      const planRemaining = Math.max(0, credits.allocatedCredits - credits.usedCredits);

      if (planRemaining >= creditsToDeduct) {
        // Use plan credits only
        transaction.update(orgRef, {
          'summaryCredits.usedCredits': FieldValue.increment(creditsToDeduct),
        });
      } else {
        // Use all remaining plan credits + some purchased credits
        const purchasedToUse = creditsToDeduct - planRemaining;
        transaction.update(orgRef, {
          'summaryCredits.usedCredits': credits.allocatedCredits, // Max out plan
          'summaryCredits.usedPurchasedCredits': FieldValue.increment(purchasedToUse),
        });
      }
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Refund credits to organization (on failure)
 */
export async function refundCredits(
  orgId: string,
  creditsToRefund: number
): Promise<{ success: boolean; error?: string }> {
  const orgRef = adminDb.collection('organizations').doc(orgId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const orgDoc = await transaction.get(orgRef);
      if (!orgDoc.exists) {
        throw new Error('Organization not found');
      }

      const data = orgDoc.data();
      const credits = data?.summaryCredits;

      if (!credits) {
        throw new Error('No credits configured');
      }

      // Refund to purchased credits first (they were used second)
      const usedPurchased = credits.usedPurchasedCredits || 0;

      if (usedPurchased >= creditsToRefund) {
        // Refund only to purchased credits
        transaction.update(orgRef, {
          'summaryCredits.usedPurchasedCredits': FieldValue.increment(-creditsToRefund),
        });
      } else {
        // Refund all purchased used + some plan credits
        const planToRefund = creditsToRefund - usedPurchased;
        transaction.update(orgRef, {
          'summaryCredits.usedPurchasedCredits': 0,
          'summaryCredits.usedCredits': FieldValue.increment(-planToRefund),
        });
      }
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
