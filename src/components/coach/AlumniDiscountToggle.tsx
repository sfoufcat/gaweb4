'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';

/**
 * AlumniDiscountToggle - Allow coach to set automatic discounts for alumni
 * 
 * When enabled, users who have completed a program get automatic discounts
 * on future purchases without needing a discount code.
 */
export function AlumniDiscountToggle() {
  const { colors, isDefault } = useBrandingValues();
  const accentColor = colors.accentLight || 'var(--brand-accent-light)';

  const [enabled, setEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/org/settings');
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            setEnabled(data.settings.alumniDiscountEnabled || false);
            setDiscountType(data.settings.alumniDiscountType || 'percentage');
            setDiscountValue(data.settings.alumniDiscountValue || 10);
          }
        }
      } catch {
        console.error('Failed to fetch alumni discount settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Save settings
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumniDiscountEnabled: enabled,
          alumniDiscountType: discountType,
          alumniDiscountValue: discountValue,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccessMessage('Alumni discount settings saved!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [enabled, discountType, discountValue]);

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-[#f5f3f0] dark:bg-[#1a1f2a] animate-pulse">
        <div className="w-40 h-4 bg-[#e8e4df] dark:bg-[#262b35] rounded" />
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Alumni discount
          </h3>
          <p className="text-[13px] text-[#8a857f] mt-0.5">
            Automatically apply a discount for users who completed a program
          </p>
        </div>

        {/* Toggle switch */}
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
            enabled ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
          }`}
          style={enabled ? { backgroundColor: accentColor } : undefined}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle alumni discount"
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              enabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* Discount configuration */}
      {enabled && (
        <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-[13px] text-[#8a857f] mb-1">
                Discount Type
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                className="w-full px-3 py-2 border border-[#e8e4df] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] text-sm"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[13px] text-[#8a857f] mb-1">
                {discountType === 'percentage' ? 'Percentage' : 'Amount'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a857f] text-sm">
                  {discountType === 'percentage' ? '%' : '$'}
                </span>
                <input
                  type="number"
                  value={discountType === 'fixed' ? discountValue / 100 : discountValue}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setDiscountValue(discountType === 'fixed' ? Math.round(val * 100) : val);
                  }}
                  min="0"
                  max={discountType === 'percentage' ? 100 : undefined}
                  className="w-full pl-8 pr-3 py-2 border border-[#e8e4df] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] text-sm"
                />
              </div>
            </div>
          </div>

          <p className="text-[12px] text-[#a09a94] mb-4">
            Alumni can use the code <strong className="font-mono">ALUMNI</strong> at checkout, or the discount will be auto-applied if they&apos;re logged in.
          </p>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: accentColor, color: 'white' }}
          >
            {isSaving ? 'Saving...' : 'Save Alumni Discount'}
          </button>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <p className="mt-3 text-[13px] text-green-600 dark:text-green-400">
          {successMessage}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-3 text-[13px] text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

