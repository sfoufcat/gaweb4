'use client';

import type { SquadStats as SquadStatsType } from '@/types';
import { ContributionGrid } from './ContributionGrid';

/**
 * SquadStats Component
 * 
 * Stats tab showing:
 * - Average alignment score (based on member UserAlignment data, excludes coach)
 * - Change indicator (vs yesterday, green if positive, red if negative)
 * - Top percentile badge (calculated from all squads, lazy loaded)
 * - Contribution grid (fraction of members fully aligned each day, lazy loaded)
 * - Explanation cards
 * 
 * PERFORMANCE: Basic stats (avg, change) load instantly.
 * Heavy stats (percentile, contribution history) are lazy-loaded.
 * 
 * NOTE: Coach is EXCLUDED from all calculations - only regular members count.
 */

interface SquadStatsProps {
  stats: SquadStatsType;
  isLoadingExtras?: boolean;
  isLoadingMoreContributions?: boolean;
  hasMoreContributions?: boolean;
  onOpenStreakInfo: () => void;
  onLoadMore?: () => void;
}

export function SquadStats({ 
  stats, 
  isLoadingExtras = false, 
  isLoadingMoreContributions = false,
  hasMoreContributions = false,
  onOpenStreakInfo,
  onLoadMore,
}: SquadStatsProps) {
  // Use real computed stats
  const avgAlignment = stats.avgAlignment ?? 0;
  const alignmentChange = stats.alignmentChange ?? 0;
  const topPercentile = stats.topPercentile ?? 0;
  const hasPercentile = topPercentile > 0;
  const hasContributionHistory = stats.contributionHistory && stats.contributionHistory.length > 0;

  // Determine change indicator styling
  const isPositive = alignmentChange > 0;
  const isNegative = alignmentChange < 0;
  const isNeutral = alignmentChange === 0;
  
  const changeColor = isPositive ? '#4CAF50' : isNegative ? '#F44336' : '#9CA3AF';
  const changeBgColor = isPositive ? 'rgba(76,175,80,0.2)' : isNegative ? 'rgba(244,67,54,0.2)' : 'rgba(156,163,175,0.2)';

  return (
    <div className="space-y-3">
      {/* Average Alignment Score */}
      <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-6 text-center">
        <p className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1px] mb-2">
          Avg. alignment score
        </p>
        <div className="flex items-center justify-center gap-2">
          <p className="font-albert text-[36px] font-normal text-text-primary dark:text-[#f5f5f8] leading-[1.2] tracking-[-2px]">
            {avgAlignment}%
          </p>
          <div 
            className="rounded-[20px] px-2 py-1 flex items-center gap-1"
            style={{ backgroundColor: changeBgColor }}
          >
            <span 
              className="font-sans text-[12px] leading-[1.2]"
              style={{ color: changeColor }}
            >
              {isPositive ? '+' : ''}{alignmentChange}%
            </span>
            {!isNeutral && (
              <svg 
                className="w-4 h-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
                style={{ 
                  color: changeColor,
                  transform: isNegative ? 'rotate(180deg)' : 'none'
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
            {isNeutral && (
              <svg 
                className="w-4 h-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
                style={{ color: changeColor }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Top Percentile Badge */}
      <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[1000px] px-2 py-1 flex items-center justify-center gap-1">
        <svg className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        {isLoadingExtras && !hasPercentile ? (
          <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">
            Calculating rank...
          </span>
        ) : (
          <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">
            You are in top {topPercentile || '—'}% of squads
          </span>
        )}
      </div>

      {/* Contribution Grid */}
      <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 mt-4">
        {isLoadingExtras && !hasContributionHistory ? (
          <div className="space-y-2">
            <div className="animate-pulse h-6 w-16 bg-[#e1ddd8] dark:bg-[#262b35] rounded" />
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="w-[48px] h-[48px] rounded-[4px] animate-pulse bg-[#e1ddd8] dark:bg-[#262b35]" />
              ))}
            </div>
          </div>
        ) : (
          <ContributionGrid 
            contributionHistory={stats.contributionHistory} 
            onLoadMore={onLoadMore}
            isLoadingMore={isLoadingMoreContributions}
            hasMore={hasMoreContributions}
          />
        )}
      </div>

      {/* Explanation Cards */}
      <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 space-y-2">
        <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1px]">
          Contribution grid
        </h3>

        {/* Legend */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">{`<50%`}</span>
            <div className="w-full h-3 rounded-sm border border-[#e1ddd8] dark:border-[#262b35]" />
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">50-70%</span>
            <div className="w-full h-3 rounded-sm bg-[rgba(44,37,32,0.2)] dark:bg-[rgba(184,137,106,0.2)]" />
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">70-90%</span>
            <div className="w-full h-3 rounded-sm bg-[rgba(44,37,32,0.6)] dark:bg-[rgba(184,137,106,0.6)]" />
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">{`>90%`}</span>
            <div className="w-full h-3 rounded-sm bg-[#2c2520] dark:bg-brand-accent" />
          </div>
        </div>

        {/* Explanation Text */}
        <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2] tracking-[-0.3px] mt-2">
          Each square = one day. Darker = more members were fully aligned (100%). Lighter = fewer completed.
        </p>
        <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2] tracking-[-0.3px]">
          This way, everyone can see not only whether the streak is alive, but how much the whole squad is pushing together.
        </p>
        <button
          onClick={onOpenStreakInfo}
          className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2] tracking-[-0.3px] underline hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
        >
          Your squad keeps the streak only if more than 50% of members are fully aligned.
        </button>
      </div>
    </div>
  );
}





