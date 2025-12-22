import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { ensureCoachHasOrganization } from '@/lib/clerk-organizations';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { OrgEmailDefaults, UserRole, ClerkPublicMetadata } from '@/types';
import { DEFAULT_EMAIL_DEFAULTS } from '@/types';

/**
 * GET /api/org/email-defaults
 * Fetches email notification defaults for an organization
 * 
 * Returns the org's configured email defaults, or global defaults if not set.
 * Requires authentication.
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID (domain-based in tenant mode, session-based in platform mode)
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      // No org, return global defaults
      return NextResponse.json({
        emailDefaults: DEFAULT_EMAIL_DEFAULTS,
        isDefault: true,
      });
    }

    // Fetch branding doc which contains emailDefaults
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();

    if (!brandingDoc.exists) {
      return NextResponse.json({
        emailDefaults: DEFAULT_EMAIL_DEFAULTS,
        isDefault: true,
      });
    }

    const brandingData = brandingDoc.data();
    const emailDefaults = brandingData?.emailDefaults || DEFAULT_EMAIL_DEFAULTS;

    return NextResponse.json({
      emailDefaults,
      isDefault: !brandingData?.emailDefaults,
    });
  } catch (error) {
    console.error('[ORG_EMAIL_DEFAULTS_GET] Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/org/email-defaults
 * Updates email notification defaults for the current user's organization
 * 
 * Only accessible by users who can access the coach dashboard (coach, admin, super_admin)
 * 
 * Body: Partial<OrgEmailDefaults> - fields to update
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
    const validKeys: (keyof OrgEmailDefaults)[] = [
      'morningCheckIn',
      'eveningCheckIn',
      'weeklyReview',
      'squadCall24h',
      'squadCall1h',
    ];

    const updates: Partial<OrgEmailDefaults> = {};
    for (const key of validKeys) {
      if (typeof body[key] === 'boolean') {
        updates[key] = body[key];
      }
    }

    // Get existing branding doc
    const brandingRef = adminDb.collection('org_branding').doc(organizationId);
    const existingDoc = await brandingRef.get();
    const now = new Date().toISOString();

    // Get existing email defaults or start with global defaults
    const existingEmailDefaults = existingDoc.exists 
      ? existingDoc.data()?.emailDefaults || DEFAULT_EMAIL_DEFAULTS
      : DEFAULT_EMAIL_DEFAULTS;

    // Merge updates into existing defaults
    const newEmailDefaults: OrgEmailDefaults = {
      ...existingEmailDefaults,
      ...updates,
    };

    // Save to Firestore (within org_branding document)
    await brandingRef.set(
      {
        organizationId,
        emailDefaults: newEmailDefaults,
        updatedAt: now,
        ...(existingDoc.exists ? {} : { createdAt: now }),
      },
      { merge: true }
    );

    console.log(`[ORG_EMAIL_DEFAULTS_POST] Updated email defaults for org ${organizationId}:`, updates);

    return NextResponse.json({
      success: true,
      emailDefaults: newEmailDefaults,
    });
  } catch (error) {
    console.error('[ORG_EMAIL_DEFAULTS_POST] Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

