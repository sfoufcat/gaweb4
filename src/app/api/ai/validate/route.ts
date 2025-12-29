/**
 * AI Validation API Route
 * 
 * POST /api/ai/validate
 * Validates a draft against the schema for a given use case.
 * 
 * Authorization: Coach/Admin only (org-scoped)
 * 
 * Request Body:
 * {
 *   useCase: 'PROGRAM_CONTENT' | 'LANDING_PAGE_PROGRAM' | 'LANDING_PAGE_SQUAD',
 *   draft: object
 * }
 * 
 * Response:
 * {
 *   valid: boolean,
 *   errors: [{ path: string, message: string }],
 *   warnings: [{ path: string, message: string }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { validateDraft } from '@/lib/ai/generate';
import type { AIUseCase } from '@/lib/ai/types';

// Valid use cases
const VALID_USE_CASES: AIUseCase[] = [
  'PROGRAM_CONTENT',
  'LANDING_PAGE_PROGRAM',
  'LANDING_PAGE_SQUAD',
];

export async function POST(request: NextRequest) {
  try {
    // Authenticate (ensure user is a coach)
    await requireCoachWithOrg();
    
    // Parse request body
    const body = await request.json();
    const { useCase, draft } = body as {
      useCase: AIUseCase;
      draft: unknown;
    };
    
    // Validate use case
    if (!useCase || !VALID_USE_CASES.includes(useCase)) {
      return NextResponse.json(
        { error: `Invalid useCase. Must be one of: ${VALID_USE_CASES.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate draft is present
    if (!draft || typeof draft !== 'object') {
      return NextResponse.json(
        { error: 'draft is required and must be an object' },
        { status: 400 }
      );
    }
    
    // Validate the draft
    const result = validateDraft(useCase, draft);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[AI_VALIDATE] Error:', error);
    
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json(
        { error: 'Forbidden: Coach access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    );
  }
}






