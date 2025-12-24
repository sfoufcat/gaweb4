'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';

/**
 * FeedSettingsToggle - Allow coach to enable/disable the social feed feature
 * 
 * This component can be added to the coach settings/branding tab
 */
export function FeedSettingsToggle() {
  const { colors, isDefault } = useBrandingValues();
  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  const [feedEnabled, setFeedEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current setting
  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const response = await fetch('/api/coach/feed-settings');
        if (response.ok) {
          const data = await response.json();
          setFeedEnabled(data.feedEnabled || false);
        }
      } catch {
        console.error('Failed to fetch feed setting');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSetting();
  }, []);

  // Handle toggle
  const handleToggle = useCallback(async () => {
    const newValue = !feedEnabled;
    
    // Optimistic update
    setFeedEnabled(newValue);
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/coach/feed-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedEnabled: newValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err) {
      // Revert on error
      setFeedEnabled(!newValue);
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  }, [feedEnabled]);

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
            Social Feed
          </h3>
          <p className="text-[13px] text-[#8a857f] mt-0.5">
            Allow members to post and interact on a community feed
          </p>
        </div>

        {/* Toggle switch */}
        <button
          onClick={handleToggle}
          disabled={isSaving}
          className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
            feedEnabled ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
          } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={feedEnabled ? { backgroundColor: accentColor } : undefined}
          role="switch"
          aria-checked={feedEnabled}
          aria-label="Toggle social feed"
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              feedEnabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* Features description */}
      {feedEnabled && (
        <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
          <p className="text-[13px] text-[#8a857f] mb-2">
            When enabled, your community can:
          </p>
          <ul className="text-[13px] text-[#5f5a55] dark:text-[#b5b0ab] space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Create posts with text, images, and videos
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Like, comment, and share posts
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Share ephemeral 24-hour stories
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: accentColor }}>✓</span>
              Report inappropriate content for you to review
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

