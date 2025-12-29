'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Code, Save, Loader2 } from 'lucide-react';
import type { FunnelTrackingConfig } from '@/types';

/**
 * GlobalPixelsSettings
 * 
 * Allows coaches to configure organization-wide tracking pixels
 * that are automatically applied to all funnels.
 */
export function GlobalPixelsSettings() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Tracking config state
  const [tracking, setTracking] = useState<FunnelTrackingConfig>({
    metaPixelId: '',
    googleAnalyticsId: '',
    googleAdsId: '',
    customHeadHtml: '',
    customBodyHtml: '',
  });
  
  // Original values for comparison
  const [originalTracking, setOriginalTracking] = useState<FunnelTrackingConfig | null>(null);

  // Fetch current settings
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/org/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data = await response.json();
      const globalTracking = data.settings?.globalTracking;
      
      if (globalTracking) {
        setTracking({
          metaPixelId: globalTracking.metaPixelId || '',
          googleAnalyticsId: globalTracking.googleAnalyticsId || '',
          googleAdsId: globalTracking.googleAdsId || '',
          customHeadHtml: globalTracking.customHeadHtml || '',
          customBodyHtml: globalTracking.customBodyHtml || '',
        });
        setOriginalTracking(globalTracking);
        // Auto-expand if there are any configured pixels
        if (globalTracking.metaPixelId || globalTracking.googleAnalyticsId || globalTracking.googleAdsId || globalTracking.customHeadHtml || globalTracking.customBodyHtml) {
          setIsExpanded(true);
        }
      } else {
        setOriginalTracking(null);
      }
    } catch (err) {
      console.error('Failed to fetch global pixels settings:', err);
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Check for changes
  useEffect(() => {
    if (!originalTracking) {
      // No original settings - check if any fields have values
      const hasValue = !!(
        tracking.metaPixelId?.trim() ||
        tracking.googleAnalyticsId?.trim() ||
        tracking.googleAdsId?.trim() ||
        tracking.customHeadHtml?.trim() ||
        tracking.customBodyHtml?.trim()
      );
      setHasChanges(hasValue);
    } else {
      // Compare with original
      const changed = 
        (tracking.metaPixelId?.trim() || '') !== (originalTracking.metaPixelId || '') ||
        (tracking.googleAnalyticsId?.trim() || '') !== (originalTracking.googleAnalyticsId || '') ||
        (tracking.googleAdsId?.trim() || '') !== (originalTracking.googleAdsId || '') ||
        (tracking.customHeadHtml?.trim() || '') !== (originalTracking.customHeadHtml || '') ||
        (tracking.customBodyHtml?.trim() || '') !== (originalTracking.customBodyHtml || '');
      setHasChanges(changed);
    }
  }, [tracking, originalTracking]);

  // Save settings
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
      
      // Build tracking config (only non-empty values)
      const trackingConfig: FunnelTrackingConfig = {};
      if (tracking.metaPixelId?.trim()) trackingConfig.metaPixelId = tracking.metaPixelId.trim();
      if (tracking.googleAnalyticsId?.trim()) trackingConfig.googleAnalyticsId = tracking.googleAnalyticsId.trim();
      if (tracking.googleAdsId?.trim()) trackingConfig.googleAdsId = tracking.googleAdsId.trim();
      if (tracking.customHeadHtml?.trim()) trackingConfig.customHeadHtml = tracking.customHeadHtml.trim();
      if (tracking.customBodyHtml?.trim()) trackingConfig.customBodyHtml = tracking.customBodyHtml.trim();
      
      const response = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globalTracking: Object.keys(trackingConfig).length > 0 ? trackingConfig : null,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }
      
      // Update original tracking after successful save
      setOriginalTracking(Object.keys(trackingConfig).length > 0 ? trackingConfig : null);
      setSuccessMessage('Global pixels saved successfully!');
      setHasChanges(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateTracking = (field: keyof FunnelTrackingConfig, value: string) => {
    setTracking(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  return (
    <div className="border border-[#e1ddd8] dark:border-[#313746] rounded-xl overflow-hidden">
      {/* Header - Collapsible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-[#faf8f6] dark:bg-[#1a1f27] hover:bg-[#f5f3f0] dark:hover:bg-[#1e232c] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Code className="w-5 h-5 text-brand-accent" />
          <div className="text-left">
            <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Global Tracking Pixels</span>
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5 font-albert">
              Applied to all funnels in your organization
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-albert">Unsaved changes</span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-[#e1ddd8] dark:border-[#313746] bg-white dark:bg-[#11141b]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
            </div>
          ) : (
            <>
              {/* Info Banner */}
              <div className="p-3 bg-brand-accent/10 rounded-lg">
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  These tracking pixels will be loaded on all funnels. Funnel-specific pixels can still be set and will override these global settings.
                </p>
              </div>

              {/* Meta Pixel ID */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Meta Pixel ID
                </label>
                <input
                  type="text"
                  value={tracking.metaPixelId || ''}
                  onChange={(e) => updateTracking('metaPixelId', e.target.value)}
                  placeholder="e.g., 1234567890"
                  className="w-full px-4 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/20 text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] font-albert"
                />
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1 font-albert">
                  Facebook/Meta Pixel ID for conversion tracking
                </p>
              </div>

              {/* Google Analytics ID */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Google Analytics ID
                </label>
                <input
                  type="text"
                  value={tracking.googleAnalyticsId || ''}
                  onChange={(e) => updateTracking('googleAnalyticsId', e.target.value)}
                  placeholder="e.g., G-XXXXXXXXXX"
                  className="w-full px-4 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/20 text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] font-albert"
                />
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1 font-albert">
                  Google Analytics 4 measurement ID
                </p>
              </div>

              {/* Google Ads ID */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Google Ads ID
                </label>
                <input
                  type="text"
                  value={tracking.googleAdsId || ''}
                  onChange={(e) => updateTracking('googleAdsId', e.target.value)}
                  placeholder="e.g., AW-XXXXXXXXXX"
                  className="w-full px-4 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/20 text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] font-albert"
                />
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1 font-albert">
                  Google Ads conversion tracking ID
                </p>
              </div>

              {/* Custom Head HTML */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Custom Head Code
                </label>
                <textarea
                  value={tracking.customHeadHtml || ''}
                  onChange={(e) => updateTracking('customHeadHtml', e.target.value)}
                  placeholder="<!-- TikTok Pixel, Snapchat Pixel, etc. -->"
                  rows={3}
                  className="w-full px-4 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/20 resize-none font-mono text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]"
                />
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1 font-albert">
                  Custom scripts injected in &lt;head&gt; - use for other tracking pixels
                </p>
              </div>

              {/* Custom Body HTML */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Custom Body Code
                </label>
                <textarea
                  value={tracking.customBodyHtml || ''}
                  onChange={(e) => updateTracking('customBodyHtml', e.target.value)}
                  placeholder="<!-- Scripts that need to run in body -->"
                  rows={3}
                  className="w-full px-4 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/20 resize-none font-mono text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]"
                />
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1 font-albert">
                  Custom scripts injected in &lt;body&gt;
                </p>
              </div>

              {/* Error message */}
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
              )}

              {/* Success message */}
              {successMessage && (
                <p className="text-sm text-green-600 dark:text-green-400 font-albert">{successMessage}</p>
              )}

              {/* Save Button */}
              <div className="pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-accent hover:bg-brand-accent/90 disabled:bg-brand-accent/50 dark:disabled:bg-brand-accent/50 text-white rounded-xl font-albert text-sm transition-colors disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Global Pixels
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


