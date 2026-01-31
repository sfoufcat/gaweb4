'use client';

import { useState, useCallback, useEffect } from 'react';
import { Phone, DollarSign, Bell, Check, Gift, PhoneOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { useStripeConnectStatus } from '@/hooks/useStripeConnectStatus';
import { StripeConnectPrompt } from '@/components/ui/StripeConnectPrompt';
import { StripeConnectModal } from '@/components/ui/StripeConnectModal';
import type { CoachCallSettings } from '@/types';

const DEFAULT_SETTINGS: CoachCallSettings = {
  allowClientRequests: true,
  pricingModel: 'free',
  pricePerCallCents: 0,
  creditsIncludedMonthly: 0,
  callRequestButtonLabel: '',
  callRequestDescription: '',
  notifyOnRequest: true,
  autoDeclineIfNoResponse: false,
  autoDeclineDays: 7,
};

/**
 * CallPricingSettings - Configure call pricing and request settings
 */
export function CallPricingSettings() {
  const { colors } = useBrandingValues();
  const accentColor = colors.accentLight || 'var(--brand-accent-light)';

  const [settings, setSettings] = useState<CoachCallSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  // Stripe Connect status for paid pricing models
  const { isConnected: stripeConnected, isLoading: stripeLoading, refetch: refetchStripe } = useStripeConnectStatus();
  const [showStripeModal, setShowStripeModal] = useState(false);
  const canAcceptPayments = stripeConnected;

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/coach/call-settings');
        if (response.ok) {
          const data = await response.json();
          // API returns { settings: ... } not { callSettings: ... }
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        }
      } catch {
        console.error('Failed to fetch call settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Save settings
  const saveSettings = useCallback(async (updates: Partial<CoachCallSettings>) => {
    const previousSettings = settings;
    const newSettings = { ...settings, ...updates };

    // Optimistic update
    setSettings(newSettings);
    setIsSaving(true);
    setError(null);
    setShowSaved(false);

    try {
      const response = await fetch('/api/coach/call-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (err) {
      setSettings(previousSettings);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  // Format cents to dollars for display
  const formatDollars = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  // Parse dollars input to cents
  const parseDollarsToCents = (dollars: string): number => {
    const parsed = parseFloat(dollars);
    if (isNaN(parsed) || parsed < 0) return 0;
    return Math.round(parsed * 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-[#f5f3f0] dark:bg-[#1a1f2a] rounded-xl" />
        <div className="h-32 bg-[#f5f3f0] dark:bg-[#1a1f2a] rounded-xl" />
        <div className="h-24 bg-[#f5f3f0] dark:bg-[#1a1f2a] rounded-xl" />
      </div>
    );
  }

  // Simplify: Free = 'free', Paid = 'per_call'
  const isPaid = settings.pricingModel === 'per_call' || settings.pricingModel === 'both';

  return (
    <div className="space-y-6">
      {/* Header with Save Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#faf8f6]">
          Call Requests
        </h2>
        <div className="flex items-center gap-2 h-7">
          <AnimatePresence mode="wait">
            {isSaving && (
              <motion.div
                key="saving"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-1.5 text-[13px] text-[#8a857f]"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </motion.div>
            )}
            {showSaved && !isSaving && (
              <motion.div
                key="saved"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-1.5 text-[13px] text-emerald-600 dark:text-emerald-400"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Allow Client Requests - Card Selector */}
      <div className="grid grid-cols-2 gap-3">
        {/* Enabled Card */}
        <button
          onClick={() => saveSettings({ allowClientRequests: true })}
          disabled={isSaving}
          className={`group relative flex flex-col items-center justify-center text-center p-5 rounded-2xl border-2 transition-all ${
            settings.allowClientRequests
              ? 'border-brand-accent bg-gradient-to-br from-brand-accent/5 to-brand-accent/10 shadow-[0_4px_24px_rgba(160,120,85,0.15)]'
              : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50 hover:shadow-lg'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all ${
            settings.allowClientRequests
              ? 'bg-brand-accent/20 shadow-[0_0_20px_rgba(160,120,85,0.2)]'
              : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-brand-accent/10'
          }`}>
            <Phone className={`w-6 h-6 ${settings.allowClientRequests ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
          </div>
          <h4 className="text-[14px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            Allow Requests
          </h4>
          <p className="text-[11px] text-[#5f5a55] dark:text-[#b2b6c2] font-albert leading-snug">
            Clients can request calls
          </p>
          {settings.allowClientRequests && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center shadow-[0_2px_8px_rgba(160,120,85,0.3)]">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
        </button>

        {/* Disabled Card */}
        <button
          onClick={() => saveSettings({ allowClientRequests: false })}
          disabled={isSaving}
          className={`group relative flex flex-col items-center justify-center text-center p-5 rounded-2xl border-2 transition-all ${
            !settings.allowClientRequests
              ? 'border-[#8a857f] bg-gradient-to-br from-[#f5f3f0] to-[#ebe8e4] dark:from-[#1a1f2a] dark:to-[#13171f] shadow-[0_4px_24px_rgba(0,0,0,0.08)]'
              : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-[#8a857f]/50 hover:shadow-lg'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all ${
            !settings.allowClientRequests
              ? 'bg-[#8a857f]/20'
              : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-[#8a857f]/10'
          }`}>
            <PhoneOff className={`w-6 h-6 ${!settings.allowClientRequests ? 'text-[#8a857f]' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
          </div>
          <h4 className="text-[14px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            Disabled
          </h4>
          <p className="text-[11px] text-[#5f5a55] dark:text-[#b2b6c2] font-albert leading-snug">
            Only you can schedule
          </p>
          {!settings.allowClientRequests && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#8a857f] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
        </button>
      </div>

      {/* Settings that appear when requests are enabled */}
      <AnimatePresence>
        {settings.allowClientRequests && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="space-y-6 overflow-hidden"
          >
            {/* Extra Call Pricing - Card Selector */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4" style={{ color: accentColor }} />
                <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
                  Extra Call Pricing
                </h3>
              </div>
              <p className="text-[12px] text-[#8a857f] mb-4">
                When clients exceed their program&apos;s monthly call allowance, extra calls can be free or charged.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Free Card */}
                <button
                  onClick={() => saveSettings({ pricingModel: 'free' })}
                  disabled={isSaving}
                  className={`group relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    !isPaid
                      ? 'border-brand-accent bg-gradient-to-br from-brand-accent/5 to-brand-accent/10'
                      : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                    !isPaid
                      ? 'bg-brand-accent/20'
                      : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-brand-accent/10'
                  }`}>
                    <Gift className={`w-4 h-4 ${!isPaid ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                  </div>
                  <div className="text-left min-w-0">
                    <h4 className="text-[14px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Free
                    </h4>
                    <p className="text-[12px] text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                      Extra calls are free
                    </p>
                  </div>
                  {!isPaid && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand-accent flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>

                {/* Paid Card */}
                <button
                  onClick={() => {
                    if (!canAcceptPayments) {
                      setShowStripeModal(true);
                      return;
                    }
                    saveSettings({ pricingModel: 'per_call' });
                  }}
                  disabled={isSaving}
                  className={`group relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    isPaid
                      ? 'border-brand-accent bg-gradient-to-br from-brand-accent/5 to-brand-accent/10'
                      : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                  } ${!canAcceptPayments ? 'opacity-70' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                    isPaid
                      ? 'bg-brand-accent/20'
                      : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-brand-accent/10'
                  }`}>
                    <DollarSign className={`w-4 h-4 ${isPaid ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                  </div>
                  <div className="text-left min-w-0">
                    <h4 className="text-[14px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Paid
                    </h4>
                    <p className="text-[12px] text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                      {canAcceptPayments ? 'Charge per call' : 'Stripe required'}
                    </p>
                  </div>
                  {isPaid && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand-accent flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              </div>

              {/* Stripe Connect Prompt when trying to use paid without Stripe */}
              {!canAcceptPayments && !isPaid && (
                <div className="mt-4">
                  <StripeConnectPrompt onClick={() => setShowStripeModal(true)} />
                </div>
              )}

              {/* Price Input - only show when Paid selected */}
              <AnimatePresence>
                {isPaid && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
                      <label className="block">
                        <span className="text-[13px] font-medium text-[#5f5a55] dark:text-[#b5b0ab]">
                          Price Per Extra Call
                        </span>
                        <div className="mt-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a857f]">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={formatDollars(settings.pricePerCallCents || 0)}
                            onChange={(e) => saveSettings({ pricePerCallCents: parseDollarsToCents(e.target.value) })}
                            disabled={isSaving}
                            className="w-full pl-7 pr-4 py-2 bg-white dark:bg-[#1a1f2a] border border-[#e8e4df] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#faf8f6] focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                            placeholder="0.00"
                          />
                        </div>
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Customization */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
              <div className="flex items-center gap-2 mb-4">
                <Phone className="w-4 h-4" style={{ color: accentColor }} />
                <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
                  Customization
                </h3>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-[13px] font-medium text-[#5f5a55] dark:text-[#b5b0ab]">
                    Request Button Label
                  </span>
                  <input
                    type="text"
                    value={settings.callRequestButtonLabel || ''}
                    onChange={(e) => setSettings({ ...settings, callRequestButtonLabel: e.target.value })}
                    onBlur={() => saveSettings({ callRequestButtonLabel: settings.callRequestButtonLabel })}
                    disabled={isSaving}
                    className="mt-1 w-full px-4 py-2 bg-white dark:bg-[#1a1f2a] border border-[#e8e4df] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#faf8f6] focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                    placeholder="Request a Call"
                    maxLength={50}
                  />
                  <p className="text-[12px] text-[#8a857f] mt-1">
                    Leave blank for &quot;Schedule a Call&quot;
                  </p>
                </label>

                <label className="block">
                  <span className="text-[13px] font-medium text-[#5f5a55] dark:text-[#b5b0ab]">
                    Description for Clients
                  </span>
                  <textarea
                    value={settings.callRequestDescription || ''}
                    onChange={(e) => setSettings({ ...settings, callRequestDescription: e.target.value })}
                    onBlur={() => saveSettings({ callRequestDescription: settings.callRequestDescription })}
                    disabled={isSaving}
                    className="mt-1 w-full px-4 py-2 bg-white dark:bg-[#1a1f2a] border border-[#e8e4df] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#faf8f6] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 resize-none"
                    placeholder="Book a 1-on-1 coaching session with me"
                    rows={2}
                    maxLength={200}
                  />
                </label>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4" style={{ color: accentColor }} />
                <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
                  Notifications
                </h3>
              </div>

              <div className="space-y-4">
                {/* Notify on Request */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[14px] text-[#1a1a1a] dark:text-[#faf8f6]">
                      Email me on new requests
                    </p>
                    <p className="text-[12px] text-[#8a857f]">
                      Get notified when clients request a call
                    </p>
                  </div>
                  <button
                    onClick={() => saveSettings({ notifyOnRequest: !settings.notifyOnRequest })}
                    disabled={isSaving}
                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                      settings.notifyOnRequest ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
                    }`}
                    style={settings.notifyOnRequest ? { backgroundColor: accentColor } : undefined}
                  >
                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      settings.notifyOnRequest ? 'translate-x-5' : ''
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stripe Connect Modal */}
      <StripeConnectModal
        isOpen={showStripeModal}
        onClose={() => setShowStripeModal(false)}
        onConnected={() => refetchStripe()}
      />
    </div>
  );
}
