'use client';

import React from 'react';
import Image from 'next/image';
import { Trophy, Flame, CheckSquare, BookOpen, User, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TopPerformer {
  userId: string;
  name: string;
  avatarUrl?: string;
  progress: number;
  streak: number;
  rank: number;
  tasksCompleted: number;
  totalTasks: number;
  contentCompleted: number;
  totalContent: number;
}

interface TopPerformerCardProps {
  performers: TopPerformer[];
  onViewClient?: (userId: string) => void;
  className?: string;
}

const RANK_STYLES = {
  1: {
    badge: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    text: 'text-amber-700',
    ring: 'ring-amber-400',
  },
  2: {
    badge: 'bg-gradient-to-br from-gray-300 to-gray-400',
    text: 'text-gray-600',
    ring: 'ring-gray-300',
  },
  3: {
    badge: 'bg-gradient-to-br from-amber-600 to-amber-700',
    text: 'text-amber-800',
    ring: 'ring-amber-600',
  },
};

export function TopPerformerCard({
  performers,
  onViewClient,
  className,
}: TopPerformerCardProps) {
  if (performers.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <Trophy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Top Performers
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center mb-3">
            <Crown className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6470]" />
          </div>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            No performance data yet
          </p>
          <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] mt-1">
            Top performers will appear as clients make progress
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <Trophy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Top Performers
            </h3>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
              Leading the program
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {performers.map((performer) => {
          const rankStyle = RANK_STYLES[performer.rank as 1 | 2 | 3] || {
            badge: 'bg-[#e1ddd8] dark:bg-[#262b35]',
            text: 'text-[#5f5a55] dark:text-[#b2b6c2]',
            ring: 'ring-transparent',
          };

          return (
            <button
              key={performer.userId}
              onClick={() => onViewClient?.(performer.userId)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a] hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-all text-left group"
            >
              {/* Rank badge */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0',
                  rankStyle.badge
                )}
              >
                {performer.rank}
              </div>

              {/* Avatar */}
              <div className={cn('flex-shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-[#faf8f6] dark:ring-offset-[#11141b]', rankStyle.ring)}>
                {performer.avatarUrl ? (
                  <Image
                    src={performer.avatarUrl}
                    alt={performer.name}
                    width={36}
                    height={36}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] flex items-center justify-center">
                    <User className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190]" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate group-hover:text-brand-accent transition-colors">
                  {performer.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckSquare className="w-3 h-3" />
                    {performer.tasksCompleted}/{performer.totalTasks}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    <BookOpen className="w-3 h-3" />
                    {performer.contentCompleted}/{performer.totalContent}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                    <Flame className="w-3 h-3" />
                    {performer.streak}d
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-20 flex-shrink-0 hidden sm:block">
                <div className="h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                    style={{ width: `${performer.progress}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
