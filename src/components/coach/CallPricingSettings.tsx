'use client';

import { useState, useCallback, useEffect } from 'react';
import { Phone, DollarSign, CreditCard, Bell, Clock, Minus, Plus, Eye, X } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import type { CallPricingModel, CoachCallSettings } from '@/types';

const PRICING_MODEL_OPTIONS: { value: CallPricingModel; label: string; description: string }[] = [
  { value: 'free', label: 'Free', description: 'All calls are free for clients' },
  { value: 'per_call', label: 'Pay Per Call', description: 'Clients pay a fixed price per call' },
  { value: 'credits', label: 'Monthly Credits', description: 'Clients get free calls each month' },
  { value: 'both', label: 'Credits + Pay Per Call', description: 'Free monthly credits, then pay per call' },
];

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
 * Preview of what clients see on their dashboard
 */
function ClientCallPreview({ settings }: { settings: CoachCallSettings }) {
  const isPaid = settings.pricingModel === 'per_call' || settings.pricingModel === 'both';
  return (
    <div className="p-4 bg-gradient-to-br from-brand-accent/5 to-brand-accent/10 border border-brand-accent/20 rounded-2xl">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-brand-accent/20 flex items-center justify-center flex-shrink-0">
          <Phone className="w-5 h-5 text-brand-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[#1a1a1a] dark:text-white">
            {settings.callRequestButtonLabel || 'Schedule a Call'}
          </h4>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            {settings.callRequestDescription || 'Book a 1-on-1 call with your coach'}
          </p>
          {isPaid && (settings.pricePerCallCents || 0) > 0 && (
            <p className="text-xs font-medium text-brand-accent mt-1">
              ${((settings.pricePerCallCents || 0) / 100).toFixed(0)} per call
            </p>
          )}
        </div>
        <span className="flex-shrink-0 px-3 py-1.5 bg-brand-accent text-white text-sm rounded-xl font-medium">
          Request
        </span>
      </div>
    </div>
  );
}

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/coach/call-settings');
        if (response.ok) {
          const data = await response.json();
          setSettings({ ...DEFAULT_SETTINGS, ...data.callSettings });
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
    setSuccessMessage(null);

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

      setSuccessMessage('Saved');
      setTimeout(() => setSuccessMessage(null), 2000);
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

  const showPriceInput = settings.pricingModel === 'per_call' || settings.pricingModel === 'both';
  const showCreditsInput = settings.pricingModel === 'credits' || settings.pricingModel === 'both';

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{successMessage}</p>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Info Banner - Where clients see this */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl">
        <p className="text-[13px] text-blue-700 dark:text-blue-300">
          <span className="font-medium">Where clients see this:</span> On their dashboard homepage as a &quot;Request Call&quot; card, and in the booking flow when requesting a call.{' '}
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="inline-flex items-center gap-1 underline hover:no-underline"
          >
            <Eye className="w-3 h-3" />
            Preview card
          </button>
        </p>
      </div>

      {/* Allow Client Requests Toggle */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" style={{ color: accentColor }} />
              <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
                Allow Client Call Requests
              </h3>
            </div>
            <p className="text-[13px] text-[#8a857f] mt-0.5">
              Let clients request coaching calls from their dashboard
            </p>
          </div>
          <button
            onClick={() => saveSettings({ allowClientRequests: !settings.allowClientRequests })}
            disabled={isSaving}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
              settings.allowClientRequests ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
            }`}
            style={settings.allowClientRequests ? { backgroundColor: accentColor } : undefined}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
              settings.allowClientRequests ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>
      </div>

      {/* Pricing Model */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4" style={{ color: accentColor }} />
          <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Pricing Model
          </h3>
        </div>

        <div className="space-y-2">
          {PRICING_MODEL_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                settings.pricingModel === option.value
                  ? 'border-brand-accent bg-brand-accent/5'
                  : 'border-[#e8e4df] dark:border-[#262b35] hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a]'
              }`}
              style={settings.pricingModel === option.value ? { borderColor: accentColor } : undefined}
            >
              <input
                type="radio"
                name="pricingModel"
                value={option.value}
                checked={settings.pricingModel === option.value}
                onChange={() => saveSettings({ pricingModel: option.value })}
                disabled={isSaving}
                className="mt-0.5"
                style={{ accentColor }}
              />
              <div>
                <p className="font-medium text-[14px] text-[#1a1a1a] dark:text-[#faf8f6]">
                  {option.label}
                </p>
                <p className="text-[12px] text-[#8a857f]">{option.description}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Conditional Price Input */}
        {showPriceInput && (
          <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
            <label className="block">
              <span className="text-[13px] font-medium text-[#5f5a55] dark:text-[#b5b0ab]">
                Price Per Call
              </span>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a857f]">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formatDollars(settings.pricePerCallCents || 0)}
                  onChange={(e) => saveSettings({ pricePerCallCents: parseDollarsToCents(e.target.value) })}
                  disabled={isSaving}
                  className="w-full pl-7 pr-4 py-2 bg-white dark:bg-[#1a1f2a] border border-[#e8e4df] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#faf8f6] focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                  placeholder="0.00"
                />
              </div>
              <p className="text-[12px] text-[#8a857f] mt-1">
                Shown as &quot;$X per call&quot; badge on dashboard card
              </p>
            </label>
          </div>
        )}

        {/* Conditional Credits Input */}
        {showCreditsInput && (
          <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[13px] font-medium text-[#5f5a55] dark:text-[#b5b0ab]">
                  Monthly Free Credits
                </span>
                <p className="text-[12px] text-[#8a857f] mt-0.5">
                  Number of free calls clients get each month
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => saveSettings({ creditsIncludedMonthly: Math.max(0, (settings.creditsIncludedMonthly || 0) - 1) })}
                  disabled={isSaving || (settings.creditsIncludedMonthly || 0) <= 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#1a1f2a] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-4 h-4 text-[#5f5a55] dark:text-[#b5b0ab]" />
                </button>
                <div
                  className="w-12 h-8 flex items-center justify-center rounded-lg font-semibold text-[15px]"
                  style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                >
                  {settings.creditsIncludedMonthly || 0}
                </div>
                <button
                  onClick={() => saveSettings({ creditsIncludedMonthly: (settings.creditsIncludedMonthly || 0) + 1 })}
                  disabled={isSaving}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#1a1f2a] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4 text-[#5f5a55] dark:text-[#b5b0ab]" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customization */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4" style={{ color: accentColor }} />
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
              Card title on client dashboard (leave blank for &quot;Schedule a Call&quot;)
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
            <p className="text-[12px] text-[#8a857f] mt-1">
              Subtitle below title on dashboard card
            </p>
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

      {/* Auto-decline Settings */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4" style={{ color: accentColor }} />
          <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Auto-decline
          </h3>
        </div>

        <div className="space-y-4">
          {/* Auto-decline toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[14px] text-[#1a1a1a] dark:text-[#faf8f6]">
                Auto-decline if no response
              </p>
              <p className="text-[12px] text-[#8a857f]">
                Automatically decline requests you don&apos;t respond to
              </p>
            </div>
            <button
              onClick={() => saveSettings({ autoDeclineIfNoResponse: !settings.autoDeclineIfNoResponse })}
              disabled={isSaving}
              className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                settings.autoDeclineIfNoResponse ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
              }`}
              style={settings.autoDeclineIfNoResponse ? { backgroundColor: accentColor } : undefined}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                settings.autoDeclineIfNoResponse ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>

          {/* Days input - only show if auto-decline is enabled */}
          {settings.autoDeclineIfNoResponse && (
            <div className="flex items-center justify-between pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
              <div>
                <span className="text-[13px] font-medium text-[#5f5a55] dark:text-[#b5b0ab]">
                  Days before auto-decline
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => saveSettings({ autoDeclineDays: Math.max(1, (settings.autoDeclineDays || 7) - 1) })}
                  disabled={isSaving || (settings.autoDeclineDays || 7) <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#1a1f2a] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-4 h-4 text-[#5f5a55] dark:text-[#b5b0ab]" />
                </button>
                <div
                  className="w-12 h-8 flex items-center justify-center rounded-lg font-semibold text-[15px]"
                  style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                >
                  {settings.autoDeclineDays || 7}
                </div>
                <button
                  onClick={() => saveSettings({ autoDeclineDays: Math.min(30, (settings.autoDeclineDays || 7) + 1) })}
                  disabled={isSaving || (settings.autoDeclineDays || 7) >= 30}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#1a1f2a] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4 text-[#5f5a55] dark:text-[#b5b0ab]" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Client Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowPreview(false)}
          />
          <div className="relative bg-white dark:bg-[#1a1f2a] rounded-2xl p-6 max-w-md w-full shadow-xl">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5 text-[#8a857f]" />
            </button>
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-white mb-1">
              Client Dashboard Preview
            </h3>
            <p className="text-sm text-[#8a857f] mb-4">
              This card appears on your clients&apos; dashboard homepage
            </p>
            <ClientCallPreview settings={settings} />
          </div>
        </div>
      )}
    </div>
  );
}
