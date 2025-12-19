import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Static mapping for growth stage labels
const GROWTH_STAGE_LABELS: Record<string, string> = {
  'just_starting': 'Just Starting',
  'building_momentum': 'Building Momentum',
  'growing_steadily': 'Growing Steadily',
  'leveling_up': 'Leveling Up',
  'reinventing': 'Reinventing',
};

// Static fallback mappings for common goal patterns
// These are used if AI fails or returns an invalid summary
const GOAL_SUMMARY_PATTERNS: { pattern: RegExp; summary: string }[] = [
  // Follower growth goals
  { pattern: /first\s*1k|1k\s*true|1,?000\s*follow/i, summary: '1k Followers' },
  { pattern: /2[–-]?5k|grow.*2.*5/i, summary: '5k Followers' },
  { pattern: /10k|\+10|10,?000/i, summary: '10k+ Followers' },
  { pattern: /grow.*follow|follower.*growth|more\s*follow/i, summary: 'Follower Growth' },
  
  // Engagement goals
  { pattern: /engagement|leads|community/i, summary: 'Engagement' },
  
  // Monetization goals
  { pattern: /monetiz|money|revenue|income|mrr/i, summary: 'Revenue' },
  { pattern: /sell|offer|product|course/i, summary: 'Monetization' },
  
  // Content goals
  { pattern: /consist|post.*regular|content.*schedul/i, summary: 'Consistency' },
  { pattern: /viral|reach|discover/i, summary: 'Reach' },
  { pattern: /brand|personal\s*brand/i, summary: 'Brand Growth' },
  
  // Audience goals
  { pattern: /audience|subscriber/i, summary: 'Audience Growth' },
];

/**
 * Extract a goal summary from the goal text using pattern matching
 */
function extractGoalSummaryFromPatterns(goal: string): string | null {
  for (const { pattern, summary } of GOAL_SUMMARY_PATTERNS) {
    if (pattern.test(goal)) {
      return summary;
    }
  }
  return null;
}

export async function POST(req: Request) {
  // Default values - guaranteed to return something
  let goalSummary = 'Your Goal';
  let stageSummary = 'Starting Point';

  try {
    const body = await req.json();
    const { goal, businessStage } = body;

    console.log('[Goal Summary] Input:', { goal, businessStage });

    // Static growth stage mapping (instant)
    if (businessStage && GROWTH_STAGE_LABELS[businessStage]) {
      stageSummary = GROWTH_STAGE_LABELS[businessStage];
    }

    // First, try static pattern matching (fast and reliable)
    if (goal) {
      const patternMatch = extractGoalSummaryFromPatterns(goal);
      if (patternMatch) {
        goalSummary = patternMatch;
        console.log('[Goal Summary] Pattern match:', goalSummary);
      }
    }

    // If no pattern match, try AI-generated summary
    if (goal && goalSummary === 'Your Goal' && process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 50,
          messages: [{
            role: 'user',
            content: `Generate a SHORT 1-3 word NOUN-BASED summary label for this goal. 

CRITICAL RULES:
- Return a NOUN or NOUN PHRASE only (e.g., "1k Followers", "Revenue Growth", "App Launch")
- Do NOT start with verbs like "Grow", "Get", "Reach", "Build"
- Focus on the TARGET or OUTCOME, not the action
- Keep it under 3 words

Examples:
- "Grow by 1k true followers" → "1k Followers"
- "Get my first 1k true followers" → "1k Followers"
- "Grow by +2-5k followers" → "5k Followers"
- "Reach $50k MRR" → "$50k MRR"
- "Launch my app" → "App Launch"
- "Build my personal brand" → "Brand Growth"
- "Increase engagement" → "Engagement"

Goal: "${goal}"

Return ONLY the summary (1-3 words, noun-based), no quotes or explanation:`,
          }],
        });

        const content = message.content[0];
        if (content.type === 'text') {
          const summary = content.text.trim().replace(/["']/g, '');
          
          // Validate the summary - reject if it starts with common verbs
          const startsWithVerb = /^(grow|get|reach|build|launch|increase|make|create|start|achieve)/i.test(summary);
          
          if (!startsWithVerb && summary.length > 0 && summary.length <= 30) {
            // Accept the summary if it's reasonable
            goalSummary = summary;
            console.log('[Goal Summary] AI generated:', goalSummary);
          } else if (summary) {
            // Try to extract the noun part after the verb
            const nounMatch = summary.match(/(?:grow|get|reach|build|launch|increase|make|create|start|achieve)\s+(?:to\s+|by\s+)?(.+)/i);
            if (nounMatch && nounMatch[1]) {
              goalSummary = nounMatch[1].trim();
              console.log('[Goal Summary] AI extracted noun:', goalSummary);
            }
          }
        }
      } catch (aiError) {
        console.error('[Goal Summary AI Error]', aiError);
        // Keep pattern match or default goalSummary
      }
    }

    console.log('[Goal Summary] Final result:', { goalSummary, stageSummary });
  } catch (parseError) {
    console.error('[Summary API Parse Error]', parseError);
  }

  // Always return something
  return NextResponse.json({ goalSummary, stageSummary });
}
