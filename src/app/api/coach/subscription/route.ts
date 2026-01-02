import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { withDemoMode } from '@/lib/demo-api';
import type { CoachSubscription, OrgSettings, CoachTier } from '@/types';
import { TIER_PRICING, getLimit, getUsagePercent } from '@/lib/coach-permissions';

/**
 * GET /api/coach/subscription
 * Get the current coach's subscription status and usage
 * 
 * Handles legacy coaches who don't have org_settings yet by:
 * 1. Creating default org_settings if missing
 * 2. Defaulting to 'starter' tier
 * 3. Gracefully handling missing data
 */
export async function GET() {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('subscription');
    if (demoData) return demoData;
    
    const { organizationId } = await requireCoachWithOrg();

    // Get org settings to find subscription
    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    let settings = settingsDoc.data() as OrgSettings | undefined;

    // If org_settings doesn't exist, create it with defaults (for legacy coaches)
    if (!settingsDoc.exists || !settings) {
      console.log(`[COACH_SUBSCRIPTION] Creating default org_settings for org ${organizationId}`);
      
      const now = new Date().toISOString();
      const defaultSettings: OrgSettings = {
        id: organizationId,
        organizationId,
        billingMode: 'platform',
        allowExternalBilling: true,
        defaultTier: 'standard',
        defaultTrack: null,
        stripeConnectAccountId: null,
        stripeConnectStatus: 'not_connected',
        platformFeePercent: 1,
        requireApproval: false,
        autoJoinSquadId: null,
        welcomeMessage: null,
        coachTier: 'starter',
        coachSubscriptionId: null,
        defaultFunnelId: null,
        createdAt: now,
        updatedAt: now,
      };

      // Create the settings document
      await adminDb.collection('org_settings').doc(organizationId).set(defaultSettings);
      settings = defaultSettings;
      console.log(`[COACH_SUBSCRIPTION] Created default org_settings for org ${organizationId}`);
    }

    // Get subscription if exists
    let subscription: CoachSubscription | null = null;
    if (settings?.coachSubscriptionId) {
      try {
        const subscriptionDoc = await adminDb
          .collection('coach_subscriptions')
          .doc(settings.coachSubscriptionId)
          .get();
        
        if (subscriptionDoc.exists) {
          subscription = { id: subscriptionDoc.id, ...subscriptionDoc.data() } as CoachSubscription;
        }
      } catch (subError) {
        console.warn(`[COACH_SUBSCRIPTION] Failed to fetch subscription:`, subError);
        // Continue without subscription - will default to starter
      }
    }

    // Determine tier - default to starter if nothing set
    const tier: CoachTier = subscription?.tier || settings?.coachTier || 'starter';

    // Get current usage counts with error handling
    let clientsCount = 0;
    let programsCount = 0;
    let squadsCount = 0;

    try {
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
          .count()
          .get(),
      ]);

      clientsCount = clientsSnapshot.data().count;
      programsCount = programsSnapshot.data().count;
      squadsCount = squadsSnapshot.data().count;
    } catch (countError) {
      console.warn(`[COACH_SUBSCRIPTION] Failed to get usage counts:`, countError);
      // Continue with zeros - better than failing entirely
    }

    const usage = {
      clients: {
        current: clientsCount,
        limit: getLimit(tier, 'max_clients'),
        percent: getUsagePercent(tier, 'max_clients', clientsCount),
      },
      programs: {
        current: programsCount,
        limit: getLimit(tier, 'max_programs'),
        percent: getUsagePercent(tier, 'max_programs', programsCount),
      },
      squads: {
        current: squadsCount,
        limit: getLimit(tier, 'max_squads'),
        percent: getUsagePercent(tier, 'max_squads', squadsCount),
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
