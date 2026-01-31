'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WeekProgressItem {
  weekNumber: number;
  progressPercent: number;
  status: 'completed' | 'current' | 'future';
}

interface WeekProgressListProps {
  weeks: WeekProgressItem[];
  currentWeek?: number;
  className?: string;
}

export function WeekProgressList({ weeks, currentWeek = 1, className }: WeekProgressListProps) {
  if (weeks.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-5', className)}>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] text-center py-4">
          No program data
        </p>
      </div>
    );
  }

  const totalWeeks = weeks.length;
  const completedWeeks = weeks.filter(w => w.status === 'completed').length;
  const currentWeekData = weeks.find(w => w.weekNumber === currentWeek);
  const currentWeekProgress = currentWeekData?.progressPercent ?? 0;

  // Calculate if they're on track
  // Expected: they should have completed (currentWeek - 1) weeks fully
  // Plus some progress in current week based on day of week
  const expectedCompletedWeeks = currentWeek - 1;
  const isOnTrack = completedWeeks >= expectedCompletedWeeks && currentWeekProgress >= 30;
  const isBehind = completedWeeks < expectedCompletedWeeks || (completedWeeks === expectedCompletedWeeks && currentWeekProgress < 20);
  const isAhead = completedWeeks > expectedCompletedWeeks;

  // Status config
  const statusConfig = isAhead ? {
    label: 'Ahead',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800/30',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
  } : isBehind ? {
    label: 'Behind',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800/30',
    icon: AlertCircle,
    iconColor: 'text-amber-500',
  } : {
    label: 'On track',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800/30',
    icon: Clock,
    iconColor: 'text-blue-500',
  };

  const StatusIcon = statusConfig.icon;

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-5', className)}>
      {/* Main content - two sections side by side */}
      <div className="flex items-stretch gap-4">
        {/* Left: Current position */}
        <div className="flex-1">
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] mb-1">Program Progress</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Week {currentWeek}
            </span>
            <span className="text-sm text-[#8c8c8c] dark:text-[#7d8190]">
              of {totalWeeks}
            </span>
          </div>

          {/* Mini progress bar */}
          <div className="mt-3 h-2 bg-[#f0ede9] dark:bg-[#262b35] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(currentWeek / totalWeeks) * 100}%` }}
            />
          </div>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] mt-1">
            {completedWeeks} week{completedWeeks !== 1 ? 's' : ''} completed
          </p>
        </div>

        {/* Divider */}
        <div className="w-px bg-[#e1ddd8] dark:bg-[#262b35]" />

        {/* Right: Status badge + this week's progress */}
        <div className="flex-1">
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] mb-1">This Week</p>

          {/* Status badge */}
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border',
            statusConfig.bgColor,
            statusConfig.borderColor
          )}>
            <StatusIcon className={cn('w-4 h-4', statusConfig.iconColor)} />
            <span className={cn('text-sm font-medium', statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>

          {/* This week's completion */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">Completion</span>
              <span className={cn(
                'text-sm font-medium',
                currentWeekProgress >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                currentWeekProgress >= 50 ? 'text-blue-600 dark:text-blue-400' :
                currentWeekProgress >= 20 ? 'text-amber-600 dark:text-amber-400' :
                'text-[#8c8c8c] dark:text-[#7d8190]'
              )}>
                {currentWeekProgress}%
              </span>
            </div>
            <div className="h-2 bg-[#f0ede9] dark:bg-[#262b35] rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  currentWeekProgress >= 80 ? 'bg-emerald-500' :
                  currentWeekProgress >= 50 ? 'bg-blue-500' :
                  currentWeekProgress >= 20 ? 'bg-amber-500' :
                  'bg-[#c4c0bc] dark:bg-[#4a4f5a]'
                )}
                style={{ width: `${currentWeekProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
