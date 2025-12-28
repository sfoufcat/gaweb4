'use client';

import { useState } from 'react';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { DollarSign, Globe, ShoppingBag, AlertTriangle } from 'lucide-react';
import { useStripeConnectStatus } from '@/hooks/useStripeConnectStatus';

export interface ContentPricingData {
  priceInCents: number | null;
  currency: string;
  purchaseType: 'popup' | 'landing_page';
  isPublic: boolean;
}

interface ContentPricingFieldsProps {
  value: ContentPricingData;
  onChange: (data: ContentPricingData) => void;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

/**
 * Reusable pricing fields component for content gating.
 * Used in articles, courses, events, downloads, and links forms.
 */
export function ContentPricingFields({ value, onChange }: ContentPricingFieldsProps) {
  const [isPricingEnabled, setIsPricingEnabled] = useState(
    value.priceInCents !== null && value.priceInCents > 0
  );
  
  // Check Stripe connection status - pricing requires connected Stripe account
  const { isConnected: stripeConnected, isLoading: stripeLoading } = useStripeConnectStatus();
  const canEnablePricing = stripeConnected || stripeLoading;

  // Convert cents to dollars for display
  const priceInDollars = value.priceInCents 
    ? (value.priceInCents / 100).toFixed(2) 
    : '';

  const handlePriceChange = (dollarValue: string) => {
    const cleanValue = dollarValue.replace(/[^0-9.]/g, '');
    if (cleanValue === '' || cleanValue === '.') {
      onChange({ ...value, priceInCents: null });
      return;
    }
    
    const cents = Math.round(parseFloat(cleanValue) * 100);
    if (!isNaN(cents) && cents >= 0) {
      onChange({ ...value, priceInCents: cents });
    }
  };

  const handlePricingToggle = (enabled: boolean) => {
    // Prevent enabling pricing if Stripe is not connected
    if (enabled && !canEnablePricing) return;
    
    setIsPricingEnabled(enabled);
    if (!enabled) {
      onChange({ ...value, priceInCents: null });
    }
  };

  const currencySymbol = CURRENCIES.find(c => c.code === value.currency)?.symbol || '$';

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-[#a07855]/5 via-transparent to-transparent border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#a07855]/10 flex items-center justify-center">
          <DollarSign className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Pricing & Access
          </h3>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Configure pricing and visibility for this content
          </p>
        </div>
      </div>

      {/* Stripe Connect Warning */}
      {!stripeLoading && !stripeConnected && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200 font-albert">
                Stripe account required
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 font-albert mt-0.5">
                Connect your Stripe account in Settings to accept payments.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enable Pricing Toggle */}
      <div className={`flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg ${
        !canEnablePricing ? 'opacity-50 cursor-not-allowed' : ''
      }`}>
        <BrandedCheckbox
          checked={isPricingEnabled}
          onChange={handlePricingToggle}
          disabled={!canEnablePricing}
        />
        <div 
          className={`flex-1 ${canEnablePricing ? 'cursor-pointer' : 'cursor-not-allowed'}`}
          onClick={() => canEnablePricing && handlePricingToggle(!isPricingEnabled)}
        >
          <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Enable Pricing
          </span>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Charge a one-time fee for access to this content
          </p>
        </div>
      </div>

      {isPricingEnabled && (
        <div className="space-y-4 pt-2">
          {/* Price and Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
                Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-albert">
                  {currencySymbol}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceInDollars}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c]"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
                Currency
              </label>
              <select
                value={value.currency}
                onChange={(e) => onChange({ ...value, currency: e.target.value })}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} ({currency.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Purchase Type */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
              Purchase Experience
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onChange({ ...value, purchaseType: 'popup' })}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  value.purchaseType === 'popup'
                    ? 'border-[#a07855] dark:border-[#b8896a] bg-[#a07855]/5'
                    : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855] dark:border-[#b8896a]/50'
                }`}
              >
                <ShoppingBag className={`w-5 h-5 ${
                  value.purchaseType === 'popup' ? 'text-[#a07855] dark:text-[#b8896a]' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                }`} />
                <div className="text-left">
                  <span className={`block text-sm font-medium font-albert ${
                    value.purchaseType === 'popup' 
                      ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' 
                      : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`}>
                    Quick Popup
                  </span>
                  <span className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Slide-up checkout
                  </span>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => onChange({ ...value, purchaseType: 'landing_page' })}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  value.purchaseType === 'landing_page'
                    ? 'border-[#a07855] dark:border-[#b8896a] bg-[#a07855]/5'
                    : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855] dark:border-[#b8896a]/50'
                }`}
              >
                <Globe className={`w-5 h-5 ${
                  value.purchaseType === 'landing_page' ? 'text-[#a07855] dark:text-[#b8896a]' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                }`} />
                <div className="text-left">
                  <span className={`block text-sm font-medium font-albert ${
                    value.purchaseType === 'landing_page' 
                      ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' 
                      : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`}>
                    Landing Page
                  </span>
                  <span className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Full sales page
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public Visibility - Always visible */}
      <div className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg mt-2">
        <BrandedCheckbox
          checked={value.isPublic}
          onChange={(checked) => onChange({ ...value, isPublic: checked })}
        />
        <div 
          className="flex-1 cursor-pointer" 
          onClick={() => onChange({ ...value, isPublic: !value.isPublic })}
        >
          <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Public in Discover
          </span>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {value.isPublic 
              ? 'Visible to everyone browsing Discover' 
              : 'Only accessible via direct link or program'}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Default values for pricing data
 */
export function getDefaultPricingData(): ContentPricingData {
  return {
    priceInCents: null,
    currency: 'USD',
    purchaseType: 'popup',
    isPublic: true,
  };
}

