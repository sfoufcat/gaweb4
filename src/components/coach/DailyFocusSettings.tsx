'use client';

import { useState, useCallback, useEffect } from 'react';
import { Target, Minus, Plus } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';

const DEFAULT_FOCUS_SLOTS = 3;
const MIN_FOCUS_SLOTS = 1;
const MAX_FOCUS_SLOTS = 6;

/**
 * DailyFocusSettings - Allow coach to configure daily focus task limit
 * 
 * This sets the hard cap for all users in the organization.
 */
export function DailyFocusSettings() {
  const { colors, isDefault } = useBrandingValues();
  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  const [focusSlots, setFocusSlots] = useState(DEFAULT_FOCUS_SLOTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch current setting
  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const response = await fetch('/api/org/settings');
        if (response.ok) {
          const data = await response.json();
          setFocusSlots(data.settings?.defaultDailyFocusSlots ?? DEFAULT_FOCUS_SLOTS);
        }
      } catch {
        console.error('Failed to fetch org settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSetting();
  }, []);

  // Handle value change
  const handleChange = useCallback(async (newValue: number) => {
    // Clamp value to valid range
    const clampedValue = Math.max(MIN_FOCUS_SLOTS, Math.min(MAX_FOCUS_SLOTS, newValue));
    
    // Optimistic update
    const previousValue = focusSlots;
    setFocusSlots(clampedValue);
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultDailyFocusSlots: clampedValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccessMessage('Saved');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      // Revert on error
      setFocusSlots(previousValue);
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  }, [focusSlots]);

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
        <div className="flex-1 mr-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" style={{ color: accentColor }} />
            <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
              Daily Focus Limit
            </h3>
            {successMessage && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {successMessage}
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#8a857f] mt-0.5">
            Maximum number of focus tasks users can have each day
          </p>
        </div>

        {/* Number stepper */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleChange(focusSlots - 1)}
            disabled={isSaving || focusSlots <= MIN_FOCUS_SLOTS}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#1a1f2a] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Decrease"
          >
            <Minus className="w-4 h-4 text-[#5f5a55] dark:text-[#b5b0ab]" />
          </button>
          
          <div 
            className="w-12 h-8 flex items-center justify-center rounded-lg font-semibold text-[15px]"
            style={{ 
              backgroundColor: `${accentColor}15`,
              color: accentColor 
            }}
          >
            {focusSlots}
          </div>
          
          <button
            onClick={() => handleChange(focusSlots + 1)}
            disabled={isSaving || focusSlots >= MAX_FOCUS_SLOTS}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#1a1f2a] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Increase"
          >
            <Plus className="w-4 h-4 text-[#5f5a55] dark:text-[#b5b0ab]" />
          </button>
        </div>
      </div>

      {/* Help text */}
      <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
        <p className="text-[13px] text-[#8a857f]">
          Program tasks fill these slots first. Any overflow goes to the user&apos;s backlog.
        </p>
        <div className="mt-2 flex items-center gap-3 text-[12px] text-[#a7a39e]">
          <span>Min: {MIN_FOCUS_SLOTS}</span>
          <span>•</span>
          <span>Max: {MAX_FOCUS_SLOTS}</span>
          <span>•</span>
          <span>Default: {DEFAULT_FOCUS_SLOTS}</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-3 text-[13px] text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

