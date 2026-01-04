import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { EmailPreferences } from '@/types';
import { DEFAULT_EMAIL_DEFAULTS } from '@/types';

/**
 * Get the effective email defaults for a user
 * Fallback chain: user's org defaults > global defaults
 */
async function getEffectiveDefaults(primaryOrganizationId?: string | null): Promise<EmailPreferences> {
  if (!primaryOrganizationId) {
    return DEFAULT_EMAIL_DEFAULTS;
  }

  try {
    // Fetch org's email defaults from org_branding collection
    const brandingDoc = await adminDb.collection('org_branding').doc(primaryOrganizationId).get();
    
    if (brandingDoc.exists && brandingDoc.data()?.emailDefaults) {
      return {
        ...DEFAULT_EMAIL_DEFAULTS,
        ...brandingDoc.data()?.emailDefaults,
      };
    }
  } catch (error) {
    console.error('[EMAIL_PREFERENCES] Error fetching org defaults:', error);
  }

  return DEFAULT_EMAIL_DEFAULTS;
}

/**
 * GET /api/user/email-preferences
 * Get current user's email notification preferences
 * 
 * Fallback chain: user's explicit prefs > org defaults > global defaults
 * 
 * IMPORTANT: If user doesn't have explicit preferences, this will SET the defaults
 * on the user document to ensure check-ins are enabled for all users.
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
      // Return global defaults if user doesn't exist yet
      return NextResponse.json({ emailPreferences: DEFAULT_EMAIL_DEFAULTS });
    }

    const userData = userDoc.data();
    
    // If user has explicit preferences, return them
    if (userData?.emailPreferences) {
      return NextResponse.json({ emailPreferences: userData.emailPreferences });
    }

    // Otherwise, get effective defaults (org defaults or global defaults)
    const effectiveDefaults = await getEffectiveDefaults(userData?.primaryOrganizationId);
    
    // IMPORTANT: Persist the defaults to the user document so check-ins work properly
    // This ensures existing users get the defaults applied
    try {
      await adminDb.collection('users').doc(userId).update({
        emailPreferences: effectiveDefaults,
        updatedAt: new Date().toISOString(),
      });
      console.log(`[EMAIL_PREFERENCES_GET] Set default email preferences for user ${userId}`);
    } catch (updateError) {
      // Log but don't fail the request
      console.error(`[EMAIL_PREFERENCES_GET] Failed to persist defaults for user ${userId}:`, updateError);
    }
    
    return NextResponse.json({ emailPreferences: effectiveDefaults });
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
      'coachingCall24h',
      'coachingCall1h',
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

    // Get current user document to determine fallback defaults
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Get current preferences or effective defaults
    let currentPreferences: EmailPreferences;
    if (userData?.emailPreferences) {
      currentPreferences = userData.emailPreferences;
    } else {
      currentPreferences = await getEffectiveDefaults(userData?.primaryOrganizationId);
    }

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
