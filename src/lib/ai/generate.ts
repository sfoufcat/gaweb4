/**
 * AI Generation Service
 * 
 * Core service for generating AI content.
 * Handles prompt building, API calls, response parsing, and validation.
 */

import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { buildProgramContentPrompt, buildLandingPagePrompt } from './prompts';
import { validateProgramContentDraft, validateLandingPageDraft } from './schemas';
import type {
  AIUseCase,
  AIGenerationContext,
  AIGenerationMeta,
  AIGenerationResponse,
  ProgramContentDraft,
  LandingPageDraft,
  AIValidationResult,
  AIUsageLog,
} from './types';

// =============================================================================
// CLIENT INITIALIZATION
// =============================================================================

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('[AI Generate] WARNING: ANTHROPIC_API_KEY is not set!');
}

const anthropic = new Anthropic({
  apiKey: apiKey,
});

// Model configuration
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;

// Approximate cost per token (Claude Sonnet 4)
const INPUT_TOKEN_COST = 0.003 / 1000;  // $3 per million input tokens
const OUTPUT_TOKEN_COST = 0.015 / 1000; // $15 per million output tokens

// =============================================================================
// RATE LIMITING
// =============================================================================

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_ORG = 10; // Max 10 requests per org per minute

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitCache = new Map<string, RateLimitEntry>();

function checkRateLimit(orgId: string): { allowed: boolean; resetInSeconds?: number } {
  const now = Date.now();
  const entry = rateLimitCache.get(orgId);
  
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitCache.set(orgId, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  if (entry.count >= MAX_REQUESTS_PER_ORG) {
    const resetInSeconds = Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, resetInSeconds };
  }
  
  entry.count++;
  return { allowed: true };
}

// =============================================================================
// USAGE LOGGING
// =============================================================================

async function logUsage(
  organizationId: string,
  userId: string,
  useCase: AIUseCase,
  success: boolean,
  inputTokens: number,
  outputTokens: number,
  errorMessage?: string
): Promise<void> {
  try {
    const estimatedCost = (inputTokens * INPUT_TOKEN_COST) + (outputTokens * OUTPUT_TOKEN_COST);
    
    const logEntry: Omit<AIUsageLog, 'id'> = {
      organizationId,
      userId,
      useCase,
      success,
      inputTokens,
      outputTokens,
      estimatedCost,
      errorMessage,
      createdAt: new Date().toISOString(),
    };
    
    await adminDb.collection('ai_usage_logs').add({
      ...logEntry,
      createdAt: FieldValue.serverTimestamp(),
    });
    
    console.log(`[AI Usage] Logged: org=${organizationId}, useCase=${useCase}, success=${success}, tokens=${inputTokens}+${outputTokens}, cost=$${estimatedCost.toFixed(4)}`);
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('[AI Usage] Failed to log usage:', error);
  }
}

// =============================================================================
// MAIN GENERATION FUNCTION
// =============================================================================

export interface GenerateOptions {
  orgId: string;
  userId: string;
  useCase: AIUseCase;
  userPrompt: string;
  context?: AIGenerationContext;
}

export async function generate(
  options: GenerateOptions
): Promise<AIGenerationResponse<ProgramContentDraft | LandingPageDraft>> {
  const { orgId, userId, useCase, userPrompt, context } = options;
  
  // Check rate limit
  const rateLimitResult = checkRateLimit(orgId);
  if (!rateLimitResult.allowed) {
    throw new Error(`Rate limit exceeded. Try again in ${rateLimitResult.resetInSeconds} seconds.`);
  }
  
  // Build prompt based on use case
  let prompt: { system: string; user: string };
  
  switch (useCase) {
    case 'PROGRAM_CONTENT':
      prompt = buildProgramContentPrompt(userPrompt, context);
      break;
    case 'LANDING_PAGE_PROGRAM':
      prompt = buildLandingPagePrompt(userPrompt, context, 'program');
      break;
    case 'LANDING_PAGE_SQUAD':
      prompt = buildLandingPagePrompt(userPrompt, context, 'squad');
      break;
    default:
      throw new Error(`Unknown use case: ${useCase}`);
  }
  
  console.log(`[AI Generate] Starting generation: useCase=${useCase}, org=${orgId}`);
  
  let inputTokens = 0;
  let outputTokens = 0;
  
  try {
    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system: prompt.system,
      messages: [
        { role: 'user', content: prompt.user },
      ],
    });
    
    // Extract token usage
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
    
    // Extract text content
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from AI');
    }
    
    const rawText = content.text.trim();
    console.log(`[AI Generate] Raw response length: ${rawText.length} chars`);
    
    // Parse JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }
    
    let draft: unknown;
    try {
      draft = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[AI Generate] JSON parse error:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }
    
    // Validate based on use case
    let validatedDraft: ProgramContentDraft | LandingPageDraft;
    
    if (useCase === 'PROGRAM_CONTENT') {
      const validation = validateProgramContentDraft(draft);
      if (!validation.success) {
        console.error('[AI Generate] Validation errors:', validation.errors);
        throw new Error(`Invalid program content: ${validation.errors?.map(e => e.message).join(', ')}`);
      }
      validatedDraft = validation.data!;
    } else {
      const validation = validateLandingPageDraft(draft);
      if (!validation.success) {
        console.error('[AI Generate] Validation errors:', validation.errors);
        throw new Error(`Invalid landing page: ${validation.errors?.map(e => e.message).join(', ')}`);
      }
      validatedDraft = validation.data!;
    }
    
    // Build metadata
    const meta: AIGenerationMeta = {
      model: DEFAULT_MODEL,
      inputTokens,
      outputTokens,
      createdAt: new Date().toISOString(),
      estimatedCost: (inputTokens * INPUT_TOKEN_COST) + (outputTokens * OUTPUT_TOKEN_COST),
    };
    
    // Log successful usage
    await logUsage(orgId, userId, useCase, true, inputTokens, outputTokens);
    
    console.log(`[AI Generate] Success: useCase=${useCase}, tokens=${inputTokens}+${outputTokens}`);
    
    return { draft: validatedDraft, meta };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed usage
    await logUsage(orgId, userId, useCase, false, inputTokens, outputTokens, errorMessage);
    
    console.error(`[AI Generate] Error: ${errorMessage}`);
    throw error;
  }
}

// =============================================================================
// VALIDATION FUNCTION
// =============================================================================

export function validateDraft(
  useCase: AIUseCase,
  draft: unknown
): AIValidationResult {
  const errors: Array<{ path: string; message: string }> = [];
  const warnings: Array<{ path: string; message: string }> = [];
  
  if (useCase === 'PROGRAM_CONTENT') {
    const validation = validateProgramContentDraft(draft);
    if (!validation.success && validation.errors) {
      errors.push(...validation.errors);
    }
    
    // Add warnings for content quality
    const programDraft = draft as ProgramContentDraft;
    if (programDraft?.daysOrWeeks) {
      for (const dayOrWeek of programDraft.daysOrWeeks) {
        if (dayOrWeek.tasks && dayOrWeek.tasks.length < 2) {
          warnings.push({
            path: `daysOrWeeks[${dayOrWeek.index}].tasks`,
            message: 'Consider adding more tasks for better engagement',
          });
        }
      }
    }
  } else {
    const validation = validateLandingPageDraft(draft);
    if (!validation.success && validation.errors) {
      errors.push(...validation.errors);
    }
    
    // Add warnings for landing page quality
    const lpDraft = draft as LandingPageDraft;
    if (lpDraft?.faq && lpDraft.faq.length < 5) {
      warnings.push({
        path: 'faq',
        message: 'Consider adding more FAQs to address common objections',
      });
    }
    if (lpDraft?.testimonials) {
      for (const [i, t] of lpDraft.testimonials.entries()) {
        // Check for potentially fabricated names
        if (t.name && !t.name.match(/^Client [A-Z]$|^Past Participant$|^Member \d+$/i)) {
          warnings.push({
            path: `testimonials[${i}].name`,
            message: 'Replace with real testimonial or use placeholder like "Client A"',
          });
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  AIUseCase,
  AIGenerationContext,
  AIGenerationMeta,
  AIGenerationResponse,
  ProgramContentDraft,
  LandingPageDraft,
  AIValidationResult,
};







