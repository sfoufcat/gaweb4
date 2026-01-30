'use client';

import React, { Fragment, useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Code, Save, Loader2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { FunnelTrackingConfig } from '@/types';

interface GlobalPixelsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalPixelsModal({ isOpen, onClose }: GlobalPixelsModalProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
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
    if (isOpen) {
      fetchSettings();
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, fetchSettings]);

  // Check for changes
  useEffect(() => {
    if (!originalTracking) {
      const hasValue = !!(
        tracking.metaPixelId?.trim() ||
        tracking.googleAnalyticsId?.trim() ||
        tracking.googleAdsId?.trim() ||
        tracking.customHeadHtml?.trim() ||
        tracking.customBodyHtml?.trim()
      );
      setHasChanges(hasValue);
    } else {
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

      setOriginalTracking(Object.keys(trackingConfig).length > 0 ? trackingConfig : null);
      setSuccessMessage('Global pixels saved!');
      setHasChanges(false);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateTracking = (field: keyof FunnelTrackingConfig, value: string) => {
    setTracking((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-accent/20 to-brand-accent/5 flex items-center justify-center border border-brand-accent/30">
              <Code className="w-6 h-6 text-brand-accent" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Global Tracking Pixels
              </h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                Applied automatically to all your funnels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 -mt-1 rounded-xl hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Platform Pixels Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-[#e1ddd8] dark:from-[#262b35] to-transparent" />
                <span className="text-xs font-medium text-[#a7a39e] dark:text-[#7d8190] uppercase tracking-wider">
                  Platform Pixels
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-[#e1ddd8] dark:from-[#262b35] to-transparent" />
              </div>

              {/* Meta Pixel ID */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  <span className="w-5 h-5 rounded-md bg-[#1877f2]/10 flex items-center justify-center text-[10px] font-bold text-[#1877f2]">f</span>
                  Meta Pixel ID
                </label>
                <input
                  type="text"
                  value={tracking.metaPixelId || ''}
                  onChange={(e) => updateTracking('metaPixelId', e.target.value)}
                  placeholder="1234567890"
                  className="w-full px-4 py-3 bg-[#f8f7f5] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#c4c0bb] dark:placeholder:text-[#4a4f5c] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent focus:bg-white dark:focus:bg-[#171b22] transition-all"
                />
              </div>

              {/* Google Analytics ID */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  <span className="w-5 h-5 rounded-md bg-[#f59e0b]/10 flex items-center justify-center">
                    <svg className="w-3 h-3 text-[#f59e0b]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.84 12.13a10.72 10.72 0 0 0-.16-1.77H12v3.34h6.08a5.2 5.2 0 0 1-2.25 3.4v2.84h3.65a11 11 0 0 0 3.36-7.81Z" />
                      <path d="M12 23a10.77 10.77 0 0 0 7.47-2.73l-3.65-2.84a6.8 6.8 0 0 1-3.82 1.08 6.77 6.77 0 0 1-6.36-4.68H1.87v2.93A11 11 0 0 0 12 23Z" />
                      <path d="M5.64 13.83a6.4 6.4 0 0 1 0-4.06V6.84H1.87a10.9 10.9 0 0 0 0 9.92l3.77-2.93Z" />
                      <path d="M12 5.49a6 6 0 0 1 4.24 1.66l3.18-3.18A10.6 10.6 0 0 0 12 1 11 11 0 0 0 1.87 6.84l3.77 2.93A6.77 6.77 0 0 1 12 5.49Z" />
                    </svg>
                  </span>
                  Google Analytics ID
                </label>
                <input
                  type="text"
                  value={tracking.googleAnalyticsId || ''}
                  onChange={(e) => updateTracking('googleAnalyticsId', e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="w-full px-4 py-3 bg-[#f8f7f5] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#c4c0bb] dark:placeholder:text-[#4a4f5c] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent focus:bg-white dark:focus:bg-[#171b22] transition-all"
                />
              </div>

              {/* Google Ads ID */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  <span className="w-5 h-5 rounded-md bg-[#4285f4]/10 flex items-center justify-center">
                    <svg className="w-3 h-3 text-[#4285f4]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                    </svg>
                  </span>
                  Google Ads ID
                </label>
                <input
                  type="text"
                  value={tracking.googleAdsId || ''}
                  onChange={(e) => updateTracking('googleAdsId', e.target.value)}
                  placeholder="AW-XXXXXXXXXX"
                  className="w-full px-4 py-3 bg-[#f8f7f5] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#c4c0bb] dark:placeholder:text-[#4a4f5c] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent focus:bg-white dark:focus:bg-[#171b22] transition-all"
                />
              </div>
            </div>

            {/* Custom Code Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-[#e1ddd8] dark:from-[#262b35] to-transparent" />
                <span className="text-xs font-medium text-[#a7a39e] dark:text-[#7d8190] uppercase tracking-wider">
                  Custom Code
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-[#e1ddd8] dark:from-[#262b35] to-transparent" />
              </div>

              {/* Custom Head HTML */}
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#8b5cf6]/10 flex items-center justify-center text-[10px] font-mono font-bold text-[#8b5cf6]">&lt;&gt;</span>
                    Head Code
                  </span>
                  <span className="text-[10px] font-normal text-[#a7a39e] dark:text-[#7d8190] font-mono">&lt;head&gt;</span>
                </label>
                <textarea
                  value={tracking.customHeadHtml || ''}
                  onChange={(e) => updateTracking('customHeadHtml', e.target.value)}
                  placeholder="<!-- TikTok Pixel, Snapchat Pixel, etc. -->"
                  rows={3}
                  className="w-full px-4 py-3 bg-[#f8f7f5] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl resize-none font-mono text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#c4c0bb] dark:placeholder:text-[#4a4f5c] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent focus:bg-white dark:focus:bg-[#171b22] transition-all"
                />
              </div>

              {/* Custom Body HTML */}
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#10b981]/10 flex items-center justify-center text-[10px] font-mono font-bold text-[#10b981]">&lt;/&gt;</span>
                    Body Code
                  </span>
                  <span className="text-[10px] font-normal text-[#a7a39e] dark:text-[#7d8190] font-mono">&lt;body&gt;</span>
                </label>
                <textarea
                  value={tracking.customBodyHtml || ''}
                  onChange={(e) => updateTracking('customBodyHtml', e.target.value)}
                  placeholder="<!-- Scripts that need to run in body -->"
                  rows={3}
                  className="w-full px-4 py-3 bg-[#f8f7f5] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl resize-none font-mono text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#c4c0bb] dark:placeholder:text-[#4a4f5c] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent focus:bg-white dark:focus:bg-[#171b22] transition-all"
                />
              </div>
            </div>

            {/* Messages */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-sm text-green-600 dark:text-green-400 font-albert">{successMessage}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex-shrink-0 px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50 bg-[#faf9f7]/80 dark:bg-[#11141b]/80 backdrop-blur-xl"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs text-amber-600 dark:text-amber-400 font-albert">Unsaved changes</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-brand-accent/20 hover:shadow-md hover:shadow-brand-accent/30"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-[90vh] max-h-[90vh] flex flex-col bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border-t border-[#e8e4df]/50 dark:border-[#262b35]/50">
          <VisuallyHidden>
            <DrawerTitle>Global Tracking Pixels</DrawerTitle>
          </VisuallyHidden>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[10000]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 z-[10001] overflow-hidden">
          <div className="flex h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg max-h-[85vh] transform rounded-2xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all flex flex-col overflow-hidden">
                {content}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
