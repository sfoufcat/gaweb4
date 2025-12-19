import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  getFullAlignmentState, 
  updateAlignmentForToday, 
  initializeAlignmentForToday,
  getTodayDate 
} from '@/lib/alignment';
import type { AlignmentUpdatePayload } from '@/types';

/**
 * GET /api/alignment
 * 
 * Fetches the current user's alignment state for today.
 * If no alignment exists for today, it will be initialized.
 * 
 * Query params:
 * - date: Optional date in YYYY-MM-DD format (defaults to today)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getTodayDate();

    // If requesting today's alignment, ensure it's initialized
    const today = getTodayDate();
    if (date === today) {
      await initializeAlignmentForToday(userId);
    }

    const { alignment, summary } = await getFullAlignmentState(userId, date);

    return NextResponse.json({
      success: true,
      alignment,
      summary,
    });
  } catch (error: any) {
    console.error('[ALIGNMENT_GET_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch alignment' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alignment
 * 
 * Updates the current user's alignment for today.
 * 
 * Body:
 * - didMorningCheckin?: boolean
 * - didSetTasks?: boolean
 * - didInteractWithSquad?: boolean
 * - hasActiveGoal?: boolean (usually computed automatically)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate and extract allowed update fields
    const updates: AlignmentUpdatePayload = {};
    
    if (typeof body.didMorningCheckin === 'boolean') {
      updates.didMorningCheckin = body.didMorningCheckin;
    }
    if (typeof body.didSetTasks === 'boolean') {
      updates.didSetTasks = body.didSetTasks;
    }
    if (typeof body.didInteractWithSquad === 'boolean') {
      updates.didInteractWithSquad = body.didInteractWithSquad;
    }
    if (typeof body.hasActiveGoal === 'boolean') {
      updates.hasActiveGoal = body.hasActiveGoal;
    }

    const alignment = await updateAlignmentForToday(userId, updates);
    
    if (!alignment) {
      return NextResponse.json(
        { error: 'Failed to update alignment' },
        { status: 500 }
      );
    }

    // Also fetch the summary to return complete state
    const { summary } = await getFullAlignmentState(userId);

    return NextResponse.json({
      success: true,
      alignment,
      summary,
    });
  } catch (error: any) {
    console.error('[ALIGNMENT_POST_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update alignment' },
      { status: 500 }
    );
  }
}

