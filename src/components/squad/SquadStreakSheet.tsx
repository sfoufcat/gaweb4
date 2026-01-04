'use client';

/**
 * SquadStreakSheet Component
 * 
 * Bottom sheet modal explaining how Squad Streak works.
 * Shows:
 * - Title: "Squad Streak"
 * - Explanation of 50% rule
 * - Contribution grid legend
 * - Detailed explanations
 * 
 * Matches Figma Squad Streak bottom sheet design.
 */

import { Drawer, DrawerContent } from '@/components/ui/drawer';

interface SquadStreakSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SquadStreakSheet({ isOpen, onClose }: SquadStreakSheetProps) {
  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent className="max-w-[500px] mx-auto">
        {/* Close button - Desktop only */}
        <button
          onClick={onClose}
          className="hidden sm:block absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="px-6 pt-5 sm:pt-8 pb-8 space-y-6">
          {/* Title */}
          <p className="font-albert text-[24px] font-medium text-text-secondary leading-[1.3] tracking-[-1.5px]">
            Squad Alignment
          </p>

          {/* Main Explanation */}
          <p className="font-sans text-[16px] text-text-primary leading-[1.5] tracking-[-0.3px]">
            Your squad&apos;s alignment compass shows how well your squad is following their growth routine today.
          </p>

          <p className="font-sans text-[16px] text-text-primary leading-[1.5] tracking-[-0.3px]">
            The number at the center shows the squad streak, which increases if more than 50% of members are fully aligned.
          </p>
        </div>

        {/* Home Indicator Spacer - Mobile only */}
        <div className="h-8 w-full flex justify-center sm:hidden">
          <div className="w-36 h-1.5 bg-gray-900 rounded-full opacity-20" />
        </div>
      </DrawerContent>
    </Drawer>
  );
}





