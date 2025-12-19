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

interface SquadStreakSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SquadStreakSheet({ isOpen, onClose }: SquadStreakSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom Sheet / Modal */}
      <div className="relative w-full max-w-[500px] mx-4 bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Grabber - Mobile only */}
        <div className="flex justify-center pt-3 pb-2 sm:hidden">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>

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
            Your squad's alignment compass shows how well your squad is following their growth routine today.
          </p>

          <p className="font-sans text-[16px] text-text-primary leading-[1.5] tracking-[-0.3px]">
            The number at the center shows the squad streak, which increases if more than 50% of members are fully aligned.
          </p>
        </div>

        {/* Home Indicator Spacer - Mobile only */}
        <div className="h-8 w-full flex justify-center sm:hidden">
          <div className="w-36 h-1.5 bg-gray-900 rounded-full opacity-20" />
        </div>
      </div>
    </div>
  );
}





