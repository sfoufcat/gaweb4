'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBrandingValues, useMenuTitles } from '@/contexts/BrandingContext';
import type { EmptyStateBehavior } from '@/types';

/**
 * MenuEmptyStateSettings - Allow coach to configure what shows when users have no program/squad
 * 
 * Options:
 * - 'discover': Show the menu item and redirect to a "find program/squad" page
 * - 'hide': Hide the menu item entirely when user has no content
 */
export function MenuEmptyStateSettings() {
  const { colors, isDefault } = useBrandingValues();
  const { program: programTitle, squad: squadTitle, programLower, squadLower } = useMenuTitles();
  const accentColor = colors.accentLight || 'var(--brand-accent-light)';

  const [programBehavior, setProgramBehavior] = useState<EmptyStateBehavior>('discover');
  const [squadBehavior, setSquadBehavior] = useState<EmptyStateBehavior>('discover');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<'program' | 'squad' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/org/settings');
        if (response.ok) {
          const data = await response.json();
          setProgramBehavior(data.settings?.programEmptyStateBehavior || 'discover');
          setSquadBehavior(data.settings?.squadEmptyStateBehavior || 'discover');
        }
      } catch {
        console.error('Failed to fetch menu empty state settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Handle toggle
  const handleToggle = useCallback(async (type: 'program' | 'squad', newValue: EmptyStateBehavior) => {
    const previousValue = type === 'program' ? programBehavior : squadBehavior;
    
    // Optimistic update
    if (type === 'program') {
      setProgramBehavior(newValue);
    } else {
      setSquadBehavior(newValue);
    }
    
    setIsSaving(type);
    setError(null);

    try {
      const payload = type === 'program' 
        ? { programEmptyStateBehavior: newValue }
        : { squadEmptyStateBehavior: newValue };
        
      const response = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err) {
      // Revert on error
      if (type === 'program') {
        setProgramBehavior(previousValue);
      } else {
        setSquadBehavior(previousValue);
      }
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setIsSaving(null);
    }
  }, [programBehavior, squadBehavior]);

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-[#f5f3f0] dark:bg-[#1a1f2a] animate-pulse">
        <div className="w-48 h-4 bg-[#e8e4df] dark:bg-[#262b35] rounded mb-4" />
        <div className="space-y-3">
          <div className="w-full h-12 bg-[#e8e4df] dark:bg-[#262b35] rounded" />
          <div className="w-full h-12 bg-[#e8e4df] dark:bg-[#262b35] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
      <div className="mb-4">
        <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
          Menu empty state behavior
        </h3>
        <p className="text-[13px] text-[#8a857f] mt-0.5">
          Choose what happens when a user has no {programLower} or {squadLower}
        </p>
      </div>

      <div className="space-y-4">
        {/* Program Empty State */}
        <div className="p-3 rounded-lg bg-[#f5f3f0] dark:bg-[#1a1f2a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[14px] font-medium text-[#1a1a1a] dark:text-[#faf8f6]">
              {programTitle} menu
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#e8e4df] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b5b0ab]">
              When user has no {programLower}
            </span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleToggle('program', 'discover')}
              disabled={isSaving === 'program'}
              className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-medium transition-colors ${
                programBehavior === 'discover'
                  ? 'text-white'
                  : 'bg-white dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f0eeeb] dark:hover:bg-[#2f3542]'
              } ${isSaving === 'program' ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={programBehavior === 'discover' ? { backgroundColor: accentColor } : undefined}
            >
              Show &quot;Find {programTitle}&quot;
            </button>
            <button
              onClick={() => handleToggle('program', 'hide')}
              disabled={isSaving === 'program'}
              className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-medium transition-colors ${
                programBehavior === 'hide'
                  ? 'text-white'
                  : 'bg-white dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f0eeeb] dark:hover:bg-[#2f3542]'
              } ${isSaving === 'program' ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={programBehavior === 'hide' ? { backgroundColor: accentColor } : undefined}
            >
              Hide menu item
            </button>
          </div>
        </div>

        {/* Squad Empty State */}
        <div className="p-3 rounded-lg bg-[#f5f3f0] dark:bg-[#1a1f2a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[14px] font-medium text-[#1a1a1a] dark:text-[#faf8f6]">
              {squadTitle} menu
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#e8e4df] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b5b0ab]">
              When user has no {squadLower}
            </span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleToggle('squad', 'discover')}
              disabled={isSaving === 'squad'}
              className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-medium transition-colors ${
                squadBehavior === 'discover'
                  ? 'text-white'
                  : 'bg-white dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f0eeeb] dark:hover:bg-[#2f3542]'
              } ${isSaving === 'squad' ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={squadBehavior === 'discover' ? { backgroundColor: accentColor } : undefined}
            >
              Show &quot;Find {squadTitle}&quot;
            </button>
            <button
              onClick={() => handleToggle('squad', 'hide')}
              disabled={isSaving === 'squad'}
              className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-medium transition-colors ${
                squadBehavior === 'hide'
                  ? 'text-white'
                  : 'bg-white dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f0eeeb] dark:hover:bg-[#2f3542]'
              } ${isSaving === 'squad' ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={squadBehavior === 'hide' ? { backgroundColor: accentColor } : undefined}
            >
              Hide menu item
            </button>
          </div>
        </div>
      </div>

      {/* Help text */}
      <p className="mt-4 text-[12px] text-[#8a857f]">
        &quot;Show Find&quot; displays a discover page to help users join a {programLower} or {squadLower}. 
        &quot;Hide&quot; removes the menu item entirely until they have content.
      </p>

      {/* Error message */}
      {error && (
        <p className="mt-3 text-[13px] text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}










