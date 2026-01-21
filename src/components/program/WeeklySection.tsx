'use client';

import { motion } from 'framer-motion';
import type { WeeklyContentResponse } from '@/hooks/useProgramWeeklyContent';

interface WeeklySectionProps {
  week: WeeklyContentResponse['week'];
  totalWeeks?: number;
}

/**
 * WeeklySection Component
 *
 * Displays the weekly header context including:
 * - Week indicator (e.g., "This Week" or "Week 3")
 * - Visual separator
 * - Weekly theme
 * - Weekly description and prompt
 *
 * This provides the client with context about the current week's focus.
 */
export function WeeklySection({ week, totalWeeks }: WeeklySectionProps) {
  if (!week) return null;

  const hasContent = week.theme || week.description || week.weeklyPrompt;
  if (!hasContent && !week.name) return null;

  // Handle special week labels: 0 = Onboarding, -1 = Closing, 1+ = regular weeks
  const weekLabel = week.weekNumber === 0 ? 'Onboarding' :
                    week.weekNumber === -1 ? 'Closing' :
                    `Week ${week.weekNumber}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-4"
    >
      {/* Week Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-albert text-[15px] font-semibold text-brand-accent tracking-[-0.3px]">
            This Week
          </span>
          <span className="text-[13px] text-text-muted dark:text-[#7d8190]">
            ·
          </span>
          <span className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
            {weekLabel}{totalWeeks ? ` of ${totalWeeks}` : ''}
          </span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-border-subtle dark:from-[#262b35] to-transparent" />
      </div>

      {/* Weekly Theme */}
      {week.theme && (
        <h3 className="font-albert text-[22px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
          {week.theme}
        </h3>
      )}

      {/* Weekly Description */}
      {week.description && (
        <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6] tracking-[-0.2px]">
          {week.description}
        </p>
      )}

      {/* Weekly Prompt - styled as a subtle callout */}
      {week.weeklyPrompt && (
        <div className="bg-brand-accent/5 dark:bg-brand-accent/10 rounded-[14px] p-4 border border-brand-accent/10 dark:border-brand-accent/15">
          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5] italic">
            &ldquo;{week.weeklyPrompt}&rdquo;
          </p>
        </div>
      )}
    </motion.div>
  );
}
