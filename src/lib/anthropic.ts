import Anthropic from '@anthropic-ai/sdk';

// Log API key status on initialization (without exposing the key)
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('[Anthropic] WARNING: ANTHROPIC_API_KEY is not set!');
} else {
  console.log(`[Anthropic] API key loaded (${apiKey.substring(0, 10)}...)`);
}

const anthropic = new Anthropic({
  apiKey: apiKey,
});

export interface ValidationResult {
  is_valid: boolean;
  issues: string[];
  suggested_rewrite: string;
  goal_summary?: string;
}

// Keep legacy interface for backward compatibility (maps to new format)
export interface LegacyValidationResult {
  isValid: boolean;
  suggestion?: string;
  reasoning?: string;
}

export interface GoalValidationResult {
  status: 'good' | 'needs_improvement';
  feedback?: string;
  suggestedGoal?: string;
  goalSummary?: string; // 1-2 word summary like "Revenue Growth", "Weight Loss"
}

// ============================================================================
// PRE-VALIDATION PATTERNS - INSTANT REJECTION (before AI call)
// ============================================================================

// IDENTITY: Reject patterns that are clearly NOT identity statements
const MISSION_REJECT_PATTERNS: Array<{ pattern: RegExp; reason: string; suggestion: string }> = [
  // Money patterns
  { pattern: /\$\d+/i, reason: 'Contains dollar amount - this is a goal, not an identity statement', suggestion: 'I am a wealth creator' },
  { pattern: /\d+k\b/i, reason: 'Contains monetary target (e.g., 100k) - this is a goal, not an identity statement', suggestion: 'I am an ambitious entrepreneur' },
  { pattern: /\d+\s*(per|a|\/)\s*(day|month|week|year|hour)/i, reason: 'Contains time-based metric - this is a goal, not an identity statement', suggestion: 'I am a consistent performer' },
  
  // Goal language (trying to, want to, going to, etc.)
  { pattern: /\b(trying|want|going|aiming|planning|hoping)\s+to\b/i, reason: 'Uses goal language ("trying to", "want to") - your identity should be present tense "I am"', suggestion: 'I am a focused achiever' },
  
  // Earning/making money language
  { pattern: /\b(make|making|earn|earning|get|getting)\s+(money|\$\d+|\d+k|\d+\s*(dollars|bucks))/i, reason: 'Describes earning money - this is a goal, not an identity statement', suggestion: 'I am a value creator' },
  { pattern: /\b(reach|hit|achieve|attain)\s+\$?\d+/i, reason: 'Describes reaching a number - this is a goal, not an identity statement', suggestion: 'I am a goal achiever' },
  
  // Revenue/business metric language
  { pattern: /\b(revenue|income|earnings|profit|salary|mrr|arr)\b/i, reason: 'Contains business metrics - this is a goal, not an identity statement', suggestion: 'I am a successful business owner' },
  
  // Follower/subscriber metrics
  { pattern: /\b\d+\s*(followers|subscribers|users|customers|clients)\b/i, reason: 'Contains audience metrics - this is a goal, not an identity statement', suggestion: 'I am an influential creator' },
  { pattern: /\b(get|gain|reach|hit)\s+\d+\s*(followers|subscribers)/i, reason: 'Describes gaining followers - this is a goal, not an identity statement', suggestion: 'I am a community builder' },
];

// GOAL: Reject patterns that are too vague or malformed
const GOAL_REJECT_PATTERNS: Array<{ pattern: RegExp; reason: string; suggestion: string }> = [
  // Vague money goals without specific amounts
  { pattern: /^(make|making)\s+(money|more|some|a\s+lot)$/i, reason: 'Too vague - how much money? Add a specific number', suggestion: 'Earn $5,000 monthly' },
  { pattern: /^(earn|earning)\s+(money|more|some|income)$/i, reason: 'Too vague - how much? Add a specific target', suggestion: 'Reach $50k annual income' },
  { pattern: /^(get|getting)\s+(money|rich|wealthy)$/i, reason: 'Too vague - what specific outcome? Add a measurable target', suggestion: 'Build $100k net worth' },
  
  // Vague business goals
  { pattern: /^(grow|growing)\s+(my\s+)?(business|company|startup)$/i, reason: 'Too vague - grow to what? Add a specific metric', suggestion: 'Grow to $10k MRR' },
  { pattern: /^(be|become)\s+(successful|rich|wealthy|famous)$/i, reason: 'Too vague - what does success look like? Add a measurable outcome', suggestion: 'Reach 10,000 customers' },
  { pattern: /^(improve|improving)\s+(my\s+)?(life|business|health)$/i, reason: 'Too vague - improve how? Add a specific metric', suggestion: 'Lose 10kg bodyweight' },
  
  // Grammatically broken / incomplete
  { pattern: /^(making|getting|earning|reaching)\s+\d+k?$/i, reason: 'Incomplete goal - making what exactly? Be specific', suggestion: 'Reach $100k revenue' },
  { pattern: /^(more|better|bigger|faster)$/i, reason: 'Too vague - more/better what? Add context and numbers', suggestion: 'Increase revenue by 50%' },
  
  // Just a number
  { pattern: /^\$?\d+k?$/i, reason: 'Just a number - what does this represent? Add context', suggestion: 'Earn $10k monthly' },
  { pattern: /^\d+\s*(k|K|m|M)?$/i, reason: 'Just a number - add what this means (revenue, users, etc.)', suggestion: 'Reach 10k subscribers' },
];

// ============================================================================
// AI PROMPTS
// ============================================================================

const IDENTITY_SYSTEM_PROMPT = `You are the Onboarding Validation Engine for Coachful.

Your job is to evaluate and correct user-submitted identity statements.

You must be consistent, strict, and helpful.

You ALWAYS output valid JSON only, with no extra text.

⸻

OUTPUT FORMAT

Always return ONLY this JSON:

{
  "is_valid": false,
  "issues": [],
  "suggested_rewrite": ""
}

Do NOT return explanations outside JSON.
No markdown. No paragraphs. JSON ONLY.
Do NOT include the user's original mistakes in the rewrite.
Always rewrite cleanly.

⸻

IDENTITY VALIDATION RULES

An identity is a short statement describing the kind of person the user wants to become.

✔ An identity IS valid if:
• It begins with "I am"
• It describes an identity, not a goal
• It refers to a role, character, or archetype
• It does NOT contain numbers, metrics, revenue, time periods, achievements
• It does NOT describe a task, outcome, or business objective
• It is written in present tense
• It is positive and self-directed

❌ An identity is NOT valid if:
• It describes a goal ("I want to reach $100k.")
• It describes a task ("I will post daily.")
• It includes money, deadlines, KPIs, revenue, followers, dates
• It's vague, random, or meaningless ("I am strong")
• It is too long or contains storytelling
• It contradicts an identity (e.g., "I am $100k/month")
• It is not an identity statement

⸻

IDENTITY REWRITE RULES (VERY IMPORTANT)

Your rewrite MUST follow ALL these rules:

🔥 Rewrite Style
• MUST be short, punchy, max 6–8 words
• MUST be formatted like: "I am a [identity] for [who]"
• NO long sentences
• NO storytelling
• NO emotional descriptions
• NO adjectives unless essential
• NO filler
• DO NOT exceed 8 words
• It should feel like a crisp identity label.

✔ Good rewrites:
• "I am a guide for people with anxiety"
• "I am a mentor for founders"
• "I am a disciplined, focused creator"
• "I am a leader for my team"

❌ Bad rewrites:
• "I am a guide who helps people with anxiety build calm, confident lives."
• "I want to grow my business."
• "I am aiming to hit $100k/month."

⸻

JSON OUTPUT LOGIC

✔ is_valid: true
Only when all criteria are met.

✔ issues
List EACH problem as a short bullet phrase.
Examples:
• "Not measurable"
• "Contains revenue target in mission"
• "Too vague"
• "Not an identity statement"

✔ suggested_rewrite
• MUST follow the rewrite rules above
• MUST be concise
• MUST NOT exceed 8 words
• MUST NOT explain anything
• MUST NOT repeat the issues

If the user's submission is already valid, still rewrite it cleaner.

⸻

✅ Example Response (Identity)

{
  "is_valid": false,
  "issues": ["Not an identity", "Contains revenue"],
  "suggested_rewrite": "I am a mentor for founders"
}`;

const GOAL_SYSTEM_PROMPT = `You are the Onboarding Validation Engine for Coachful.

Your job is to evaluate and correct user-submitted SMART goals.

You must be consistent, strict, and helpful.

You ALWAYS output valid JSON only, with no extra text.

⸻

OUTPUT FORMAT

Always return ONLY this JSON:

{
  "is_valid": false,
  "issues": [],
  "suggested_rewrite": "",
  "goal_summary": ""
}

Fields:
- is_valid: whether the goal meets SMART criteria
- issues: array of specific problems (empty if valid)
- suggested_rewrite: improved version of the goal
- goal_summary: Extract the core measurable part in 2-4 words (e.g., "$50k MRR", "Lose 10kg", "1K Subscribers", "Launch App")

Do NOT return explanations outside JSON.
No markdown. No paragraphs. JSON ONLY.
Do NOT include the user's original mistakes in the rewrite.
Always rewrite cleanly.

⸻

GOAL VALIDATION RULES (SMART GOAL WITHOUT TIME)

A goal should be specific, measurable, outcome-based, but the deadline comes from a separate question, so do NOT penalize missing timeframes.

✔ A goal IS valid if:
• It is specific
• It is measurable
• It describes a clear outcome (not a task)
• It contains a metric, number, or completion indicator
• It is six-eight words or can be rewritten as such
• It is realistic and focused

❌ A goal is NOT valid if:
• It is vague ("grow my business")
• It is an identity instead of a goal
• It's a task ("post every day")
• It's impossible to measure
• It's too long or includes fluff
• It describes multiple goals at once
• It's a story instead of a goal

⸻

GOAL REWRITE RULES

When rewriting a goal, follow these rules:

🔥 Rewrite Style
• MUST be very concise (max 6–8 words)
• MUST focus ONLY on the outcome metric
• Remove all filler
• Keep just the core measurable part
• Should look like a bullet point, NOT a sentence.

✔ Good rewrites:
• "Grow to $50k MRR"
• "Reach 20 active clients"
• "Lose 10kg bodyweight"
• "Publish 4 videos monthly"

❌ Bad rewrites:
• "Grow my business to $50k monthly recurring revenue."
• "I want to build a big community online."
• "Improve my YouTube channel so it consistently grows."

⸻

JSON OUTPUT LOGIC

✔ is_valid: true
Only when all criteria are met.

✔ issues
List EACH problem as a short bullet phrase.
Examples:
• "Not measurable"
• "Contains revenue target in mission"
• "Too vague"
• "Not an identity statement"

✔ suggested_rewrite
• MUST follow the rewrite rules above
• MUST be concise
• MUST NOT exceed 8 words
• MUST NOT explain anything
• MUST NOT repeat the issues

If the user's submission is already valid, still rewrite it cleaner.

⸻

✅ Example Response (Goal)

{
  "is_valid": true,
  "issues": [],
  "suggested_rewrite": "Grow to $50k MRR"
}`;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export async function validateIdentityStatement(
  statement: string
): Promise<LegacyValidationResult> {
  const lowerStatement = statement.toLowerCase().trim();
  
  // -------------------------------------------------------------------------
  // Normalize: prepend "I am " if not already present (UI shows "I am " as prefix)
  // -------------------------------------------------------------------------
  let normalizedStatement = statement.trim();
  if (!lowerStatement.startsWith('i am ') && !lowerStatement.startsWith("i'm ")) {
    normalizedStatement = `I am ${statement.trim()}`;
  }
  
  // -------------------------------------------------------------------------
  // STEP 1: Basic length validation
  // -------------------------------------------------------------------------
  if (statement.length < 5) {
    console.log('[Identity Validation] REJECTED: Too short');
    return {
      isValid: false,
      reasoning: 'Too short - please describe who you are',
      suggestion: 'I am a guide for others',
    };
  }

  // -------------------------------------------------------------------------
  // STEP 2: Reject test/placeholder text
  // -------------------------------------------------------------------------
  const testPatterns = [
    /^test\s+test$/,
    /^test+$/,
    /test.*test/,
    /^asdf/,
    /^qwerty/,
    /^abc+$/,
    /^123+$/,
    /^lorem\s+ipsum/,
    /^(hello|hi)\s+(world|there)$/,
  ];
  if (testPatterns.some(pattern => pattern.test(lowerStatement))) {
    console.log('[Identity Validation] REJECTED: Test/placeholder text');
    return {
      isValid: false,
      reasoning: 'Please enter a real identity statement',
      suggestion: 'I am a mentor for founders',
    };
  }

  // -------------------------------------------------------------------------
  // STEP 3: PRE-VALIDATION - Check against reject patterns BEFORE calling AI
  // -------------------------------------------------------------------------
  for (const { pattern, reason, suggestion } of MISSION_REJECT_PATTERNS) {
    if (pattern.test(lowerStatement)) {
      console.log(`[Identity Validation] REJECTED by pre-validation: ${reason}`);
      console.log(`[Identity Validation] Input was: "${statement}"`);
      return {
        isValid: false,
        reasoning: reason,
        suggestion: suggestion,
      };
    }
  }

  // -------------------------------------------------------------------------
  // STEP 4: Call AI for nuanced validation
  // -------------------------------------------------------------------------
  try {
    console.log(`[Identity Validation] Calling AI for: "${normalizedStatement}"`);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `${IDENTITY_SYSTEM_PROMPT}

Analyze the following identity statement and return ONLY valid JSON:

Identity: "${normalizedStatement}"`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      console.log(`[Identity Validation] AI response: ${content.text}`);
      
      // Parse the JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result: ValidationResult = JSON.parse(jsonMatch[0]);
        console.log(`[Identity Validation] Parsed result: is_valid=${result.is_valid}, issues=${JSON.stringify(result.issues)}`);
        
        // Map to legacy format for backward compatibility
        return {
          isValid: result.is_valid === true,
          reasoning: result.issues.length > 0 ? result.issues.join('. ') : 'Looks good!',
          suggestion: result.is_valid ? undefined : result.suggested_rewrite,
        };
      }
    }

    // -------------------------------------------------------------------------
    // FALLBACK: Parse failure = REJECT (fail-safe)
    // -------------------------------------------------------------------------
    console.error('[Identity Validation] FAILED to parse AI response - rejecting as safety measure');
    return {
      isValid: false,
      reasoning: 'Could not validate your identity. Please try rephrasing it.',
      suggestion: 'I am a leader who inspires others',
    };
  } catch (error) {
    // -------------------------------------------------------------------------
    // ERROR: Reject on any error (fail-safe)
    // -------------------------------------------------------------------------
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStatus = (error as { status?: number; statusCode?: number })?.status || (error as { status?: number; statusCode?: number })?.statusCode || 'N/A';
    console.error(`[Identity Validation] ERROR: ${errorMessage}`);
    console.error(`[Identity Validation] Status: ${errorStatus}`);
    console.error(`[Identity Validation] Full error:`, JSON.stringify(error, null, 2));
    
    return {
      isValid: false,
      reasoning: `Validation error: ${errorMessage.substring(0, 100)}`,
      suggestion: 'I am a mentor for founders',
    };
  }
}

export async function validateGoal(
  goal: string,
  targetDate: string
): Promise<GoalValidationResult> {
  const lowerGoal = goal.toLowerCase().trim();
  
  // -------------------------------------------------------------------------
  // STEP 1: Basic length validation
  // -------------------------------------------------------------------------
  if (goal.length < 3) {
    console.log('[Goal Validation] REJECTED: Too short');
    return {
      status: 'needs_improvement',
      feedback: 'Too short - please describe your goal',
      suggestedGoal: 'Grow to $50k MRR',
    };
  }

  // -------------------------------------------------------------------------
  // STEP 2: Reject test/placeholder text
  // -------------------------------------------------------------------------
  const testPatterns = [
    /^test+\s*test+/,
    /^asdf/,
    /^qwerty/,
    /^abc+$/,
    /^123+$/,
  ];
  if (testPatterns.some(pattern => pattern.test(lowerGoal))) {
    console.log('[Goal Validation] REJECTED: Test/placeholder text');
    return {
      status: 'needs_improvement',
      feedback: 'Please enter a real goal',
      suggestedGoal: 'Reach 20 active clients',
    };
  }

  // -------------------------------------------------------------------------
  // STEP 3: PRE-VALIDATION - Check against reject patterns BEFORE calling AI
  // -------------------------------------------------------------------------
  for (const { pattern, reason, suggestion } of GOAL_REJECT_PATTERNS) {
    if (pattern.test(lowerGoal)) {
      console.log(`[Goal Validation] REJECTED by pre-validation: ${reason}`);
      console.log(`[Goal Validation] Input was: "${goal}"`);
      return {
        status: 'needs_improvement',
        feedback: reason,
        suggestedGoal: suggestion,
      };
    }
  }

  // -------------------------------------------------------------------------
  // STEP 4: Call AI for nuanced validation
  // -------------------------------------------------------------------------
  try {
    console.log(`[Goal Validation] Calling AI for: "${goal}" (target: ${targetDate})`);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `${GOAL_SYSTEM_PROMPT}

Analyze the following goal and return ONLY valid JSON:

Goal: "${goal}"
Target Date: ${targetDate}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      console.log(`[Goal Validation] AI response: ${content.text}`);
      
      // Parse the JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result: ValidationResult = JSON.parse(jsonMatch[0]);
        console.log(`[Goal Validation] Parsed result: is_valid=${result.is_valid}, issues=${JSON.stringify(result.issues)}, summary=${result.goal_summary}`);
        
        // Map to legacy format for backward compatibility
        return {
          status: result.is_valid ? 'good' : 'needs_improvement',
          feedback: result.issues.length > 0 ? result.issues.join('. ') : 'Your goal looks good!',
          suggestedGoal: result.is_valid ? undefined : result.suggested_rewrite,
          goalSummary: result.goal_summary,
        };
      }
    }

    // -------------------------------------------------------------------------
    // FALLBACK: Parse failure = REJECT (fail-safe)
    // -------------------------------------------------------------------------
    console.error('[Goal Validation] FAILED to parse AI response - rejecting as safety measure');
    return {
      status: 'needs_improvement',
      feedback: 'Could not validate your goal. Please try rephrasing it.',
      suggestedGoal: 'Reach 1,000 subscribers',
    };
  } catch (error) {
    // -------------------------------------------------------------------------
    // ERROR: Reject on any error (fail-safe)
    // -------------------------------------------------------------------------
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStatus = (error as { status?: number; statusCode?: number })?.status || (error as { status?: number; statusCode?: number })?.statusCode || 'N/A';
    console.error(`[Goal Validation] ERROR: ${errorMessage}`);
    console.error(`[Goal Validation] Status: ${errorStatus}`);
    console.error(`[Goal Validation] Full error:`, JSON.stringify(error, null, 2));
    
    return {
      status: 'needs_improvement',
      feedback: `Validation error: ${errorMessage.substring(0, 100)}`,
      suggestedGoal: 'Grow to $10k MRR',
    };
  }
}

// ============================================================================
// TRANSFORMATION TEXT GENERATION
// ============================================================================

export interface TransformationTextInput {
  businessStage?: string;
  peerAccountability?: string;
  goal?: string;
  identity?: string;
}

export interface TransformationTextResult {
  text: string;
  error?: string;
}

const TRANSFORMATION_PROMPT = `You are a motivational copywriter for Coachful, a personal growth app.

Your job is to write ONE SHORT, punchy sentence that explains why THIS journey will work for them.

You MUST:
- Address their specific accountability situation in the sentence
- Be confident and inspiring, not generic
- Use "you" language (second person)
- Keep it to EXACTLY 1 sentence
- Be concise (max 15-20 words)

You MUST NOT:
- Be generic or vague
- Use clichés like "unlock your potential" or "transform your life"
- Mention the app or product
- Write more than 1 sentence
- Use bullet points or lists

Return ONLY the single sentence. No quotes, no explanation, just the text.`;

export async function generateTransformationText(
  input: TransformationTextInput
): Promise<TransformationTextResult> {
  try {
    const { businessStage, peerAccountability, goal, identity } = input;
    
    // Format peer accountability for the prompt
    const peerAccountabilityMap: Record<string, string> = {
      'alone': 'working alone without peer accountability',
      'no_daily_system': 'having communities but no daily accountability system',
      'inconsistent': 'inconsistent accountability',
      'strong_accountability': 'strong peer accountability',
    };
    
    const formattedAccountability = peerAccountabilityMap[peerAccountability || ''] || 'limited accountability';
    
    // Format growth stage
    const stageMap: Record<string, string> = {
      'just_starting': 'just getting started',
      'building_momentum': 'building momentum',
      'growing_steadily': 'growing steadily',
      'leveling_up': 'leveling up a new chapter',
      'reinventing': 'reinventing themselves',
    };
    const formattedStage = stageMap[businessStage || ''] || businessStage || 'their current stage';
    
    console.log(`[Transformation Text] Generating for: stage=${formattedStage}, accountability=${formattedAccountability}, goal=${goal}`);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `${TRANSFORMATION_PROMPT}

User context:
- Current stage: ${formattedStage}
- Current accountability situation: ${formattedAccountability}
- Goal: ${goal || 'achieve their main goal'}
- Identity: ${identity || 'a focused achiever'}

Write the 2-sentence transformation paragraph:`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      const text = content.text.trim();
      console.log(`[Transformation Text] Generated: ${text}`);
      return { text };
    }

    return { 
      text: 'With the right system, you\'ll finally break through what\'s been holding you back.',
      error: 'Failed to parse AI response'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Transformation Text] ERROR: ${errorMessage}`);
    
    // Return a decent fallback
    return { 
      text: 'With the right system, you\'ll finally break through what\'s been holding you back.',
      error: errorMessage
    };
  }
}

// ============================================================================
// GOAL SUMMARY GENERATION (1-2 word summary for chart labels)
// ============================================================================

export interface GoalSummaryResult {
  summary: string;
  error?: string;
}

const GOAL_SUMMARY_PROMPT = `Generate a 1-2 word summary/category for the following goal.

Rules:
- MUST be 1-2 words maximum
- Should capture the essence/category of the goal
- Use title case (e.g., "Weight Loss", "SaaS Launch")
- Be specific and descriptive
- NO articles (a, an, the)
- NO verbs in present tense (use nouns or noun phrases)

Examples:
- "Lose 20kg by summer" → "Weight Loss"
- "Launch my SaaS product" → "SaaS Launch"  
- "Get 10k followers on Instagram" → "Audience Growth"
- "Reach $50k MRR" → "Revenue Growth"
- "Write and publish my first book" → "Book Launch"
- "Get 100 paying customers" → "Customer Growth"
- "Run a marathon" → "Marathon"
- "Learn to code" → "Coding Skills"
- "Start a podcast" → "Podcast Launch"
- "Build my personal brand" → "Personal Brand"

Return ONLY the 1-2 word summary. No quotes, no explanation, just the summary.`;

export async function generateGoalSummary(goal: string): Promise<GoalSummaryResult> {
  if (!goal || goal.trim().length < 3) {
    return { summary: 'Your Goal' };
  }

  try {
    console.log(`[Goal Summary] Generating for: "${goal}"`);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `${GOAL_SUMMARY_PROMPT}

Goal: "${goal}"

Summary:`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      // Clean up the response - remove quotes, trim, limit to 2 words
      let summary = content.text.trim().replace(/["']/g, '');
      
      // Ensure it's max 2 words
      const words = summary.split(/\s+/);
      if (words.length > 2) {
        summary = words.slice(0, 2).join(' ');
      }
      
      console.log(`[Goal Summary] Generated: ${summary}`);
      return { summary };
    }

    return { summary: 'Your Goal', error: 'Failed to parse AI response' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Goal Summary] ERROR: ${errorMessage}`);
    return { summary: 'Your Goal', error: errorMessage };
  }
}

// ============================================================================
// ACCOUNTABILITY SUMMARY GENERATION (1-2 word summary for chart labels)
// ============================================================================

export interface AccountabilitySummaryResult {
  summary: string;
  error?: string;
}

// Map of accountability answer values to their full question text
const ACCOUNTABILITY_ANSWER_TEXT: Record<string, string> = {
  'alone': "No, I'm working on this alone",
  'no_daily_system': "I have communities but no daily accountability system",
  'inconsistent': "I have some accountability, but it's not consistent",
  'strong_accountability': "Yes, I have strong peer accountability",
};

const ACCOUNTABILITY_SUMMARY_PROMPT = `Generate a 1-2 word summary describing someone's current accountability/support situation.

The user was asked: "Do you have a group of peers who see your commitments and your results every day?"

Rules:
- MUST be 1-2 words maximum
- Should describe their CURRENT state (what they have now)
- Use title case (e.g., "Solo Journey", "No Support")
- Be specific and descriptive
- NO articles (a, an, the)
- NO verbs - use nouns or noun phrases ONLY
- Should feel like a status label

Examples of good summaries:
- For someone working alone → "Solo Journey" or "No Support"
- For someone with communities but no daily system → "Loose Network" or "No System"
- For someone with inconsistent accountability → "Spotty Support" or "Some Support"
- For someone with strong accountability → "Strong Network" or "Good Support"

Return ONLY the 1-2 word summary. No quotes, no explanation, just the summary.`;

export async function generateAccountabilitySummary(
  peerAccountability: string
): Promise<AccountabilitySummaryResult> {
  // Get the full answer text
  const answerText = ACCOUNTABILITY_ANSWER_TEXT[peerAccountability];
  
  if (!answerText) {
    return { summary: 'Starting Point' };
  }

  try {
    console.log(`[Accountability Summary] Generating for: "${peerAccountability}" = "${answerText}"`);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `${ACCOUNTABILITY_SUMMARY_PROMPT}

Their answer: "${answerText}"

Summary:`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      // Clean up the response - remove quotes, trim, limit to 2 words
      let summary = content.text.trim().replace(/["']/g, '');
      
      // Ensure it's max 2 words
      const words = summary.split(/\s+/);
      if (words.length > 2) {
        summary = words.slice(0, 2).join(' ');
      }
      
      console.log(`[Accountability Summary] Generated: ${summary}`);
      return { summary };
    }

    return { summary: 'Starting Point', error: 'Failed to parse AI response' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Accountability Summary] ERROR: ${errorMessage}`);
    return { summary: 'Starting Point', error: errorMessage };
  }
}

// ============================================================================
// WEEKLY FOCUS SUMMARY GENERATION (2-5 word summary for homepage display)
// ============================================================================

export interface WeeklyFocusSummaryResult {
  summary: string;
  error?: string;
}

const WEEKLY_FOCUS_SUMMARY_PROMPT = `Summarize this weekly focus statement into 2-5 action-oriented words.

Rules:
- MUST be 2-5 words
- Start with an action verb when possible (e.g., "Crack", "Launch", "Master", "Build", "Complete")
- Remove filler words like "I want to", "This week", "I'm going to", etc.
- Keep the core focus/topic intact
- Use sentence case (capitalize first word only, unless proper noun)
- Be punchy and direct
- NO periods at the end

Examples:
- "This week I want to crack the Meta ads game" → "Crack Meta ads"
- "I'm going to finish my portfolio draft and launch it" → "Launch portfolio"
- "This week I'm committing to finishing my book outline" → "Finish book outline"
- "Focus on getting 10 new clients this week" → "Get 10 new clients"
- "I want to learn React and build my first app" → "Build first React app"
- "Running three times and eating healthy" → "Run 3x, eat healthy"
- "Complete the sales deck and pitch to investors" → "Pitch to investors"
- "Master cold outreach for B2B sales" → "Master cold outreach"

Return ONLY the 2-5 word summary. No quotes, no explanation, just the summary.`;

export async function summarizeWeeklyFocus(
  focusText: string
): Promise<WeeklyFocusSummaryResult> {
  if (!focusText || focusText.trim().length < 3) {
    return { summary: focusText?.trim() || 'Weekly Focus' };
  }

  try {
    console.log(`[Weekly Focus Summary] Generating for: "${focusText}"`);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `${WEEKLY_FOCUS_SUMMARY_PROMPT}

Weekly focus: "${focusText}"

Summary:`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      // Clean up the response - remove quotes, trim, limit to 5 words
      let summary = content.text.trim().replace(/["']/g, '').replace(/\.$/, '');
      
      // Ensure it's max 5 words
      const words = summary.split(/\s+/);
      if (words.length > 5) {
        summary = words.slice(0, 5).join(' ');
      }
      
      console.log(`[Weekly Focus Summary] Generated: ${summary}`);
      return { summary };
    }

    return { summary: focusText.trim(), error: 'Failed to parse AI response' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Weekly Focus Summary] ERROR: ${errorMessage}`);
    // Return the original text as fallback (truncated if too long)
    const fallback = focusText.trim().split(/\s+/).slice(0, 5).join(' ');
    return { summary: fallback, error: errorMessage };
  }
}

// ============================================================================
// QUIZ GOAL GENERATION - Generate 3-word goal from quiz option
// ============================================================================

/**
 * Generates a concise 3-word goal from a quiz option selection.
 * Used during onboarding quiz to set the user's 90-day goal.
 * 
 * @param optionLabel - The full label of the selected quiz option (e.g., "Get my first 1k true followers 🎯")
 * @returns A 3-word goal summary (e.g., "Reach 1k followers")
 */
export async function generateQuizGoal(optionLabel: string): Promise<{ goal: string; error?: string }> {
  console.log(`[Quiz Goal] Input: ${optionLabel}`);
  
  // Clean the input - remove emojis
  const cleanLabel = optionLabel.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
  
  if (!cleanLabel) {
    return { goal: 'Grow my audience', error: 'Empty input' };
  }
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `Convert this quiz option into a clear, specific goal (4-6 words). The goal should describe what the person wants to achieve.

Quiz option: "${cleanLabel}"

Rules:
- 4-6 words maximum
- Be specific about the metric (followers, reach, views, engagement, etc.)
- Include numbers/ranges if present in the original
- Make it read naturally as a goal statement
- No periods or punctuation
- Should complete the sentence "My goal is to..."

Examples:
- "Get my first 1k true followers" → "Reach 1,000 followers"
- "Grow by +2-5k followers" → "Grow to 2-5k followers"
- "Grow by +10k or more" → "Hit 10k+ followers"
- "I care more about engagement / leads than follower count" → "Maximize engagement and leads"
- "Start making consistent money from my content" → "Make consistent income from content"

Return ONLY the goal, nothing else.`
        }
      ],
    });
    
    const content = response.content[0];
    if (content.type === 'text') {
      let goal = content.text.trim().replace(/["'\.]/g, '');
      
      // Ensure it's max 6 words
      const words = goal.split(/\s+/);
      if (words.length > 6) {
        goal = words.slice(0, 6).join(' ');
      }
      
      // Capitalize first letter
      goal = goal.charAt(0).toUpperCase() + goal.slice(1);
      
      console.log(`[Quiz Goal] Generated: ${goal}`);
      return { goal };
    }

    return { goal: 'Grow my audience', error: 'Failed to parse AI response' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Quiz Goal] ERROR: ${errorMessage}`);
    // Return a sensible fallback
    if (cleanLabel.toLowerCase().includes('engagement') || cleanLabel.toLowerCase().includes('leads')) {
      return { goal: 'Maximize engagement and leads', error: errorMessage };
    }
    return { goal: 'Grow my audience', error: errorMessage };
  }
}

// ============================================================================
// STARTING POINT SUMMARY - Generate 1-2 word summary from quiz option
// ============================================================================

export interface StartingPointSummaryResult {
  summary: string;
  error?: string;
}

const STARTING_POINT_SUMMARY_PROMPT = `Generate a 1-2 word summary describing someone's current starting point or stage.

This will be displayed on a transformation graph as "Today: [summary]" at the starting point.

Rules:
- MUST be 1-2 words maximum
- Should describe their CURRENT state (where they are now)
- Use title case (e.g., "Just Starting", "Building Momentum")
- Be specific and descriptive
- NO articles (a, an, the)
- NO verbs - use nouns or noun phrases ONLY
- Should feel like a status label

Examples of good summaries:
- For someone who hasn't really started → "Just Starting" or "Pre-Launch"
- For someone posting occasionally with small audience → "Early Stage" or "Small Audience"
- For someone posting consistently but slow growth → "Slow Growth" or "Consistency Phase"
- For someone with solid audience wanting to scale → "Ready Scale" or "Established"

Return ONLY the 1-2 word summary. No quotes, no explanation, just the summary.`;

/**
 * Generates a concise 1-2 word starting point summary from a quiz option selection.
 * Used during onboarding quiz to set the user's starting point for the transformation graph.
 * 
 * @param optionLabel - The full label of the selected quiz option (e.g., "I post occasionally but my audience is still small 🌱")
 * @returns A 1-2 word summary (e.g., "Early Stage")
 */
export async function generateStartingPointSummary(
  optionLabel: string
): Promise<StartingPointSummaryResult> {
  // Clean the input - remove emojis
  const cleanLabel = optionLabel.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
  
  if (!cleanLabel) {
    return { summary: 'Starting Point' };
  }

  try {
    console.log(`[Starting Point Summary] Generating for: "${cleanLabel}"`);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `${STARTING_POINT_SUMMARY_PROMPT}

Their answer: "${cleanLabel}"

Summary:`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      // Clean up the response - remove quotes, trim, limit to 2 words
      let summary = content.text.trim().replace(/["']/g, '');
      
      // Ensure it's max 2 words
      const words = summary.split(/\s+/);
      if (words.length > 2) {
        summary = words.slice(0, 2).join(' ');
      }
      
      console.log(`[Starting Point Summary] Generated: ${summary}`);
      return { summary };
    }

    return { summary: 'Starting Point', error: 'Failed to parse AI response' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Starting Point Summary] ERROR: ${errorMessage}`);
    return { summary: 'Starting Point', error: errorMessage };
  }
}
