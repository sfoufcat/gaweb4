'use client';

/**
 * WeeklyOverviewCard Component
 *
 * Displays the current week's overview for weekly-oriented programs.
 * Shows week name, theme, task checklist, current focus, and notes.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Target,
  StickyNote,
  CheckCircle2,
  Circle,
  Sparkles,
} from 'lucide-react';
import type { ProgramWeek, ProgramTaskTemplate } from '@/types';

interface WeeklyOverviewCardProps {
  week: ProgramWeek;
  weekNumber: number;
  totalWeeks: number;
  completedTaskIds?: string[];
  onTaskToggle?: (taskLabel: string) => void;
  isExpanded?: boolean;
}

export function WeeklyOverviewCard({
  week,
  weekNumber,
  totalWeeks,
  completedTaskIds = [],
  onTaskToggle,
  isExpanded: initialExpanded = true,
}: WeeklyOverviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [localCompletedTasks, setLocalCompletedTasks] = useState<Set<string>>(
    new Set(completedTaskIds)
  );

  const tasks = week.weeklyTasks || [];
  const currentFocus = week.currentFocus || [];
  const notes = week.notes || [];

  const completedCount = tasks.filter((t) =>
    localCompletedTasks.has(t.label)
  ).length;
  const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const handleTaskClick = (taskLabel: string) => {
    setLocalCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskLabel)) {
        next.delete(taskLabel);
      } else {
        next.add(taskLabel);
      }
      return next;
    });
    onTaskToggle?.(taskLabel);
  };

  return (
    <div className="bg-white dark:bg-[#171b22] rounded-[20px] overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {/* Week Badge */}
          <div className="w-10 h-10 rounded-full bg-brand-accent/10 dark:bg-brand-accent/20 flex items-center justify-center">
            <span className="font-albert text-[14px] font-bold text-brand-accent">
              W{weekNumber}
            </span>
          </div>

          <div className="text-left">
            <h3 className="font-albert text-[17px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3]">
              {week.name || `Week ${weekNumber}`}
            </h3>
            {week.theme && (
              <p className="font-sans text-[13px] text-text-muted dark:text-[#7d8190] mt-0.5">
                {week.theme}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          {tasks.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-[#f3f1ef] dark:bg-[#262b35] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-brand-accent rounded-full"
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-[12px] text-text-muted dark:text-[#7d8190]">
                {completedCount}/{tasks.length}
              </span>
            </div>
          )}

          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
          </motion.div>
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5">
              {/* Week Description */}
              {week.description && (
                <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5]">
                  {week.description}
                </p>
              )}

              {/* Weekly Tasks */}
              {tasks.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-sans text-[13px] font-semibold text-text-secondary dark:text-[#b2b6c2] uppercase tracking-[0.5px]">
                    This Week&apos;s Tasks
                  </h4>
                  <div className="space-y-2">
                    {tasks.map((task, index) => {
                      const isCompleted = localCompletedTasks.has(task.label);
                      return (
                        <button
                          key={index}
                          onClick={() => handleTaskClick(task.label)}
                          className={`
                            w-full flex items-start gap-3 p-3 rounded-[12px]
                            bg-[#f9f8f7] dark:bg-[#11141b]
                            hover:bg-[#f3f1ef] dark:hover:bg-[#1a1f28]
                            transition-colors text-left
                          `}
                        >
                          <div className="shrink-0 mt-0.5">
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p
                              className={`font-sans text-[14px] text-text-primary dark:text-[#f5f5f8] leading-[1.4] ${
                                isCompleted ? 'line-through opacity-60' : ''
                              }`}
                            >
                              {task.label}
                            </p>
                            {task.notes && (
                              <p className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] mt-1">
                                {task.notes}
                              </p>
                            )}
                          </div>
                          {task.estimatedMinutes && (
                            <span className="shrink-0 text-[11px] text-text-muted dark:text-[#7d8190]">
                              {task.estimatedMinutes}m
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Current Focus (max 3) */}
              {currentFocus.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-brand-accent" />
                    <h4 className="font-sans text-[13px] font-semibold text-text-secondary dark:text-[#b2b6c2] uppercase tracking-[0.5px]">
                      Current Focus
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {currentFocus.slice(0, 3).map((focus, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-brand-accent shrink-0" />
                        <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                          {focus}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes (max 3) */}
              {notes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-amber-500" />
                    <h4 className="font-sans text-[13px] font-semibold text-text-secondary dark:text-[#b2b6c2] uppercase tracking-[0.5px]">
                      Notes
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {notes.slice(0, 3).map((note, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                        <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                          {note}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI-generated indicator */}
              {week.fillSource?.type === 'ai_prompt' ||
                (week.fillSource?.type === 'call_summary' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[#e8e4df] dark:border-[#262b35]">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-[11px] text-text-muted dark:text-[#7d8190]">
                      Generated from{' '}
                      {week.fillSource?.type === 'call_summary'
                        ? 'call summary'
                        : 'AI'}
                    </span>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
