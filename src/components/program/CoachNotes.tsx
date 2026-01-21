'use client';

import { motion } from 'framer-motion';
import { MessageSquare, StickyNote } from 'lucide-react';
import type { WeeklyContentResponse } from '@/hooks/useProgramWeeklyContent';

interface CoachNotesProps {
  week: WeeklyContentResponse['week'];
  coachName?: string;
}

/**
 * CoachNotes Component
 *
 * Displays the coach's notes for the week. This includes:
 * - Reminder notes (bulleted list)
 * - Manual notes (free-form text from coach)
 *
 * This section feels personal and supportive, providing guidance
 * without being instructional.
 */
export function CoachNotes({ week, coachName = 'Your Coach' }: CoachNotesProps) {
  const hasNotes = week?.notes && week.notes.length > 0;
  const hasManualNotes = week?.manualNotes && week.manualNotes.trim().length > 0;

  if (!hasNotes && !hasManualNotes) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-brand-accent" />
        <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
          From {coachName}
        </h3>
      </div>

      {/* Manual Notes - Personal message from coach */}
      {hasManualNotes && (
        <div className="bg-[#f8f6f4] dark:bg-[#11141b] rounded-[14px] p-4">
          <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6] whitespace-pre-wrap">
            {week!.manualNotes}
          </p>
        </div>
      )}

      {/* Reminder Notes - Bulleted list */}
      {hasNotes && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <StickyNote className="w-4 h-4 text-text-muted dark:text-[#7d8190]" />
            <span className="font-sans text-[13px] font-medium text-text-muted dark:text-[#7d8190] uppercase tracking-wider">
              Reminders
            </span>
          </div>
          <ul className="space-y-2">
            {week!.notes!.map((note, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="flex items-start gap-3"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-accent/60 dark:bg-brand-accent/70 flex-shrink-0 mt-2" />
                <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5]">
                  {note}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
