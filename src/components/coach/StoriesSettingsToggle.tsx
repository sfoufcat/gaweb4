'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';

/**
 * StoriesSettingsToggle - Allow coach to enable/disable the stories feature
 * 
 * Stories are independent from the social feed - coaches can have stories
 * enabled even when the feed is disabled.
 */
export function StoriesSettingsToggle() {
  const { colors } = useBrandingValues();
  const accentColor = colors.accentLight || 'var(--brand-accent-light)';

  const [storiesEnabled, setStoriesEnabled] = useState(true); // Default to true
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current setting
  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const response = await fetch('/api/coach/stories-settings');
        if (response.ok) {
          const data = await response.json();
          // Default to true if not explicitly set
          setStoriesEnabled(data.storiesEnabled !== false);
        }
      } catch {
        console.error('Failed to fetch stories setting');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSetting();
  }, []);

  // Handle toggle
  const handleToggle = useCallback(async () => {
    const newValue = !storiesEnabled;
    
    // Optimistic update
    setStoriesEnabled(newValue);
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/coach/stories-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storiesEnabled: newValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err) {
      // Revert on error
      setStoriesEnabled(!newValue);
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  }, [storiesEnabled]);

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
            Enable stories
          </h3>
          <p className="text-[13px] text-[#8a857f] mt-0.5">
            Show auto-generated stories from member activity (tasks, goals, check-ins)
          </p>
        </div>

        {/* Toggle switch */}
        <button
          onClick={handleToggle}
          disabled={isSaving}
          className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
            storiesEnabled ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
          } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={storiesEnabled ? { backgroundColor: accentColor } : undefined}
          role="switch"
          aria-checked={storiesEnabled}
          aria-label="Toggle stories"
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              storiesEnabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* Features description */}
      {storiesEnabled && (
        <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
          <p className="text-[13px] text-[#8a857f] mb-2">
            Stories automatically showcase member activity:
          </p>
          <ul className="text-[13px] text-[#5f5a55] dark:text-[#b5b0ab] space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Today&apos;s focus tasks and progress
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Active goals and milestones
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Evening check-in summaries
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Weekly reflection highlights
            </li>
          </ul>
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

