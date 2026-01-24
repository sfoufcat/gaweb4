'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';

/**
 * HidePoweredByToggle - Allow coach to hide "Powered by Coachful" in emails
 *
 * White-label setting for coaches who want to remove platform branding from outgoing emails.
 */
export function HidePoweredByToggle() {
  const { colors } = useBrandingValues();
  const accentColor = colors.accentLight || 'var(--brand-accent-light)';

  const [hidePoweredBy, setHidePoweredBy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current setting
  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const response = await fetch('/api/org/settings');
        if (response.ok) {
          const data = await response.json();
          setHidePoweredBy(data.settings?.hidePoweredByCoachful || false);
        }
      } catch {
        console.error('Failed to fetch org settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSetting();
  }, []);

  // Handle toggle
  const handleToggle = useCallback(async () => {
    const newValue = !hidePoweredBy;

    // Optimistic update
    setHidePoweredBy(newValue);
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidePoweredByCoachful: newValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err) {
      // Revert on error
      setHidePoweredBy(!newValue);
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  }, [hidePoweredBy]);

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-[#f5f3f0] dark:bg-[#1a1f2a] animate-pulse">
        <div className="w-32 h-4 bg-[#e8e4df] dark:bg-[#262b35] rounded" />
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Hide &quot;Powered by Coachful&quot;
          </h3>
          <p className="text-[13px] text-[#8a857f] mt-0.5">
            Remove platform branding from confirmation and reminder emails
          </p>
        </div>

        {/* Toggle switch */}
        <button
          onClick={handleToggle}
          disabled={isSaving}
          className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
            hidePoweredBy ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
          } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={hidePoweredBy ? { backgroundColor: accentColor } : undefined}
          role="switch"
          aria-checked={hidePoweredBy}
          aria-label="Hide Powered by Coachful"
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              hidePoweredBy ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* Note when enabled */}
      {hidePoweredBy && (
        <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
          <p className="text-[13px] text-[#5f5a55] dark:text-[#b5b0ab]">
            Emails to your clients will no longer include the Coachful footer attribution.
          </p>
        </div>
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
