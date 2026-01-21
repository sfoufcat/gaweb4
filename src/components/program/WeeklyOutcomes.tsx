'use client';

import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import type { WeeklyContentResponse } from '@/hooks/useProgramWeeklyContent';

interface WeeklyOutcomesProps {
  week: WeeklyContentResponse['week'];
}

/**
 * WeeklyOutcomes Component
 *
 * Displays the weekly outcomes/focus areas defined by the coach.
 * Only renders if outcomes exist for the week.
 *
 * Styled consistently with the existing coaching data sections.
 */
export function WeeklyOutcomes({ week }: WeeklyOutcomesProps) {
  if (!week?.currentFocus || week.currentFocus.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-white dark:bg-[#171b22] rounded-[20px] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-brand-accent" />
        <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
          This Week&apos;s Focus
        </h3>
      </div>

      <ul className="space-y-2.5">
        {week.currentFocus.map((focus, index) => (
          <motion.li
            key={index}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            className="flex items-start gap-3"
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center mt-0.5">
              <span className="text-[11px] font-semibold text-brand-accent">
                {index + 1}
              </span>
            </span>
            <span className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5]">
              {focus}
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
