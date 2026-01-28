'use client';

import React from 'react';
import { Users, TrendingUp, Flame, BookOpen, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  trendValue,
}: StatCardProps) {
  return (
    <div className="flex flex-col p-4 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-xl', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        {trend && trendValue && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full',
              trend === 'up' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
              trend === 'down' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              trend === 'neutral' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            )}
          >
            {trend === 'up' && <ArrowUp className="w-3 h-3" />}
            {trend === 'down' && <ArrowDown className="w-3 h-3" />}
            {trend === 'neutral' && <Minus className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-tight">
          {value}
        </p>
        <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert">
          {label}
        </p>
        {subValue && (
          <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] font-albert">
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}

interface ProgramStats {
  activeClients: number;
  newThisWeek: number;
  avgTaskCompletion: number;
  taskCompletionRange?: { min: number; max: number };
  avgStreak: number;
  bestStreak: number;
  contentCompletion: number;
  totalContentItems: number;
  completedContentItems: number;
}

interface ClientStats {
  overallProgress: number;
  currentWeek: number;
  totalWeeks: number;
  currentStreak: number;
  bestStreak: number;
  contentCompletion: number;
  totalContentItems: number;
  completedContentItems: number;
  callsCompleted?: number;
  totalCalls?: number;
}

interface DashboardStatsRowProps {
  mode: 'program' | 'client';
  stats: ProgramStats | ClientStats;
  className?: string;
}

export function DashboardStatsRow({ mode, stats, className }: DashboardStatsRowProps) {
  if (mode === 'program') {
    const programStats = stats as ProgramStats;
    return (
      <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>
        <StatCard
          label="Active Clients"
          value={programStats.activeClients}
          subValue={programStats.newThisWeek > 0 ? `+${programStats.newThisWeek} this week` : undefined}
          icon={Users}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          trend={programStats.newThisWeek > 0 ? 'up' : 'neutral'}
          trendValue={programStats.newThisWeek > 0 ? `+${programStats.newThisWeek}` : '0'}
        />
        <StatCard
          label="Avg Task Completion"
          value={`${programStats.avgTaskCompletion ?? 0}%`}
          subValue="Last 7 days"
          icon={TrendingUp}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
        />
        <StatCard
          label="Avg Streak"
          value={`${programStats.avgStreak ?? 0} days`}
          subValue={`Best: ${programStats.bestStreak ?? 0} days`}
          icon={Flame}
          iconColor="text-orange-600 dark:text-orange-400"
          iconBg="bg-orange-100 dark:bg-orange-900/30"
        />
        <StatCard
          label="Content Completion"
          value={`${programStats.contentCompletion ?? 0}%`}
          subValue={`${programStats.completedContentItems ?? 0}/${programStats.totalContentItems ?? 0} items`}
          icon={BookOpen}
          iconColor="text-purple-600 dark:text-purple-400"
          iconBg="bg-purple-100 dark:bg-purple-900/30"
        />
      </div>
    );
  }

  // Client mode
  const clientStats = stats as ClientStats;
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>
      <StatCard
        label="Overall Progress"
        value={`${clientStats.overallProgress ?? 0}%`}
        subValue={`Week ${clientStats.currentWeek} of ${clientStats.totalWeeks}`}
        icon={TrendingUp}
        iconColor="text-emerald-600 dark:text-emerald-400"
        iconBg="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <StatCard
        label="Current Streak"
        value={`${clientStats.currentStreak ?? 0} days`}
        subValue={`Best: ${clientStats.bestStreak ?? 0} days`}
        icon={Flame}
        iconColor="text-orange-600 dark:text-orange-400"
        iconBg="bg-orange-100 dark:bg-orange-900/30"
      />
      <StatCard
        label="Content Completion"
        value={`${clientStats.contentCompletion ?? 0}%`}
        subValue={`${clientStats.completedContentItems ?? 0}/${clientStats.totalContentItems ?? 0} items`}
        icon={BookOpen}
        iconColor="text-purple-600 dark:text-purple-400"
        iconBg="bg-purple-100 dark:bg-purple-900/30"
      />
      <StatCard
        label="Current Week"
        value={`Week ${clientStats.currentWeek}`}
        subValue={`${clientStats.totalWeeks - clientStats.currentWeek} weeks remaining`}
        icon={Users}
        iconColor="text-blue-600 dark:text-blue-400"
        iconBg="bg-blue-100 dark:bg-blue-900/30"
      />
    </div>
  );
}
