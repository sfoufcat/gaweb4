import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { CoachSubscription, OrgSettings } from '@/types';
import { TIER_PRICING, getLimit, getUsagePercent } from '@/lib/coach-permissions';

/**
 * GET /api/coach/subscription
 * Get the current coach's subscription status and usage
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Get org settings to find subscription
    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const settings = settingsDoc.data() as OrgSettings | undefined;

    // Get subscription if exists
    let subscription: CoachSubscription | null = null;
    if (settings?.coachSubscriptionId) {
      const subscriptionDoc = await adminDb
        .collection('coach_subscriptions')
        .doc(settings.coachSubscriptionId)
        .get();
      
      if (subscriptionDoc.exists) {
        subscription = { id: subscriptionDoc.id, ...subscriptionDoc.data() } as CoachSubscription;
      }
    }

    // If no subscription, return default starter tier info
    const tier = subscription?.tier || settings?.coachTier || 'starter';

    // Get current usage counts
    const [clientsSnapshot, programsSnapshot, squadsSnapshot] = await Promise.all([
      adminDb.collection('org_memberships')
        .where('organizationId', '==', organizationId)
        .where('orgRole', '==', 'member')
        .where('isActive', '==', true)
        .count()
        .get(),
      adminDb.collection('programs')
        .where('organizationId', '==', organizationId)
        .where('isActive', '==', true)
        .count()
        .get(),
      adminDb.collection('squads')
        .where('organizationId', '==', organizationId)
        .where('isActive', '!=', false)
        .count()
        .get(),
    ]);

    const usage = {
      clients: {
        current: clientsSnapshot.data().count,
        limit: getLimit(tier, 'max_clients'),
        percent: getUsagePercent(tier, 'max_clients', clientsSnapshot.data().count),
      },
      programs: {
        current: programsSnapshot.data().count,
        limit: getLimit(tier, 'max_programs'),
        percent: getUsagePercent(tier, 'max_programs', programsSnapshot.data().count),
      },
      squads: {
        current: squadsSnapshot.data().count,
        limit: getLimit(tier, 'max_squads'),
        percent: getUsagePercent(tier, 'max_squads', squadsSnapshot.data().count),
      },
    };

    return NextResponse.json({
      subscription,
      tier,
      tierInfo: TIER_PRICING[tier],
      usage,
      hasActiveSubscription: subscription?.status === 'active' || subscription?.status === 'trialing',
    });
  } catch (error) {
    console.error('[COACH_SUBSCRIPTION_GET]', error);
    const message = error instanceof Error ? error.message : 'Failed to get subscription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

