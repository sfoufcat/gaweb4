'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Layers, 
  UsersRound, 
  Filter,
  ArrowUpRight,
  Check,
  AlertTriangle,
  Zap,
  Globe,
  Mail,
  CreditCard,
  ExternalLink,
  X,
  Shield
} from 'lucide-react';
import type { CoachTier, CoachSubscription } from '@/types';
import { 
  TIER_PRICING, 
  hasPermission,
  formatLimitValue,
} from '@/lib/coach-permissions';

// =============================================================================
// TYPES
// =============================================================================

interface UsageData {
  current: number;
  limit: number;
  percent: number;
}

interface SubscriptionData {
  subscription: CoachSubscription | null;
  tier: CoachTier;
  tierInfo: typeof TIER_PRICING[CoachTier];
  usage: {
    clients: UsageData;
    programs: UsageData;
    squads: UsageData;
  };
  hasActiveSubscription: boolean;
}

// =============================================================================
// USAGE METER COMPONENT
// =============================================================================

function UsageMeter({ 
  label, 
  icon: Icon, 
  current, 
  limit, 
  percent 
}: { 
  label: string;
  icon: React.ElementType;
  current: number;
  limit: number;
  percent: number;
}) {
  const isUnlimited = limit === -1;
  const isWarning = percent >= 80 && percent < 100;
  const isAtLimit = percent >= 100;

  return (
    <div className="bg-white dark:bg-[#171b22] rounded-xl p-4 border border-[#e1ddd8] dark:border-[#262b35]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isAtLimit 
              ? 'bg-red-100 dark:bg-red-900/20' 
              : isWarning 
                ? 'bg-amber-100 dark:bg-amber-900/20'
                : 'bg-[#faf8f6] dark:bg-[#262b35]'
          }`}>
            <Icon className={`w-4 h-4 ${
              isAtLimit 
                ? 'text-red-600 dark:text-red-400' 
                : isWarning
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-brand-accent'
            }`} />
          </div>
          <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
            {label}
          </span>
        </div>
        <div className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8]">
          {current} / {isUnlimited ? '∞' : limit}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-[#f5f2ed] dark:bg-[#262b35] rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            isAtLimit 
              ? 'bg-red-500' 
              : isWarning
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-brand-accent to-[#c9a07a]'
          }`}
          style={{ width: `${isUnlimited ? 0 : Math.min(100, percent)}%` }}
        />
      </div>

      {/* Warning Message */}
      {isAtLimit && (
        <div className="mt-2 flex items-center gap-1.5 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="font-sans text-[12px]">Limit reached</span>
        </div>
      )}
      {isWarning && !isAtLimit && (
        <div className="mt-2 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="font-sans text-[12px]">Approaching limit</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FEATURE STATUS COMPONENT
// =============================================================================

function FeatureStatus({ 
  label, 
  enabled, 
  icon: Icon,
  tier,
  requiredTier 
}: { 
  label: string;
  enabled: boolean;
  icon: React.ElementType;
  tier: CoachTier;
  requiredTier: CoachTier;
}) {
  const needsUpgrade = !enabled;

  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-xl ${
      enabled 
        ? 'bg-[#f0fdf4] dark:bg-[#052e16]/30 border border-[#bbf7d0] dark:border-[#166534]/50'
        : 'bg-[#fafafa] dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35]'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          enabled
            ? 'bg-[#dcfce7] dark:bg-[#166534]/30'
            : 'bg-[#f5f2ed] dark:bg-[#262b35]'
        }`}>
          <Icon className={`w-4 h-4 ${
            enabled
              ? 'text-[#22c55e]'
              : 'text-[#9ca3af] dark:text-[#6b7280]'
          }`} />
        </div>
        <span className={`font-sans text-[14px] ${
          enabled
            ? 'text-[#166534] dark:text-[#4ade80]'
            : 'text-text-secondary dark:text-[#b2b6c2]'
        }`}>
          {label}
        </span>
      </div>
      {enabled ? (
        <div className="flex items-center gap-1.5 text-[#22c55e]">
          <Check className="w-4 h-4" />
          <span className="font-sans text-[12px] font-medium">Active</span>
        </div>
      ) : (
        <span className="font-sans text-[12px] text-text-tertiary dark:text-[#6b7280]">
          {TIER_PRICING[requiredTier].name}+
        </span>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CoachPlanTab() {
  const router = useRouter();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [showManualBillingModal, setShowManualBillingModal] = useState(false);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/coach/subscription');
        if (!response.ok) {
          throw new Error('Failed to fetch subscription');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscription');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  const handleManageSubscription = async () => {
    // If manual billing (admin-assigned tier), show info modal instead of Stripe portal
    if (data?.subscription?.manualBilling) {
      setShowManualBillingModal(true);
      return;
    }
    
    // Otherwise, open Stripe portal in new tab
    setIsPortalLoading(true);
    try {
      const response = await fetch('/api/coach/subscription/portal', {
        method: 'POST',
      });
      const result = await response.json();
      if (result.url) {
        window.open(result.url, '_blank');
      } else {
        throw new Error(result.error || 'Failed to open billing portal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setIsPortalLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Plan card skeleton */}
        <div className="bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-7 w-32 bg-text-primary/10 rounded" />
                <div className="h-4 w-48 bg-text-primary/10 rounded" />
              </div>
              <div className="h-10 w-36 bg-text-primary/10 rounded-xl" />
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="h-4 w-24 bg-text-primary/10 rounded" />
            <div className="h-3 w-full bg-text-primary/5 rounded-full" />
            <div className="h-3 w-full bg-text-primary/5 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Failed to load subscription'}</p>
        <button 
          onClick={() => window.location.reload()}
          className="text-brand-accent underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const { tier, tierInfo, usage, subscription, hasActiveSubscription } = data;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-albert text-[24px] font-bold text-text-primary dark:text-[#f5f5f8]">
                  {tierInfo.name} Plan
                </h2>
                {hasActiveSubscription && (
                  <span className="px-2 py-0.5 bg-[#dcfce7] dark:bg-[#166534]/30 text-[#166534] dark:text-[#4ade80] text-[11px] font-medium rounded-full">
                    Active
                  </span>
                )}
              </div>
              <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                {tierInfo.description}
              </p>
            </div>
            <div className="text-right">
              <div className="font-albert text-[32px] font-bold text-text-primary dark:text-[#f5f5f8]">
                ${tierInfo.monthly / 100}
              </div>
              <div className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
                per month
              </div>
            </div>
          </div>
        </div>

        {/* Usage Meters */}
        <div className="p-6">
          <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] mb-4">
            Usage
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <UsageMeter 
              label="Clients"
              icon={Users}
              current={usage.clients.current}
              limit={usage.clients.limit}
              percent={usage.clients.percent}
            />
            <UsageMeter 
              label="Programs"
              icon={Layers}
              current={usage.programs.current}
              limit={usage.programs.limit}
              percent={usage.programs.percent}
            />
            <UsageMeter 
              label="Squads"
              icon={UsersRound}
              current={usage.squads.current}
              limit={usage.squads.limit}
              percent={usage.squads.percent}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-wrap gap-3">
          {tier !== 'scale' && (
            <button
              onClick={() => router.push('/coach/plan')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#a07855] hover:bg-[#8b6847] text-white font-sans font-medium text-[14px] rounded-xl transition-colors"
            >
              <Zap className="w-4 h-4" />
              Upgrade Plan
            </button>
          )}
          {hasActiveSubscription && (
            <button
              onClick={handleManageSubscription}
              disabled={isPortalLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#e1ddd8] dark:border-[#262b35] text-text-primary dark:text-[#f5f5f8] font-sans font-medium text-[14px] rounded-xl hover:bg-[#faf8f6] dark:hover:bg-[#262b35] transition-colors disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" />
              {isPortalLoading ? 'Opening...' : 'Manage Billing'}
            </button>
          )}
        </div>
      </div>

      {/* Features Status */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
        <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] mb-4">
          Available Features
        </h3>
        <div className="space-y-3">
          <FeatureStatus 
            label="Stripe Connect"
            enabled={hasPermission(tier, 'stripe_connect')}
            icon={CreditCard}
            tier={tier}
            requiredTier="pro"
          />
          <FeatureStatus 
            label="Custom Domain"
            enabled={hasPermission(tier, 'custom_domain')}
            icon={Globe}
            tier={tier}
            requiredTier="pro"
          />
          <FeatureStatus 
            label="Email Whitelabeling"
            enabled={hasPermission(tier, 'email_whitelabel')}
            icon={Mail}
            tier={tier}
            requiredTier="pro"
          />
          <FeatureStatus 
            label="Advanced Funnel Steps"
            enabled={hasPermission(tier, 'funnel_step_analyzing')}
            icon={Filter}
            tier={tier}
            requiredTier="pro"
          />
          <p className="font-sans text-[13px] text-text-tertiary dark:text-[#6b7280] pt-2 text-center">
            ...and more
          </p>
        </div>

        {tier === 'starter' && (
          <div className="mt-6 p-4 bg-gradient-to-br from-[#faf8f6] to-[#f5f2ed] dark:from-[#262b35] dark:to-[#1f242d] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-accent to-[#c9a07a] rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-albert text-[15px] font-semibold text-text-primary dark:text-[#f5f5f8] mb-1">
                  Unlock Pro Features
                </h4>
                <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2] mb-3">
                  Get custom domain, email whitelabeling, Stripe Connect, and advanced funnel steps.
                </p>
                <button
                  onClick={() => router.push('/coach/plan')}
                  className="inline-flex items-center gap-1.5 text-brand-accent font-sans text-[13px] font-medium hover:underline"
                >
                  View Plans
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Billing Details */}
      {subscription && (
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
          <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] mb-4">
            Billing Details
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
              <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">Status</span>
              <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] capitalize">
                {subscription.status}
              </span>
            </div>
            {subscription.currentPeriodEnd && (
              <div className="flex justify-between py-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                  {subscription.cancelAtPeriodEnd ? 'Access Until' : 'Next Billing Date'}
                </span>
                <span className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8]">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
            {subscription.cancelAtPeriodEnd && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 py-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-sans text-[13px]">
                  Your subscription will end on the date above
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Billing Info Modal */}
      {showManualBillingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowManualBillingModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => setShowManualBillingModal(false)}
              className="absolute top-4 right-4 p-1.5 text-text-secondary hover:text-text-primary dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="p-6 pb-4">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              </div>

              <h2 className="font-albert text-[22px] font-bold text-text-primary dark:text-[#f5f5f8] mb-2">
                {tierInfo.name} Plan
              </h2>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-[12px] font-medium mb-3">
                <Shield className="w-3.5 h-3.5" />
                Managed by Administrator
              </div>

              <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                Your subscription is managed by a Growth Addicts administrator. You don&apos;t need to manage billing directly.
              </p>
            </div>

            {/* Details */}
            <div className="px-6 pb-4">
              <div className="bg-[#faf8f6] dark:bg-[#0a0c10] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
                    Current Plan
                  </span>
                  <span className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8]">
                    {tierInfo.name}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                  <span className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
                    Access Expires
                  </span>
                  <span className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8]">
                    {subscription?.manualExpiresAt 
                      ? new Date(subscription.manualExpiresAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })
                      : 'No expiration'
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-2">
              <button
                onClick={() => setShowManualBillingModal(false)}
                className="w-full px-5 py-3 bg-[#f5f2ed] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] font-sans font-medium text-[15px] rounded-xl hover:bg-[#e9e5df] dark:hover:bg-[#2d333d] transition-colors"
              >
                Got it
              </button>
              <p className="font-sans text-[12px] text-text-tertiary dark:text-[#6b7280] text-center mt-3">
                Contact support if you have questions about your plan
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

