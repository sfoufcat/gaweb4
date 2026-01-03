import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { summarizeWeeklyFocus } from '@/lib/anthropic';
import { isDemoRequest } from '@/lib/demo-api';
import type { FirebaseUser } from '@/types';

/**
 * GET /api/weekly-focus
 * 
 * Fetches the user's weekly focus with fallback to track defaults.
 * 
 * Logic:
 * 1. Check user's publicFocus field (set via weekly check-in)
 * 2. If empty, look up track's weeklyFocusDefaults
 * 3. Return default for current week if available
 * 
 * Response:
 * - weeklyFocus: string | null - The full focus text
 * - weeklyFocusSummary: string | null - AI-generated 2-5 word summary for display
 * - currentWeek: number | null - Current week number (1-4)
 * - isAutoInitialized: boolean - Whether focus came from track defaults
 */
export async function GET() {
  try {
    // Check for demo mode
    if (await isDemoRequest()) {
      return NextResponse.json({
        weeklyFocus: 'Complete my morning routine every day and exercise at least 4 times this week',
        weeklyFocusSummary: 'Morning routine & exercise',
        currentWeek: 3,
        isAutoInitialized: false,
      });
    }
    
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user data
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ 
        weeklyFocus: null,
        weeklyFocusSummary: null,
        currentWeek: null,
        isAutoInitialized: false,
      });
    }

    const userData = userDoc.data() as FirebaseUser;
    
    // If user has set their own focus, return it with summary
    if (userData.publicFocus && userData.publicFocus.trim()) {
      let summary = userData.publicFocusSummary;
      
      // If summary is missing, generate it on-demand and save it
      if (!summary || summary === userData.publicFocus) {
        try {
          const { summary: generatedSummary } = await summarizeWeeklyFocus(userData.publicFocus);
          summary = generatedSummary;
          
          // Save the generated summary back to the database
          await userRef.update({
            publicFocusSummary: summary,
          });
          console.log(`[Weekly Focus] Generated and saved summary for user ${userId}: "${summary}"`);
        } catch (error) {
          console.error('[Weekly Focus] Failed to generate summary:', error);
          // Fall back to full text if generation fails
          summary = userData.publicFocus;
        }
      }
      
      return NextResponse.json({
        weeklyFocus: userData.publicFocus,
        weeklyFocusSummary: summary,
        currentWeek: null,
        isAutoInitialized: false,
      });
    }

    // No focus set - tracks deprecated, so no track-based defaults
    // Weekly focus must be set manually by the user
    return NextResponse.json({
      weeklyFocus: null,
      weeklyFocusSummary: null,
      currentWeek: null,
      isAutoInitialized: false,
    });

  } catch (error) {
    console.error('Error fetching weekly focus:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch weekly focus';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}


