/**
 * AI Generation Prompts
 * 
 * System and user prompt templates for each use case.
 * These are server-side only and should never be exposed to clients.
 */

import type { AIGenerationContext, ProgramStructure, OrgContentContext } from './types';

// =============================================================================
// HELPER FUNCTIONS FOR CONTEXT BUILDING
// =============================================================================

/**
 * Build a section of the prompt with PDF content
 */
function buildPdfContextSection(context?: AIGenerationContext): string {
  if (!context?.pdfContent) return '';

  const fileName = context.pdfFileName ? ` (${context.pdfFileName})` : '';
  return `

UPLOADED DOCUMENT${fileName}:
---
${context.pdfContent}
---

Use relevant information from this document to inform your generation. Extract key details about the coaching approach, target audience, offerings, and brand voice.`;
}

/**
 * Build a section with organization content for "Use my content" feature
 */
function buildOrgContentSection(orgContent?: OrgContentContext, useCase?: string): string {
  if (!orgContent) return '';

  const parts: string[] = [];

  // For website generation, include all programs and squads
  if (orgContent.programs && orgContent.programs.length > 0) {
    parts.push('EXISTING PROGRAMS:');
    orgContent.programs.forEach((p, i) => {
      parts.push(`${i + 1}. "${p.name}" (${p.lengthDays} days, ${p.type})`);
      if (p.description) parts.push(`   Description: ${p.description}`);
      if (p.keyOutcomes && p.keyOutcomes.length > 0) {
        parts.push(`   Key Outcomes: ${p.keyOutcomes.join(', ')}`);
      }
      if (p.features && p.features.length > 0) {
        parts.push(`   Features: ${p.features.map((f) => f.title).join(', ')}`);
      }
      if (p.weekTitles && p.weekTitles.length > 0) {
        parts.push(`   Week Themes: ${p.weekTitles.slice(0, 5).join(', ')}${p.weekTitles.length > 5 ? '...' : ''}`);
      }
    });
  }

  if (orgContent.squads && orgContent.squads.length > 0) {
    parts.push('\nEXISTING COMMUNITIES/SQUADS:');
    orgContent.squads.forEach((s, i) => {
      parts.push(`${i + 1}. "${s.name}"`);
      if (s.description) parts.push(`   Description: ${s.description}`);
      if (s.keyOutcomes && s.keyOutcomes.length > 0) {
        parts.push(`   Key Benefits: ${s.keyOutcomes.join(', ')}`);
      }
    });
  }

  // For specific program context
  if (orgContent.program) {
    parts.push('PROGRAM DETAILS:');
    parts.push(`Name: "${orgContent.program.name}"`);
    parts.push(`Type: ${orgContent.program.type} coaching`);
    parts.push(`Duration: ${orgContent.program.lengthDays} days`);
    if (orgContent.program.description) {
      parts.push(`Description: ${orgContent.program.description}`);
    }
    if (orgContent.program.keyOutcomes && orgContent.program.keyOutcomes.length > 0) {
      parts.push(`Key Outcomes:\n${orgContent.program.keyOutcomes.map((o) => `- ${o}`).join('\n')}`);
    }
    if (orgContent.program.features && orgContent.program.features.length > 0) {
      parts.push(`Features:\n${orgContent.program.features.map((f) => `- ${f.title}${f.description ? `: ${f.description}` : ''}`).join('\n')}`);
    }
    if (orgContent.program.weekTitles && orgContent.program.weekTitles.length > 0) {
      parts.push(`Week Themes: ${orgContent.program.weekTitles.join(', ')}`);
    }
  }

  // For specific squad context
  if (orgContent.squad) {
    parts.push('SQUAD/COMMUNITY DETAILS:');
    parts.push(`Name: "${orgContent.squad.name}"`);
    if (orgContent.squad.description) {
      parts.push(`Description: ${orgContent.squad.description}`);
    }
    if (orgContent.squad.keyOutcomes && orgContent.squad.keyOutcomes.length > 0) {
      parts.push(`Key Benefits:\n${orgContent.squad.keyOutcomes.map((o) => `- ${o}`).join('\n')}`);
    }
    if (orgContent.squad.features && orgContent.squad.features.length > 0) {
      parts.push(`Features:\n${orgContent.squad.features.map((f) => `- ${f.title}${f.description ? `: ${f.description}` : ''}`).join('\n')}`);
    }
  }

  // Include coach bio if available
  if (orgContent.coachBio) {
    parts.push(`\nCOACH BIO:\n${orgContent.coachBio}`);
  }

  // Include existing testimonials for reference (but still use placeholders in output)
  if (orgContent.existingTestimonials && orgContent.existingTestimonials.length > 0) {
    parts.push('\nEXISTING TESTIMONIAL THEMES (for reference, still use placeholder names in output):');
    orgContent.existingTestimonials.slice(0, 3).forEach((t) => {
      parts.push(`- "${t.text.slice(0, 100)}${t.text.length > 100 ? '...' : ''}"`);
    });
  }

  // Include existing FAQs for reference
  if (orgContent.existingFaqs && orgContent.existingFaqs.length > 0) {
    parts.push('\nEXISTING FAQ TOPICS (for reference):');
    orgContent.existingFaqs.slice(0, 5).forEach((f) => {
      parts.push(`- ${f.question}`);
    });
  }

  if (parts.length === 0) return '';

  return `

EXISTING ORGANIZATION CONTENT:
Use this information to create authentic, specific content that accurately represents the coach's actual offerings.
${parts.join('\n')}`;
}

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

  // Add PDF content if provided
  const pdfSection = buildPdfContextSection(context);

  // Add org content if provided
  const orgSection = buildOrgContentSection(context?.orgContent, 'PROGRAM_CONTENT');

  const user = `Generate a ${duration}-${structure === 'weeks' ? 'week' : 'day'} coaching program with the following structure:
- Structure: ${structure}
- Duration: ${duration} ${structure}
- Generate content for ALL ${duration} ${structure}
${contextSection}${orgSection}${pdfSection}

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

  // Add PDF content if provided
  const pdfSection = buildPdfContextSection(context);

  // Add org content if provided
  const orgSection = buildOrgContentSection(context?.orgContent, entityType === 'program' ? 'LANDING_PAGE_PROGRAM' : 'LANDING_PAGE_SQUAD');

  const entityDescription = entityType === 'program'
    ? 'coaching program'
    : 'community/squad';

  const user = `Generate landing page copy for a ${entityDescription}.
${contextSection}${orgSection}${pdfSection}

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
// WEBSITE CONTENT GENERATION
// =============================================================================

const WEBSITE_CONTENT_SYSTEM_PROMPT = `You are an expert conversion copywriter specializing in coaching and personal development websites.

Your job is to create compelling website copy that converts visitors into clients. This is a coach's main website - their digital home that showcases who they are and what they offer.

CRITICAL RULES:
1. Output ONLY valid JSON matching the exact schema provided. No markdown, no explanations.
2. Write benefit-focused copy that speaks to the target audience's desires and pain points.
3. Keep copy scannable - use short sentences and clear structure.
4. Testimonials MUST use placeholder names like "Client A", "Client B", "Past Participant" - NEVER fabricate real-sounding names.
5. FAQs should address real objections about working with a coach (4-8 items).
6. Services should be broad offerings (e.g., "1:1 Coaching", "Group Programs") not specific product names.
7. Match the requested tone while maintaining professionalism.
8. Avoid clichés and generic marketing speak.
9. Focus on transformation and outcomes, not just features.
10. SEO meta title should be under 60 characters, meta description under 160 characters.

TONE OPTIONS:
- "friendly": Warm, approachable, conversational
- "direct": Clear, no-nonsense, action-oriented
- "premium": Sophisticated, exclusive, high-value
- "playful": Fun, energetic, memorable

SERVICE ICON OPTIONS (optional):
"target", "users", "book", "trophy", "heart", "compass", "star", "zap", "lightbulb", "puzzle"

OUTPUT SCHEMA:
{
  "hero": {
    "headline": string,
    "subheadline": string,
    "ctaText": string
  },
  "coach": {
    "headline": string,
    "bio": string,
    "bullets": string[]
  },
  "services": {
    "headline": string,
    "items": [{ "title": string, "description": string, "icon": string? }]
  },
  "testimonials": [
    { "name": string, "role": string?, "quote": string }
  ],
  "faq": [
    { "question": string, "answer": string }
  ],
  "cta": {
    "headline": string,
    "subheadline": string,
    "buttonText": string
  },
  "seo": {
    "metaTitle": string,
    "metaDescription": string
  },
  "tone": "friendly"|"direct"|"premium"|"playful"
}`;

export function buildWebsiteContentPrompt(
  userPrompt: string,
  context?: AIGenerationContext
): { system: string; user: string } {
  const contextParts: string[] = [];

  if (context?.coachName) {
    contextParts.push(`Coach Name: ${context.coachName}`);
  }
  if (context?.niche) {
    contextParts.push(`Niche/Industry: ${context.niche}`);
  }
  if (context?.targetAudience) {
    contextParts.push(`Target Audience: ${context.targetAudience}`);
  }
  if (context?.constraints) {
    contextParts.push(`Additional Context: ${context.constraints}`);
  }

  const contextSection = contextParts.length > 0
    ? `\n\nCOACH CONTEXT:\n${contextParts.join('\n')}`
    : '';

  // Add PDF content if provided
  const pdfSection = buildPdfContextSection(context);

  // Add org content if provided - for website, this includes all programs and squads
  const orgSection = buildOrgContentSection(context?.orgContent, 'LANDING_PAGE_WEBSITE');

  const user = `Generate website content for a coach's main website.
${contextSection}${orgSection}${pdfSection}

COACH'S REQUEST:
${userPrompt}

IMPORTANT REMINDERS:
- This is the coach's main website, not a specific program landing page
- Services should be broad categories (e.g., "1:1 Coaching", "Group Programs", "Workshops")${context?.orgContent?.programs?.length ? ' - but you can reference the coach\'s actual programs listed above' : ''}
- Testimonials must use placeholder names like "Client A", "Client B", or "Past Participant"
- Include 4-8 FAQ items that address common objections about coaching
- SEO meta title must be under 60 characters, meta description under 160 characters
- Match the tone to what the coach described

Remember: Output ONLY the JSON object. No explanations, no markdown formatting.`;

  return { system: WEBSITE_CONTENT_SYSTEM_PROMPT, user };
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
}

export function buildWeekFillPrompt(
  source: { type: 'call_summary' | 'prompt' | 'pdf'; content: string },
  context: WeekFillContext
): { system: string; user: string } {
  const contextParts: string[] = [
    `Program: "${context.programName}"`,
    `Week: ${context.weekNumber}`,
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
- IMPORTANT: "currentFocus" is REQUIRED - always include 1-3 focus areas, even if you need to infer them from the overall theme
- If the source is a questionnaire or diagnostic, infer focus areas from the questions/themes covered

Remember: Output ONLY the JSON object. No explanations, no markdown formatting.`;

  return { system: WEEK_FILL_SYSTEM_PROMPT, user };
}

// =============================================================================
// DAY-SPECIFIC FILL GENERATION (from call summary with frequency-aware placement)
// =============================================================================

import type { CallSummaryActionItem } from '@/types';

const DAY_SPECIFIC_FILL_SYSTEM_PROMPT = `You are a coaching assistant creating a week plan from call insights.

Your job is to create tasks for specific days based on frequency hints from the call summary.

CRITICAL RULES:
1. Output ONLY valid JSON matching the exact schema provided.
2. "daily" tasks → add to ALL days in the fill range
3. "once" tasks → spread across different days evenly
4. "specific_day" tasks → place on the correct day (convert day name to day index)
5. Keep task labels concise but actionable (under 100 characters)
6. 1-4 tasks per day is ideal, max 8 per day

TASK TYPES:
- "task": General action item (default)
- "habit": Behavior to practice regularly
- "learning": Learning or reflection exercise
- "admin": Administrative task

OUTPUT SCHEMA:
{
  "days": {
    "1": { "tasks": [...] },
    "2": { "tasks": [...] },
    ...
  },
  "weekTheme": string?,
  "weekDescription": string?,
  "currentFocus": [string, string?, string?]
}

TASK FORMAT:
{ "label": string, "type": "task"|"habit"|"learning"|"admin", "isPrimary": boolean, "estimatedMinutes": number?, "notes": string? }`;

export interface DaySpecificFillContext {
  programName?: string;
  weekNumber: number;
  daysToFill: number[];  // [1, 2, 3, 4, 5] for Mon-Fri
  skipWeekends: boolean;
  todayDayIndex: number;  // What day index is "today"
}

export function buildDaySpecificFillPrompt(
  source: { content: string; actionItems?: CallSummaryActionItem[] },
  context: DaySpecificFillContext
): { system: string; user: string } {
  const daysStr = context.daysToFill.join(', ');
  const weekendNote = context.skipWeekends ? 'This program is weekdays only (Mon-Fri).' : '';

  // Format action items with frequency hints
  const actionItemsHint = source.actionItems?.length
    ? `\nACTION ITEMS FROM CALL (with frequency hints):\n${source.actionItems.map(item =>
        `- ${item.description} [${item.frequency || 'once'}${item.targetDayName ? `, target: ${item.targetDayName}` : ''}] (${item.priority} priority, assigned to: ${item.assignedTo})`
      ).join('\n')}`
    : '';

  const user = `Generate day-specific tasks from the following call summary.

PROGRAM CONTEXT:
${context.programName ? `Program: "${context.programName}"` : ''}
Week: ${context.weekNumber}
Days to fill: ${daysStr}
Today is Day ${context.todayDayIndex}
${weekendNote}

DAY INDEX MAPPING:
Day 1 = Monday, Day 2 = Tuesday, Day 3 = Wednesday, Day 4 = Thursday, Day 5 = Friday
${!context.skipWeekends ? 'Day 6 = Saturday, Day 7 = Sunday' : ''}
${actionItemsHint}

CALL SUMMARY CONTENT:
${source.content}

PLACEMENT INSTRUCTIONS:
- For "daily" frequency tasks: add to ALL days (${daysStr})
- For "once" frequency tasks: spread across different days
- For "specific_day" tasks with targetDayName: convert day name to index and place there
- If a specific day is outside the fill range, put on the closest available day
- Tasks should start from today (Day ${context.todayDayIndex})
- Client-assigned tasks should become actual tasks; coach tasks are optional notes

Remember: Output ONLY the JSON object. No explanations, no markdown formatting.`;

  return { system: DAY_SPECIFIC_FILL_SYSTEM_PROMPT, user };
}





