import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
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
 * GET /api/weekly-focus/suggestion
 * 
 * Fetches the track's weekly focus suggestion for the current week.
 * Used in the weekly check-in flow to suggest a focus.
 * 
 * Response:
 * - suggestion: string | null - The suggested focus text from CMS
 * - currentWeek: number | null - Current week number (1-4)
 * - trackName: string | null - The user's track display name
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
        suggestion: null,
        currentWeek: null,
        trackName: null,
      });
    }

    const userData = userDoc.data() as FirebaseUser;
    const userTrack = userData.track;
    
    if (!userTrack) {
      return NextResponse.json({
        suggestion: null,
        currentWeek: null,
        trackName: null,
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
        suggestion: null,
        currentWeek,
        trackName: null,
      });
    }

    const trackData = trackSnapshot.docs[0].data();
    const trackName = trackData.name as string | undefined;
    const weeklyFocusDefaults = trackData.weeklyFocusDefaults as WeeklyFocusDefaults | undefined;

    if (!weeklyFocusDefaults || !weeklyFocusDefaults[currentWeek]) {
      return NextResponse.json({
        suggestion: null,
        currentWeek,
        trackName: trackName || null,
      });
    }

    // Return the suggestion for current week
    return NextResponse.json({
      suggestion: weeklyFocusDefaults[currentWeek],
      currentWeek,
      trackName: trackName || null,
    });

  } catch (error: any) {
    console.error('Error fetching weekly focus suggestion:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch weekly focus suggestion' },
      { status: 500 }
    );
  }
}

