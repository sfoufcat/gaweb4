'use client';

import React from 'react';
import { X, Circle, Calendar, Phone, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ProgramDay, ProgramInstanceDay, ProgramTaskTemplate, ProgramInstanceTask, ProgramHabitTemplate } from '@/types';

// Accept either ProgramDay or ProgramInstanceDay
type DayData = ProgramDay | ProgramInstanceDay;
type TaskData = ProgramTaskTemplate | ProgramInstanceTask;

interface DayPreviewPopupProps {
  isOpen: boolean;
  onClose: () => void;
  dayNumber: number; // 1-based day number within the week
  day: DayData | null;
  habits?: ProgramHabitTemplate[]; // Program-level habits
  weekNumber: number;
}

export function DayPreviewPopup({
  isOpen,
  onClose,
  dayNumber,
  day,
  habits = [],
  weekNumber,
}: DayPreviewPopupProps) {
  if (!day) return null;

  // Separate focus tasks from backlog
  const focusTasks = (day.tasks || []).filter((t) => t.isPrimary !== false);
  const backlogTasks = (day.tasks || []).filter((t) => t.isPrimary === false);

  // Get the source label for a task
  const getSourceLabel = (task: TaskData) => {
    const dayTag = 'dayTag' in task ? task.dayTag : undefined;
    if (dayTag === 'daily') return 'daily';
    if (dayTag === 'spread') return 'spread';
    if (typeof dayTag === 'number') return `day ${dayTag}`;
    return 'auto';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[80vh] overflow-hidden"
          >
            <div className="bg-white dark:bg-[#1e222a] rounded-2xl shadow-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e1ddd8]/60 dark:border-[#262b35]/60 bg-[#f7f5f3] dark:bg-[#11141b]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-accent/10 text-brand-accent">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Day {dayNumber} Preview
                    </h3>
                    <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                      Week {weekNumber} &middot; {day.title || `Day ${dayNumber}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-[#8c8c8c] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] hover:bg-[#e1ddd8]/40 dark:hover:bg-[#262b35]/40 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Focus Tasks */}
                <section>
                  <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                    Focus Tasks
                  </h4>
                  {focusTasks.length === 0 ? (
                    <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] italic">
                      No focus tasks for this day
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {focusTasks.map((task, idx) => (
                        <div
                          key={task.id || idx}
                          className="flex items-start gap-3 p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl"
                        >
                          <Circle className="w-4 h-4 text-[#c4c0bb] dark:text-[#4a4f5c] mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              {task.label}
                            </p>
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                              {getSourceLabel(task)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Habits */}
                {habits.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Habits
                    </h4>
                    <div className="space-y-2">
                      {habits.map((habit, idx) => (
                        <div
                          key={`habit-${idx}`}
                          className="flex items-center gap-3 p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl"
                        >
                          <Repeat className="w-4 h-4 text-brand-accent flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              {habit.title}
                            </p>
                            {habit.frequency && (
                              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                                {habit.frequency}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Sessions placeholder */}
                {(() => {
                  // Handle both ProgramInstanceDay (linkedEventIds) and ProgramDay (scheduledItems)
                  const eventCount = 'linkedEventIds' in day && day.linkedEventIds
                    ? day.linkedEventIds.length
                    : 'scheduledItems' in day && day.scheduledItems
                      ? day.scheduledItems.length
                      : 0;
                  if (eventCount === 0) return null;
                  return (
                    <section>
                      <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                        Sessions
                      </h4>
                      <div className="flex items-center gap-3 p-3 bg-brand-accent/5 rounded-xl border border-brand-accent/20">
                        <Phone className="w-4 h-4 text-brand-accent flex-shrink-0" />
                        <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                          {eventCount} scheduled session{eventCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </section>
                  );
                })()}

                {/* Backlog */}
                {backlogTasks.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Backlog
                    </h4>
                    <div className="space-y-2">
                      {backlogTasks.map((task, idx) => (
                        <div
                          key={task.id || idx}
                          className="flex items-start gap-3 p-3 bg-[#f7f5f3]/60 dark:bg-[#11141b]/60 rounded-xl opacity-70"
                        >
                          <Circle className="w-4 h-4 text-[#c4c0bb] dark:text-[#4a4f5c] mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                            {task.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Day prompt if exists */}
                {day.dailyPrompt && (
                  <section>
                    <h4 className="text-xs font-semibold text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3 font-albert">
                      Day Prompt
                    </h4>
                    <div className="p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl">
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-pre-wrap">
                        {day.dailyPrompt}
                      </p>
                    </div>
                  </section>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-[#e1ddd8]/60 dark:border-[#262b35]/60 bg-[#f7f5f3]/50 dark:bg-[#11141b]/50">
                <p className="text-xs text-center text-[#a7a39e] dark:text-[#7d8190] font-albert">
                  This is a preview of the computed day. Edit tasks in the Week Editor.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
