import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { EmailPreferences } from '@/types';

// Default email preferences (all enabled by default)
const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  morningCheckIn: true,
  eveningCheckIn: true,
  weeklyReview: true,
  squadCall24h: true,
  squadCall1h: true,
};

/**
 * GET /api/user/email-preferences
 * Get current user's email notification preferences
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user document
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      // Return defaults if user doesn't exist yet
      return NextResponse.json({ emailPreferences: DEFAULT_EMAIL_PREFERENCES });
    }

    const userData = userDoc.data();
    const emailPreferences = userData?.emailPreferences || DEFAULT_EMAIL_PREFERENCES;

    return NextResponse.json({ emailPreferences });
  } catch (error) {
    console.error('[EMAIL_PREFERENCES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email preferences' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/email-preferences
 * Update user's email notification preferences
 * 
 * Body can contain any subset of EmailPreferences fields
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate that only valid keys are being set
    const validKeys: (keyof EmailPreferences)[] = [
      'morningCheckIn',
      'eveningCheckIn',
      'weeklyReview',
      'squadCall24h',
      'squadCall1h',
    ];

    const updates: Partial<EmailPreferences> = {};
    for (const key of validKeys) {
      if (typeof body[key] === 'boolean') {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid preferences provided' },
        { status: 400 }
      );
    }

    // Get current preferences and merge
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const currentPreferences = userDoc.exists 
      ? userDoc.data()?.emailPreferences || DEFAULT_EMAIL_PREFERENCES
      : DEFAULT_EMAIL_PREFERENCES;

    const newPreferences: EmailPreferences = {
      ...currentPreferences,
      ...updates,
    };

    // Update user document
    await adminDb.collection('users').doc(userId).set(
      {
        emailPreferences: newPreferences,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[EMAIL_PREFERENCES_PATCH] Updated preferences for user ${userId}:`, updates);

    return NextResponse.json({ 
      success: true,
      emailPreferences: newPreferences,
    });
  } catch (error) {
    console.error('[EMAIL_PREFERENCES_PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update email preferences' },
      { status: 500 }
    );
  }
}









