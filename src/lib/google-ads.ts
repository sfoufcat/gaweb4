/**
 * Google Ads Conversion Tracking Utilities
 * 
 * Platform-level tracking for coach signups and trial subscriptions.
 * This is separate from org-specific GA4 tracking handled by GATracker component.
 */

// Google Ads Measurement ID
const GOOGLE_ADS_ID = 'AW-16653181105';

// Extend Window type to include gtag
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Check if gtag is available
 */
function isGtagAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/**
 * Track when a coach successfully subscribes to their trial
 * 
 * This conversion event fires after:
 * 1. Coach completes profile setup
 * 2. Selects a plan (Starter, Pro, or Scale)
 * 3. Enters payment details via Stripe
 * 4. Successfully subscribes to 7-day free trial
 * 
 * @param tier - The selected coach tier (starter, pro, scale)
 * @param billingPeriod - The billing period (monthly, yearly)
 */
export function trackCoachTrialConversion(
  tier?: 'starter' | 'pro' | 'scale',
  billingPeriod?: 'monthly' | 'yearly'
): void {
  if (!isGtagAvailable()) {
    console.log('[Google Ads] gtag not available, skipping conversion tracking');
    return;
  }

  try {
    // Fire the conversion event
    // Note: You'll need to set up the conversion action in Google Ads
    // and get the specific conversion label (e.g., 'AW-16653181105/xxxxx')
    // For now, we use a generic 'sign_up' event that Google Ads can track
    window.gtag!('event', 'conversion', {
      send_to: GOOGLE_ADS_ID,
      event_category: 'coach_signup',
      event_label: 'trial_subscription',
      // Include tier and billing info as custom parameters
      coach_tier: tier || 'unknown',
      billing_period: billingPeriod || 'unknown',
    });

    console.log('[Google Ads] Coach trial conversion tracked:', { tier, billingPeriod });
  } catch (error) {
    console.error('[Google Ads] Error tracking conversion:', error);
  }
}

/**
 * Track a custom Google Ads event
 * 
 * @param eventName - Name of the event
 * @param params - Additional parameters to include
 */
export function trackGoogleAdsEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (!isGtagAvailable()) {
    return;
  }

  try {
    window.gtag!('event', eventName, {
      send_to: GOOGLE_ADS_ID,
      ...params,
    });
  } catch (error) {
    console.error('[Google Ads] Error tracking event:', error);
  }
}



