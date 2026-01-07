'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useEveningCheckIn } from '@/hooks/useEveningCheckIn';
import { useDemoMode } from '@/contexts/DemoModeContext';
import type { EveningTaskReviewStepProps } from './types';

/**
 * EveningTaskReviewStep - Evening check-in task review
 *
 * Displays today's focus tasks with completion status,
 * shows emoji and messaging based on completion state.
 * Extracted from: src/app/checkin/evening/start/page.tsx
 */
export function EveningTaskReviewStep({ config, onComplete }: EveningTaskReviewStepProps) {
  const { isDemoMode } = useDemoMode();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasStartedCheckIn, setHasStartedCheckIn] = useState(false);

  // Get config values with defaults
  const {
    heading = 'Close your day',
    allCompletedEmoji = '👏',
    partialEmoji = '🌿',
    allCompletedTitle = 'Well done today',
    partialTitle = 'You did what you could today',
    allCompletedMessage = 'You showed up and moved things forward. Even small wins build big change.',
    partialMessage = "Progress isn't always linear — and that's okay. What matters is that you showed up with intention.",
    noTasksMessage = 'No focus tasks for today',
  } = config;

  // Get today's date
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Fetch today's tasks
  const { focusTasks, isLoading: tasksLoading } = useTasks({ date: today });
  const { startCheckIn } = useEveningCheckIn();

  // Demo tasks for the UI
  const demoTasks = useMemo(() => isDemoMode ? [
    { id: 'demo-1', title: 'Morning meditation', status: 'completed' },
    { id: 'demo-2', title: 'Review project goals', status: 'completed' },
    { id: 'demo-3', title: 'Complete workout', status: 'completed' },
    { id: 'demo-4', title: 'Read for 30 minutes', status: 'completed' },
    { id: 'demo-5', title: 'Plan tomorrow', status: 'pending' },
  ] : [], [isDemoMode]);

  // Use demo tasks or real tasks
  const displayTasks = isDemoMode ? demoTasks : focusTasks;

  // Calculate task completion
  const completedCount = displayTasks.filter(t => t.status === 'completed').length;
  const totalTasks = displayTasks.length;
  const allTasksCompleted = totalTasks > 0 && completedCount === totalTasks;

  // Start check-in on mount (after tasks are loaded)
  useEffect(() => {
    if (hasStartedCheckIn || tasksLoading || isDemoMode) return;

    const doStartCheckIn = async () => {
      try {
        await startCheckIn(completedCount, totalTasks);
        setHasStartedCheckIn(true);
      } catch (error) {
        console.error('Error starting evening check-in:', error);
      }
    };

    doStartCheckIn();
  }, [hasStartedCheckIn, tasksLoading, isDemoMode, startCheckIn, completedCount, totalTasks]);

  const handleContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Pass task completion data to the next step
    onComplete({
      tasksCompleted: completedCount,
      tasksTotal: totalTasks,
      allTasksCompleted,
    });
  };

  if (tasksLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a] dark:border-white" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-[480px] mx-auto flex-1 md:flex-initial flex flex-col pt-4 md:pt-0">
          {/* Header */}
          <p className="font-albert text-[20px] md:text-[28px] font-medium text-[#5f5a55] dark:text-[#a0a0a0] tracking-[-1.5px] leading-[1.3] mb-4 md:mb-8 text-center">
            {heading}
          </p>

          {/* Emoji */}
          <div className="text-[52px] md:text-[72px] text-center mb-4 md:mb-8">
            {allTasksCompleted ? allCompletedEmoji : partialEmoji}
          </div>

          {/* Title and description based on completion state */}
          <div className="text-center mb-6 md:mb-10">
            <h1 className="font-albert text-[22px] md:text-[28px] font-medium text-[#1a1a1a] dark:text-white tracking-[-1.5px] leading-[1.3] mb-3 md:mb-6">
              {allTasksCompleted ? allCompletedTitle : partialTitle}
            </h1>
            <p className="font-sans text-[16px] md:text-[20px] text-[#1a1a1a] dark:text-white/90 tracking-[-0.4px] leading-[1.4] max-w-[420px] mx-auto">
              {allTasksCompleted ? allCompletedMessage : partialMessage}
            </p>
          </div>

          {/* Task List */}
          <div className="flex flex-col gap-[6px] w-full mb-6">
            {displayTasks.map((task) => {
              const isCompleted = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  className="bg-[#f3f1ef] dark:bg-[#1a1f28] rounded-[14px] md:rounded-[20px] px-4 py-3 flex items-center gap-3"
                >
                  {/* Checkbox indicator */}
                  <div
                    className={`w-5 h-5 md:w-7 md:h-7 rounded-[5px] md:rounded-[6px] flex items-center justify-center border-2 flex-shrink-0 ${
                      isCompleted
                        ? 'bg-brand-accent border-brand-accent'
                        : 'border-[#d4d0cc] dark:border-[#3a3f48] bg-transparent'
                    }`}
                  >
                    {isCompleted && (
                      <Check className="w-3 h-3 md:w-5 md:h-5 text-white" strokeWidth={3} />
                    )}
                  </div>

                  {/* Task title */}
                  <span
                    className={`font-albert text-[16px] md:text-[18px] font-semibold tracking-[-0.8px] leading-[1.3] flex-1 ${
                      isCompleted
                        ? 'line-through text-[#8a857f] dark:text-[#6a6560]'
                        : 'text-[#1a1a1a] dark:text-white'
                    }`}
                  >
                    {task.title}
                  </span>
                </div>
              );
            })}

            {displayTasks.length === 0 && (
              <div className="bg-[#f3f1ef] dark:bg-[#1a1f28] rounded-[14px] md:rounded-[20px] px-4 py-4 text-center">
                <p className="font-sans text-[15px] md:text-[17px] text-[#5f5a55] dark:text-[#a0a0a0]">
                  {noTasksMessage}
                </p>
              </div>
            )}
          </div>

          {/* Spacer on mobile to push button down */}
          <div className="flex-1 md:hidden" />

          {/* Continue button */}
          <div className="mt-6 md:mt-10 pb-8 md:pb-0">
            <button
              onClick={handleContinue}
              disabled={isSubmitting}
              className="w-full bg-[#2c2520] text-white py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[17px] font-bold tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Loading...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
