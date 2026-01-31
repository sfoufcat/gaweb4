'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { ReferralRewardSelector } from './ReferralRewardSelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  X,
  Loader2,
  Settings2,
  Gift,
} from 'lucide-react';
import type { Program, Funnel, ReferralReward, ReferralConfig, ReferralResourceType } from '@/types';

interface ReferralConfigItem {
  targetType: 'program' | 'squad' | ReferralResourceType;
  targetId: string;
  targetName: string;
  referralConfig: ReferralConfig | null;
  funnelName?: string;
}

// Display labels for target types
const TARGET_TYPE_LABELS: Record<string, string> = {
  program: 'Program',
  squad: 'Squad',
  course: 'Course',
  article: 'Article',
  download: 'Download',
  video: 'Video',
  link: 'Link',
};

// Support both old (program-based) and new (config-based) props
interface ReferralEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Old props
  program?: Program;
  organizationId?: string;
  // New props
  config?: ReferralConfigItem;
  onSuccess?: () => void;
}

/**
 * ReferralEditSheet Component
 *
 * Beautiful simple edit form (not wizard) for already-enabled referrals.
 * Shows funnel dropdown + reward selector.
 * Responsive: Drawer on mobile, Dialog on desktop.
 */
export function ReferralEditSheet({
  open,
  onOpenChange,
  program,
  organizationId,
  config,
  onSuccess,
}: ReferralEditSheetProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Derive values from either program or config
  const targetId = config?.targetId || program?.id || '';
  const targetType = config?.targetType || 'program';
  const targetName = config?.targetName || program?.name || '';
  const initialConfig = config?.referralConfig || program?.referralConfig;

  // Form state
  const [funnelId, setFunnelId] = useState<string>(initialConfig?.funnelId || '');
  const [reward, setReward] = useState<ReferralReward | undefined>(initialConfig?.reward);

  // Data
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loadingFunnels, setLoadingFunnels] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      const cfg = config?.referralConfig || program?.referralConfig;
      setFunnelId(cfg?.funnelId || '');
      setReward(cfg?.reward);
      setError(null);
    }
  }, [open, program, config]);

  // Fetch funnels
  useEffect(() => {
    if (!open || !targetId) return;

    const fetchFunnels = async () => {
      setLoadingFunnels(true);
      try {
        const response = await fetch('/api/coach/org-funnels');
        if (response.ok) {
          const data = await response.json();
          // Filter funnels based on target type
          const filteredFunnels = (data.funnels || []).filter(
            (f: Funnel) => {
              if (targetType === 'program') {
                return f.programId === targetId;
              } else if (targetType === 'squad') {
                return f.squadId === targetId;
              } else {
                // For resources (course, article, etc.), show all funnels
                return true;
              }
            }
          );
          setFunnels(filteredFunnels);
        }
      } catch (err) {
        console.error('Failed to fetch funnels:', err);
      } finally {
        setLoadingFunnels(false);
      }
    };

    fetchFunnels();
  }, [open, targetId, targetType]);

  const handleSave = async () => {
    if (!funnelId) {
      setError('Please select a funnel');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const newConfig: ReferralConfig = {
        enabled: true,
        funnelId,
        reward,
      };

      const response = await fetch('/api/coach/referral-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          referralConfig: newConfig,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/coach/referral-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          referralConfig: { enabled: false },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disable');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable');
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-brand-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                Edit Referral Settings
              </h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                {targetName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 -mr-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Funnel selector */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
            Referral Funnel
          </label>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
            The signup flow referred users will go through
          </p>
          {loadingFunnels ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#5f5a55]" />
              <span className="text-sm text-[#5f5a55]">Loading funnels...</span>
            </div>
          ) : funnels.length === 0 ? (
            <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] py-3">
              No funnels found for this {targetType}. Create a funnel first.
            </p>
          ) : (
            <Select value={funnelId} onValueChange={setFunnelId}>
              <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                <SelectValue placeholder="Select a funnel..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg">
                {funnels.map((funnel) => (
                  <SelectItem
                    key={funnel.id}
                    value={funnel.id}
                    className="cursor-pointer pl-3"
                  >
                    <div className="flex items-center gap-2">
                      <span>{funnel.name}</span>
                      {funnel.isDefault && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          Default
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50" />

        {/* Reward config */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-4 h-4 text-brand-accent" />
            <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
              Referral Reward
            </label>
          </div>
          <ReferralRewardSelector
            value={reward}
            onChange={setReward}
            organizationId={organizationId}
          />
        </div>
      </div>

      {/* Footer with blur */}
      <div className="relative flex-shrink-0 px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        {/* Blur gradient */}
        <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-white dark:from-[#171b22] to-transparent pointer-events-none" />

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={handleDisable}
            disabled={saving}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Disable
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || !funnelId}
            className="flex-1 h-11 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  // Render mobile drawer or desktop dialog
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[85vh] max-h-[85vh] flex flex-col">
          <VisuallyHidden>
            <DrawerTitle>Edit Referral Settings</DrawerTitle>
          </VisuallyHidden>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[10000]" onClose={() => onOpenChange(false)}>
        {/* Backdrop */}
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
              <Dialog.Panel className="w-full max-w-md max-h-[80vh] transform rounded-3xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all flex flex-col overflow-hidden">
                {content}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
