import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { validateGoal } from '@/lib/anthropic';

export async function POST(req: Request) {
  try {
    // Get the goal, target date, and optional guest session from request body
    const { goal, targetDate, guestSessionId } = await req.json();

    // Check for authenticated user OR guest session
    const { userId } = await auth();
    
    // Allow if authenticated OR has valid guest session ID
    if (!userId && !guestSessionId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!goal || typeof goal !== 'string') {
      return NextResponse.json(
        { error: 'Goal is required' },
        { status: 400 }
      );
    }

    if (!targetDate || typeof targetDate !== 'string') {
      return NextResponse.json(
        { error: 'Target date is required' },
        { status: 400 }
      );
    }

    // Validate with Claude
    const validation = await validateGoal(goal.trim(), targetDate);

    return NextResponse.json(validation);
  } catch (error) {
    console.error('Error in goal validation API:', error);
    return NextResponse.json(
      { error: 'Failed to validate goal' },
      { status: 500 }
    );
  }
}








