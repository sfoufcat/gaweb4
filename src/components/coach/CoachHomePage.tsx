'use client';

import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import {
  Users,
  BookOpen,
  UsersRound,
  Plus,
  ArrowRight,
  UserPlus,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MessageSquare,
  Target,
  Heart,
  Calendar,
  CreditCard,
  Rocket,
  CheckCircle2,
  Circle,
  X,
  Zap,
  BarChart3,
  ChevronRight,
  Lightbulb,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StoryAvatar } from '@/components/stories/StoryAvatar';
import { NotificationBell, NotificationIconButton } from '@/components/notifications';
import { CalendarButton, CalendarIconButton } from '@/components/scheduling';
import { ChatButton } from '@/components/chat/ChatButton';
import { ThemeToggle } from '@/components/theme';
import { ViewSwitcher } from '@/components/shared/ViewSwitcher';
import { useCurrentUserStoryAvailability } from '@/hooks/useUserStoryAvailability';
import { Progress } from '@/components/ui/progress';
import { CoachGoalModal, CoachGoalData } from './CoachGoalModal';
import { NewProgramModal } from './programs/NewProgramModal';
import { CreateSquadModal } from '@/components/admin/CreateSquadModal';
import { InviteClientsDialog } from './InviteClientsDialog';
import { FunnelEditorDialog } from './funnels/FunnelEditorDialog';
import type { Program as FullProgram } from '@/types';
import { useRouter } from 'next/navigation';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ============================================================================
// PREMIUM DESIGN TOKENS
// ============================================================================

// Glass card style - Apple-inspired with subtle backdrop blur
const glassCard = cn(
  'bg-white/70 dark:bg-[#1a1f2a]/70',
  'backdrop-blur-xl',
  'border border-white/20 dark:border-white/5',
  'shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)]',
  'dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3)]'
);

const glassCardHover = cn(
  glassCard,
  'hover:bg-white/80 dark:hover:bg-[#1a1f2a]/80',
  'hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12)]',
  'dark:hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.4)]',
  'transition-all duration-300'
);

// ============================================================================
// TIME PERIOD SELECTOR
// ============================================================================

type TimePeriod = 'today' | '7' | '30' | '90' | 'all';

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (value: TimePeriod) => void;
}

function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TimePeriod)}>
      <SelectTrigger className="w-[140px] h-9 rounded-xl bg-white/50 dark:bg-white/5 border-white/20 dark:border-white/10 font-albert text-sm backdrop-blur-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl backdrop-blur-xl bg-white/90 dark:bg-[#1a1f2a]/90 border-white/20 dark:border-white/10">
        <SelectItem value="today" className="font-albert">Today</SelectItem>
        <SelectItem value="7" className="font-albert">Last 7 days</SelectItem>
        <SelectItem value="30" className="font-albert">Last 30 days</SelectItem>
        <SelectItem value="90" className="font-albert">Last 90 days</SelectItem>
        <SelectItem value="all" className="font-albert">All time</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// GETTING STARTED CHECKLIST
// ============================================================================

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  isComplete: boolean;
  isLocked?: boolean;
}

interface GettingStartedCardProps {
  items: ChecklistItem[];
  onDismiss: () => void;
  totalRevenue: number;
}

function GettingStartedCard({ items, onDismiss, totalRevenue }: GettingStartedCardProps) {
  const completedCount = items.filter(i => i.isComplete).length;
  const progress = (completedCount / items.length) * 100;
  const allComplete = completedCount === items.length;

  // If all complete, show congratulations state
  if (allComplete && totalRevenue > 0) {
    return (
      <Card className={cn('rounded-2xl overflow-hidden', glassCard)}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary font-albert text-lg">
                  You&apos;re fully live
                </h3>
                <p className="text-text-secondary font-albert text-sm mt-0.5">
                  Your coaching business is set up and ready to scale.
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-text-tertiary" />
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('rounded-2xl overflow-hidden', glassCard)}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/20">
              <Rocket className="w-5 h-5 text-brand-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary font-albert">
                Launch Your Business
              </h3>
              <p className="text-xs text-text-secondary font-albert mt-0.5">
                {completedCount} of {items.length} complete
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Dismiss forever"
          >
            <X className="w-4 h-4 text-text-tertiary" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <Progress value={progress} className="h-1.5 bg-black/5 dark:bg-white/10" />
        </div>

        {/* Checklist items */}
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.isLocked ? '#' : item.href}
              className={cn(
                'group flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
                item.isComplete
                  ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                  : item.isLocked
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
              )}
              onClick={(e) => item.isLocked && e.preventDefault()}
            >
              <div className={cn(
                'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center',
                item.isComplete
                  ? 'bg-emerald-500 text-white'
                  : 'border-2 border-text-tertiary'
              )}>
                {item.isComplete && <CheckCircle2 className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-albert text-sm font-medium',
                  item.isComplete ? 'text-text-secondary line-through' : 'text-text-primary'
                )}>
                  {item.label}
                </p>
                {!item.isComplete && (
                  <p className="text-xs text-text-tertiary font-albert line-clamp-1">
                    {item.description}
                  </p>
                )}
              </div>
              {!item.isComplete && !item.isLocked && (
                <ChevronRight className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// REVENUE COMMAND CENTER (Primary Stat)
// ============================================================================

interface RevenueCommandCenterProps {
  totalRevenue: number;
  monthlyRevenue: number;
  monthlyGoal?: number;
  trend?: number;
  timePeriod: TimePeriod;
}

function RevenueCommandCenter({
  totalRevenue,
  monthlyRevenue,
  monthlyGoal = 0,
  trend,
  timePeriod,
}: RevenueCommandCenterProps) {
  const progressToGoal = monthlyGoal > 0 ? Math.min((monthlyRevenue / monthlyGoal) * 100, 100) : 0;
  const isPositiveTrend = trend !== undefined && trend >= 0;

  return (
    <div className={cn('rounded-2xl p-6', glassCard)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-albert text-text-secondary mb-1">
            {timePeriod === 'today' ? "Today's Revenue" : timePeriod === 'all' ? 'Total Revenue' : `Revenue (${timePeriod}d)`}
          </p>
          <p className="text-4xl font-bold font-albert text-text-primary tracking-tight">
            ${totalRevenue.toLocaleString()}
          </p>
          {trend !== undefined && (
            <div className={cn(
              'flex items-center gap-1 mt-2 text-sm font-albert',
              isPositiveTrend ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            )}>
              {isPositiveTrend ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{isPositiveTrend ? '+' : ''}{trend}% vs last period</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
          <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
      </div>

      {monthlyGoal > 0 && (
        <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between text-sm font-albert mb-2">
            <span className="text-text-secondary">Monthly Goal</span>
            <span className="text-text-primary font-medium">
              ${monthlyRevenue.toLocaleString()} / ${monthlyGoal.toLocaleString()}
            </span>
          </div>
          <Progress value={progressToGoal} className="h-2 bg-black/5 dark:bg-white/10" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECONDARY STAT CARDS (Growth Levers)
// ============================================================================

interface SecondaryStatProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  href?: string;
  trend?: number;
  variant?: 'default' | 'alert';
}

function SecondaryStat({
  label,
  value,
  subValue,
  icon: Icon,
  href,
  trend,
  variant = 'default',
}: SecondaryStatProps) {
  const isAlert = variant === 'alert';
  const isPositiveTrend = trend !== undefined && trend >= 0;

  const content = (
    <div className={cn(
      'group p-4 rounded-xl transition-all duration-200',
      isAlert
        ? 'bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/30'
        : 'bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10',
      href && 'cursor-pointer'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className={cn(
          'p-2 rounded-lg',
          isAlert
            ? 'bg-amber-100/80 dark:bg-amber-800/30'
            : 'bg-black/5 dark:bg-white/10'
        )}>
          <Icon className={cn(
            'w-4 h-4',
            isAlert ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary'
          )} />
        </div>
        {href && (
          <ArrowUpRight className="w-3.5 h-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <p className={cn(
        'text-2xl font-bold font-albert tracking-tight',
        isAlert ? 'text-amber-700 dark:text-amber-300' : 'text-text-primary'
      )}>
        {value}
      </p>
      <p className={cn(
        'text-xs font-albert mt-0.5',
        isAlert ? 'text-amber-600/80 dark:text-amber-400/80' : 'text-text-secondary'
      )}>
        {label}
      </p>
      {(subValue || trend !== undefined) && (
        <p className={cn(
          'text-xs font-albert mt-1 flex items-center gap-1',
          isAlert
            ? 'text-amber-500/80 dark:text-amber-500/60'
            : trend !== undefined
              ? isPositiveTrend
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
              : 'text-text-tertiary'
        )}>
          {trend !== undefined && (
            isPositiveTrend ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
          )}
          {subValue || (trend !== undefined ? `${isPositiveTrend ? '+' : ''}${trend}%` : '')}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ============================================================================
// REVENUE PLAN CARD (Coach Goal)
// ============================================================================

interface RevenuePlanCardProps {
  currentMRR: number;
  monthlyGoal?: number;
  avgRevenuePerClient?: number;
  activeClients: number;
  isLoading?: boolean;
  onSetGoal?: () => void;
  onEditGoal?: () => void;
}

function RevenuePlanCard({
  currentMRR,
  monthlyGoal = 0,
  avgRevenuePerClient = 0,
  activeClients,
  isLoading,
  onSetGoal,
  onEditGoal,
}: RevenuePlanCardProps) {
  if (isLoading) {
    return (
      <Card className={cn('rounded-2xl', glassCard)}>
        <CardContent className="p-5">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-32 bg-black/5 dark:bg-white/10 rounded-full" />
            <div className="h-8 w-full bg-black/5 dark:bg-white/10 rounded-lg" />
            <div className="h-3 w-24 bg-black/5 dark:bg-white/10 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No goal set
  if (!monthlyGoal || monthlyGoal <= 0) {
    return (
      <Card className={cn('rounded-2xl', glassCard)}>
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-brand-accent/10 dark:bg-brand-accent/20">
              <Target className="w-4 h-4 text-brand-accent" />
            </div>
            <h3 className="font-semibold text-text-primary font-albert text-sm">
              Revenue Plan
            </h3>
          </div>
          <p className="text-text-secondary font-albert text-sm mb-4">
            Set a monthly revenue goal to track your path to growth.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl font-albert text-sm h-9"
            onClick={onSetGoal}
          >
            <Target className="w-4 h-4 mr-1.5" />
            Set Revenue Goal
          </Button>
        </CardContent>
      </Card>
    );
  }

  const progress = Math.min((currentMRR / monthlyGoal) * 100, 100);
  const gap = Math.max(monthlyGoal - currentMRR, 0);
  const clientsNeeded = avgRevenuePerClient > 0 ? Math.ceil(gap / avgRevenuePerClient) : 0;

  return (
    <Card className={cn('rounded-2xl', glassCard)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-accent/10 dark:bg-brand-accent/20">
              <Target className="w-4 h-4 text-brand-accent" />
            </div>
            <h3 className="font-semibold text-text-primary font-albert text-sm">
              Path to ${monthlyGoal.toLocaleString()}/mo
            </h3>
          </div>
          <button
            onClick={onEditGoal}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Edit
          </button>
        </div>

        {/* Progress visualization */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold font-albert text-text-primary">
                ${currentMRR.toLocaleString()}
              </p>
              <p className="text-xs text-text-secondary font-albert">Current MRR</p>
            </div>
            <p className="text-lg font-semibold font-albert text-text-tertiary">
              {Math.round(progress)}%
            </p>
          </div>

          <Progress value={progress} className="h-2 bg-black/5 dark:bg-white/10" />

          {gap > 0 && (
            <div className="pt-3 border-t border-black/5 dark:border-white/5">
              <p className="text-sm font-albert text-text-secondary">
                <span className="text-text-primary font-medium">${gap.toLocaleString()}</span> to go
                {clientsNeeded > 0 && avgRevenuePerClient > 0 && (
                  <span className="text-text-tertiary">
                    {' '}· ~{clientsNeeded} more {clientsNeeded === 1 ? 'client' : 'clients'} at ${avgRevenuePerClient.toLocaleString()}/avg
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// AI-POWERED SUGGESTIONS (What To Do Next)
// ============================================================================

interface Suggestion {
  id: string;
  title: string;
  description: string;
  action: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
  icon?: React.ElementType;
}

interface WhatToDoNextProps {
  suggestions: Suggestion[];
  isLoading?: boolean;
}

function WhatToDoNext({ suggestions, isLoading }: WhatToDoNextProps) {
  if (isLoading) {
    return (
      <Card className={cn('rounded-2xl', glassCard)}>
        <CardContent className="p-5">
          <div className="animate-pulse space-y-4">
            <div className="h-5 w-40 bg-black/5 dark:bg-white/10 rounded-full" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-black/5 dark:bg-white/10 rounded-xl" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card className={cn('rounded-2xl', glassCard)}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-purple-500/10 dark:bg-purple-500/20">
            <Lightbulb className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-semibold text-text-primary font-albert text-sm">
            What To Do Next
          </h3>
        </div>

        <div className="space-y-2">
          {suggestions.slice(0, 3).map((suggestion) => {
            const IconComponent = suggestion.icon || Zap;
            return (
              <Link
                key={suggestion.id}
                href={suggestion.href}
                className="group flex items-start gap-3 p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <div className={cn(
                  'flex-shrink-0 p-2 rounded-lg',
                  suggestion.priority === 'high'
                    ? 'bg-rose-500/10 dark:bg-rose-500/20'
                    : suggestion.priority === 'medium'
                      ? 'bg-amber-500/10 dark:bg-amber-500/20'
                      : 'bg-blue-500/10 dark:bg-blue-500/20'
                )}>
                  <IconComponent className={cn(
                    'w-4 h-4',
                    suggestion.priority === 'high'
                      ? 'text-rose-600 dark:text-rose-400'
                      : suggestion.priority === 'medium'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-blue-600 dark:text-blue-400'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-albert text-sm font-medium text-text-primary line-clamp-1">
                    {suggestion.title}
                  </p>
                  <p className="text-xs text-text-tertiary font-albert line-clamp-1 mt-0.5">
                    {suggestion.description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0 h-8 text-xs font-albert opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {suggestion.action}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// QUICK ACTIONS (Business-Focused)
// ============================================================================

interface QuickActionButtonProps {
  label: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

function QuickActionButton({ label, icon: Icon, href, onClick, variant = 'secondary' }: QuickActionButtonProps) {
  const buttonContent = (
    <Button
      variant={variant === 'primary' ? 'default' : 'outline'}
      onClick={onClick}
      className={cn(
        'h-10 px-4 rounded-xl gap-2 font-albert text-sm',
        variant === 'secondary' && 'bg-white/50 dark:bg-white/5 border-white/20 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Button>
  );

  if (href && !onClick) {
    return <Link href={href}>{buttonContent}</Link>;
  }

  return buttonContent;
}

// ============================================================================
// PROGRAM/SQUAD CARDS (Compact)
// ============================================================================

interface ProgramCardProps {
  name: string;
  type: 'group' | 'individual';
  activeEnrollments: number;
  totalRevenue?: number;
  id: string;
}

function ProgramCard({ name, type, activeEnrollments, totalRevenue, id }: ProgramCardProps) {
  return (
    <Link
      href={`/coach?tab=programs&programId=${id}`}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
        'bg-white/40 dark:bg-white/5',
        'hover:bg-white/60 dark:hover:bg-white/10'
      )}
    >
      <div className={cn(
        'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
        type === 'group'
          ? 'bg-purple-100/80 dark:bg-purple-900/30'
          : 'bg-blue-100/80 dark:bg-blue-900/30'
      )}>
        {type === 'group' ? (
          <UsersRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        ) : (
          <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-text-primary font-albert truncate text-sm">
          {name}
        </h4>
        <p className="text-xs text-text-secondary font-albert">
          {activeEnrollments} active
          {totalRevenue !== undefined && totalRevenue > 0 && (
            <span className="text-text-tertiary"> · ${totalRevenue.toLocaleString()}</span>
          )}
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

interface SquadCardProps {
  name: string;
  memberCount: number;
  id: string;
}

function SquadCard({ name, memberCount, id }: SquadCardProps) {
  return (
    <Link
      href={`/coach?tab=squads&squadId=${id}`}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
        'bg-white/40 dark:bg-white/5',
        'hover:bg-white/60 dark:hover:bg-white/10'
      )}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-100/80 dark:bg-emerald-900/30">
        <UsersRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-text-primary font-albert truncate text-sm">
          {name}
        </h4>
        <p className="text-xs text-text-secondary font-albert">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

// ============================================================================
// FEED ACTIVITY CARD (Demoted)
// ============================================================================

interface FeedActivityCardProps {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  isLoading?: boolean;
}

function FeedActivityCard({ totalPosts, totalLikes, totalComments, isLoading }: FeedActivityCardProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3 p-4 rounded-xl bg-white/30 dark:bg-white/5">
        <div className="h-4 w-24 bg-black/5 dark:bg-white/10 rounded-full" />
        <div className="h-6 w-full bg-black/5 dark:bg-white/10 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white/30 dark:bg-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-albert font-medium text-text-primary">Community</span>
        </div>
        <Link
          href="/feed"
          className="text-xs text-text-tertiary hover:text-text-secondary font-albert transition-colors"
        >
          View Feed →
        </Link>
      </div>
      <div className="flex items-center gap-4 text-sm font-albert text-text-secondary">
        <span>{totalPosts} posts</span>
        <span className="text-text-tertiary">·</span>
        <span className="flex items-center gap-1">
          <Heart className="w-3 h-3 text-rose-500" />
          {totalLikes}
        </span>
        <span className="text-text-tertiary">·</span>
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-blue-500" />
          {totalComments}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/10" />
          <div className="space-y-2">
            <div className="h-5 w-32 bg-black/5 dark:bg-white/10 rounded-full" />
            <div className="h-4 w-24 bg-black/5 dark:bg-white/10 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10" />
          <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10" />
        </div>
      </div>

      {/* Revenue card skeleton */}
      <div className="h-40 bg-black/5 dark:bg-white/10 rounded-2xl" />

      {/* Stats row skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-black/5 dark:bg-white/10 rounded-xl" />
        ))}
      </div>

      {/* Two column grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 bg-black/5 dark:bg-white/10 rounded-2xl" />
        <div className="h-48 bg-black/5 dark:bg-white/10 rounded-2xl" />
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex p-5 rounded-2xl bg-brand-accent/10 dark:bg-brand-accent/20 mb-6">
        <Rocket className="w-10 h-10 text-brand-accent" />
      </div>
      <h3 className="text-2xl font-bold text-text-primary font-albert mb-3">
        Welcome to your command center
      </h3>
      <p className="text-text-secondary font-albert mb-8 max-w-md mx-auto">
        Let&apos;s get your coaching business live. Start by creating your first offer.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/coach?tab=programs">
          <Button className="h-11 px-6 rounded-xl gap-2 font-albert">
            <Plus className="w-5 h-5" />
            Create Your First Offer
          </Button>
        </Link>
        <Link href="/coach?tab=clients">
          <Button variant="outline" className="h-11 px-6 rounded-xl gap-2 font-albert bg-white/50 dark:bg-white/5 border-white/20 dark:border-white/10">
            <UserPlus className="w-5 h-5" />
            Invite a Client
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Program {
  id: string;
  name: string;
  type: 'group' | 'individual';
  activeEnrollments: number;
  totalEnrollments: number;
  totalRevenue?: number;
}

interface ProgramsResponse {
  programs: Program[];
  totalCount?: number;
}

interface Squad {
  id: string;
  name: string;
  memberCount: number;
}

interface SquadsResponse {
  squads: Squad[];
  totalCount?: number;
}

interface ClientsData {
  summary?: {
    totalClients?: number;
    activeCount?: number;
    atRiskCount?: number;
  };
}

interface ProductsData {
  summary?: {
    totalRevenue?: number;
    totalEnrollments?: number;
    monthlyRevenue?: number;
    avgRevenuePerClient?: number;
  };
  programs?: Array<{
    id: string;
    totalRevenue: number;
  }>;
}

interface FeedData {
  summary?: {
    totalPosts?: number;
    totalLikes?: number;
    totalComments?: number;
    activePosters?: number;
  };
  posters?: Array<{
    userId: string;
    name: string;
    avatarUrl?: string;
    postCount: number;
  }>;
}

interface UserGoalData {
  goal?: {
    goal?: string;
    targetDate?: string;
    progress?: { percentage: number };
    // Coach-specific goal fields
    monthlyRevenueGoal?: number;
    targetClients?: number;
  };
}

interface OrgSettingsData {
  stripeConnectStatus?: 'not_connected' | 'pending' | 'connected';
  coachDashboardChecklistDismissed?: boolean;
  defaultFunnelId?: string | null;
}

interface SuggestionsResponse {
  suggestions: Suggestion[];
}

interface FunnelsData {
  funnels: Array<{ id: string }>;
  totalCount?: number;
}

interface RevenueGoalData {
  monthlyRevenueGoal: number | null;
  targetClients: number | null;
  goalSetAt: string | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CoachHomePage() {
  const { user } = useUser();
  const router = useRouter();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30');
  const [greeting, setGreeting] = useState('Good morning');
  const [mounted, setMounted] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  // Quick Action modals
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [squadModalOpen, setSquadModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [funnelModalOpen, setFunnelModalOpen] = useState(false);

  // Story availability for avatar
  const storyAvailability = useCurrentUserStoryAvailability();
  const currentUserId = user?.id || '';

  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // Calculate days param for API
  const days = timePeriod === 'all' ? '0' : timePeriod === 'today' ? '1' : timePeriod;

  // Fetch programs
  const { data: programsData, isLoading: programsLoading } = useSWR<ProgramsResponse>(
    '/api/coach/org-programs',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch squads
  const { data: squadsData, isLoading: squadsLoading } = useSWR<SquadsResponse>(
    '/api/coach/org-squads',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch funnels (for checklist)
  const { data: funnelsData } = useSWR<FunnelsData>(
    '/api/coach/org-funnels',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch client analytics
  const { data: clientsData, isLoading: clientsLoading } = useSWR<ClientsData>(
    '/api/coach/analytics/clients',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch product analytics (revenue)
  const { data: productsData, isLoading: productsLoading } = useSWR<ProductsData>(
    `/api/coach/analytics/products?days=${days}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch feed analytics
  const { data: feedData, isLoading: feedLoading } = useSWR<FeedData>(
    `/api/coach/analytics/feed?days=${days}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch coach's personal goal
  const { data: userData, isLoading: userLoading } = useSWR<UserGoalData>(
    '/api/user/me',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch org settings (for Stripe status and checklist state)
  const { data: orgSettings, mutate: mutateOrgSettings } = useSWR<OrgSettingsData>(
    '/api/coach/org-settings',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch AI suggestions
  const { data: suggestionsData, isLoading: suggestionsLoading } = useSWR<SuggestionsResponse>(
    '/api/coach/suggestions',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 300000 } // Refresh every 5 minutes
  );

  // Fetch coach revenue goal
  const { data: revenueGoalData, isLoading: revenueGoalLoading, mutate: mutateRevenueGoal } = useSWR<RevenueGoalData>(
    '/api/coach/revenue-goal',
    fetcher,
    { revalidateOnFocus: false }
  );

  const isLoading = programsLoading || squadsLoading || clientsLoading;

  // Extract data
  const programs = programsData?.programs || [];
  const squads = squadsData?.squads || [];
  const totalClients = clientsData?.summary?.totalClients ?? 0;
  const activeClients = clientsData?.summary?.activeCount ?? 0;
  const atRiskCount = clientsData?.summary?.atRiskCount ?? 0;
  const totalRevenue = productsData?.summary?.totalRevenue ?? 0;
  const monthlyRevenue = productsData?.summary?.monthlyRevenue ?? 0;
  const avgRevenuePerClient = productsData?.summary?.avgRevenuePerClient ?? 0;
  const totalPosts = feedData?.summary?.totalPosts ?? 0;
  const totalLikes = feedData?.summary?.totalLikes ?? 0;
  const totalComments = feedData?.summary?.totalComments ?? 0;

  // Check if dismissed from local state or org settings
  const isChecklistDismissed = checklistDismissed || orgSettings?.coachDashboardChecklistDismissed;

  // Build checklist items
  const checklistItems: ChecklistItem[] = useMemo(() => {
    const hasStripe = orgSettings?.stripeConnectStatus === 'connected';
    const hasProgram = programs.length > 0;
    const hasFunnel = (funnelsData?.funnels?.length ?? 0) > 0;
    const hasClient = totalClients > 0;
    const hasSquad = squads.length > 0;

    return [
      {
        id: 'program',
        label: 'Create your first offer',
        description: 'Design a program clients can enroll in',
        href: '/coach?tab=programs',
        isComplete: hasProgram,
      },
      {
        id: 'stripe',
        label: 'Connect Stripe',
        description: 'Start accepting payments for your offers',
        href: '/coach?tab=settings&section=billing',
        isComplete: hasStripe,
      },
      {
        id: 'funnel',
        label: 'Create a funnel',
        description: 'Build a landing page to capture leads',
        href: '/coach?tab=funnels',
        isComplete: hasFunnel,
      },
      {
        id: 'client',
        label: 'Close your first client',
        description: 'Invite someone to your program',
        href: '/coach?tab=clients',
        isComplete: hasClient,
      },
      {
        id: 'squad',
        label: 'Start a community',
        description: 'Create a squad for peer support',
        href: '/coach?tab=squads',
        isComplete: hasSquad,
      },
    ];
  }, [programs.length, squads.length, totalClients, orgSettings, funnelsData?.funnels?.length]);

  // Build program revenue map
  const programRevenueMap = useMemo(() => {
    const map = new Map<string, number>();
    productsData?.programs?.forEach((p) => {
      map.set(p.id, p.totalRevenue);
    });
    return map;
  }, [productsData?.programs]);

  // Handle checklist dismiss
  const handleDismissChecklist = async () => {
    setChecklistDismissed(true);
    try {
      await fetch('/api/coach/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachDashboardChecklistDismissed: true }),
      });
      mutateOrgSettings();
    } catch (error) {
      console.error('Failed to dismiss checklist:', error);
    }
  };

  // Handle revenue goal save
  const handleSaveRevenueGoal = async (data: CoachGoalData) => {
    await fetch('/api/coach/revenue-goal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    mutateRevenueGoal();
  };

  const isEmpty = totalClients === 0 && programs.length === 0 && squads.length === 0;
  const firstName = user?.firstName || 'Coach';
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Show getting started if not all items complete and not dismissed
  const allChecklistComplete = checklistItems.every(item => item.isComplete);
  const showGettingStarted = !isChecklistDismissed && !allChecklistComplete;

  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* HEADER with Profile Badge */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          {/* Profile badge - pill shape */}
          <div className="bg-[#f3f1ef] dark:bg-[#181d28] rounded-[40px] p-1 flex items-center gap-2 sm:gap-3 pr-3 sm:pr-4 max-w-[72%] sm:max-w-none">
            <StoryAvatar
              user={{
                firstName: user?.firstName || '',
                lastName: user?.lastName || '',
                imageUrl: user?.imageUrl || '',
              }}
              userId={currentUserId}
              hasStory={storyAvailability.hasStory}
              showRing={storyAvailability.showRing}
              showCheck={storyAvailability.showCheck}
              userPostedStories={storyAvailability.data.userPostedStories}
              goal={storyAvailability.data.goal}
              tasks={storyAvailability.data.tasks}
              hasDayClosed={storyAvailability.data.hasDayClosed}
              completedTasks={storyAvailability.data.completedTasks}
              eveningCheckIn={storyAvailability.data.eveningCheckIn}
              hasWeekClosed={storyAvailability.data.hasWeekClosed}
              weeklyReflection={storyAvailability.data.weeklyReflection}
              size="md"
            />
            <Link href="/profile" className="text-left hover:opacity-80 transition-opacity min-w-0">
              <p className="font-albert text-[16px] sm:text-[18px] font-semibold text-text-primary leading-[1.3] tracking-[-1px] truncate">
                Hi {firstName},
              </p>
              <p className="font-albert text-[16px] sm:text-[18px] font-normal text-text-primary leading-[1.3] tracking-[-1px] truncate">
                {greeting}!
              </p>
            </Link>
          </div>

          {/* Calendar + Notification Bell + View Switcher + Theme Toggle */}
          <div className="flex items-center gap-2">
            <CalendarButton className="hidden lg:block" />
            {/* Mobile: Calendar and Chat buttons side by side */}
            <CalendarIconButton size="xl" className="lg:hidden" />
            <ChatButton className="lg:hidden" />
            <NotificationBell className="hidden lg:block" />
            {/* Desktop: vertical view switcher + theme toggle */}
            <ViewSwitcher className="hidden lg:flex" />
            <ThemeToggle className="hidden lg:flex" />
          </div>
        </div>

        {/* Date + Icons (mobile only) */}
        <div className="flex items-center justify-between lg:justify-start">
          <p className="font-sans text-[12px] text-text-secondary leading-[1.2]">
            {currentDate}
          </p>
          {/* Mobile: notification, view switcher, and theme toggle icons */}
          <div className="flex items-center gap-2 lg:hidden">
            <NotificationIconButton />
            <ViewSwitcher horizontal />
            <ThemeToggle horizontal />
          </div>
        </div>
      </div>

      {isEmpty ? (
        <Card className={cn('rounded-2xl', glassCard)}>
          <CardContent className="p-8">
            <EmptyState />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Getting Started Checklist (conditionally shown) */}
          {showGettingStarted && (
            <GettingStartedCard
              items={checklistItems}
              onDismiss={handleDismissChecklist}
              totalRevenue={totalRevenue}
            />
          )}

          {/* Time Period Selector + Section Title */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary font-albert">
              Command Center
            </h2>
            <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />
          </div>

          {/* Revenue Command Center (Primary) */}
          <RevenueCommandCenter
            totalRevenue={totalRevenue}
            monthlyRevenue={monthlyRevenue}
            monthlyGoal={revenueGoalData?.monthlyRevenueGoal || undefined}
            timePeriod={timePeriod}
          />

          {/* Secondary Stats Row (Growth Levers) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <SecondaryStat
              label="Active Clients"
              value={activeClients}
              subValue={`${totalClients} total`}
              icon={Users}
              href="/coach?tab=clients"
            />
            <SecondaryStat
              label="Offers"
              value={programs.length}
              subValue={`${programs.filter((p) => p.activeEnrollments > 0).length} with enrollments`}
              icon={BookOpen}
              href="/coach?tab=programs"
            />
            {atRiskCount > 0 ? (
              <SecondaryStat
                label="Need Attention"
                value={atRiskCount}
                subValue="Inactive clients"
                icon={AlertTriangle}
                href="/coach?tab=clients"
                variant="alert"
              />
            ) : (
              <SecondaryStat
                label="Squads"
                value={squads.length}
                subValue={`${squads.reduce((sum, s) => sum + s.memberCount, 0)} members`}
                icon={UsersRound}
                href="/coach?tab=squads"
              />
            )}
            <SecondaryStat
              label="Avg Revenue/Client"
              value={avgRevenuePerClient > 0 ? `$${avgRevenuePerClient.toLocaleString()}` : '—'}
              icon={BarChart3}
              href="/coach?tab=analytics"
            />
          </div>

          {/* Two Column Layout: Revenue Plan + What To Do Next */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RevenuePlanCard
              currentMRR={monthlyRevenue}
              monthlyGoal={revenueGoalData?.monthlyRevenueGoal || undefined}
              avgRevenuePerClient={avgRevenuePerClient}
              activeClients={activeClients}
              isLoading={revenueGoalLoading}
              onSetGoal={() => setGoalModalOpen(true)}
              onEditGoal={() => setGoalModalOpen(true)}
            />
            <WhatToDoNext
              suggestions={suggestionsData?.suggestions || []}
              isLoading={suggestionsLoading}
            />
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-sm font-medium text-text-secondary font-albert mb-3">
              Quick Actions
            </h2>
            <div className="flex flex-wrap gap-2">
              <QuickActionButton
                label="New Program"
                icon={Plus}
                onClick={() => setProgramModalOpen(true)}
                variant="primary"
              />
              <QuickActionButton
                label="New Squad"
                icon={UsersRound}
                onClick={() => setSquadModalOpen(true)}
              />
              <QuickActionButton
                label="Invite Client"
                icon={UserPlus}
                onClick={() => setInviteModalOpen(true)}
              />
              <QuickActionButton
                label="Create Funnel"
                icon={Zap}
                onClick={() => setFunnelModalOpen(true)}
              />
            </div>
          </div>

          {/* Programs and Squads Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Programs Section */}
            <Card className={cn('rounded-2xl', glassCard)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-text-secondary font-albert">
                    Your Offers
                  </h2>
                  <Link
                    href="/coach?tab=programs"
                    className="text-xs text-text-tertiary hover:text-text-secondary font-albert transition-colors"
                  >
                    View all →
                  </Link>
                </div>
                {programs.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="inline-flex p-3 rounded-xl bg-purple-50/80 dark:bg-purple-900/20 mb-3">
                      <BookOpen className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                    </div>
                    <p className="text-text-secondary font-albert text-sm mb-3">
                      No offers yet
                    </p>
                    <Link
                      href="/coach?tab=programs"
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent hover:underline"
                    >
                      <Plus className="w-4 h-4" />
                      Create your first offer
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {programs.slice(0, 4).map((program) => (
                      <ProgramCard
                        key={program.id}
                        id={program.id}
                        name={program.name}
                        type={program.type}
                        activeEnrollments={program.activeEnrollments}
                        totalRevenue={programRevenueMap.get(program.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Squads Section */}
            <Card className={cn('rounded-2xl', glassCard)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-text-secondary font-albert">
                    Your Communities
                  </h2>
                  <Link
                    href="/coach?tab=squads"
                    className="text-xs text-text-tertiary hover:text-text-secondary font-albert transition-colors"
                  >
                    View all →
                  </Link>
                </div>
                {squads.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="inline-flex p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 mb-3">
                      <UsersRound className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <p className="text-text-secondary font-albert text-sm mb-3">
                      No communities yet
                    </p>
                    <Link
                      href="/coach?tab=squads"
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent hover:underline"
                    >
                      <Plus className="w-4 h-4" />
                      Start your first community
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {squads.slice(0, 4).map((squad) => (
                      <SquadCard
                        key={squad.id}
                        id={squad.id}
                        name={squad.name}
                        memberCount={squad.memberCount}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Community Activity (Demoted) */}
          {(totalPosts > 0 || totalLikes > 0 || totalComments > 0) && (
            <FeedActivityCard
              totalPosts={totalPosts}
              totalLikes={totalLikes}
              totalComments={totalComments}
              isLoading={feedLoading}
            />
          )}
        </div>
      )}

      {/* Coach Revenue Goal Modal */}
      <CoachGoalModal
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        onSave={handleSaveRevenueGoal}
        initialData={revenueGoalData?.monthlyRevenueGoal ? {
          monthlyRevenueGoal: revenueGoalData.monthlyRevenueGoal,
          targetClients: revenueGoalData.targetClients || undefined,
        } : undefined}
        currentMRR={monthlyRevenue}
        activeClients={activeClients}
      />

      {/* New Program Modal */}
      <NewProgramModal
        isOpen={programModalOpen}
        onClose={() => setProgramModalOpen(false)}
        onCreateFromScratch={() => {
          setProgramModalOpen(false);
          router.push('/coach?tab=programs');
        }}
        onProgramCreated={(programId) => {
          setProgramModalOpen(false);
          router.push(`/coach?tab=programs&programId=${programId}`);
        }}
      />

      {/* Create Squad Modal */}
      <CreateSquadModal
        isOpen={squadModalOpen}
        onClose={() => setSquadModalOpen(false)}
        onSquadCreated={() => {
          setSquadModalOpen(false);
          router.push('/coach?tab=squads');
        }}
        apiBasePath="/api/coach/org-squads"
        coachesApiEndpoint="/api/coach/coaches"
        uploadEndpoint="/api/coach/upload-media"
      />

      {/* Invite Clients Dialog */}
      <InviteClientsDialog
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />

      {/* Create Funnel Dialog */}
      {funnelModalOpen && (
        <FunnelEditorDialog
          mode="create"
          programs={programs as unknown as FullProgram[]}
          squads={squads}
          onClose={() => setFunnelModalOpen(false)}
          onSaved={() => {
            setFunnelModalOpen(false);
            router.push('/coach?tab=funnels');
          }}
        />
      )}
    </div>
  );
}
