'use client';

import type { ContributionDay } from '@/types';

/**
 * ContributionGrid Component
 * 
 * GitHub-style heatmap showing squad contribution over time.
 * Each square represents one day, colored based on fraction of 
 * squad members who were fully aligned (100% alignment) on that day.
 * 
 * Color buckets:
 * - <50%  → lightest / almost white (border only)
 * - 50-70% → light gray
 * - 70-90% → medium gray
 * - >90%  → darkest
 */

interface ContributionGridProps {
  contributionHistory: ContributionDay[];
  month?: string; // e.g., "Nov"
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
}

/**
 * Get the current month abbreviation from the contribution history
 * or from current date if empty
 */
function getCurrentMonth(history: ContributionDay[]): string {
  if (history.length > 0) {
    // Use the most recent date in history
    const lastDate = new Date(history[history.length - 1].date);
    return lastDate.toLocaleDateString('en-US', { month: 'short' });
  }
  return new Date().toLocaleDateString('en-US', { month: 'short' });
}

/**
 * Get CSS class for the contribution day based on completion rate
 * Rate is the percentage of members who were fully aligned (0-100)
 */
function getContributionColor(rate: number): string {
  if (rate < 50) {
    // <50% → lightest (just border, no fill)
    return 'border border-[#e1ddd8] dark:border-[#262b35] bg-transparent';
  }
  if (rate < 70) {
    // 50-70% → light gray
    return 'bg-[rgba(44,37,32,0.2)] dark:bg-[rgba(184,137,106,0.2)]';
  }
  if (rate < 90) {
    // 70-90% → medium gray
    return 'bg-[rgba(44,37,32,0.6)] dark:bg-[rgba(184,137,106,0.6)]';
  }
  // >90% → darkest
  return 'bg-[#2c2520] dark:bg-[#b8896a]';
}

export function ContributionGrid({ 
  contributionHistory, 
  month,
  onLoadMore,
  isLoadingMore = false,
  hasMore = false,
}: ContributionGridProps) {
  // Use provided month or derive from history
  const displayMonth = month || getCurrentMonth(contributionHistory);

  // Use real contribution data (should be populated by API)
  // If empty, show a message instead of mock data
  const hasData = contributionHistory.length > 0;
  const days = contributionHistory;

  return (
    <div className="space-y-1">
      {/* Month Label */}
      <p className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1.5px]">
        {displayMonth}
      </p>

      {/* Grid */}
      {hasData ? (
        <div className="flex flex-wrap gap-1">
          {days.map((day) => (
            <div
              key={day.date}
              className={`w-[48px] h-[48px] rounded-[4px] ${getContributionColor(day.completionRate)}`}
              title={`${day.date}: ${Math.round(day.completionRate)}% of members fully aligned`}
            />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-text-secondary dark:text-[#b2b6c2]">
          <p className="font-sans text-[14px]">No contribution data yet.</p>
          <p className="font-sans text-[12px] mt-1">Data will appear as your squad stays aligned.</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-2">
        <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">
          Less
        </span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm border border-[#e1ddd8] dark:border-[#262b35]" />
          <div className="w-3 h-3 rounded-sm bg-[rgba(44,37,32,0.2)] dark:bg-[rgba(184,137,106,0.2)]" />
          <div className="w-3 h-3 rounded-sm bg-[rgba(44,37,32,0.6)] dark:bg-[rgba(184,137,106,0.6)]" />
          <div className="w-3 h-3 rounded-sm bg-[#2c2520] dark:bg-[#b8896a]" />
        </div>
        <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">
          More
        </span>
      </div>

      {/* Load More - only show if we have data and more available */}
      {hasData && hasMore && (
        <button 
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="flex items-center justify-center gap-1 w-full py-2 text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors disabled:opacity-50"
        >
          {isLoadingMore ? (
            <>
              <div className="w-4 h-4 border-2 border-text-secondary dark:border-[#b2b6c2] border-t-transparent rounded-full animate-spin" />
              <span className="font-sans text-[12px] leading-[1.2]">Loading...</span>
            </>
          ) : (
            <>
              <span className="font-sans text-[12px] leading-[1.2]">Load more</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}





