'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';

/**
 * CommunitySettingsToggle - Allow coach to set default community conversion for all programs
 * 
 * This component can be added to the coach settings/branding tab
 */
export function CommunitySettingsToggle() {
  const { colors, isDefault } = useBrandingValues();
  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  const [defaultConvert, setDefaultConvert] = useState(false);
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
          setDefaultConvert(data.settings?.defaultConvertToCommunity || false);
        }
      } catch {
        console.error('Failed to fetch community setting');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSetting();
  }, []);

  // Handle toggle
  const handleToggle = useCallback(async () => {
    const newValue = !defaultConvert;
    
    // Optimistic update
    setDefaultConvert(newValue);
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultConvertToCommunity: newValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err) {
      // Revert on error
      setDefaultConvert(!newValue);
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  }, [defaultConvert]);

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
            Auto-convert communities to masterminds
          </h3>
          <p className="text-[13px] text-[#8a857f] mt-0.5">
            When a program cohort ends, automatically convert its communities to masterminds
          </p>
        </div>

        {/* Toggle switch */}
        <button
          onClick={handleToggle}
          disabled={isSaving}
          className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
            defaultConvert ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
          } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={defaultConvert ? { backgroundColor: accentColor } : undefined}
          role="switch"
          aria-checked={defaultConvert}
          aria-label="Toggle auto-convert to community"
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              defaultConvert ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* Features description */}
      {defaultConvert && (
        <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
          <p className="text-[13px] text-[#8a857f] mb-2">
            When enabled for new cohorts:
          </p>
          <ul className="text-[13px] text-[#5f5a55] dark:text-[#b5b0ab] space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Squads become standalone communities after program ends
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Members stay connected and can continue chatting
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Great for building long-term alumni networks
            </li>
          </ul>
          <p className="mt-3 text-[12px] text-[#a09a94]">
            You can still override this setting per cohort when creating or editing cohorts.
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

