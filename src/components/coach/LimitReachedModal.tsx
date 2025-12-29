'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, X, Zap, ArrowUpRight } from 'lucide-react';
import type { CoachTier } from '@/types';
import { 
  TIER_PRICING, 
  PERMISSION_LABELS, 
  getLimit, 
  getNextTier,
  type PermissionKey 
} from '@/lib/coach-permissions';

// =============================================================================
// LIMIT REACHED MODAL
// =============================================================================

interface LimitReachedModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  
  /**
   * Callback to close the modal
   */
  onClose: () => void;
  
  /**
   * The permission/limit that was reached
   */
  limitKey: PermissionKey;
  
  /**
   * Current tier
   */
  currentTier: CoachTier;
  
  /**
   * Current count (how many they have now)
   */
  currentCount: number;
  
  /**
   * Optional custom title
   */
  title?: string;
  
  /**
   * Optional custom message
   */
  message?: string;
}

/**
 * LimitReachedModal - Modal shown when user hits a tier limit
 * 
 * Shows current usage, limit, and upgrade options.
 */
export function LimitReachedModal({
  isOpen,
  onClose,
  limitKey,
  currentTier,
  currentCount,
  title,
  message,
}: LimitReachedModalProps) {
  const router = useRouter();
  
  if (!isOpen) return null;

  const currentLimit = getLimit(currentTier, limitKey);
  const nextTier = getNextTier(currentTier);
  const nextTierLimit = nextTier ? getLimit(nextTier, limitKey) : null;
  const tierInfo = TIER_PRICING[currentTier];
  const nextTierInfo = nextTier ? TIER_PRICING[nextTier] : null;
  const featureLabel = PERMISSION_LABELS[limitKey];

  const handleUpgrade = () => {
    onClose();
    router.push('/coach/plan');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-text-secondary hover:text-text-primary dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>

          <h2 className="font-albert text-[22px] font-bold text-text-primary dark:text-[#f5f5f8] mb-2">
            {title || `${featureLabel} Limit Reached`}
          </h2>

          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
            {message || `You've reached the maximum of ${currentLimit} ${featureLabel.toLowerCase()} on your ${tierInfo.name} plan.`}
          </p>
        </div>

        {/* Current vs Next Tier */}
        <div className="px-6 pb-4">
          <div className="bg-[#faf8f6] dark:bg-[#0a0c10] rounded-xl p-4 space-y-3">
            {/* Current Plan */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
                  {tierInfo.name} (Current)
                </span>
              </div>
              <span className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8]">
                {currentCount} / {currentLimit === -1 ? '∞' : currentLimit}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full"
                style={{ width: '100%' }}
              />
            </div>

            {/* Next Tier */}
            {nextTier && nextTierLimit !== null && (
              <div className="flex items-center justify-between pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-brand-accent" />
                  <span className="font-sans text-[13px] font-medium text-brand-accent">
                    {nextTierInfo?.name}
                  </span>
                </div>
                <span className="font-albert text-[16px] font-semibold text-brand-accent">
                  {nextTierLimit === -1 ? 'Unlimited' : nextTierLimit}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-2 flex flex-col gap-3">
          {nextTier ? (
            <>
              <button
                onClick={handleUpgrade}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand-accent hover:bg-brand-accent/90 text-brand-accent-foreground font-sans font-semibold text-[15px] rounded-xl transition-colors"
              >
                <Zap className="w-5 h-5" />
                Upgrade to {nextTierInfo?.name}
              </button>
              <button
                onClick={onClose}
                className="w-full px-5 py-2.5 text-text-secondary dark:text-[#b2b6c2] font-sans font-medium text-[14px] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
              >
                Maybe Later
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-5 py-3 bg-[#f5f2ed] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] font-sans font-medium text-[15px] rounded-xl hover:bg-[#e9e5df] dark:hover:bg-[#2d333d] transition-colors"
            >
              Got it
            </button>
          )}
        </div>

        {/* Footer */}
        {nextTier && (
          <div className="px-6 pb-6 pt-0">
            <p className="font-sans text-[12px] text-text-tertiary dark:text-[#6b7280] text-center">
              {nextTierInfo?.name} starts at ${(nextTierInfo?.monthly || 0) / 100}/month
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HOOK FOR LIMIT CHECK
// =============================================================================

import { useState, useCallback } from 'react';
import { isLimitReached } from '@/lib/coach-permissions';

interface UseLimitCheckReturn {
  checkLimit: (key: PermissionKey, currentCount: number) => boolean;
  showLimitModal: (key: PermissionKey, currentCount: number) => void;
  modalProps: {
    isOpen: boolean;
    onClose: () => void;
    limitKey: PermissionKey;
    currentTier: CoachTier;
    currentCount: number;
  };
}

/**
 * Hook to check limits and show modal when reached
 */
export function useLimitCheck(currentTier: CoachTier): UseLimitCheckReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [limitKey, setLimitKey] = useState<PermissionKey>('max_clients');
  const [currentCount, setCurrentCount] = useState(0);

  const checkLimit = useCallback((key: PermissionKey, count: number): boolean => {
    return isLimitReached(currentTier, key, count);
  }, [currentTier]);

  const showLimitModal = useCallback((key: PermissionKey, count: number) => {
    setLimitKey(key);
    setCurrentCount(count);
    setIsOpen(true);
  }, []);

  const onClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    checkLimit,
    showLimitModal,
    modalProps: {
      isOpen,
      onClose,
      limitKey,
      currentTier,
      currentCount,
    },
  };
}

