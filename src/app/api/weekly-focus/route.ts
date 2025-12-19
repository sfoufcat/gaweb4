import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { summarizeWeeklyFocus } from '@/lib/anthropic';
import type { FirebaseUser, WeeklyFocusDefaults } from '@/types';

/**
 * Calculate the current week number based on program enrollment or account creation
 * Week number is 1-based (week 1, week 2, etc.)
 * Cycles through weeks 1-4 and repeats
 */
function calculateCurrentWeek(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1;
  // Cycle through weeks 1-4 (mod 4, but 1-indexed)
  return ((weekNumber - 1) % 4) + 1;
}

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

    // If no focus set, try to get track default
    const userTrack = userData.track;
    
    if (!userTrack) {
      return NextResponse.json({
        weeklyFocus: null,
        weeklyFocusSummary: null,
        currentWeek: null,
        isAutoInitialized: false,
      });
    }

    // Determine reference date for week calculation
    // Priority: Program enrollment start date > Account creation date
    let referenceDate = userData.createdAt;

    // Check if user has an active program enrollment
    const enrollmentSnapshot = await adminDb
      .collection('starter_program_enrollments')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!enrollmentSnapshot.empty) {
      const enrollment = enrollmentSnapshot.docs[0].data();
      if (enrollment.startedAt) {
        referenceDate = enrollment.startedAt;
      }
    }

    // Calculate current week
    const currentWeek = referenceDate ? calculateCurrentWeek(referenceDate) : 1;

    // Fetch track's weekly focus defaults
    const trackSnapshot = await adminDb
      .collection('tracks')
      .where('slug', '==', userTrack)
      .limit(1)
      .get();

    if (trackSnapshot.empty) {
      return NextResponse.json({
        weeklyFocus: null,
        weeklyFocusSummary: null,
        currentWeek,
        isAutoInitialized: false,
      });
    }

    const trackData = trackSnapshot.docs[0].data();
    const weeklyFocusDefaults = trackData.weeklyFocusDefaults as WeeklyFocusDefaults | undefined;

    if (!weeklyFocusDefaults || !weeklyFocusDefaults[currentWeek]) {
      return NextResponse.json({
        weeklyFocus: null,
        weeklyFocusSummary: null,
        currentWeek,
        isAutoInitialized: false,
      });
    }

    // Return the default focus for current week
    // For track defaults, use the full text as summary (they're typically short already)
    const defaultFocus = weeklyFocusDefaults[currentWeek];
    
    return NextResponse.json({
      weeklyFocus: defaultFocus,
      weeklyFocusSummary: defaultFocus,
      currentWeek,
      isAutoInitialized: true,
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


