'use client';

import React from 'react';
import { Calendar, CheckCircle, Circle, Clock } from 'lucide-react';
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

export function WeekProgressList({ weeks, currentWeek, className }: WeekProgressListProps) {
  if (weeks.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Week Progress
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            No weeks available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Week Progress
            </h3>
            {currentWeek && (
              <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                Currently on Week {currentWeek}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Week pills grid */}
      <div className="flex flex-wrap gap-2">
        {weeks.map((week) => {
          const isCompleted = week.status === 'completed';
          const isCurrent = week.status === 'current';
          const isFuture = week.status === 'future';

          return (
            <div
              key={week.weekNumber}
              className={cn(
                'relative flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 transition-all',
                isCompleted && 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
                isCurrent && 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800',
                isFuture && 'bg-[#faf8f6] dark:bg-[#11141b] border-[#e1ddd8] dark:border-[#262b35]'
              )}
            >
              {/* Status icon */}
              <div className="absolute -top-1.5 -right-1.5">
                {isCompleted && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}
                {isCurrent && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm animate-pulse">
                    <Clock className="w-3 h-3 text-white" />
                  </div>
                )}
                {isFuture && (
                  <div className="w-5 h-5 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] flex items-center justify-center">
                    <Circle className="w-3 h-3 text-[#a7a39e] dark:text-[#5f6470]" />
                  </div>
                )}
              </div>

              {/* Week number */}
              <span
                className={cn(
                  'text-sm font-bold font-albert',
                  isCompleted && 'text-emerald-700 dark:text-emerald-400',
                  isCurrent && 'text-blue-700 dark:text-blue-400',
                  isFuture && 'text-[#a7a39e] dark:text-[#5f6470]'
                )}
              >
                W{week.weekNumber}
              </span>

              {/* Progress percent */}
              <span
                className={cn(
                  'text-[10px] font-medium',
                  isCompleted && 'text-emerald-600 dark:text-emerald-500',
                  isCurrent && 'text-blue-600 dark:text-blue-500',
                  isFuture && 'text-[#c4c0bc] dark:text-[#4a4f5a]'
                )}
              >
                {week.progressPercent}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#f0ede9] dark:border-[#1e222a]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#e1ddd8] dark:bg-[#262b35]" />
          <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Upcoming</span>
        </div>
      </div>
    </div>
  );
}
