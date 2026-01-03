'use client';

import { Compass, Library } from 'lucide-react';

export type DiscoverViewMode = 'browse' | 'my-content';

interface BrowseMyContentPillsProps {
  selectedMode: DiscoverViewMode;
  onSelect: (mode: DiscoverViewMode) => void;
  myContentCount?: number;
}

/**
 * Tab bar toggle for Discover page to switch between Browse and My Content views.
 * Styled to match the squad page tab bar.
 */
export function BrowseMyContentPills({ 
  selectedMode, 
  onSelect,
  myContentCount 
}: BrowseMyContentPillsProps) {
  return (
    <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2">
      {/* Browse Tab */}
      <button
        onClick={() => onSelect('browse')}
        className={`flex-1 rounded-[32px] px-3 sm:px-4 py-2 font-albert text-[16px] sm:text-[18px] font-semibold tracking-[-1px] leading-[1.3] transition-all duration-200 ${
          selectedMode === 'browse'
            ? 'bg-white dark:bg-[#171b22] text-text-primary dark:text-[#f5f5f8] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
            : 'text-text-secondary dark:text-[#7d8190]'
        }`}
      >
        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
          <Compass className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span>Browse</span>
        </div>
      </button>

      {/* My Content Tab */}
      <button
        onClick={() => onSelect('my-content')}
        className={`flex-1 rounded-[32px] px-3 sm:px-4 py-2 font-albert text-[16px] sm:text-[18px] font-semibold tracking-[-1px] leading-[1.3] transition-all duration-200 ${
          selectedMode === 'my-content'
            ? 'bg-white dark:bg-[#171b22] text-text-primary dark:text-[#f5f5f8] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
            : 'text-text-secondary dark:text-[#7d8190]'
        }`}
      >
        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
          <Library className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="whitespace-nowrap">My Content</span>
          {myContentCount !== undefined && myContentCount > 0 && (
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
              selectedMode === 'my-content'
                ? 'bg-brand-accent/20 text-brand-accent dark:bg-brand-accent/20 dark:text-brand-accent'
                : 'bg-[#e1ddd8]/50 dark:bg-[#262b35] text-text-muted dark:text-[#7d8190]'
            }`}>
              {myContentCount}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
