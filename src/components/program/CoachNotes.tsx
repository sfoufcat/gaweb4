'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import type { WeeklyContentResponse } from '@/hooks/useProgramWeeklyContent';

interface CoachNotesProps {
  week: WeeklyContentResponse['week'];
  coachName?: string;
  coachImageUrl?: string;
}

/**
 * CoachNotes Component
 *
 * Displays the coach's notes for the week. This includes:
 * - Coach avatar and name
 * - Reminder notes (bulleted list styled like goals)
 * - Manual notes (free-form text from coach)
 *
 * This section feels personal and supportive, providing guidance
 * without being instructional.
 */
export function CoachNotes({ week, coachName = 'Your Coach', coachImageUrl }: CoachNotesProps) {
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
      className="bg-white dark:bg-[#171b22] rounded-[20px] p-5 space-y-4"
    >
      {/* Title */}
      <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
        Notes from your coach
      </h3>

      {/* Coach Avatar + Name */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full overflow-hidden bg-brand-accent/10 flex-shrink-0">
          {coachImageUrl ? (
            <Image
              src={coachImageUrl}
              alt={coachName}
              width={28}
              height={28}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[10px] font-medium text-brand-accent">
                {coachName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
          )}
        </div>
        <span className="font-albert text-[13px] font-medium text-text-muted dark:text-[#7d8190]">
          {coachName}
        </span>
      </div>

      {/* Manual Notes - Personal message from coach */}
      {hasManualNotes && (
        <div className="bg-[#f8f6f4] dark:bg-[#11141b] rounded-[14px] p-4">
          <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6] whitespace-pre-wrap">
            {week!.manualNotes}
          </p>
        </div>
      )}

      {/* Notes - Bulleted list styled like goals */}
      {hasNotes && (
        <ul className="space-y-2.5">
          {week!.notes!.map((note, index) => (
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
                {note}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
