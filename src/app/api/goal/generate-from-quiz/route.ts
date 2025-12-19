/**
 * API: Generate Goal from Quiz Option
 * 
 * POST /api/goal/generate-from-quiz
 * 
 * Takes a quiz option label and generates a concise 3-word goal using AI.
 * This is called during the onboarding quiz to set the user's 90-day goal.
 */

import { NextResponse } from 'next/server';
import { generateQuizGoal } from '@/lib/anthropic';

export async function POST(req: Request) {
  try {
    const { optionLabel } = await req.json();

    if (!optionLabel || typeof optionLabel !== 'string') {
      return NextResponse.json(
        { error: 'optionLabel is required' },
        { status: 400 }
      );
    }

    const result = await generateQuizGoal(optionLabel);
    
    return NextResponse.json({
      goal: result.goal,
      error: result.error,
    });
  } catch (error) {
    console.error('[Generate Quiz Goal] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate goal', goal: 'Grow my audience' },
      { status: 500 }
    );
  }
}

