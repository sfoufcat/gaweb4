import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { ensureCoachHasOrganization } from '@/lib/clerk-organizations';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { OrgSystemNotifications, UserRole } from '@/types';
import { DEFAULT_SYSTEM_NOTIFICATIONS } from '@/types';

/**
 * GET /api/org/system-notifications
 * Fetches system notification settings for an organization
 * 
 * System notifications control whether in-app notifications are sent at all.
 * If disabled, both in-app notification AND email are blocked for that type.
 * 
 * Returns the org's configured settings, or global defaults if not set.
 * Requires authentication.
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();

    if (!organizationId) {
      // No org, return global defaults
      return NextResponse.json({
        systemNotifications: DEFAULT_SYSTEM_NOTIFICATIONS,
        isDefault: true,
      });
    }

    // Fetch branding doc which contains systemNotifications
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();

    if (!brandingDoc.exists) {
      return NextResponse.json({
        systemNotifications: DEFAULT_SYSTEM_NOTIFICATIONS,
        isDefault: true,
      });
    }

    const brandingData = brandingDoc.data();
    const systemNotifications = brandingData?.systemNotifications || DEFAULT_SYSTEM_NOTIFICATIONS;

    return NextResponse.json({
      systemNotifications,
      isDefault: !brandingData?.systemNotifications,
    });
  } catch (error) {
    console.error('[ORG_SYSTEM_NOTIFICATIONS_GET] Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/org/system-notifications
 * Updates system notification settings for the current user's organization
 * 
 * Only accessible by users who can access the coach dashboard (coach, admin, super_admin)
 * 
 * When a system notification is disabled:
 * - In-app notifications of that type are not created
 * - Emails of that type are not sent (regardless of email defaults)
 * 
 * Body: Partial<OrgSystemNotifications> - fields to update
 */
export async function POST(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has coach/admin access
    const publicMetadata = sessionClaims?.publicMetadata as { role?: UserRole } | undefined;
    const role = publicMetadata?.role;

    if (!canAccessCoachDashboard(role)) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    // Ensure user has an organization
    const organizationId = await ensureCoachHasOrganization(userId);

    // Parse request body
    const body = await request.json();

    // Validate that only valid keys are being set
    const validKeys: (keyof OrgSystemNotifications)[] = [
      'morningCheckIn',
      'eveningCheckIn',
      'weeklyReview',
      'squadCall24h',
      'squadCall1h',
    ];

    const updates: Partial<Record<string, boolean>> = {};
    for (const key of validKeys) {
      if (typeof body[key] === 'boolean') {
        updates[key] = body[key];
      }
    }

    // Get existing branding doc
    const brandingRef = adminDb.collection('org_branding').doc(organizationId);
    const existingDoc = await brandingRef.get();
    const now = new Date().toISOString();

    // Get existing system notifications or start with global defaults
    const existingSystemNotifications = existingDoc.exists 
      ? existingDoc.data()?.systemNotifications || DEFAULT_SYSTEM_NOTIFICATIONS
      : DEFAULT_SYSTEM_NOTIFICATIONS;

    // Merge updates into existing settings
    const newSystemNotifications: OrgSystemNotifications = {
      ...existingSystemNotifications,
      ...updates,
    };

    // Save to Firestore (within org_branding document)
    await brandingRef.set(
      {
        organizationId,
        systemNotifications: newSystemNotifications,
        updatedAt: now,
        ...(existingDoc.exists ? {} : { createdAt: now }),
      },
      { merge: true }
    );

    console.log(`[ORG_SYSTEM_NOTIFICATIONS_POST] Updated system notifications for org ${organizationId}:`, updates);

    return NextResponse.json({
      success: true,
      systemNotifications: newSystemNotifications,
    });
  } catch (error) {
    console.error('[ORG_SYSTEM_NOTIFICATIONS_POST] Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

