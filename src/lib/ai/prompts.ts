/**
 * AI Generation Prompts
 * 
 * System and user prompt templates for each use case.
 * These are server-side only and should never be exposed to clients.
 */

import type { AIGenerationContext, ProgramStructure } from './types';

// =============================================================================
// PROGRAM CONTENT GENERATION
// =============================================================================

const PROGRAM_CONTENT_SYSTEM_PROMPT = `You are an expert coach-program builder and curriculum designer.

Your job is to create structured, actionable program content that transforms participants over time.

CRITICAL RULES:
1. Output ONLY valid JSON matching the exact schema provided. No markdown, no explanations.
2. Each day/week MUST have 3-6 tasks maximum.
3. Each day/week can have 0-3 suggested habits.
4. Tasks should be specific, actionable, and achievable in the estimated time.
5. Mix "action" tasks (do something concrete) with "reflection" tasks (journaling, planning).
6. NEVER include medical, clinical, or dangerous advice.
7. Avoid generic filler - every task should provide real value.
8. Build progressively - earlier days/weeks should lay foundations for later ones.

TASK TYPES:
- "action": Concrete doing tasks (write, create, reach out, practice, etc.)
- "reflection": Thinking/journaling tasks (reflect, plan, assess, journal about, etc.)

HABIT FREQUENCIES:
- "daily": Every day (e.g., morning routine, journaling)
- "3x_week": Three times per week (e.g., exercise, content creation)
- "weekly": Once per week (e.g., weekly review, batch cooking)

OUTPUT SCHEMA:
{
  "structure": "days" | "weeks",
  "duration": number,
  "daysOrWeeks": [
    {
      "index": number,
      "title": string,
      "focus": string,
      "tasks": [
        { "title": string, "description": string?, "type": "action"|"reflection", "estimatedMinutes": number? }
      ],
      "defaultHabits": [
        { "title": string, "frequency": "daily"|"3x_week"|"weekly", "notes": string? }
      ]
    }
  ],
  "globalDefaultHabits": [
    { "title": string, "frequency": "daily"|"3x_week"|"weekly", "notes": string? }
  ]
}`;

export function buildProgramContentPrompt(
  userPrompt: string,
  context?: AIGenerationContext
): { system: string; user: string } {
  const structure: ProgramStructure = context?.structure || 'days';
  const duration = context?.duration || 30;
  
  const contextParts: string[] = [];
  
  if (context?.programName) {
    contextParts.push(`Program Name: "${context.programName}"`);
  }
  if (context?.niche) {
    contextParts.push(`Niche/Industry: ${context.niche}`);
  }
  if (context?.targetAudience) {
    contextParts.push(`Target Audience: ${context.targetAudience}`);
  }
  if (context?.programType) {
    contextParts.push(`Program Type: ${context.programType} coaching`);
  }
  if (context?.constraints) {
    contextParts.push(`Additional Constraints: ${context.constraints}`);
  }
  
  const contextSection = contextParts.length > 0
    ? `\n\nPROGRAM CONTEXT:\n${contextParts.join('\n')}`
    : '';
  
  const user = `Generate a ${duration}-${structure === 'weeks' ? 'week' : 'day'} coaching program with the following structure:
- Structure: ${structure}
- Duration: ${duration} ${structure}
- Generate content for ALL ${duration} ${structure}

${contextSection}

COACH'S REQUEST:
${userPrompt}

Remember: Output ONLY the JSON object. No explanations, no markdown formatting.`;
  
  return { system: PROGRAM_CONTENT_SYSTEM_PROMPT, user };
}

// =============================================================================
// LANDING PAGE GENERATION
// =============================================================================

const LANDING_PAGE_SYSTEM_PROMPT = `You are an expert conversion copywriter and landing page strategist.

Your job is to create compelling, high-converting landing page copy for coaching programs and communities.

CRITICAL RULES:
1. Output ONLY valid JSON matching the exact schema provided. No markdown, no explanations.
2. Write benefit-focused copy that speaks to the target audience's desires and pain points.
3. Keep copy scannable - use short sentences and clear structure.
4. Testimonials MUST use placeholder names like "Client A", "Client B", "Past Participant" - NEVER fabricate real-sounding names.
5. FAQs should address real objections and concerns (4-8 items).
6. Match the requested tone while maintaining professionalism.
7. Avoid clichés and generic marketing speak.
8. Focus on transformation and outcomes, not just features.

TONE OPTIONS:
- "friendly": Warm, approachable, conversational
- "direct": Clear, no-nonsense, action-oriented
- "premium": Sophisticated, exclusive, high-value
- "playful": Fun, energetic, memorable

OUTPUT SCHEMA:
{
  "hero": {
    "title": string,
    "subtitle": string,
    "primaryCta": string,
    "secondaryCta": string?
  },
  "aboutCoach": {
    "headline": string,
    "bio": string,
    "bullets": string[]
  },
  "whatYoullLearn": {
    "headline": string,
    "items": [{ "title": string, "description": string }]
  },
  "whatsIncluded": {
    "headline": string,
    "items": [{ "title": string, "description": string }]
  },
  "whoItsFor": {
    "headline": string,
    "items": string[]
  },
  "testimonials": [
    { "name": string, "role": string?, "quote": string }
  ],
  "faq": [
    { "question": string, "answer": string }
  ],
  "tone": "friendly"|"direct"|"premium"|"playful"
}`;

export function buildLandingPagePrompt(
  userPrompt: string,
  context?: AIGenerationContext,
  entityType: 'program' | 'squad' = 'program'
): { system: string; user: string } {
  const contextParts: string[] = [];
  
  const entityName = entityType === 'program' ? context?.programName : context?.squadName;
  if (entityName) {
    contextParts.push(`${entityType === 'program' ? 'Program' : 'Community'} Name: "${entityName}"`);
  }
  if (context?.coachName) {
    contextParts.push(`Coach Name: ${context.coachName}`);
  }
  if (context?.niche) {
    contextParts.push(`Niche/Industry: ${context.niche}`);
  }
  if (context?.targetAudience) {
    contextParts.push(`Target Audience: ${context.targetAudience}`);
  }
  if (context?.duration) {
    contextParts.push(`Program Duration: ${context.duration} days`);
  }
  if (context?.price !== undefined) {
    const priceStr = context.price === 0 
      ? 'Free' 
      : `${(context.price / 100).toFixed(0)} ${context.currency?.toUpperCase() || 'USD'}`;
    contextParts.push(`Price: ${priceStr}`);
  }
  if (context?.constraints) {
    contextParts.push(`Additional Context: ${context.constraints}`);
  }
  
  const contextSection = contextParts.length > 0
    ? `\n\n${entityType.toUpperCase()} CONTEXT:\n${contextParts.join('\n')}`
    : '';
  
  const entityDescription = entityType === 'program' 
    ? 'coaching program' 
    : 'community/squad';
  
  const user = `Generate landing page copy for a ${entityDescription}.
${contextSection}

COACH'S REQUEST:
${userPrompt}

IMPORTANT REMINDERS:
- Testimonials must use placeholder names like "Client A", "Client B", or "Past Participant"
- Include 4-8 FAQ items that address real objections
- Keep the copy scannable and benefit-focused
- Match the tone to what the coach described

Remember: Output ONLY the JSON object. No explanations, no markdown formatting.`;

  return { system: LANDING_PAGE_SYSTEM_PROMPT, user };
}

// =============================================================================
// WEEK FILL GENERATION (from call summary, prompt, or PDF)
// =============================================================================

const WEEK_FILL_SYSTEM_PROMPT = `You are an expert coaching assistant that extracts actionable content from call summaries and coaching materials.

Your job is to analyze coaching call transcripts, PDFs, or prompts and generate structured weekly content for a coaching program.

CRITICAL RULES:
1. Output ONLY valid JSON matching the exact schema provided. No markdown, no explanations.
2. Extract 3-8 specific, actionable tasks from the content.
3. Identify 1-3 key focus areas (what the client should prioritize).
4. Extract 1-3 important notes or reminders from the discussion.
5. Tasks should be concrete and achievable within a week.
6. Focus areas should be high-level themes, not specific tasks.
7. Notes can include context, warnings, or reminders discussed in the call.

TASK TYPES:
- "task": General action item (default)
- "reflection": Journaling or thinking exercise
- "habit": Behavior to practice regularly

OUTPUT SCHEMA:
{
  "tasks": [
    { "label": string, "type": "task"|"reflection"|"habit", "isPrimary": boolean, "estimatedMinutes": number?, "notes": string?, "tag": string? }
  ],
  "currentFocus": [string, string?, string?],  // 1-3 items max
  "notes": [string, string?, string?],          // 1-3 items max
  "weekTheme": string?,                          // Optional theme for the week
  "weekDescription": string?                     // Optional description
}`;

export interface WeekFillContext {
  programName: string;
  programDescription?: string;
  weekNumber: number;
  clientName?: string;
  orientation: 'daily' | 'weekly';
}

export function buildWeekFillPrompt(
  source: { type: 'call_summary' | 'prompt' | 'pdf'; content: string },
  context: WeekFillContext
): { system: string; user: string } {
  const contextParts: string[] = [
    `Program: "${context.programName}"`,
    `Week: ${context.weekNumber}`,
    `Orientation: ${context.orientation}`,
  ];

  if (context.programDescription) {
    contextParts.push(`Program Description: ${context.programDescription}`);
  }
  if (context.clientName) {
    contextParts.push(`Client: ${context.clientName}`);
  }

  const sourceLabel =
    source.type === 'call_summary'
      ? 'CALL SUMMARY TRANSCRIPT'
      : source.type === 'pdf'
      ? 'PDF CONTENT'
      : 'COACH INSTRUCTIONS';

  const user = `Generate weekly program content from the following source.

PROGRAM CONTEXT:
${contextParts.join('\n')}

${sourceLabel}:
${source.content}

INSTRUCTIONS:
- Extract actionable tasks that the client should complete this week
- Identify the key focus areas based on what was discussed
- Note any important reminders or context from the conversation
- Tasks marked as "isPrimary: true" will be shown in Daily Focus
- Limit to 3-8 tasks, 1-3 focus areas, and 1-3 notes

Remember: Output ONLY the JSON object. No explanations, no markdown formatting.`;

  return { system: WEEK_FILL_SYSTEM_PROMPT, user };
}







