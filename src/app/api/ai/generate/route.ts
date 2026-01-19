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
 *   useCase: 'PROGRAM_CONTENT' | 'LANDING_PAGE_PROGRAM' | 'LANDING_PAGE_SQUAD' | 'LANDING_PAGE_WEBSITE',
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
 *     // PDF Upload feature
 *     pdfContent?: string,      // Extracted text from uploaded PDF
 *     pdfFileName?: string,     // Original filename for context
 *     // "Use my content" feature
 *     orgContent?: OrgContentContext,  // Organization programs/squads data
 *   }
 * }
 *
 * Response:
 * {
 *   draft: ProgramContentDraft | LandingPageDraft | WebsiteContentDraft,
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
import { requireAIHelperAccess, isEntitlementError, getEntitlementErrorStatus } from '@/lib/billing/server-enforcement';
import { generate } from '@/lib/ai/generate';
import type { AIUseCase, AIGenerationContext } from '@/lib/ai/types';

// Valid use cases
const VALID_USE_CASES: AIUseCase[] = [
  'PROGRAM_CONTENT',
  'LANDING_PAGE_PROGRAM',
  'LANDING_PAGE_SQUAD',
  'LANDING_PAGE_WEBSITE',
];

export async function POST(request: NextRequest) {
  try {
    // Authenticate and verify AI helper access (Scale plan only)
    const { userId, orgId: organizationId } = await requireAIHelperAccess();
    
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
    
    // Check if we have alternative context sources (PDF or org content)
    const hasPdfContent = !!(context?.pdfContent && context.pdfContent.length > 0);
    const hasOrgContent = !!(context?.orgContent && (
      context.orgContent.programs?.length ||
      context.orgContent.squads?.length ||
      context.orgContent.program ||
      context.orgContent.squad
    ));
    const hasAlternativeContext = hasPdfContent || hasOrgContent;

    // Validate user prompt - allow empty if we have alternative context
    if (userPrompt && typeof userPrompt !== 'string') {
      return NextResponse.json(
        { error: 'userPrompt must be a string' },
        { status: 400 }
      );
    }

    const promptLength = (userPrompt || '').length;

    // Require either a prompt or alternative context
    if (promptLength < 10 && !hasAlternativeContext) {
      return NextResponse.json(
        { error: 'Please provide a prompt (at least 10 characters), upload a PDF, or use your existing content' },
        { status: 400 }
      );
    }

    if (promptLength > 5000) {
      return NextResponse.json(
        { error: 'userPrompt must be 5000 characters or less' },
        { status: 400 }
      );
    }

    // Use a default prompt if none provided but we have context
    const effectivePrompt = promptLength >= 10
      ? userPrompt
      : 'Generate content based on my existing programs and squads.';
    
    // Generate content
    const result = await generate({
      orgId: organizationId,
      userId,
      useCase,
      userPrompt: effectivePrompt,
      context,
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[AI_GENERATE] Error:', error);
    
    // Handle entitlement errors (plan limits/features)
    if (isEntitlementError(error)) {
      return NextResponse.json(
        { 
          error: error.message, 
          code: error.code,
          requiredPlan: error.requiredPlan,
        },
        { status: getEntitlementErrorStatus(error) }
      );
    }
    
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    // Handle specific error types
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (message.includes('No organization context')) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
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
    if (message.includes('Invalid program content') || message.includes('Invalid landing page') || message.includes('Invalid website content')) {
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






