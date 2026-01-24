'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { AlertTriangle, Clock, TrendingDown, TrendingUp, Send, User, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface AttentionMember {
  userId: string;
  name: string;
  avatarUrl?: string;
  reason: 'low_progress' | 'idle' | 'both' | 'inactive' | 'missed_call' | 'overdue_tasks';
  metric: string;
  progress: number;
  lastActive?: string;
  daysInactive?: number;
}

interface NeedsAttentionCardProps {
  members: AttentionMember[];
  onNudge?: (userId: string) => Promise<boolean>;
  onViewClient?: (userId: string) => void;
  isNudging?: string | null;
  nudgedUsers?: Set<string>;
  className?: string;
}

const REASON_CONFIG = {
  low_progress: {
    icon: TrendingDown,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Low progress',
  },
  idle: {
    icon: Clock,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: 'Inactive',
  },
  both: {
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: 'Low progress & inactive',
  },
  inactive: {
    icon: Clock,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: 'Inactive',
  },
  missed_call: {
    icon: AlertTriangle,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    label: 'Missed call',
  },
  overdue_tasks: {
    icon: Clock,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    label: 'Overdue tasks',
  },
};

export function NeedsAttentionCard({
  members,
  onNudge,
  onViewClient,
  isNudging,
  nudgedUsers = new Set(),
  className,
}: NeedsAttentionCardProps) {
  // Track fade-in animation for sent confirmation
  const [showSentAnimation, setShowSentAnimation] = useState<Set<string>>(new Set());

  // Trigger animation when nudgedUsers changes
  useEffect(() => {
    nudgedUsers.forEach(userId => {
      if (!showSentAnimation.has(userId)) {
        setShowSentAnimation(prev => new Set([...prev, userId]));
      }
    });
  }, [nudgedUsers, showSentAnimation]);
  if (members.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Needs Attention
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Everyone is on track!
          </p>
          <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] mt-1">
            No members need attention right now
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Needs Attention
            </h3>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
              {members.length} member{members.length !== 1 ? 's' : ''} may need support
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {members.map((member) => {
          const config = REASON_CONFIG[member.reason];
          const ReasonIcon = config.icon;

          return (
            <div
              key={member.userId}
              className="flex items-center gap-3 p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9] dark:border-[#1e222a] hover:border-amber-200 dark:hover:border-amber-800/50 transition-colors group"
            >
              {/* Avatar */}
              <button
                onClick={() => onViewClient?.(member.userId)}
                className="flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                {member.avatarUrl ? (
                  <Image
                    src={member.avatarUrl}
                    alt={member.name}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] flex items-center justify-center">
                    <User className="w-5 h-5 text-[#8c8c8c] dark:text-[#7d8190]" />
                  </div>
                )}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => onViewClient?.(member.userId)}
                  className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate block hover:text-brand-accent transition-colors text-left"
                >
                  {member.name}
                </button>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('flex items-center gap-1 text-xs', config.color)}>
                    <ReasonIcon className="w-3 h-3" />
                    {member.metric}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-16 flex-shrink-0 hidden sm:block">
                <div className="h-1.5 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      member.progress < 30
                        ? 'bg-red-500'
                        : member.progress < 60
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                    )}
                    style={{ width: `${member.progress}%` }}
                  />
                </div>
                <p className="text-[10px] text-[#8c8c8c] dark:text-[#7d8190] mt-0.5 text-center">
                  {member.progress}%
                </p>
              </div>

              {/* Nudge button / Sent confirmation */}
              {onNudge && (
                <div className="flex-shrink-0">
                  {nudgedUsers.has(member.userId) ? (
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs text-green-600 dark:text-green-400 px-3 py-1.5 transition-all duration-300",
                        showSentAnimation.has(member.userId)
                          ? "opacity-100 translate-x-0"
                          : "opacity-0 translate-x-2"
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Sent
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNudge(member.userId)}
                      disabled={isNudging === member.userId}
                      className="text-brand-accent hover:text-brand-accent hover:bg-brand-accent/10"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      <span className="text-xs">Nudge</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
