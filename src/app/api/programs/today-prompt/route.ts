/**
 * API: Get Today's Program Prompt
 * 
 * GET /api/programs/today-prompt
 * 
 * Returns the daily prompt for the user's current day in their active program enrollment.
 * Falls back to generic prompts if no active enrollment or no prompt defined.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { 
  getActiveEnrollment, 
  getProgramById,
  calculateCurrentDayIndex,
} from '@/lib/program-engine';

interface ProgramPrompt {
  title: string;
  description: string;
}

// Generic fallback prompts when user has no active program
const GENERIC_PROMPTS: ProgramPrompt[] = [
  {
    title: "Start Your Day with Purpose",
    description: "Take a moment to reflect on what you want to accomplish today. What's the one thing that will make today a success?",
  },
  {
    title: "Focus on Progress",
    description: "Small steps lead to big changes. What's one small action you can take today toward your goals?",
  },
  {
    title: "Embrace the Journey",
    description: "Every day is an opportunity to learn and grow. What will you explore today?",
  },
  {
    title: "Make It Count",
    description: "Time is your most valuable asset. How will you invest it wisely today?",
  },
  {
    title: "Build Momentum",
    description: "Consistency beats intensity. What daily habit are you strengthening today?",
  },
];

/**
 * Get a prompt index that cycles daily
 */
function getDailyPromptIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active enrollment
    const enrollment = await getActiveEnrollment(userId);

    if (!enrollment) {
      // Return a generic prompt for users without active enrollment
      const index = getDailyPromptIndex() % GENERIC_PROMPTS.length;
      return NextResponse.json({
        success: true,
        hasEnrollment: false,
        prompt: GENERIC_PROMPTS[index],
        programName: null,
        currentDay: null,
      });
    }

    // Get program details
    const program = await getProgramById(enrollment.programId);
    if (!program) {
      const index = getDailyPromptIndex() % GENERIC_PROMPTS.length;
      return NextResponse.json({
        success: true,
        hasEnrollment: true,
        prompt: GENERIC_PROMPTS[index],
        programName: null,
        currentDay: null,
        error: 'Program not found',
      });
    }

    // Calculate current day
    const today = new Date().toISOString().split('T')[0];
    const currentDayIndex = calculateCurrentDayIndex(enrollment.startedAt, program.lengthDays, today);

    // Fetch the program day for current day
    const daySnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', program.id)
      .where('dayIndex', '==', currentDayIndex)
      .limit(1)
      .get();

    let prompt: ProgramPrompt | null = null;

    if (!daySnapshot.empty) {
      const dayData = daySnapshot.docs[0].data();
      if (dayData.dailyPrompt) {
        prompt = {
          title: dayData.title || `Day ${currentDayIndex}`,
          description: dayData.dailyPrompt,
        };
      }
    }

    // Fallback to generic prompt if no day-specific prompt
    if (!prompt) {
      const index = getDailyPromptIndex() % GENERIC_PROMPTS.length;
      prompt = GENERIC_PROMPTS[index];
    }

    return NextResponse.json({
      success: true,
      hasEnrollment: true,
      prompt,
      programName: program.name,
      currentDay: currentDayIndex,
      totalDays: program.lengthDays,
    });
  } catch (error) {
    console.error('[API_PROGRAMS_TODAY_PROMPT_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

