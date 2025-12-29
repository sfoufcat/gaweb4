'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';

/**
 * PublicSignupToggle - Allow coach to enable/disable public signup
 * 
 * When enabled: Anyone can sign up via /signup
 * When disabled: /signup shows "contact coach" page with coach email
 */
export function PublicSignupToggle() {
  const { colors, isDefault } = useBrandingValues();
  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  const [publicSignupEnabled, setPublicSignupEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current setting
  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const response = await fetch('/api/coach/signup-settings');
        if (response.ok) {
          const data = await response.json();
          // Default to true if not set
          setPublicSignupEnabled(data.publicSignupEnabled !== false);
        }
      } catch {
        console.error('Failed to fetch signup setting');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSetting();
  }, []);

  // Handle toggle
  const handleToggle = useCallback(async () => {
    const newValue = !publicSignupEnabled;
    
    // Optimistic update
    setPublicSignupEnabled(newValue);
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/coach/signup-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicSignupEnabled: newValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err) {
      // Revert on error
      setPublicSignupEnabled(!newValue);
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  }, [publicSignupEnabled]);

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
            Enable public signup
          </h3>
          <p className="text-[13px] text-[#8a857f] mt-0.5">
            Allow anyone to create an account on your platform
          </p>
        </div>

        {/* Toggle switch */}
        <button
          onClick={handleToggle}
          disabled={isSaving}
          className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
            publicSignupEnabled ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
          } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={publicSignupEnabled ? { backgroundColor: accentColor } : undefined}
          role="switch"
          aria-checked={publicSignupEnabled}
          aria-label="Toggle public signup"
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              publicSignupEnabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* Description based on state */}
      <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
        {publicSignupEnabled ? (
          <>
            <p className="text-[13px] text-[#8a857f] mb-2">
              When enabled:
            </p>
            <ul className="text-[13px] text-[#5f5a55] dark:text-[#b5b0ab] space-y-1 ml-4">
              <li className="flex items-center gap-2">
                <span style={{ color: accentColor }}>✓</span>
                Anyone can sign up at /signup
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: accentColor }}>✓</span>
                New users are added to your organization
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: accentColor }}>✓</span>
                Use funnels to enroll them in specific programs
              </li>
            </ul>
          </>
        ) : (
          <>
            <p className="text-[13px] text-[#8a857f] mb-2">
              When disabled:
            </p>
            <ul className="text-[13px] text-[#5f5a55] dark:text-[#b5b0ab] space-y-1 ml-4">
              <li className="flex items-center gap-2">
                <span className="text-amber-500">⚠</span>
                Visitors see a &quot;Contact Coach&quot; page
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-500">⚠</span>
                They can email you to request access
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-500">⚠</span>
                Use invite links to add specific clients
              </li>
            </ul>
          </>
        )}
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


