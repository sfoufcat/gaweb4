import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import type { CoachTier, CoachSubscriptionStatus } from '@/types';

/**
 * GET /api/subscription/check-status
 *
 * Checks the current organization subscription status.
 * Used by the platform-deactivated page to check if subscription
 * has been reactivated without relying on cached session data.
 *
 * Returns:
 * - isActive: boolean - whether the subscription is currently active
 * - redirectTo: string | null - where to redirect if active
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({
        isActive: false,
        redirectTo: null,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    // Get tenant org ID from header (set by middleware)
    const headersList = await headers();
    const tenantOrgId = headersList.get('x-tenant-org-id');
    const organizationId = tenantOrgId || orgId;

    if (!organizationId) {
      return NextResponse.json({
        isActive: false,
        redirectTo: null,
        error: 'No organization context'
      });
    }

    // Fetch fresh subscription status from Clerk (bypasses session cache)
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();

    try {
      const org = await clerk.organizations.getOrganization({ organizationId });
      const orgMetadata = org.publicMetadata as {
        plan?: CoachTier;
        subscriptionStatus?: CoachSubscriptionStatus;
        currentPeriodEnd?: string;
        cancelAtPeriodEnd?: boolean;
        graceEndsAt?: string;
      } | undefined;

      const status = orgMetadata?.subscriptionStatus || 'none';
      const currentPeriodEnd = orgMetadata?.currentPeriodEnd;
      const cancelAtPeriodEnd = orgMetadata?.cancelAtPeriodEnd;
      const graceEndsAt = orgMetadata?.graceEndsAt;

      // Check if subscription is active (same logic as proxy.ts)
      const isActive = checkIsSubscriptionActive(status, currentPeriodEnd, cancelAtPeriodEnd, graceEndsAt);

      console.log(`[CHECK_STATUS] Org ${organizationId}: status=${status}, isActive=${isActive}`);

      return NextResponse.json({
        isActive,
        redirectTo: isActive ? '/' : null,
        status,
        plan: orgMetadata?.plan || 'starter',
      });
    } catch (clerkError) {
      console.error('[CHECK_STATUS] Clerk error:', clerkError);
      return NextResponse.json({
        isActive: false,
        redirectTo: null,
        error: 'Failed to fetch organization data'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[CHECK_STATUS] Error:', error);
    return NextResponse.json({
      isActive: false,
      redirectTo: null,
      error: 'Internal error'
    }, { status: 500 });
  }
}

/**
 * Check if org subscription is active (mirrors proxy.ts logic)
 */
function checkIsSubscriptionActive(
  status?: CoachSubscriptionStatus,
  currentPeriodEnd?: string,
  cancelAtPeriodEnd?: boolean,
  graceEndsAt?: string
): boolean {
  // Active or trialing = full access
  if (status === 'active' || status === 'trialing') {
    return true;
  }

  // Past due but within grace period = allow access with warning
  if (status === 'past_due' && graceEndsAt) {
    const graceEnd = new Date(graceEndsAt);
    const now = new Date();
    if (graceEnd > now) {
      return true;
    }
  }

  // Canceled but still in paid period
  if ((status === 'canceled' || cancelAtPeriodEnd) && currentPeriodEnd) {
    const endDate = new Date(currentPeriodEnd);
    const now = new Date();
    return endDate > now;
  }

  return false;
}
