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
import type { CallSummary, CallSummaryActionItem, SuggestedTask, ProgramEnrollment, ProgramWeek, ClientProgramWeek, Program, ProgramInstance } from '@/types';

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
  weekContent?: {
    notes: string[];           // Max 3 client-facing reminder/context notes
    goals?: string[];          // Max 3 goals for the week (new)
    currentFocus?: string[];   // Legacy: kept for backwards compat
    theme?: string;            // Optional week theme
    description?: string;      // What client should focus on this week
  };
}

// =============================================================================
// PROMPT
// =============================================================================

const SYSTEM_PROMPT = `You are an expert coaching assistant analyzing call transcriptions.
Your role is to extract actionable insights from coaching calls to help coaches track client progress and follow up effectively.

Guidelines:
- Be concise but comprehensive
- Focus on actionable insights
- Identify concrete next steps with timing/frequency when mentioned
- Note any breakthroughs or challenges
- Keep the tone professional and supportive

IMPORTANT: Extract timing/frequency information for action items:
- If coach says "do this every day" or "daily" → frequency: "daily"
- If coach says "do this once" or mentions no frequency → frequency: "once"
- If coach says "by Thursday", "on Friday", "before Monday" → frequency: "specific_day", targetDayName: "Thursday"

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
      "category": "optional category",
      "frequency": "daily" | "once" | "specific_day",
      "targetDayName": "Monday" (only if frequency is "specific_day")
    }
  ],
  "followUpQuestions": ["Question 1?", "Question 2?", ...],
  "weekContent": {
    "notes": ["Reminder 1 for client", "Reminder 2", "Reminder 3"],
    "goals": ["Goal 1 for the week", "Goal 2", "Goal 3"],
    "theme": "Optional theme for the week (e.g., 'Building Momentum')",
    "description": "What the client should focus on and accomplish this week"
  }
}

The weekContent section should describe what the CLIENT'S UPCOMING WEEK should look like (NOT a summary of the call):
- notes: 3 key reminders or context items the client should keep in mind this week
- goals: 3 specific goals or focus areas the client should work toward this week based on what was discussed
- theme: A short inspiring theme that captures the spirit of the week ahead (e.g., 'Building Momentum', 'Taking Bold Action')
- description: A 1-2 sentence description of what the client should prioritize and accomplish this week. Write it as guidance for the week ahead, not a recap of the call.`;

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

  // Add IDs and default frequency to action items if missing
  result.actionItems = result.actionItems.map((item, index) => ({
    ...item,
    id: item.id || `action-${index + 1}`,
    frequency: item.frequency || 'once',  // Default to 'once' if not specified
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
    // Program instance linking
    instanceId?: string;
    weekIndex?: number;
    dayIndex?: number;
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

    // Skip very short calls (less than 2 minutes) - but allow PDFs (durationSeconds = 0)
    if (durationSeconds > 0 && durationSeconds < 120) {
      console.log(`[AI Call Summary] Skipping short call (${durationSeconds}s)`);
      return { success: false, error: 'Call too short for summary (< 2 minutes)' };
    }

    // Get transcript - either from URL (new) or direct field (legacy)
    let transcriptText: string;
    if (transcription.transcriptUrl) {
      // New format: fetch from Bunny Storage
      const response = await fetch(transcription.transcriptUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch transcript from URL: ${response.status}`);
      }
      transcriptText = await response.text();
    } else if (transcription.transcript) {
      // Legacy format: read from Firestore field
      transcriptText = transcription.transcript;
    } else {
      throw new Error('No transcript found');
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
      // Program instance linking (for displaying summary in program day/week)
      instanceId: context.instanceId,
      weekIndex: context.weekIndex,
      dayIndex: context.dayIndex,
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

    // Generate summary synchronously to ensure it completes before returning
    // This prevents silent failures when serverless functions timeout
    try {
      await generateAndStoreSummary(
        orgId,
        summaryId,
        transcriptText,
        durationSeconds,
        context
      );
    } catch (error) {
      console.error(`[AI Call Summary] Error generating summary ${summaryId}:`, error);
      // Status will be 'failed' from generateAndStoreSummary's catch block
    }

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
    // Program instance linking
    instanceId?: string;
    weekIndex?: number;
    dayIndex?: number;
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
      weekContent: result.weekContent,
      status: 'completed',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create suggested tasks from action items for client
    if (context.clientUserId && result.actionItems.length > 0) {
      await createSuggestedTasks(orgId, summaryId, context.clientUserId, result.actionItems);
    }

    // Link summary to program instance week/day if applicable
    if (context.instanceId && context.weekIndex !== undefined) {
      await linkSummaryToInstance(summaryId, context.instanceId, context.weekIndex, context.dayIndex);
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
 * Link a call summary to a program instance's week and day
 */
async function linkSummaryToInstance(
  summaryId: string,
  instanceId: string,
  weekIndex: number,
  dayIndex?: number
): Promise<void> {
  try {
    const instanceRef = adminDb.collection('program_instances').doc(instanceId);
    const instanceDoc = await instanceRef.get();

    if (!instanceDoc.exists) {
      console.log(`[AI Call Summary] Instance ${instanceId} not found, skipping linking`);
      return;
    }

    const instanceData = instanceDoc.data() as ProgramInstance;
    const weeks = [...(instanceData.weeks || [])];

    if (!weeks[weekIndex]) {
      console.log(`[AI Call Summary] Week ${weekIndex} not found in instance ${instanceId}`);
      return;
    }

    // Add to week's linkedSummaryIds
    const weekLinkedSummaryIds = weeks[weekIndex].linkedSummaryIds || [];
    if (!weekLinkedSummaryIds.includes(summaryId)) {
      weeks[weekIndex].linkedSummaryIds = [...weekLinkedSummaryIds, summaryId];
    }

    // If dayIndex is provided, also add to day's linkedSummaryIds
    if (dayIndex !== undefined) {
      const days = weeks[weekIndex].days || [];
      const weekStartDayIndex = weeks[weekIndex].startDayIndex || 1;
      const dayIndexInWeek = dayIndex - weekStartDayIndex;

      if (days[dayIndexInWeek]) {
        const dayLinkedSummaryIds = days[dayIndexInWeek].linkedSummaryIds || [];
        if (!dayLinkedSummaryIds.includes(summaryId)) {
          days[dayIndexInWeek].linkedSummaryIds = [...dayLinkedSummaryIds, summaryId];
        }
        weeks[weekIndex].days = days;
      }
    }

    await instanceRef.update({
      weeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[AI Call Summary] Linked summary ${summaryId} to instance ${instanceId} week ${weekIndex}${dayIndex !== undefined ? ` day ${dayIndex}` : ''}`);
  } catch (error) {
    console.error('[AI Call Summary] Error linking summary to instance:', error);
    // Don't throw - this is a non-critical operation
  }
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
            distribution: undefined, // Let it inherit from program setting
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

// =============================================================================
// AUTO-FILL WEEK FROM SUMMARY
// =============================================================================

import { buildDaySpecificFillPrompt } from './prompts';
import { validateWeekFillDaySpecificResult, type WeekFillDaySpecificResult } from './schemas';

interface AutoFillContext {
  programId: string;
  instanceId: string;
  weekIndex: number;
  autoFillTarget: 'current' | 'next' | 'until_call';
  cohortId?: string;
  enrollment?: ProgramEnrollment;
}

interface WeekFillPlan {
  weekIndex: number;
  weekNumber: number;
  daysToFill: number[];  // 1-7 within this week
}

interface FillConfig {
  weeks: WeekFillPlan[];
  totalDays: number;
  skipWeekends: boolean;
}

/**
 * Calculate which weeks and days to fill based on the target option
 * Supports multi-week fills for "until next call" and "next week"
 */
async function calculateFillConfig(
  target: 'current' | 'next' | 'until_call',
  programId: string,
  instanceId: string,
  currentWeekIndex: number,
  cohortId?: string,
  enrollment?: ProgramEnrollment,
  skipWeekends?: boolean
): Promise<FillConfig> {
  const startDate = enrollment?.startedAt ? new Date(enrollment.startedAt) : new Date();
  const today = new Date();

  // Get instance for week data
  const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();
  const instance = instanceDoc.data() as ProgramInstance | undefined;
  const totalWeeks = instance?.weeks?.length || 1;

  // Calculate today's position
  const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysPerWeek = skipWeekends ? 5 : 7;

  // Find which week "today" falls in
  let todayWeekIndex = currentWeekIndex;
  let todayDayInWeek = 1;

  if (instance?.weeks) {
    for (let i = 0; i < instance.weeks.length; i++) {
      const week = instance.weeks[i];
      const weekStart = week.startDayIndex || (i * 7 + 1);
      const weekEnd = week.endDayIndex || ((i + 1) * 7);
      if (daysSinceStart >= weekStart - 1 && daysSinceStart < weekEnd) {
        todayWeekIndex = i;
        todayDayInWeek = Math.max(1, Math.min(7, daysSinceStart - weekStart + 2));
        break;
      }
    }
  }

  const weeks: WeekFillPlan[] = [];

  if (target === 'current') {
    // Fill remaining days of current week only
    const currentWeek = instance?.weeks?.[todayWeekIndex];
    const maxDay = skipWeekends ? 5 : 7;
    const daysToFill: number[] = [];
    for (let d = todayDayInWeek; d <= maxDay; d++) {
      if (!skipWeekends || d <= 5) {
        daysToFill.push(d);
      }
    }
    if (daysToFill.length > 0) {
      weeks.push({
        weekIndex: todayWeekIndex,
        weekNumber: currentWeek?.weekNumber || todayWeekIndex + 1,
        daysToFill,
      });
    }
  } else if (target === 'next') {
    // Fill all days of next week only
    const nextWeekIndex = todayWeekIndex + 1;
    if (nextWeekIndex < totalWeeks) {
      const nextWeek = instance?.weeks?.[nextWeekIndex];
      weeks.push({
        weekIndex: nextWeekIndex,
        weekNumber: nextWeek?.weekNumber || nextWeekIndex + 1,
        daysToFill: skipWeekends ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7],
      });
    }
  } else {
    // Until next call - may span multiple weeks
    const nextCallDate = await getNextCallDate(programId, cohortId);
    let daysUntilCall = 7; // Default to 7 days if no call found

    if (nextCallDate) {
      daysUntilCall = Math.ceil((nextCallDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Fill from today until the call (or 7 days if no call)
    let remainingDays = daysUntilCall;
    let weekIdx = todayWeekIndex;
    let dayInWeek = todayDayInWeek;

    while (remainingDays > 0 && weekIdx < totalWeeks) {
      const week = instance?.weeks?.[weekIdx];
      const maxDay = skipWeekends ? 5 : 7;
      const daysToFill: number[] = [];

      // For first week, start from today; for subsequent weeks, start from day 1
      const startDay = weekIdx === todayWeekIndex ? dayInWeek : 1;

      for (let d = startDay; d <= maxDay && remainingDays > 0; d++) {
        if (!skipWeekends || d <= 5) {
          daysToFill.push(d);
          remainingDays--;
        }
      }

      if (daysToFill.length > 0) {
        weeks.push({
          weekIndex: weekIdx,
          weekNumber: week?.weekNumber || weekIdx + 1,
          daysToFill,
        });
      }

      weekIdx++;
      dayInWeek = 1; // Next week starts from day 1
    }
  }

  // Ensure at least one day
  if (weeks.length === 0) {
    const currentWeek = instance?.weeks?.[todayWeekIndex];
    weeks.push({
      weekIndex: todayWeekIndex,
      weekNumber: currentWeek?.weekNumber || todayWeekIndex + 1,
      daysToFill: [todayDayInWeek],
    });
  }

  const totalDays = weeks.reduce((sum, w) => sum + w.daysToFill.length, 0);

  return { weeks, totalDays, skipWeekends: skipWeekends || false };
}

/**
 * Get the next scheduled call date for a program/cohort
 */
async function getNextCallDate(programId: string, cohortId?: string): Promise<Date | null> {
  try {
    const now = new Date();
    let query = adminDb
      .collection('events')
      .where('programId', '==', programId)
      .where('startDateTime', '>', now.toISOString())
      .where('status', '==', 'confirmed')
      .orderBy('startDateTime', 'asc')
      .limit(1) as FirebaseFirestore.Query;

    if (cohortId) {
      query = adminDb
        .collection('events')
        .where('programId', '==', programId)
        .where('cohortId', '==', cohortId)
        .where('startDateTime', '>', now.toISOString())
        .where('status', '==', 'confirmed')
        .orderBy('startDateTime', 'asc')
        .limit(1);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      return null;
    }

    const eventData = snapshot.docs[0].data();
    return new Date(eventData.startDateTime);
  } catch (error) {
    console.error('[Auto-Fill] Error getting next call date:', error);
    return null;
  }
}

/**
 * Build source content from summary data for the prompt
 */
function buildSourceContent(summaryData: CallSummary): string {
  const parts: string[] = [];

  if (summaryData.summary.executive) {
    parts.push(`Executive Summary: ${summaryData.summary.executive}`);
  }

  if (summaryData.summary.keyDiscussionPoints?.length) {
    parts.push(`\nKey Discussion Points:\n${summaryData.summary.keyDiscussionPoints.map(p => `- ${p}`).join('\n')}`);
  }

  if (summaryData.summary.clientProgress) {
    parts.push(`\nClient Progress: ${summaryData.summary.clientProgress}`);
  }

  if (summaryData.summary.challenges?.length) {
    parts.push(`\nChallenges:\n${summaryData.summary.challenges.map(c => `- ${c}`).join('\n')}`);
  }

  if (summaryData.summary.breakthroughs?.length) {
    parts.push(`\nBreakthroughs:\n${summaryData.summary.breakthroughs.map(b => `- ${b}`).join('\n')}`);
  }

  if (summaryData.summary.coachingNotes) {
    parts.push(`\nCoaching Notes: ${summaryData.summary.coachingNotes}`);
  }

  return parts.join('\n');
}

/**
 * Generate a unique ID for tasks
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Auto-fill weeks from call summary
 * Called after a summary is generated with autoFillWeek enabled
 * Supports multi-week fills for "until next call"
 */
export async function autoFillWeekFromSummary(
  orgId: string,
  summaryId: string,
  context: AutoFillContext
): Promise<{ success: boolean; error?: string; daysUpdated?: number; weeksUpdated?: number; notesApplied?: boolean; weeksWithNotes?: number[] }> {
  try {
    console.log(`[Auto-Fill] Starting auto-fill for summary ${summaryId}, instance ${context.instanceId}, target: ${context.autoFillTarget}`);

    // 1. Get program settings
    const programDoc = await adminDb.collection('programs').doc(context.programId).get();
    const program = programDoc.data() as Program | undefined;
    const skipWeekends = program?.includeWeekends === false;

    // 2. Get instance
    const instanceDoc = await adminDb.collection('program_instances').doc(context.instanceId).get();
    const instance = instanceDoc.data() as ProgramInstance | undefined;
    if (!instance) {
      return { success: false, error: 'Instance not found' };
    }

    // 3. Get summary with action items
    const summaryDoc = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('call_summaries')
      .doc(summaryId)
      .get();
    const summaryData = summaryDoc.data() as CallSummary | undefined;
    if (!summaryData) {
      return { success: false, error: 'Summary not found' };
    }

    // 4. Calculate which weeks and days to fill (supports multi-week)
    const fillConfig = await calculateFillConfig(
      context.autoFillTarget,
      context.programId,
      context.instanceId,
      context.weekIndex,
      context.cohortId,
      context.enrollment,
      skipWeekends
    );

    console.log(`[Auto-Fill] Fill config: ${fillConfig.weeks.length} weeks, ${fillConfig.totalDays} total days`);
    fillConfig.weeks.forEach(w => {
      console.log(`[Auto-Fill]   Week ${w.weekNumber} (index ${w.weekIndex}): days ${w.daysToFill.join(', ')}`);
    });

    // 5. Check if there are action items to convert
    if (!summaryData.actionItems?.length) {
      console.log('[Auto-Fill] No action items in summary - skipping task generation');
      // Still apply weekContent if available
      if (summaryData.weekContent) {
        // Apply weekContent to current week only
        const weeks = [...(instance.weeks || [])];
        if (weeks[context.weekIndex]) {
          if (summaryData.weekContent.notes?.length) {
            weeks[context.weekIndex].notes = summaryData.weekContent.notes;
          }
          // Use goals if available, fall back to currentFocus for backwards compat
          const goalsOrFocus = summaryData.weekContent.goals || summaryData.weekContent.currentFocus;
          if (goalsOrFocus?.length) {
            weeks[context.weekIndex].currentFocus = goalsOrFocus;
          }
          if (summaryData.weekContent.theme) {
            weeks[context.weekIndex].theme = summaryData.weekContent.theme;
          }
          if (summaryData.weekContent.description) {
            weeks[context.weekIndex].description = summaryData.weekContent.description;
          }
          await adminDb.collection('program_instances').doc(context.instanceId).update({
            weeks,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return { success: true, daysUpdated: 0, weeksUpdated: 0, notesApplied: true, weeksWithNotes: [context.weekIndex + 1] };
        }
      }
      return { success: false, error: 'No action items in summary to convert to tasks' };
    }

    // 6. Distribute action items to days using deterministic logic (no AI call needed)
    // The action items already have frequency/targetDayName from summary generation
    // Falls back to pattern matching on description if frequency field is missing
    const result = distributeActionItemsToDays(
      summaryData.actionItems,
      fillConfig.weeks,
      fillConfig.skipWeekends,
      summaryData.weekContent
    );

    console.log(`[Auto-Fill] Deterministic distribution completed for ${summaryData.actionItems.length} action items`);

    // --- AI-BASED FILL (COMMENTED OUT FOR FUTURE USE) ---
    // If deterministic logic isn't sufficient, uncomment this block to use AI for task distribution.
    // Cost: ~$0.01-0.02 per call (Claude Sonnet)
    /*
    const sourceContent = buildSourceContent(summaryData);

    const allDaysToFill: string[] = [];
    for (const weekPlan of fillConfig.weeks) {
      for (const day of weekPlan.daysToFill) {
        allDaysToFill.push(`W${weekPlan.weekNumber}D${day}`);
      }
    }

    const { system, user } = buildMultiWeekFillPrompt(
      {
        content: sourceContent,
        actionItems: summaryData.actionItems,
      },
      {
        programName: program?.name,
        weekPlans: fillConfig.weeks,
        skipWeekends: fillConfig.skipWeekends,
        allDaysToFill,
      }
    );

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return { success: false, error: 'No text response from AI' };
    }

    let result: MultiWeekFillResult;
    try {
      let jsonStr = textContent.text;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      result = JSON.parse(jsonStr) as MultiWeekFillResult;
    } catch (parseError) {
      console.error('[Auto-Fill] Failed to parse response:', textContent.text);
      return { success: false, error: 'Failed to parse AI response' };
    }
    */
    // --- END AI-BASED FILL ---

    // 10. Apply to instance - update each week
    const weeks = [...(instance.weeks || [])];
    let totalDaysUpdated = 0;
    let weeksUpdated = 0;

    for (const weekPlan of fillConfig.weeks) {
      const weekKey = `week_${weekPlan.weekNumber}`;
      const weekData = result.weeks?.[weekKey];

      if (!weekData || !weeks[weekPlan.weekIndex]) {
        continue;
      }

      const week = { ...weeks[weekPlan.weekIndex] };
      const days = [...(week.days || [])];

      // Update each day in this week
      for (const [dayIndexStr, dayData] of Object.entries(weekData.days || {})) {
        const targetDayIndex = parseInt(dayIndexStr, 10); // 1-7 (day of week)

        // Find the day by its dayIndex property (1-7), not array position
        const dayArrayIndex = days.findIndex(d => d.dayIndex === targetDayIndex);

        if (dayArrayIndex !== -1 && days[dayArrayIndex]) {
          const rawTasks = dayData.tasks || [];

          // Only process if there are actual tasks to add
          if (rawTasks.length === 0) {
            console.log(`[Auto-Fill] Skipping week ${weekPlan.weekNumber} day ${targetDayIndex} - no tasks generated`);
            continue;
          }

          const newTasks = rawTasks.map((t: { label: string; type?: string; isPrimary?: boolean; estimatedMinutes?: number; notes?: string }) => ({
            id: generateTaskId(),
            label: t.label,
            type: (t.type === 'learning' || t.type === 'admin' || t.type === 'habit' ? t.type : 'task') as 'task' | 'habit' | 'learning' | 'admin',
            isPrimary: t.isPrimary || false,
            estimatedMinutes: t.estimatedMinutes,
            notes: t.notes,
          }));

          // APPEND new tasks to existing ones instead of replacing
          const existingTasks = days[dayArrayIndex].tasks || [];
          days[dayArrayIndex] = {
            ...days[dayArrayIndex],
            tasks: [...existingTasks, ...newTasks],
          };
          totalDaysUpdated++;
          console.log(`[Auto-Fill] Added ${newTasks.length} tasks to week ${weekPlan.weekNumber} day ${targetDayIndex} (now ${existingTasks.length + newTasks.length} total)`);
        }
      }

      week.days = days;
      if (weekData.theme) week.theme = weekData.theme;
      if (weekData.description) week.description = weekData.description;
      // Use goals if available, fall back to currentFocus for backwards compat
      const goalsOrFocus = weekData.goals || weekData.currentFocus;
      if (goalsOrFocus) week.currentFocus = goalsOrFocus;
      week.fillSource = {
        type: 'call_summary',
        sourceId: summaryId,
        generatedAt: new Date().toISOString(),
      };

      weeks[weekPlan.weekIndex] = week;
      weeksUpdated++;
    }

    // 11. Apply pre-generated weekContent (notes, currentFocus, theme, description)
    // Logic: If call was on Thu-Sun, apply to BOTH current and next week; otherwise just current
    let weeksWithNotes: number[] = [];
    if (summaryData.weekContent) {
      const callDate = summaryData.callStartedAt
        ? new Date(summaryData.callStartedAt)
        : new Date();
      const dayOfWeek = callDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const isThursdayOrAfter = dayOfWeek === 0 || dayOfWeek >= 4; // Thu=4, Fri=5, Sat=6, Sun=0

      // Determine which week indices to apply notes to
      const currentWeekIndex = context.weekIndex;
      const weeksToApplyNotes = isThursdayOrAfter && currentWeekIndex !== undefined
        ? [currentWeekIndex, currentWeekIndex + 1]
        : currentWeekIndex !== undefined
          ? [currentWeekIndex]
          : [];

      for (const weekIdx of weeksToApplyNotes) {
        if (weeks[weekIdx]) {
          if (summaryData.weekContent.notes?.length) {
            weeks[weekIdx].notes = summaryData.weekContent.notes;
          }
          // Use goals if available, fall back to currentFocus for backwards compat
          const goalsOrFocus = summaryData.weekContent.goals || summaryData.weekContent.currentFocus;
          if (goalsOrFocus?.length) {
            weeks[weekIdx].currentFocus = goalsOrFocus;
          }
          if (summaryData.weekContent.theme) {
            weeks[weekIdx].theme = summaryData.weekContent.theme;
          }
          if (summaryData.weekContent.description) {
            weeks[weekIdx].description = summaryData.weekContent.description;
          }
          weeksWithNotes.push(weekIdx + 1); // 1-indexed for display
          console.log(`[Auto-Fill] Applied weekContent to week ${weekIdx + 1}`);
        }
      }
    }

    await adminDb.collection('program_instances').doc(context.instanceId).update({
      weeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[Auto-Fill] Filled ${totalDaysUpdated} days across ${weeksUpdated} weeks from summary ${summaryId}`);

    return {
      success: true,
      daysUpdated: totalDaysUpdated,
      weeksUpdated,
      notesApplied: weeksWithNotes.length > 0,
      weeksWithNotes,
    };
  } catch (error) {
    console.error('[Auto-Fill] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Multi-week fill result type
interface MultiWeekFillResult {
  weeks: {
    [weekKey: string]: {
      days: {
        [dayIndex: string]: {
          tasks: Array<{
            label: string;
            type?: string;
            isPrimary?: boolean;
            estimatedMinutes?: number;
            notes?: string;
          }>;
        };
      };
      theme?: string;
      description?: string;
      goals?: string[];
      currentFocus?: string[];  // Legacy, prefer goals
    };
  };
}

// Day name to index mapping (Monday = 1, Sunday = 7)
const DAY_NAME_TO_INDEX: Record<string, number> = {
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
  sunday: 7, sun: 7,
};

// Patterns that indicate daily frequency
const DAILY_PATTERNS = [
  /every\s*day/i,
  /everyday/i,
  /each\s*day/i,
  /daily/i,
  /every\s*morning/i,
  /every\s*night/i,
  /every\s*evening/i,
  /each\s*morning/i,
  /nightly/i,
  /morning\s*routine/i,
  /evening\s*routine/i,
];

// Patterns that indicate a specific day (captures day name)
const SPECIFIC_DAY_PATTERNS = [
  /\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /\bbefore\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*morning/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*evening/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*night/i,
  /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
];

/**
 * Infer frequency from action item description as fallback
 */
function inferFrequencyFromDescription(description: string): {
  frequency: 'daily' | 'once' | 'specific_day';
  targetDayName?: string;
} {
  const text = description.toLowerCase();

  // Check for daily patterns
  for (const pattern of DAILY_PATTERNS) {
    if (pattern.test(text)) {
      return { frequency: 'daily' };
    }
  }

  // Check for specific day patterns
  for (const pattern of SPECIFIC_DAY_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const dayName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      return { frequency: 'specific_day', targetDayName: dayName };
    }
  }

  // Default to 'once'
  return { frequency: 'once' };
}

/**
 * Get day index (1-7) from day name
 */
function getDayIndexFromName(dayName: string): number | null {
  const normalized = dayName.toLowerCase().trim();
  return DAY_NAME_TO_INDEX[normalized] ?? null;
}

/**
 * Distribute action items to days deterministically (no AI call)
 * Uses structured frequency field from summary generation, with fallback pattern matching
 */
function distributeActionItemsToDays(
  actionItems: CallSummaryActionItem[],
  weekPlans: WeekFillPlan[],
  skipWeekends: boolean,
  weekContent?: CallSummary['weekContent']
): MultiWeekFillResult {
  const result: MultiWeekFillResult = { weeks: {} };

  // Initialize week structure
  for (const weekPlan of weekPlans) {
    const weekKey = `week_${weekPlan.weekNumber}`;
    result.weeks[weekKey] = {
      days: {},
      // Apply weekContent to first week only
      ...(weekPlan.weekIndex === 0 && weekContent ? {
        theme: weekContent.theme,
        description: weekContent.description,
        goals: weekContent.goals || weekContent.currentFocus,
      } : {}),
    };

    // Initialize each day that can be filled
    for (const dayIdx of weekPlan.daysToFill) {
      result.weeks[weekKey].days[String(dayIdx)] = { tasks: [] };
    }
  }

  // Build a flat list of all (weekKey, dayIndex) pairs for distributing 'once' tasks
  const allDaySlots: Array<{ weekKey: string; dayIndex: number }> = [];
  for (const weekPlan of weekPlans) {
    const weekKey = `week_${weekPlan.weekNumber}`;
    for (const dayIdx of weekPlan.daysToFill) {
      // Skip weekends if needed
      if (skipWeekends && (dayIdx === 6 || dayIdx === 7)) continue;
      allDaySlots.push({ weekKey, dayIndex: dayIdx });
    }
  }

  // Track which slot to use for 'once' tasks (round-robin distribution)
  let onceTaskSlotIndex = 0;

  // Filter to only client-assigned tasks
  const clientTasks = actionItems.filter(
    item => item.assignedTo === 'client' || item.assignedTo === 'both'
  );

  for (const actionItem of clientTasks) {
    // Determine frequency - use structured field, fallback to pattern matching
    let frequency = actionItem.frequency;
    let targetDayName = actionItem.targetDayName;

    if (!frequency) {
      const inferred = inferFrequencyFromDescription(actionItem.description);
      frequency = inferred.frequency;
      if (inferred.targetDayName) {
        targetDayName = inferred.targetDayName;
      }
      console.log(`[Auto-Fill] Inferred frequency for "${actionItem.description.slice(0, 50)}...": ${frequency}${targetDayName ? ` (${targetDayName})` : ''}`);
    }

    // Create task object
    const task = {
      label: actionItem.description,
      type: 'task' as const,
      isPrimary: actionItem.priority === 'high',
    };

    // Distribute based on frequency
    if (frequency === 'daily') {
      // Add to ALL days across ALL weeks
      for (const slot of allDaySlots) {
        result.weeks[slot.weekKey].days[String(slot.dayIndex)].tasks.push({ ...task });
      }
      console.log(`[Auto-Fill] Daily task added to ${allDaySlots.length} days: "${task.label.slice(0, 40)}..."`);
    } else if (frequency === 'specific_day' && targetDayName) {
      // Add to specific day(s) matching the name
      const targetDayIndex = getDayIndexFromName(targetDayName);
      if (targetDayIndex) {
        let placed = false;
        for (const weekPlan of weekPlans) {
          const weekKey = `week_${weekPlan.weekNumber}`;
          if (weekPlan.daysToFill.includes(targetDayIndex)) {
            result.weeks[weekKey].days[String(targetDayIndex)].tasks.push({ ...task });
            placed = true;
            console.log(`[Auto-Fill] Specific day task placed on ${targetDayName} (day ${targetDayIndex}) in week ${weekPlan.weekNumber}: "${task.label.slice(0, 40)}..."`);
          }
        }
        // If target day not in fill range, place on nearest available day
        if (!placed && allDaySlots.length > 0) {
          const nearestSlot = allDaySlots.reduce((nearest, slot) => {
            const nearestDiff = Math.abs(nearest.dayIndex - targetDayIndex);
            const slotDiff = Math.abs(slot.dayIndex - targetDayIndex);
            return slotDiff < nearestDiff ? slot : nearest;
          });
          result.weeks[nearestSlot.weekKey].days[String(nearestSlot.dayIndex)].tasks.push({ ...task });
          console.log(`[Auto-Fill] Target day ${targetDayName} not available, placed on day ${nearestSlot.dayIndex}: "${task.label.slice(0, 40)}..."`);
        }
      } else {
        // Unknown day name, treat as 'once'
        if (allDaySlots.length > 0) {
          const slot = allDaySlots[onceTaskSlotIndex % allDaySlots.length];
          result.weeks[slot.weekKey].days[String(slot.dayIndex)].tasks.push({ ...task });
          onceTaskSlotIndex++;
          console.log(`[Auto-Fill] Unknown day "${targetDayName}", treated as once task on day ${slot.dayIndex}: "${task.label.slice(0, 40)}..."`);
        }
      }
    } else {
      // 'once' - place on single day, round-robin distribution
      if (allDaySlots.length > 0) {
        const slot = allDaySlots[onceTaskSlotIndex % allDaySlots.length];
        result.weeks[slot.weekKey].days[String(slot.dayIndex)].tasks.push({ ...task });
        onceTaskSlotIndex++;
        console.log(`[Auto-Fill] Once task placed on week ${slot.weekKey} day ${slot.dayIndex}: "${task.label.slice(0, 40)}..."`);
      }
    }
  }

  return result;
}

/**
 * Build prompt for multi-week fill
 */
function buildMultiWeekFillPrompt(
  source: { content: string; actionItems?: CallSummaryActionItem[] },
  context: {
    programName?: string;
    weekPlans: WeekFillPlan[];
    skipWeekends: boolean;
    allDaysToFill: string[];
  }
): { system: string; user: string } {
  const weekendNote = context.skipWeekends ? 'This program is weekdays only (Mon-Fri).' : '';

  // Format action items with frequency hints
  const actionItemsHint = source.actionItems?.length
    ? `\nACTION ITEMS FROM CALL (with frequency hints):\n${source.actionItems.map(item =>
        `- ${item.description} [${item.frequency || 'once'}${item.targetDayName ? `, target: ${item.targetDayName}` : ''}] (${item.priority} priority, assigned to: ${item.assignedTo})`
      ).join('\n')}`
    : '';

  // Build week structure info
  const weekStructure = context.weekPlans.map(w =>
    `Week ${w.weekNumber}: fill days ${w.daysToFill.join(', ')}`
  ).join('\n');

  const system = `You are a coaching assistant creating a multi-week plan from call insights.

Your job is to create tasks for specific days across multiple weeks based on frequency hints from the call summary.

CRITICAL RULES:
1. Output ONLY valid JSON matching the exact schema provided.
2. "daily" tasks → add to ALL days across ALL weeks being filled
3. "once" tasks → place on ONE day only (spread across weeks if multiple "once" tasks)
4. "specific_day" tasks → place on the correct day name (e.g., "Friday" goes on day 5)
5. Keep task labels concise but actionable (under 100 characters)
6. 1-4 tasks per day is ideal, max 8 per day

TASK TYPES:
- "task": General action item (default)
- "habit": Behavior to practice regularly
- "learning": Learning or reflection exercise
- "admin": Administrative task

OUTPUT SCHEMA:
{
  "weeks": {
    "week_1": {
      "days": {
        "3": { "tasks": [...] },
        "4": { "tasks": [...] },
        "5": { "tasks": [...] }
      },
      "theme": "Inspiring theme for the week",
      "description": "What the client should focus on this week (forward-looking, not a recap)",
      "goals": ["Goal 1 for the week", "Goal 2"]
    },
    "week_2": {
      "days": {
        "1": { "tasks": [...] },
        "2": { "tasks": [...] }
      }
    }
  }
}

TASK FORMAT:
{ "label": string, "type": "task"|"habit"|"learning"|"admin", "isPrimary": boolean, "estimatedMinutes": number?, "notes": string? }`;

  const user = `Generate tasks for multiple weeks from the following call summary.

PROGRAM CONTEXT:
${context.programName ? `Program: "${context.programName}"` : ''}
${weekendNote}

WEEKS TO FILL:
${weekStructure}

Day index mapping: Day 1 = Monday, Day 2 = Tuesday, Day 3 = Wednesday, Day 4 = Thursday, Day 5 = Friday${!context.skipWeekends ? ', Day 6 = Saturday, Day 7 = Sunday' : ''}
${actionItemsHint}

CALL SUMMARY CONTENT:
${source.content}

PLACEMENT INSTRUCTIONS:
- For "daily" frequency tasks: add to EVERY day listed above (across all weeks)
- For "once" frequency tasks: place on one day, spread across weeks if multiple
- For "specific_day" tasks with targetDayName: place on that day in the appropriate week
- Client-assigned tasks should become actual tasks; coach tasks are optional notes

Remember: Output ONLY the JSON object. No explanations, no markdown formatting.`;

  return { system, user };
}
