/**
 * API: Generate Starting Point Summary from Quiz Option
 * 
 * POST /api/goal/generate-starting-point
 * 
 * Takes a quiz option label and generates a concise 1-2 word starting point summary using AI.
 * This is called during the onboarding quiz to set the user's starting point for the transformation graph.
 */

import { NextResponse } from 'next/server';
import { generateStartingPointSummary } from '@/lib/anthropic';

// Static fallback mappings for known starting point options
// These match the options in the content-creator quiz
const STARTING_POINT_PATTERNS: { pattern: RegExp; summary: string }[] = [
  // Content creator quiz options
  { pattern: /haven't.*started|just\s*curious|not\s*started/i, summary: 'Just Starting' },
  { pattern: /post.*occasional|audience.*small|occasional/i, summary: 'Early Stage' },
  { pattern: /post.*consist|growth.*slow|slow/i, summary: 'Slow Growth' },
  { pattern: /solid\s*audience|want.*scale|scaling|already.*audience/i, summary: 'Ready to Scale' },
  
  // General business stages
  { pattern: /idea|planning|thinking/i, summary: 'Idea Stage' },
  { pattern: /launch|new|beginning|start/i, summary: 'Just Starting' },
  { pattern: /build|growing|momentum/i, summary: 'Building' },
  { pattern: /establish|steady|consistent/i, summary: 'Established' },
  { pattern: /scale|expand|grow.*fast/i, summary: 'Scaling' },
];

/**
 * Extract starting point summary using pattern matching
 */
function extractStartingPointFromPatterns(optionLabel: string): string | null {
  for (const { pattern, summary } of STARTING_POINT_PATTERNS) {
    if (pattern.test(optionLabel)) {
      return summary;
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { optionLabel } = await req.json();

    console.log('[Generate Starting Point] Input:', optionLabel);

    if (!optionLabel || typeof optionLabel !== 'string') {
      return NextResponse.json(
        { error: 'optionLabel is required', summary: 'Starting Point' },
        { status: 400 }
      );
    }

    // First, try static pattern matching (fast and reliable)
    const patternMatch = extractStartingPointFromPatterns(optionLabel);
    if (patternMatch) {
      console.log('[Generate Starting Point] Pattern match:', patternMatch);
      return NextResponse.json({
        summary: patternMatch,
      });
    }

    // If no pattern match, try AI
    const result = await generateStartingPointSummary(optionLabel);
    
    // Validate AI result - if it's just "Starting Point" or empty, try harder
    if (!result.summary || result.summary === 'Starting Point') {
      // Final fallback - extract key words from the label
      const cleanLabel = optionLabel.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
      const words = cleanLabel.split(/\s+/);
      if (words.length >= 2) {
        // Try to extract a meaningful 2-word phrase
        const summary = words.slice(0, 2).join(' ');
        console.log('[Generate Starting Point] Fallback extraction:', summary);
        return NextResponse.json({ summary });
      }
    }

    console.log('[Generate Starting Point] AI result:', result.summary);
    
    return NextResponse.json({
      summary: result.summary,
      error: result.error,
    });
  } catch (error) {
    console.error('[Generate Starting Point] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate starting point summary', summary: 'Starting Point' },
      { status: 500 }
    );
  }
}
