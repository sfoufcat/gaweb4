'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Loader2, Save, Users, Eye, EyeOff } from 'lucide-react';
import type { PlatformSettings } from '@/types';

/**
 * AdminPlatformSettingsTab
 * 
 * Manages global platform settings including:
 * - Marketplace decoy listings toggle
 */
export function AdminPlatformSettingsTab() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch current settings
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/platform-settings');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch settings');
      }

      setSettings(data.settings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle decoys toggle
  const handleDecoysToggle = async () => {
    if (!settings) return;

    const newValue = !settings.marketplaceDecoysEnabled;
    
    // Optimistic update
    setSettings({ ...settings, marketplaceDecoysEnabled: newValue });
    setIsSaving(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/admin/platform-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceDecoysEnabled: newValue }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Revert on error
        setSettings({ ...settings, marketplaceDecoysEnabled: !newValue });
        throw new Error(data.error || 'Failed to update settings');
      }

      setSettings(data.settings);
      setSuccessMessage(newValue 
        ? 'Decoy listings are now visible on the marketplace'
        : 'Decoy listings are now hidden from the marketplace'
      );
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 font-albert mb-4">{error}</p>
        <button
          onClick={fetchSettings}
          className="text-brand-accent hover:underline font-albert"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
          Platform Settings
        </h2>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
          Global configuration for the GrowthAddicts platform.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
          <p className="text-emerald-700 dark:text-emerald-300 font-albert text-sm">
            ✓ {successMessage}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
          <p className="text-red-700 dark:text-red-300 font-albert text-sm">
            {error}
          </p>
        </div>
      )}

      {/* Settings Sections */}
      <div className="space-y-4">
        {/* Marketplace Section */}
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#0f1218]">
            <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] flex items-center gap-2">
              <Settings className="w-4 h-4 text-brand-accent" />
              Marketplace Settings
            </h3>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Decoy Listings Toggle */}
            <div className="flex items-start justify-between gap-4 p-4 bg-[#faf8f6] dark:bg-[#0f1218] rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Show Decoy Listings
                  </h4>
                  <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                    Display 6 fake program listings on the marketplace for social proof.
                    These link to a &quot;Program Full&quot; landing page.
                  </p>
                  
                  {/* Decoy programs list */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      'Jazz Piano Fundamentals',
                      'Full-Stack Developer Bootcamp',
                      'High-Performance Mindset',
                      'Wealth Building Masterclass',
                      '90-Day Body Transformation',
                      'Authentic Leadership Program',
                    ].map((name) => (
                      <span
                        key={name}
                        className="px-2 py-1 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[11px] font-albert text-[#5f5a55] dark:text-[#b2b6c2]"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Toggle Button */}
              <button
                onClick={handleDecoysToggle}
                disabled={isSaving}
                className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 ${
                  settings?.marketplaceDecoysEnabled
                    ? 'bg-brand-accent'
                    : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform flex items-center justify-center ${
                    settings?.marketplaceDecoysEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                >
                  {isSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin text-[#5f5a55]" />
                  ) : settings?.marketplaceDecoysEnabled ? (
                    <Eye className="w-3 h-3 text-brand-accent" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-[#5f5a55]" />
                  )}
                </div>
              </button>
            </div>
            
            {/* Status indicator */}
            <div className="flex items-center gap-2 text-sm font-albert">
              <div
                className={`w-2 h-2 rounded-full ${
                  settings?.marketplaceDecoysEnabled
                    ? 'bg-emerald-500'
                    : 'bg-[#a7a39e]'
                }`}
              />
              <span className="text-[#5f5a55] dark:text-[#b2b6c2]">
                Decoy listings are{' '}
                <span className={settings?.marketplaceDecoysEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}>
                  {settings?.marketplaceDecoysEnabled ? 'visible' : 'hidden'}
                </span>
              </span>
            </div>
          </div>
        </div>
        
        {/* Last Updated Info */}
        {settings?.updatedAt && (
          <p className="text-[12px] text-[#a7a39e] dark:text-[#7d8190] font-albert">
            Last updated: {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

