import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import Anthropic from '@anthropic-ai/sdk';
import type { UserTrack } from '@/types';

// Rate limiting: Max 10 AI calls per user per day
const DAILY_LIMIT = 10;

// Initialize Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// =============================================================================
// TYPES
// =============================================================================

type AIAction = 'suggest_tasks_for_today' | 'help_complete_task' | 'track_specific_help';

interface AIRequestPayload {
  action: AIAction;
  track: UserTrack;
  dailyTasks: { id: string; title: string }[];
  backlogTasks: { id: string; title: string }[];
  starterProgramContext: {
    id: string | null;
    name: string | null;
    dayNumber: number | null;
  };
  selectedTaskId?: string | null;
}

interface SuggestTasksResponse {
  suggestedTasks: { title: string }[];
  notes: string;
}

interface HelpCompleteTaskResponse {
  breakdown: string[];
  suggestedTaskTitle?: string;
}

interface TrackSpecificHelpResponse {
  suggestedTask: { title: string };
  reason: string;
}

// =============================================================================
// TRACK LABELS MAPPING
// =============================================================================

const TRACK_LABELS: Record<UserTrack, string> = {
  content_creator: 'Content Creator',
  saas: 'SaaS Builder',
  agency: 'Agency Builder',
  ecom: 'E-commerce Founder',
  coach_consultant: 'Coach/Consultant',
  community_builder: 'Community Builder',
  general: 'Entrepreneur',
};

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

const BASE_SYSTEM_PROMPT = `You are a focused productivity assistant for entrepreneurs using Growth Addicts, a daily accountability app. 

You ONLY respond with valid JSON following the exact schema provided. No markdown, no explanations, just clean JSON.

Key principles:
- Tasks must be concrete and doable in 30-60 minutes
- Use simple, direct language
- Focus on high-impact actions
- Be track-specific when relevant
- Never suggest more than 3 tasks total in Daily Focus`;

function buildSuggestTasksPrompt(
  track: UserTrack,
  currentTaskCount: number,
  existingTasks: string[],
  programContext: { name: string | null; dayNumber: number | null },
  completedTaskHistory: string[] = []
): string {
  const trackLabel = TRACK_LABELS[track];
  const slotsAvailable = 3 - currentTaskCount;
  
  // Build task history context if available
  const historyContext = completedTaskHistory.length > 0
    ? `\nTasks they've completed recently: ${completedTaskHistory.slice(0, 10).join(', ')}\n\nUse their past completed tasks as context for what kind of work they do and suggest similar or related tasks.`
    : '';
  
  return `${BASE_SYSTEM_PROMPT}

You are helping a ${trackLabel}.
${programContext.name ? `They are on Day ${programContext.dayNumber} of the "${programContext.name}" program.` : ''}

Their current Daily Focus tasks: ${existingTasks.length > 0 ? existingTasks.join(', ') : 'None yet'}
${historyContext}

Suggest ${slotsAvailable} task(s) for today. Tasks should be:
- Specific and actionable (not vague like "work on business")
- Completable in 30-60 minutes each
- Relevant to a ${trackLabel}'s daily priorities
- Different from their existing tasks
- Informed by their past work patterns if history is available
${programContext.name ? '- Aligned with their starter program focus' : ''}

Return ONLY this JSON:
{
  "suggestedTasks": [
    { "title": "Exact task title here" }
  ],
  "notes": "One sentence explaining why these tasks matter today"
}`;
}

function buildHelpCompleteTaskPrompt(
  track: UserTrack,
  taskTitle: string,
  programContext: { name: string | null; dayNumber: number | null }
): string {
  const trackLabel = TRACK_LABELS[track];
  
  return `${BASE_SYSTEM_PROMPT}

You are helping a ${trackLabel} complete this task: "${taskTitle}"
${programContext.name ? `They are on Day ${programContext.dayNumber} of the "${programContext.name}" program.` : ''}

Create a 10-20 minute micro-plan with 2-4 concrete steps. Each step should be:
- Very specific (not vague like "think about it")
- Doable in 3-5 minutes
- Building toward completing the task

Optionally suggest a clearer/more specific task title if the original is vague.

Return ONLY this JSON:
{
  "breakdown": [
    "Step 1: Specific action (X minutes)",
    "Step 2: Specific action (X minutes)"
  ],
  "suggestedTaskTitle": "Optional: A clearer version of the task title, or null if original is good"
}`;
}

function buildTrackSpecificHelpPrompt(
  track: UserTrack,
  currentTasks: string[],
  programContext: { name: string | null; dayNumber: number | null }
): string {
  const trackLabel = TRACK_LABELS[track];
  
  return `${BASE_SYSTEM_PROMPT}

You are helping a ${trackLabel} with one high-leverage thing to do right now.
${programContext.name ? `They are on Day ${programContext.dayNumber} of the "${programContext.name}" program.` : ''}

Their current tasks: ${currentTasks.length > 0 ? currentTasks.join(', ') : 'None yet'}

Suggest ONE very concrete, high-impact action for a ${trackLabel} to do today. It should:
- Be specific and immediately actionable
- Take 30-60 minutes max
- Be different from their existing tasks
- Match what a ${trackLabel} should prioritize

Explain why this action matters in one sentence.

Return ONLY this JSON:
{
  "suggestedTask": {
    "title": "Exact task title here"
  },
  "reason": "One sentence explaining why this is valuable for a ${trackLabel}"
}`;
}

// =============================================================================
// TASK HISTORY
// =============================================================================

/**
 * Fetch user's completed tasks from the last 30 days for the given track.
 * This provides context for AI suggestions based on what the user has been working on.
 * Only fetches tasks that were completed while on this track.
 */
async function getCompletedTaskHistory(
  userId: string,
  _track: UserTrack
): Promise<string[]> {
  try {
    // Calculate 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    // Fetch completed tasks from the last 30 days
    // We filter by date range and completion status
    const snapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('status', '==', 'completed')
      .where('date', '>=', thirtyDaysAgoStr)
      .orderBy('date', 'desc')
      .limit(50) // Fetch more than we need, will dedupe and limit
      .get();
    
    if (snapshot.empty) return [];
    
    // Extract unique task titles (some tasks may repeat daily)
    const uniqueTitles = new Set<string>();
    const titles: string[] = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const title = data.title as string;
      
      // Skip if we've already seen this task title
      if (uniqueTitles.has(title.toLowerCase())) continue;
      uniqueTitles.add(title.toLowerCase());
      
      titles.push(title);
      
      // Stop after 10 unique titles
      if (titles.length >= 10) break;
    }
    
    return titles;
  } catch (error) {
    console.error('[AI_SUPPORT] Error fetching task history:', error);
    return [];
  }
}

// =============================================================================
// RATE LIMITING
// =============================================================================

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().split('T')[0];
  const rateLimitRef = adminDb.collection('ai_rate_limits').doc(`${userId}_${today}`);
  
  const doc = await rateLimitRef.get();
  
  if (!doc.exists) {
    // First call today
    await rateLimitRef.set({
      userId,
      date: today,
      count: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }
  
  const data = doc.data()!;
  const currentCount = data.count || 0;
  
  if (currentCount >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  // Increment count
  await rateLimitRef.update({
    count: currentCount + 1,
    updatedAt: new Date().toISOString(),
  });
  
  return { allowed: true, remaining: DAILY_LIMIT - currentCount - 1 };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(req: Request) {
  try {
    // Auth check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request
    const payload: AIRequestPayload = await req.json();
    const { action, track, dailyTasks, backlogTasks, starterProgramContext, selectedTaskId } = payload;
    
    // Validate action
    if (!['suggest_tasks_for_today', 'help_complete_task', 'track_specific_help'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    // Rate limit check
    const rateLimit = await checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Daily AI limit reached. Try again tomorrow.', rateLimitExceeded: true },
        { status: 429 }
      );
    }
    
    // Build prompt based on action
    let prompt: string;
    const existingTaskTitles = dailyTasks.map(t => t.title);
    const allTaskTitles = [...existingTaskTitles, ...backlogTasks.map(t => t.title)];
    
    switch (action) {
      case 'suggest_tasks_for_today':
        // Fetch completed task history for smarter suggestions
        const completedTaskHistory = await getCompletedTaskHistory(userId, track || 'general');
        
        prompt = buildSuggestTasksPrompt(
          track || 'general',
          dailyTasks.length,
          existingTaskTitles,
          starterProgramContext,
          completedTaskHistory
        );
        break;
        
      case 'help_complete_task':
        const selectedTask = dailyTasks.find(t => t.id === selectedTaskId);
        if (!selectedTask) {
          return NextResponse.json({ error: 'Selected task not found' }, { status: 400 });
        }
        prompt = buildHelpCompleteTaskPrompt(
          track || 'general',
          selectedTask.title,
          starterProgramContext
        );
        break;
        
      case 'track_specific_help':
        prompt = buildTrackSpecificHelpPrompt(
          track || 'general',
          allTaskTitles,
          starterProgramContext
        );
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    // Call Claude
    console.log(`[AI Support] Calling Claude for action: ${action}`);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });
    
    const content = message.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected AI response format' }, { status: 500 });
    }
    
    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[AI Support] Failed to parse JSON from:', content.text);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }
    
    let responseData: SuggestTasksResponse | HelpCompleteTaskResponse | TrackSpecificHelpResponse;
    try {
      responseData = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('[AI Support] JSON parse error:', jsonMatch[0]);
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 });
    }
    
    console.log(`[AI Support] Success for action: ${action}`, responseData);
    
    return NextResponse.json({
      success: true,
      action,
      data: responseData,
      remaining: rateLimit.remaining,
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Support] Error:', errorMessage);
    return NextResponse.json(
      { error: 'AI service temporarily unavailable. Please try again later.' },
      { status: 500 }
    );
  }
}

