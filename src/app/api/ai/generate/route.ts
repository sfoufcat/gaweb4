/**
 * AI Generation API Route
 * 
 * POST /api/ai/generate
 * Generates content using AI based on the specified use case.
 * 
 * Authorization: Coach/Admin only (org-scoped)
 * 
 * Request Body:
 * {
 *   useCase: 'PROGRAM_CONTENT' | 'LANDING_PAGE_PROGRAM' | 'LANDING_PAGE_SQUAD',
 *   userPrompt: string,
 *   context?: {
 *     programName?: string,
 *     squadName?: string,
 *     coachName?: string,
 *     niche?: string,
 *     targetAudience?: string,
 *     duration?: number,
 *     structure?: 'days' | 'weeks',
 *     programType?: 'group' | 'individual',
 *     price?: number,
 *     currency?: string,
 *     constraints?: string,
 *   }
 * }
 * 
 * Response:
 * {
 *   draft: ProgramContentDraft | LandingPageDraft,
 *   meta: {
 *     model: string,
 *     inputTokens: number,
 *     outputTokens: number,
 *     createdAt: string,
 *     estimatedCost?: number,
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { generate } from '@/lib/ai/generate';
import type { AIUseCase, AIGenerationContext } from '@/lib/ai/types';

// Valid use cases
const VALID_USE_CASES: AIUseCase[] = [
  'PROGRAM_CONTENT',
  'LANDING_PAGE_PROGRAM',
  'LANDING_PAGE_SQUAD',
];

export async function POST(request: NextRequest) {
  try {
    // Authenticate and get organization context
    const { userId, organizationId } = await requireCoachWithOrg();
    
    // Parse request body
    const body = await request.json();
    const { useCase, userPrompt, context } = body as {
      useCase: AIUseCase;
      userPrompt: string;
      context?: AIGenerationContext;
    };
    
    // Validate use case
    if (!useCase || !VALID_USE_CASES.includes(useCase)) {
      return NextResponse.json(
        { error: `Invalid useCase. Must be one of: ${VALID_USE_CASES.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate user prompt
    if (!userPrompt || typeof userPrompt !== 'string') {
      return NextResponse.json(
        { error: 'userPrompt is required and must be a string' },
        { status: 400 }
      );
    }
    
    if (userPrompt.length < 10) {
      return NextResponse.json(
        { error: 'userPrompt must be at least 10 characters' },
        { status: 400 }
      );
    }
    
    if (userPrompt.length > 5000) {
      return NextResponse.json(
        { error: 'userPrompt must be 5000 characters or less' },
        { status: 400 }
      );
    }
    
    // Generate content
    const result = await generate({
      orgId: organizationId,
      userId,
      useCase,
      userPrompt,
      context,
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[AI_GENERATE] Error:', error);
    
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    // Handle specific error types
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json(
        { error: 'Forbidden: Coach access required' },
        { status: 403 }
      );
    }
    
    if (message.includes('Rate limit')) {
      return NextResponse.json(
        { error: message },
        { status: 429 }
      );
    }
    
    if (message.includes('TenantRequired')) {
      return NextResponse.json(
        { error: 'Please access this feature from your organization domain' },
        { status: 403 }
      );
    }
    
    // For validation errors, return them with details
    if (message.includes('Invalid program content') || message.includes('Invalid landing page')) {
      return NextResponse.json(
        { 
          error: 'AI generated invalid content. Please try again with a more specific prompt.',
          details: message,
        },
        { status: 422 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate content. Please try again.' },
      { status: 500 }
    );
  }
}





