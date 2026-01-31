'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Timer, CalendarDays, ListChecks, TrendingUp, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBranding } from '@/contexts/BrandingContext';

export interface WeekProgressItem {
  weekNumber: number;
  progressPercent: number;
  status: 'completed' | 'current' | 'future';
}

export interface CurrentWeekTask {
  id: string;
  label: string;
  completed: boolean;
}

interface WeekProgressListProps {
  weeks: WeekProgressItem[];
  currentWeek?: number;
  className?: string;
  thisWeekTasks?: { completed: number; total: number; tasks?: CurrentWeekTask[] };
  daysRemainingInWeek?: number;
  /** Total weeks including onboarding/closing (for UI display) */
  totalProgramWeeks?: number;
  /** Program end date for calculating days remaining */
  programEndDate?: string;
}

export function WeekProgressList({
  weeks,
  currentWeek = 1,
  className,
  thisWeekTasks,
  daysRemainingInWeek,
  totalProgramWeeks,
  programEndDate,
}: WeekProgressListProps) {
  const { effectiveBranding } = useBranding();
  const accentColor = effectiveBranding.colors.accentLight;

  if (weeks.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-5', className)}>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] text-center py-4">
          No program data
        </p>
      </div>
    );
  }

  // Use totalProgramWeeks if provided (includes onboarding/closing), otherwise fall back to weeks.length
  const totalWeeks = totalProgramWeeks ?? weeks.length;
  const displayWeeks = weeks.length; // For the dots display

  // UI-only: Recalculate completed weeks considering Friday evening as week end
  // If it's Saturday or Sunday, the current week should be considered "completed"
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Count weeks that are marked completed, plus current week if it's weekend
  const baseCompletedWeeks = weeks.filter(w => w.status === 'completed').length;
  const completedWeeks = isWeekend && currentWeek <= totalWeeks
    ? Math.max(baseCompletedWeeks, currentWeek) // On weekend, current week counts as done
    : baseCompletedWeeks;

  const currentWeekData = weeks.find(w => w.weekNumber === currentWeek);
  const currentWeekProgress = currentWeekData?.progressPercent ?? 0;

  // Calculate if they're on track
  const expectedCompletedWeeks = currentWeek - 1;
  const isOnTrack = completedWeeks >= expectedCompletedWeeks && currentWeekProgress >= 30;
  const isBehind = completedWeeks < expectedCompletedWeeks || (completedWeeks === expectedCompletedWeeks && currentWeekProgress < 20);
  const isAhead = completedWeeks > expectedCompletedWeeks;

  // Status config - Apple-style frosted glass badges
  const statusConfig = isAhead ? {
    label: 'Ahead',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-400/10 backdrop-blur-md',
    borderColor: 'border-emerald-500/20 dark:border-emerald-400/20',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  } : isBehind ? {
    label: 'Behind',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-500/10 dark:bg-amber-400/10 backdrop-blur-md',
    borderColor: 'border-amber-500/20 dark:border-amber-400/20',
    icon: AlertCircle,
    iconColor: 'text-amber-600 dark:text-amber-400',
  } : {
    label: 'On track',
    color: 'text-sky-700 dark:text-sky-300',
    bgColor: 'bg-sky-500/10 dark:bg-sky-400/10 backdrop-blur-md',
    borderColor: 'border-sky-500/20 dark:border-sky-400/20',
    icon: Clock,
    iconColor: 'text-sky-600 dark:text-sky-400',
  };

  const StatusIcon = statusConfig.icon;

  // Program progress percentage
  const programProgress = Math.round((currentWeek / totalWeeks) * 100);

  // Task completion percentage
  const taskCompletionPercent = thisWeekTasks && thisWeekTasks.total > 0
    ? Math.round((thisWeekTasks.completed / thisWeekTasks.total) * 100)
    : 0;

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-5', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30">
          <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Program Progress
          </h3>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
            Week {currentWeek} of {totalWeeks}
          </p>
        </div>
        {/* Status badge */}
        <div className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm',
          statusConfig.bgColor,
          statusConfig.borderColor
        )}>
          <StatusIcon className={cn('w-3.5 h-3.5', statusConfig.iconColor)} />
          <span className={cn('text-xs font-medium', statusConfig.color)}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Program Timeline */}
        <div className="p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a]">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-4 h-4 text-violet-500" />
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">Timeline</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {programProgress}%
            </span>
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
              complete
            </span>
          </div>
          {/* Timeline progress bar */}
          <div className="h-1.5 bg-[#e8e5e1] dark:bg-[#262b35] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${programProgress}%`,
                backgroundColor: accentColor,
              }}
            />
          </div>
        </div>

        {/* Weeks Completed */}
        <div className="p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a]">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">Weeks Done</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {completedWeeks}
            </span>
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
              of {totalWeeks}
            </span>
          </div>
          {/* Week dots with days remaining */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-0.5 flex-shrink-0">
              {weeks.slice(0, Math.min(displayWeeks, 12)).map((week) => (
                <div
                  key={week.weekNumber}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    week.status === 'completed' && 'bg-emerald-500',
                    week.status === 'current' && 'bg-violet-500',
                    week.status === 'future' && 'bg-[#d9d5d0] dark:bg-[#3a3f4a]',
                  )}
                />
              ))}
              {displayWeeks > 12 && (
                <span className="text-[10px] text-[#8c8c8c] dark:text-[#7d8190] ml-1">
                  +{displayWeeks - 12}
                </span>
              )}
            </div>
            {/* Days remaining */}
            {(() => {
              let daysRemaining: number | null = null;
              let isEstimate = false;

              if (programEndDate) {
                const endDate = new Date(programEndDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
              } else {
                const weeksRemaining = totalWeeks - currentWeek;
                if (weeksRemaining > 0) {
                  daysRemaining = weeksRemaining * 7;
                  isEstimate = true;
                }
              }

              if (daysRemaining !== null && daysRemaining > 0) {
                return (
                  <span className="text-[11.5px] sm:text-[12.5px] font-medium text-[#5f5a55] dark:text-[#a0a4b0] ml-auto whitespace-nowrap">
                    {isEstimate ? '~' : ''}{daysRemaining}d left
                  </span>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>

      {/* Task List Preview (if tasks exist) */}
      {thisWeekTasks && thisWeekTasks.tasks && thisWeekTasks.tasks.length > 0 && (
        <div className="pt-3 border-t border-[#e8e5e1] dark:border-[#262b35]">
          <p className="text-xs font-medium text-[#8c8c8c] dark:text-[#7d8190] mb-2">
            Week Tasks
          </p>
          <div className="space-y-1.5">
            {thisWeekTasks.tasks.slice(0, 3).map((task, index) => (
              <div key={task.id} className="flex items-center gap-2">
                <CircleDot className={cn(
                  'w-3.5 h-3.5 flex-shrink-0',
                  task.completed
                    ? 'text-emerald-500'
                    : 'text-[#c4c0bc] dark:text-[#4a4f5a]'
                )} />
                <span className={cn(
                  'text-sm truncate flex-1',
                  task.completed
                    ? 'text-[#8c8c8c] dark:text-[#7d8190] line-through'
                    : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                )}>
                  {task.label}
                </span>
                {index === 2 && thisWeekTasks.tasks && thisWeekTasks.tasks.length > 3 && (
                  <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] whitespace-nowrap">
                    +{thisWeekTasks.tasks.length - 3} more
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
