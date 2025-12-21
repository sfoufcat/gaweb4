import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/weekly-focus/suggestion
 * 
 * Previously fetched track-based weekly focus suggestions.
 * Now returns null since tracks are deprecated.
 * Weekly focus should be set manually by users.
 * 
 * Response:
 * - suggestion: null - Track suggestions deprecated
 * - currentWeek: null
 * - trackName: null
 */
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Tracks deprecated - no more track-based suggestions
    // Weekly focus should be set manually by the user
    return NextResponse.json({
      suggestion: null,
      currentWeek: null,
      trackName: null,
    });

  } catch (error) {
    console.error('Error fetching weekly focus suggestion:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch weekly focus suggestion';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
