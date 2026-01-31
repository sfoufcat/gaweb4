'use client';

import React from 'react';
import { Activity, Zap, Clock, Flame, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskVelocity {
  completed: number;
  total: number;
  rate: number;
  trend: 'up' | 'down' | 'stable';
}

interface ResponseTimeMetric {
  avgHours: number | null;
  sameDayPercent: number;
  bucket: 'same_day' | 'next_day' | 'delayed' | 'no_data';
}

interface ConsistencyMetric {
  currentStreak: number;
  lastActiveDate: string | null;
  daysSinceActive: number;
  level: 'high' | 'moderate' | 'low' | 'inactive';
}

interface EngagementTrend {
  direction: 'improving' | 'stable' | 'declining';
  percentChange: number;
  warning: boolean;
}

interface EngagementInsightsProps {
  taskVelocity?: TaskVelocity;
  responseTime?: ResponseTimeMetric;
  consistency?: ConsistencyMetric;
  trend?: EngagementTrend;
  className?: string;
}

// Default values for when data is missing
const defaultTaskVelocity: TaskVelocity = { completed: 0, total: 0, rate: 0, trend: 'stable' };
const defaultResponseTime: ResponseTimeMetric = { avgHours: null, sameDayPercent: 0, bucket: 'no_data' };
const defaultConsistency: ConsistencyMetric = { currentStreak: 0, lastActiveDate: null, daysSinceActive: -1, level: 'inactive' };
const defaultTrend: EngagementTrend = { direction: 'stable', percentChange: 0, warning: false };

export function EngagementInsights({
  taskVelocity = defaultTaskVelocity,
  responseTime = defaultResponseTime,
  consistency = defaultConsistency,
  trend = defaultTrend,
  className,
}: EngagementInsightsProps) {
  // Calculate estimated time to complete remaining tasks
  // Uses average completion time (capped at 8h per task) and working hours (9-5)
  const calculateTimeToComplete = () => {
    const uncompletedTasks = taskVelocity.total - taskVelocity.completed;
    if (uncompletedTasks <= 0) return { hours: 0, display: 'Done!' };

    // Use average response time if available, capped at 8 hours per task
    const avgHoursPerTask = responseTime.avgHours !== null
      ? Math.min(responseTime.avgHours, 8)
      : 2; // Default 2 hours per task if no data

    const totalHours = uncompletedTasks * avgHoursPerTask;

    // Convert to working days (8 hours per day, 9-5)
    const workingHoursPerDay = 8;
    if (totalHours <= workingHoursPerDay) {
      // Less than a day - show hours
      if (totalHours < 1) return { hours: totalHours, display: `${Math.round(totalHours * 60)}m` };
      return { hours: totalHours, display: `${totalHours.toFixed(1)}h` };
    }

    // More than a day - show days
    const workingDays = Math.ceil(totalHours / workingHoursPerDay);
    return { hours: totalHours, display: `${workingDays}d` };
  };

  const timeToComplete = calculateTimeToComplete();

  // Format response time display (kept for reference but renamed)
  const formatResponseTime = () => {
    if (responseTime.avgHours === null) return 'No data';
    if (responseTime.avgHours < 1) return `${Math.round(responseTime.avgHours * 60)}m`;
    if (responseTime.avgHours < 24) return `${responseTime.avgHours.toFixed(1)}h`;
    return `${Math.round(responseTime.avgHours / 24)}d`;
  };

  // Format streak display
  const formatStreak = () => {
    if (consistency.currentStreak >= 1) {
      return `${consistency.currentStreak} day${consistency.currentStreak > 1 ? 's' : ''}`;
    }
    if (consistency.daysSinceActive === 0) return 'Active today';
    if (consistency.daysSinceActive === 1) return 'Yesterday';
    if (consistency.daysSinceActive > 0) return `${consistency.daysSinceActive}d ago`;
    return 'No activity';
  };

  // Get trend icon
  const TrendIcon = trend.direction === 'improving' ? TrendingUp :
    trend.direction === 'declining' ? TrendingDown : Minus;

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-5', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
          <Activity className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Engagement
          </h3>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
            Last 7 days
          </p>
        </div>
      </div>

      {/* 2x2 Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Task Velocity */}
        <div className="p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a]">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">Tasks</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {taskVelocity.completed}/{taskVelocity.total}
            </span>
            <span className={cn(
              'text-xs font-medium',
              taskVelocity.rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
              taskVelocity.rate >= 50 ? 'text-amber-600 dark:text-amber-400' :
              'text-red-600 dark:text-red-400'
            )}>
              {taskVelocity.rate}%
            </span>
            {taskVelocity.trend === 'up' && (
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            )}
            {taskVelocity.trend === 'down' && (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
          </div>
        </div>

        {/* Time to Complete */}
        <div className="p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a]">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">Time to complete</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {timeToComplete.display}
            </span>
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
              on avg {taskVelocity.total - taskVelocity.completed > 0 && `(${taskVelocity.total - taskVelocity.completed} task${taskVelocity.total - taskVelocity.completed !== 1 ? 's' : ''})`}
            </span>
          </div>
        </div>

        {/* Streak/Consistency */}
        <div className="p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a]">
          <div className="flex items-center gap-2 mb-1.5">
            <Flame className={cn(
              'w-4 h-4',
              consistency.currentStreak >= 3 ? 'text-orange-500' : 'text-[#a7a39e] dark:text-[#5f6470]'
            )} />
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">Streak</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {formatStreak()}
            </span>
            {consistency.level !== 'inactive' && (
              <span className={cn(
                'text-xs',
                consistency.level === 'high' && 'text-emerald-600 dark:text-emerald-400',
                consistency.level === 'moderate' && 'text-amber-600 dark:text-amber-400',
                consistency.level === 'low' && 'text-[#8c8c8c] dark:text-[#7d8190]',
              )}>
                {consistency.level}
              </span>
            )}
          </div>
        </div>

        {/* Engagement Trend */}
        <div className={cn(
          'p-3 rounded-xl border',
          trend.warning
            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
            : 'bg-[#faf8f6] dark:bg-[#11141b] border-[#f0ede9] dark:border-[#1e222a]'
        )}>
          <div className="flex items-center gap-2 mb-1.5">
            {trend.warning ? (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            ) : (
              <TrendIcon className={cn(
                'w-4 h-4',
                trend.direction === 'improving' && 'text-emerald-500',
                trend.direction === 'declining' && 'text-red-500',
                trend.direction === 'stable' && 'text-[#8c8c8c] dark:text-[#7d8190]',
              )} />
            )}
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">Trend</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              'text-lg font-semibold font-albert',
              trend.warning && 'text-red-600 dark:text-red-400',
              !trend.warning && trend.direction === 'improving' && 'text-emerald-600 dark:text-emerald-400',
              !trend.warning && trend.direction === 'declining' && 'text-red-600 dark:text-red-400',
              !trend.warning && trend.direction === 'stable' && 'text-[#1a1a1a] dark:text-[#f5f5f8]',
            )}>
              {trend.percentChange > 0 ? '+' : ''}{trend.percentChange}%
            </span>
            <span className={cn(
              'text-xs capitalize',
              trend.warning && 'text-red-600 dark:text-red-400',
              !trend.warning && 'text-[#8c8c8c] dark:text-[#7d8190]',
            )}>
              {trend.direction}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
