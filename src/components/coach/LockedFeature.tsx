'use client';

import { Lock, Zap, ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { CoachTier } from '@/types';
import { TIER_PRICING, PERMISSION_LABELS, type PermissionKey } from '@/lib/coach-permissions';

// =============================================================================
// LOCKED FEATURE OVERLAY
// =============================================================================

interface LockedFeatureProps {
  /**
   * The permission that is locked
   */
  permission: PermissionKey;
  
  /**
   * The tier required to unlock this feature
   */
  requiredTier: CoachTier;
  
  /**
   * Optional custom title (defaults to permission label)
   */
  title?: string;
  
  /**
   * Optional custom description
   */
  description?: string;
  
  /**
   * The content to render behind the overlay
   */
  children: React.ReactNode;
  
  /**
   * Whether to blur the background content
   * @default true
   */
  blurContent?: boolean;
  
  /**
   * Optional className for the wrapper
   */
  className?: string;
}

/**
 * LockedFeature - Overlay component for gated features
 * 
 * Wraps content and shows a lock overlay with upgrade CTA
 * when the user's tier doesn't have access to the feature.
 */
export function LockedFeature({
  permission,
  requiredTier,
  title,
  description,
  children,
  blurContent = true,
  className = '',
}: LockedFeatureProps) {
  const router = useRouter();
  const tierInfo = TIER_PRICING[requiredTier];
  const featureLabel = title || PERMISSION_LABELS[permission];

  return (
    <div className={`relative ${className}`}>
      {/* Background Content */}
      <div className={blurContent ? 'blur-sm pointer-events-none select-none' : 'pointer-events-none select-none opacity-50'}>
        {children}
      </div>

      {/* Lock Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-[#0a0c10]/80 backdrop-blur-[2px] rounded-xl">
        <div className="text-center max-w-sm mx-auto px-6">
          {/* Lock Icon */}
          <div className="w-14 h-14 bg-gradient-to-br from-[#f5f2ed] to-[#e9e5df] dark:from-[#262b35] dark:to-[#1f242d] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Lock className="w-7 h-7 text-[#a07855] dark:text-[#b8896a]" />
          </div>

          {/* Title */}
          <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] mb-2">
            {featureLabel}
          </h3>

          {/* Description */}
          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] mb-5">
            {description || `Upgrade to ${tierInfo.name} to unlock this feature.`}
          </p>

          {/* Upgrade Button */}
          <button
            onClick={() => router.push('/coach/plan')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#a07855] to-[#c9a07a] text-white font-sans font-medium text-[14px] rounded-xl hover:shadow-lg transition-all"
          >
            <Zap className="w-4 h-4" />
            Upgrade to {tierInfo.name}
          </button>

          {/* Price hint */}
          <p className="mt-3 font-sans text-[12px] text-text-tertiary dark:text-[#6b7280]">
            Starting at ${tierInfo.monthly / 100}/month
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// LOCKED FEATURE BADGE
// =============================================================================

interface LockedFeatureBadgeProps {
  requiredTier: CoachTier;
  className?: string;
}

/**
 * Small badge showing which tier is required
 */
export function LockedFeatureBadge({ requiredTier, className = '' }: LockedFeatureBadgeProps) {
  const tierInfo = TIER_PRICING[requiredTier];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-[#f5f2ed] dark:bg-[#262b35] text-text-secondary dark:text-[#b2b6c2] text-[11px] font-medium rounded-full ${className}`}>
      <Lock className="w-3 h-3" />
      {tierInfo.name}
    </span>
  );
}

// =============================================================================
// INLINE LOCKED INDICATOR
// =============================================================================

interface LockedIndicatorProps {
  requiredTier: CoachTier;
  onClick?: () => void;
}

/**
 * Inline indicator that can be placed next to locked features in lists/menus
 */
export function LockedIndicator({ requiredTier, onClick }: LockedIndicatorProps) {
  const router = useRouter();
  const tierInfo = TIER_PRICING[requiredTier];

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push('/coach/plan');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-[#faf8f6] to-[#f5f2ed] dark:from-[#262b35] dark:to-[#1f242d] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:border-[#a07855] dark:border-[#b8896a] dark:hover:border-[#b8896a] transition-colors group"
    >
      <Lock className="w-3.5 h-3.5 text-[#9ca3af] group-hover:text-[#a07855] dark:text-[#b8896a] dark:group-hover:text-[#b8896a] transition-colors" />
      <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] group-hover:text-[#a07855] dark:text-[#b8896a] dark:group-hover:text-[#b8896a] transition-colors">
        {tierInfo.name}
      </span>
    </button>
  );
}

