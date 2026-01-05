/**
 * AI Call Summary Service
 *
 * Generates AI-powered summaries from coaching call transcriptions.
 * Extracts key discussion points, action items, and coaching insights.
 */

import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { notifyUser } from '@/lib/notifications';
import type { CallSummary, CallSummaryActionItem, SuggestedTask, ProgramEnrollment, ProgramWeek, ClientProgramWeek, Program } from '@/types';

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
    hostUserId: string;
    hostName: string;
    clientUserId?: string;
    clientName?: string;
    programId?: string;
    programEnrollmentId?: string;
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

    // Notify coach to fill week with this summary (if client has active enrollment)
    await notifyCoachToFillWeek(orgId, summaryId, context);

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
 * Notify coach to fill a program week with the call summary
 * Called after a call summary is generated for a client with an active enrollment
 */
async function notifyCoachToFillWeek(
  orgId: string,
  summaryId: string,
  context: {
    hostUserId: string;
    clientUserId?: string;
    clientName?: string;
    programId?: string;
    programEnrollmentId?: string;
  }
): Promise<void> {
  try {
    // Need a client to check for enrollments
    if (!context.clientUserId) {
      return;
    }

    // Find active enrollment (either from context or query)
    let enrollment: ProgramEnrollment | null = null;
    let programId = context.programId;

    if (context.programEnrollmentId) {
      // Use the provided enrollment
      const enrollmentDoc = await adminDb
        .collection('program_enrollments')
        .doc(context.programEnrollmentId)
        .get();
      if (enrollmentDoc.exists) {
        enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;
        programId = enrollment.programId;
      }
    } else {
      // Find any active enrollment for this client in this org
      const enrollmentsSnapshot = await adminDb
        .collection('program_enrollments')
        .where('userId', '==', context.clientUserId)
        .where('organizationId', '==', orgId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!enrollmentsSnapshot.empty) {
        const doc = enrollmentsSnapshot.docs[0];
        enrollment = { id: doc.id, ...doc.data() } as ProgramEnrollment;
        programId = enrollment.programId;
      }
    }

    // No active enrollment found
    if (!enrollment || !programId) {
      console.log(`[AI Call Summary] No active enrollment for client ${context.clientUserId}, skipping notification`);
      return;
    }

    // Calculate current day index in the program
    const startDate = new Date(enrollment.startedAt);
    const today = new Date();
    const daysSinceStart = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const currentDayIndex = Math.max(0, daysSinceStart);

    // Find the week that contains the current day index
    const weeksSnapshot = await adminDb
      .collection('program_weeks')
      .where('programId', '==', programId)
      .where('startDayIndex', '<=', currentDayIndex)
      .orderBy('startDayIndex', 'desc')
      .limit(1)
      .get();

    if (weeksSnapshot.empty) {
      console.log(`[AI Call Summary] No matching week found for day ${currentDayIndex}`);
      return;
    }

    const weekDoc = weeksSnapshot.docs[0];
    const week = { id: weekDoc.id, ...weekDoc.data() } as ProgramWeek;

    // Verify the day index is within this week's range
    if (currentDayIndex > week.endDayIndex) {
      console.log(`[AI Call Summary] Current day ${currentDayIndex} is past week ${week.id}`);
      return;
    }

    // Smart week assignment: If call is in last 3 days of week (day 5+),
    // assign to NEXT week so action items are for upcoming days
    const dayWithinWeek = currentDayIndex - week.startDayIndex + 1; // 1-7
    const daysInWeek = week.endDayIndex - week.startDayIndex + 1;

    let targetWeekId = week.id;
    let targetWeekName = week.name || `Week ${week.weekNumber}`;

    // If call is on days 5-7 of a 7-day week, assign to next week
    if (dayWithinWeek >= 5 && daysInWeek === 7) {
      const nextWeekSnapshot = await adminDb
        .collection('program_weeks')
        .where('programId', '==', programId)
        .where('weekNumber', '==', week.weekNumber + 1)
        .limit(1)
        .get();

      if (!nextWeekSnapshot.empty) {
        const nextWeekDoc = nextWeekSnapshot.docs[0];
        const nextWeek = nextWeekDoc.data() as ProgramWeek;
        targetWeekId = nextWeekDoc.id;
        targetWeekName = nextWeek.name || `Week ${nextWeek.weekNumber}`;
        console.log(`[AI Call Summary] Call on day ${dayWithinWeek} of week - assigning to next week ${targetWeekId}`);
      } else {
        console.log(`[AI Call Summary] No next week found, keeping current week ${week.id}`);
      }
    }

    // Check if this is an individual (1:1) program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    const program = programDoc.exists ? (programDoc.data() as Program) : null;
    const isIndividualProgram = program?.type === 'individual';

    if (isIndividualProgram && enrollment) {
      // For individual programs, link to client-specific week
      // First, find the client week for this enrollment and week number
      const targetWeekData = weeksSnapshot.docs.find(d => d.id === targetWeekId)?.data() as ProgramWeek | undefined;
      const targetWeekNumber = targetWeekData?.weekNumber || week.weekNumber;

      let clientWeekSnapshot = await adminDb
        .collection('client_program_weeks')
        .where('enrollmentId', '==', enrollment.id)
        .where('programWeekId', '==', targetWeekId)
        .limit(1)
        .get();

      if (clientWeekSnapshot.empty) {
        // Try finding by week number if not found by programWeekId
        clientWeekSnapshot = await adminDb
          .collection('client_program_weeks')
          .where('enrollmentId', '==', enrollment.id)
          .where('weekNumber', '==', targetWeekNumber)
          .limit(1)
          .get();
      }

      if (!clientWeekSnapshot.empty) {
        // Link to existing client week
        const clientWeekDoc = clientWeekSnapshot.docs[0];
        await adminDb
          .collection('client_program_weeks')
          .doc(clientWeekDoc.id)
          .update({
            linkedSummaryIds: FieldValue.arrayUnion(summaryId),
            updatedAt: FieldValue.serverTimestamp(),
          });
        console.log(`[AI Call Summary] Auto-linked summary ${summaryId} to client week ${clientWeekDoc.id}`);
      } else {
        // No client week exists yet - create one from template
        const templateWeekDoc = await adminDb.collection('program_weeks').doc(targetWeekId).get();
        if (templateWeekDoc.exists) {
          const templateWeek = templateWeekDoc.data() as ProgramWeek;
          const newClientWeekRef = adminDb.collection('client_program_weeks').doc();

          const clientWeekData: Omit<ClientProgramWeek, 'id'> = {
            enrollmentId: enrollment.id,
            programWeekId: targetWeekId,
            programId,
            organizationId: orgId,
            userId: enrollment.userId,
            weekNumber: templateWeek.weekNumber,
            moduleId: templateWeek.moduleId,
            order: templateWeek.order,
            startDayIndex: templateWeek.startDayIndex,
            endDayIndex: templateWeek.endDayIndex,
            name: templateWeek.name,
            theme: templateWeek.theme,
            description: templateWeek.description,
            weeklyPrompt: templateWeek.weeklyPrompt,
            weeklyTasks: templateWeek.weeklyTasks,
            weeklyHabits: templateWeek.weeklyHabits,
            currentFocus: templateWeek.currentFocus,
            notes: templateWeek.notes,
            distribution: templateWeek.distribution || 'repeat-daily',
            linkedSummaryIds: [summaryId], // Link the summary
            linkedCallEventIds: [],
            hasLocalChanges: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastSyncedAt: new Date().toISOString(),
          };

          await newClientWeekRef.set(clientWeekData);
          console.log(`[AI Call Summary] Created client week ${newClientWeekRef.id} and linked summary ${summaryId}`);
        }
      }
    } else {
      // For group programs, link to template week (original behavior)
      await adminDb
        .collection('program_weeks')
        .doc(targetWeekId)
        .update({
          linkedSummaryIds: FieldValue.arrayUnion(summaryId),
          updatedAt: FieldValue.serverTimestamp(),
        });
      console.log(`[AI Call Summary] Auto-linked summary ${summaryId} to template week ${targetWeekId}`);
    }

    // Create notification for the coach
    const clientName = context.clientName || 'Client';
    const weekName = targetWeekName;

    await notifyUser({
      userId: context.hostUserId,
      type: 'call_summary_fill_week',
      title: `Call summary ready for ${clientName}`,
      body: `Fill ${weekName} with insights from your call with ${clientName}`,
      actionRoute: `/coach/programs/${programId}?weekId=${targetWeekId}&summaryId=${summaryId}`,
      organizationId: orgId,
      metadata: {
        summaryId,
        programId,
        weekId: targetWeekId,
        clientName,
      },
    });

    console.log(`[AI Call Summary] Notified coach ${context.hostUserId} to fill week ${targetWeekId}`);
  } catch (error) {
    // Don't fail the summary generation if notification fails
    console.error('[AI Call Summary] Error notifying coach:', error);
  }
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
