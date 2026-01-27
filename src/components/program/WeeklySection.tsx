'use client';

import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import type { WeeklyContentResponse } from '@/hooks/useProgramWeeklyContent';

interface WeeklySectionProps {
  week: WeeklyContentResponse['week'];
  totalWeeks?: number;
}

/**
 * WeeklySection Component
 *
 * Displays the weekly header context in a glass card including:
 * - Week indicator (e.g., "Onboarding Week" or "Week 3 of 10")
 * - Weekly theme as title
 * - Weekly description
 * - Weekly prompt (styled as callout)
 * - Weekly goals/focus areas
 *
 * This provides the client with context about the current week's focus.
 */
export function WeeklySection({ week, totalWeeks }: WeeklySectionProps) {
  if (!week) return null;

  const hasDescription = week.description;
  const hasGoals = week.currentFocus && week.currentFocus.length > 0;
  const hasPrompt = week.weeklyPrompt;
  const hasExtendedContent = hasDescription || hasGoals || hasPrompt;

  // Handle special week labels: 0 = Onboarding, -1 = Closing, 1+ = regular weeks
  const weekLabel = week.weekNumber === 0
    ? 'Onboarding Week'
    : week.weekNumber === -1
      ? 'Closing Week'
      : `Week ${week.weekNumber}${totalWeeks ? ` of ${totalWeeks}` : ''}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Glass Card Container - compact padding when minimal content */}
      <div className={`relative rounded-[20px] overflow-hidden bg-white/70 dark:bg-[#1c2026]/70 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-sm ${hasExtendedContent ? 'p-5' : 'p-4'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/5 pointer-events-none" />

        <div className="relative space-y-3">
          {/* Theme Title + Week Badge Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Weekly Theme (Title) */}
            {week.theme && (
              <h3 className="font-albert text-[20px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-0.8px] leading-[1.3]">
                {week.theme}
              </h3>
            )}
            {/* Week Indicator Badge - soft rounded pill */}
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100/80 dark:bg-amber-500/20 border border-amber-200/60 dark:border-amber-500/30">
              <span className="font-sans text-[12px] font-semibold text-amber-700 dark:text-amber-300 tracking-[-0.2px]">
                {weekLabel}
              </span>
            </span>
          </div>

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

          {/* Weekly Goals / Focus Areas */}
          {week.currentFocus && week.currentFocus.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-brand-accent" />
                <span className="font-sans text-[12px] font-medium text-text-muted dark:text-[#7d8190] uppercase tracking-wider">
                  Weekly Goals
                </span>
              </div>
              <ul className="space-y-2">
                {week.currentFocus.map((focus, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-2 shrink-0" />
                    <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5]">
                      {focus}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
