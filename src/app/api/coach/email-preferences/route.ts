import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import type { CoachEmailPreferences } from '@/types';
import { DEFAULT_COACH_EMAIL_PREFERENCES } from '@/types';

/**
 * GET /api/coach/email-preferences
 * Get email preferences for the coach's organization
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    
    if (!settingsDoc.exists) {
      return NextResponse.json({ emailPreferences: DEFAULT_COACH_EMAIL_PREFERENCES });
    }

    const settings = settingsDoc.data();
    
    // Merge with defaults to ensure all fields exist
    const emailPreferences: CoachEmailPreferences = {
      ...DEFAULT_COACH_EMAIL_PREFERENCES,
      ...settings?.emailPreferences,
      // Always force these to true - they cannot be disabled
      verificationEnabled: true,
      paymentFailedEnabled: true,
    };
    
    return NextResponse.json({ emailPreferences });
  } catch (error) {
    console.error('[EMAIL_PREFERENCES_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch email preferences';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/coach/email-preferences
 * Update email preferences for the coach's organization
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    
    // Validate that only allowed preferences are being updated
    const allowedKeys: (keyof CoachEmailPreferences)[] = [
      'welcomeEnabled',
      'abandonedCartEnabled',
      'morningReminderEnabled',
      'eveningReminderEnabled',
      'weeklyReminderEnabled',
      // Call Scheduling
      'callRequestReceivedEnabled',
      'callConfirmedEnabled',
      'callDeclinedEnabled',
      'callCounterProposedEnabled',
      'callRescheduledEnabled',
      'callCancelledEnabled',
    ];
    
    const updates: Partial<Record<string, boolean>> = {};
    
    for (const key of allowedKeys) {
      if (key in body && typeof body[key] === 'boolean') {
        updates[key] = body[key];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid preferences provided' },
        { status: 400 }
      );
    }

    // Get existing preferences
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);
    const settingsDoc = await settingsRef.get();
    const existingSettings = settingsDoc.data() || {};
    
    // Merge with existing preferences
    const newPreferences: CoachEmailPreferences = {
      ...DEFAULT_COACH_EMAIL_PREFERENCES,
      ...existingSettings.emailPreferences,
      ...updates,
      // Always force these to true - they cannot be disabled
      verificationEnabled: true,
      paymentFailedEnabled: true,
    };

    // Update org settings
    await settingsRef.set(
      { 
        emailPreferences: newPreferences,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[EMAIL_PREFERENCES_POST] Updated for org ${organizationId}:`, updates);

    return NextResponse.json({
      success: true,
      emailPreferences: newPreferences,
    });
  } catch (error) {
    console.error('[EMAIL_PREFERENCES_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update email preferences';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

