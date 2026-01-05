/**
 * AI Call Summary Service
 *
 * Generates AI-powered summaries from coaching call transcriptions.
 * Extracts key discussion points, action items, and coaching insights.
 */

import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { CallSummary, CallSummaryActionItem, SuggestedTask } from '@/types';

// =============================================================================
// CLIENT INITIALIZATION
// =============================================================================

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('[AI Call Summary] WARNING: ANTHROPIC_API_KEY is not set!');
}

const anthropic = new Anthropic({
  apiKey: apiKey,
});

// Model configuration - using Haiku for cost efficiency on summaries
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
const MAX_TOKENS = 4096;

// =============================================================================
// TYPES
// =============================================================================

interface CallSummaryInput {
  transcript: string;
  durationSeconds: number;
  callType: 'coaching_1on1';
  hostName: string;
  clientName?: string;
  programName?: string;
}

interface CallSummaryResult {
  summary: {
    executive: string;
    keyDiscussionPoints: string[];
    clientProgress?: string;
    challenges?: string[];
    breakthroughs?: string[];
    coachingNotes?: string;
  };
  actionItems: CallSummaryActionItem[];
  followUpQuestions?: string[];
}

// =============================================================================
// PROMPT
// =============================================================================

const SYSTEM_PROMPT = `You are an expert coaching assistant analyzing call transcriptions.
Your role is to extract actionable insights from coaching calls to help coaches track client progress and follow up effectively.

Guidelines:
- Be concise but comprehensive
- Focus on actionable insights
- Identify concrete next steps
- Note any breakthroughs or challenges
- Keep the tone professional and supportive

Output must be valid JSON matching this structure:
{
  "summary": {
    "executive": "2-3 sentence overview of the call",
    "keyDiscussionPoints": ["point 1", "point 2", ...],
    "clientProgress": "Brief summary of client's progress (if applicable)",
    "challenges": ["challenge 1", "challenge 2", ...],
    "breakthroughs": ["breakthrough 1", ...],
    "coachingNotes": "Notes for the coach's reference"
  },
  "actionItems": [
    {
      "id": "unique-id-1",
      "description": "What needs to be done",
      "assignedTo": "client" | "coach" | "both",
      "priority": "high" | "medium" | "low",
      "category": "optional category"
    }
  ],
  "followUpQuestions": ["Question 1?", "Question 2?", ...]
}`;

function buildUserPrompt(input: CallSummaryInput): string {
  let prompt = `Please analyze this ${Math.round(input.durationSeconds / 60)} minute coaching call transcript and extract key insights.\n\n`;

  if (input.programName) {
    prompt += `Program: ${input.programName}\n`;
  }
  prompt += `Coach: ${input.hostName}\n`;
  if (input.clientName) {
    prompt += `Client: ${input.clientName}\n`;
  }
  prompt += `\n---TRANSCRIPT START---\n${input.transcript}\n---TRANSCRIPT END---\n\n`;
  prompt += `Provide a structured summary with action items. Output valid JSON only.`;

  return prompt;
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Generate a call summary from transcription
 */
export async function generateCallSummary(
  input: CallSummaryInput
): Promise<CallSummaryResult> {
  const message = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(input),
      },
    ],
    system: SYSTEM_PROMPT,
  });

  // Extract text content
  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from AI');
  }

  // Parse JSON response
  let result: CallSummaryResult;
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = textContent.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    result = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('[AI Call Summary] Failed to parse response:', textContent.text);
    throw new Error('Failed to parse AI response as JSON');
  }

  // Add IDs to action items if missing
  result.actionItems = result.actionItems.map((item, index) => ({
    ...item,
    id: item.id || `action-${index + 1}`,
  }));

  return result;
}

/**
 * Process a call and generate summary with suggested tasks
 * This is the main entry point called after transcription completes
 */
export async function processCallSummary(
  orgId: string,
  callId: string,
  transcriptionId: string,
  context: {
    eventId?: string;
    hostUserId: string;
    hostName: string;
    clientUserId?: string;
    clientName?: string;
    programId?: string;
    programEnrollmentId?: string;
    programName?: string;
    recordingUrl?: string;
    callStartedAt: string;
    callEndedAt: string;
  }
): Promise<{ success: boolean; summaryId?: string; error?: string }> {
  try {
    // Get transcription
    const transcriptionDoc = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('platform_transcriptions')
      .doc(transcriptionId)
      .get();

    if (!transcriptionDoc.exists) {
      throw new Error('Transcription not found');
    }

    const transcription = transcriptionDoc.data();
    if (transcription?.status !== 'completed') {
      throw new Error('Transcription not completed');
    }

    const durationSeconds = transcription.durationSeconds || 0;

    // Skip very short calls (less than 2 minutes)
    if (durationSeconds < 120) {
      console.log(`[AI Call Summary] Skipping short call (${durationSeconds}s)`);
      return { success: false, error: 'Call too short for summary (< 2 minutes)' };
    }

    // Create call summary record with 'processing' status
    const summariesRef = adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('call_summaries');

    const summaryData: Omit<CallSummary, 'id'> = {
      organizationId: orgId,
      callId,
      eventId: context.eventId,
      transcriptionId,
      callType: 'coaching_1on1',
      hostUserId: context.hostUserId,
      participantUserIds: context.clientUserId
        ? [context.hostUserId, context.clientUserId]
        : [context.hostUserId],
      clientUserId: context.clientUserId,
      programId: context.programId,
      programEnrollmentId: context.programEnrollmentId,
      recordingUrl: context.recordingUrl,
      recordingDurationSeconds: durationSeconds,
      summary: {
        executive: '',
        keyDiscussionPoints: [],
      },
      actionItems: [],
      status: 'processing',
      callDurationSeconds: durationSeconds,
      callStartedAt: context.callStartedAt,
      callEndedAt: context.callEndedAt,
      reviewedByCoach: false,
      createdAt: FieldValue.serverTimestamp() as unknown as string,
      updatedAt: FieldValue.serverTimestamp() as unknown as string,
    };

    const summaryRef = await summariesRef.add(summaryData);
    const summaryId = summaryRef.id;

    // Generate summary asynchronously
    generateAndStoreSummary(
      orgId,
      summaryId,
      transcription.transcript,
      durationSeconds,
      context
    ).catch((error) => {
      console.error(`[AI Call Summary] Error generating summary ${summaryId}:`, error);
    });

    return { success: true, summaryId };
  } catch (error) {
    console.error('[AI Call Summary] Error processing call summary:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate and store the summary (async)
 */
async function generateAndStoreSummary(
  orgId: string,
  summaryId: string,
  transcript: string,
  durationSeconds: number,
  context: {
    hostName: string;
    clientUserId?: string;
    clientName?: string;
    programName?: string;
  }
): Promise<void> {
  const summaryRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('call_summaries')
    .doc(summaryId);

  try {
    // Generate summary
    const result = await generateCallSummary({
      transcript,
      durationSeconds,
      callType: 'coaching_1on1',
      hostName: context.hostName,
      clientName: context.clientName,
      programName: context.programName,
    });

    // Update summary with results
    await summaryRef.update({
      summary: result.summary,
      actionItems: result.actionItems,
      followUpQuestions: result.followUpQuestions || [],
      status: 'completed',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create suggested tasks from action items for client
    if (context.clientUserId && result.actionItems.length > 0) {
      await createSuggestedTasks(orgId, summaryId, context.clientUserId, result.actionItems);
    }

    console.log(`[AI Call Summary] Completed summary ${summaryId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await summaryRef.update({
      status: 'failed',
      processingError: errorMessage,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.error(`[AI Call Summary] Failed summary ${summaryId}:`, error);
  }
}

/**
 * Create suggested tasks from action items
 */
async function createSuggestedTasks(
  orgId: string,
  summaryId: string,
  clientUserId: string,
  actionItems: CallSummaryActionItem[]
): Promise<void> {
  const suggestedTasksRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('suggested_tasks');

  const clientTasks = actionItems.filter(
    (item) => item.assignedTo === 'client' || item.assignedTo === 'both'
  );

  const batch = adminDb.batch();

  for (const item of clientTasks) {
    const taskData: Omit<SuggestedTask, 'id'> = {
      organizationId: orgId,
      callSummaryId: summaryId,
      userId: clientUserId,
      title: item.description,
      notes: item.category ? `Category: ${item.category}` : undefined,
      status: 'pending_review',
      createdAt: FieldValue.serverTimestamp() as unknown as string,
      updatedAt: FieldValue.serverTimestamp() as unknown as string,
    };

    const newTaskRef = suggestedTasksRef.doc();
    batch.set(newTaskRef, taskData);
  }

  await batch.commit();
  console.log(`[AI Call Summary] Created ${clientTasks.length} suggested tasks for summary ${summaryId}`);
}

/**
 * Get call summary by ID
 */
export async function getCallSummaryById(
  orgId: string,
  summaryId: string
): Promise<CallSummary | null> {
  const doc = await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('call_summaries')
    .doc(summaryId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as CallSummary;
}

/**
 * List call summaries for an organization
 */
export async function listCallSummaries(
  orgId: string,
  options?: {
    clientUserId?: string;
    programId?: string;
    limit?: number;
  }
): Promise<CallSummary[]> {
  let query = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('call_summaries')
    .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

  if (options?.clientUserId) {
    query = query.where('clientUserId', '==', options.clientUserId);
  }

  if (options?.programId) {
    query = query.where('programId', '==', options.programId);
  }

  query = query.limit(options?.limit || 50);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CallSummary[];
}

/**
 * Mark summary as reviewed by coach
 */
export async function markSummaryReviewed(
  orgId: string,
  summaryId: string
): Promise<void> {
  await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('call_summaries')
    .doc(summaryId)
    .update({
      reviewedByCoach: true,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}
