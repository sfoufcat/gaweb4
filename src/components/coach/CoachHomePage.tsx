'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import confetti from 'canvas-confetti';
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
import { useStoryViewTracking, generateStoryContentData, useStoryViewStatus } from '@/hooks/useStoryViewTracking';
import { Progress } from '@/components/ui/progress';
import { CoachGoalModal, CoachGoalData } from './CoachGoalModal';
import { NewProgramModal } from './programs/NewProgramModal';
import { CreateSquadModal } from '@/components/admin/CreateSquadModal';
import { InviteClientsDialog } from './InviteClientsDialog';
import { FunnelEditorDialog } from './funnels/FunnelEditorDialog';
import { StripeConnectModal } from '@/components/ui/StripeConnectModal';
import type { Program as FullProgram } from '@/types';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ============================================================================
// DESIGN TOKENS
// ============================================================================

// Use glass-card class from globals.css for consistent styling
// All cards should use: className="glass-card rounded-[24px]"

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
  onClick?: () => void;
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
  const router = useRouter();

  if (allComplete && totalRevenue > 0) {
    return (
      <Card className="glass-card overflow-hidden rounded-[24px]">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm tracking-tight">
                  Business is Live
                </h3>
                <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm mt-0.5">
                  Your coaching setup is complete and ready to scale.
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-[#a7a39e]" />
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card overflow-hidden rounded-[24px]">
      <CardContent className="p-0">
        <div className="p-5">
          <div className="flex items-start justify-between mb-5">
            <div className="space-y-0.5">
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-base tracking-tight">
                Complete your setup
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Follow these steps to start accepting payments and clients.
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-[#a7a39e]" />
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex items-center gap-3 group transition-all duration-200 w-full text-left',
                  item.isLocked && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => {
                  if (item.isLocked) return;
                  if (item.onClick) {
                    item.onClick();
                  } else {
                    router.push(item.href);
                  }
                }}
              >
                <div className={cn(
                  'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors',
                  item.isComplete
                    ? 'bg-emerald-500 text-white'
                    : 'border-2 border-[#e1ddd8] dark:border-[#262b35] group-hover:border-[#a07855]'
                )}>
                  {item.isComplete ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <div className="w-1 h-1 rounded-full bg-transparent group-hover:bg-[#a07855] transition-colors" />
                  )}
                </div>
                <div className="flex-1 min-w-0 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 pb-2.5">
                  <p className={cn(
                    'font-albert text-base font-medium',
                    item.isComplete ? 'text-[#a7a39e] dark:text-[#7d8190] line-through' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  )}>
                    {item.label}
                  </p>
                  {!item.isComplete && (
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5 opacity-80">
                      {item.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-4 flex justify-center">
          <Button
            className="w-full bg-brand-accent text-white hover:opacity-90 rounded-xl h-10 font-albert font-semibold text-sm"
            onClick={() => {
              const firstIncomplete = items.find(i => !i.isComplete);
              if (firstIncomplete) {
                if (firstIncomplete.onClick) {
                  firstIncomplete.onClick();
                } else {
                  router.push(firstIncomplete.href);
                }
              }
            }}
          >
            Continue setup
          </Button>
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
  trend?: number;
  timePeriod: TimePeriod;
  activeClients?: number;
}

function RevenueCommandCenter({
  totalRevenue,
  trend,
  timePeriod,
  activeClients,
}: RevenueCommandCenterProps) {
  const isPositiveTrend = trend !== undefined && trend >= 0;

  return (
    <div className="glass-card p-6 rounded-[24px] relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-accent/5 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium font-albert text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">
              {timePeriod === 'today' ? "Today's Revenue" : timePeriod === 'all' ? 'Total Revenue' : `Revenue (Last ${timePeriod} days)`}
            </p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl sm:text-5xl font-bold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] tracking-tight">
                ${totalRevenue.toLocaleString()}
              </h2>
              {trend !== undefined && (
                <div className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold font-albert mb-1',
                  isPositiveTrend ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                )}>
                  {isPositiveTrend ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositiveTrend ? '+' : ''}{trend}%
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center sm:pb-1">
            <div className="space-y-0.5 text-right">
              <p className="text-xl sm:text-2xl font-bold font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                {activeClients}
              </p>
              <p className="text-xs font-medium font-albert text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">
                Active Clients
              </p>
            </div>
          </div>
        </div>
      </div>
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
      'glass-card group p-4 rounded-[20px]',
      isAlert && 'bg-rose-50/50 dark:bg-rose-950/20',
      href && 'cursor-pointer'
    )}>
      <div className={cn(
        'p-2 rounded-lg w-fit',
        isAlert
          ? 'bg-rose-100/80 dark:bg-rose-900/30'
          : 'bg-brand-accent/10'
      )}>
        <Icon className={cn(
          'w-4 h-4',
          isAlert ? 'text-rose-600 dark:text-rose-400' : 'text-brand-accent'
        )} />
      </div>
      
      <p className={cn(
        'text-2xl font-bold font-albert tracking-tight mt-3',
        isAlert ? 'text-rose-700 dark:text-rose-300' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
      )}>
        {value}
      </p>
      
      <div className="flex items-center justify-between mt-1">
        <p className={cn(
          'text-sm font-medium font-albert',
          isAlert ? 'text-rose-600/80 dark:text-rose-400/80' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
        )}>
          {label}
        </p>
        {(subValue || trend !== undefined) && (
          <p className={cn(
            'text-xs font-semibold font-albert flex items-center gap-1',
            isAlert
              ? 'text-rose-500/80 dark:text-rose-500/60'
              : trend !== undefined
                ? isPositiveTrend
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
                : 'text-[#a7a39e]'
          )}>
            {trend !== undefined && (
              isPositiveTrend ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
            )}
            {subValue || (trend !== undefined ? `${isPositiveTrend ? '+' : ''}${trend}%` : '')}
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}

// ============================================================================
// STAT CAROUSEL (Mobile Only)
// ============================================================================

interface StatCarouselProps {
  children: React.ReactNode[];
}

function StatCarousel({ children }: StatCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cardWidth = container.offsetWidth * 0.48 + 12; // 48% width + gap
    const newIndex = Math.round(container.scrollLeft / cardWidth);
    setActiveIndex(Math.max(0, Math.min(newIndex, children.length - 1)));
  }, [children.length]);

  const scrollToIndex = (index: number) => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.offsetWidth * 0.48 + 12;
    scrollRef.current.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory"
      >
        {children.map((child, i) => (
          <div key={i} className="flex-shrink-0 w-[48%] snap-start">
            {child}
          </div>
        ))}
      </div>
      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-2">
        {children.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToIndex(i)}
            className={cn(
              'h-2 rounded-full transition-all',
              i === activeIndex
                ? 'bg-brand-accent w-4'
                : 'bg-[#e1ddd8] dark:bg-[#272d38] w-2'
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// REVENUE PLAN CARD (Coach Goal with Deadline)
// ============================================================================

interface RevenuePlanCardProps {
  currentRevenue: number; // Revenue earned since goal start date
  revenueGoal?: number;
  revenueGoalDeadline?: string; // ISO date YYYY-MM-DD
  revenueGoalStartDate?: string; // ISO date YYYY-MM-DD
  isLoading?: boolean;
  isGoalAchieved?: boolean;
  isGoalExpired?: boolean;
  onSetGoal?: () => void;
  onEditGoal?: () => void;
}

function formatGoalDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysRemaining(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function RevenuePlanCard({
  currentRevenue,
  revenueGoal = 0,
  revenueGoalDeadline,
  revenueGoalStartDate,
  isLoading,
  isGoalAchieved,
  isGoalExpired,
  onSetGoal,
  onEditGoal,
}: RevenuePlanCardProps) {
  if (isLoading) {
    return (
      <Card className="glass-card h-full rounded-[24px]">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 bg-black/5 dark:bg-white/10 rounded-full" />
            <div className="h-12 w-full bg-black/5 dark:bg-white/10 rounded-2xl" />
            <div className="h-4 w-24 bg-black/5 dark:bg-white/10 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No goal set
  if (!revenueGoal || revenueGoal <= 0) {
    return (
      <Card className="glass-card h-full rounded-[24px] bg-gradient-to-br from-[#f3f1ef] to-white dark:from-[#11141b] dark:to-[#171b22]">
        <CardContent className="p-6 flex flex-col h-full items-center justify-center text-center">
          <div className="p-3 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/20 mb-3">
            <Target className="w-6 h-6 text-brand-accent" />
          </div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-lg mb-1.5 tracking-tight">
            Define your success
          </h3>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-xs mb-4 max-w-[220px]">
            Set a revenue target to stay focused and motivated on your journey.
          </p>
          <Button
            onClick={onSetGoal}
            className="rounded-xl font-albert font-semibold px-5 h-9 text-sm bg-[#a07855] text-white hover:opacity-90 transition-all"
          >
            Set your goal
          </Button>
        </CardContent>
      </Card>
    );
  }

  const progress = Math.min((currentRevenue / revenueGoal) * 100, 100);
  const gap = Math.max(revenueGoal - currentRevenue, 0);
  const daysLeft = revenueGoalDeadline ? getDaysRemaining(revenueGoalDeadline) : 0;

  return (
    <Card className="glass-card h-full rounded-[24px]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-accent/10 dark:bg-brand-accent/20">
              <Target className="w-4 h-4 text-brand-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-base tracking-tight">
                Current Goal
              </h3>
              {revenueGoalDeadline && (
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                  Target: {formatGoalDate(revenueGoalDeadline)}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEditGoal}
            className="text-xs font-semibold text-[#a07855] hover:bg-[#a07855]/5 h-7 px-2"
          >
            Edit Goal
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                ${currentRevenue.toLocaleString()}
              </p>
              <p className="text-sm font-medium font-albert text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                Earned of ${revenueGoal.toLocaleString()} goal
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold font-albert text-[#a07855]">
                {Math.round(progress)}%
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-2 bg-[#f3f1ef] dark:bg-[#1e222a]" />
            <div className="flex justify-between items-center text-sm font-albert">
              <p className="text-[#5f5a55] dark:text-[#b2b6c2]">
                {gap > 0 ? (
                  <><span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-semibold">${gap.toLocaleString()}</span> remaining</>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Goal smashed! 🚀</span>
                )}
              </p>
              {daysLeft > 0 && (
                <p className="text-[#a7a39e] dark:text-[#7d8190] flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                </p>
              )}
            </div>
          </div>
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
  onClick?: () => void;
}

interface WhatToDoNextProps {
  suggestions: Suggestion[];
  isLoading?: boolean;
}

function WhatToDoNext({ suggestions, isLoading }: WhatToDoNextProps) {
  if (isLoading) {
    return (
      <Card className="glass-card rounded-[24px]">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-32 bg-black/5 dark:bg-white/10 rounded-full" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-black/5 dark:bg-white/10 rounded-xl" />
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
    <Card className="glass-card rounded-[24px]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10 dark:bg-purple-500/20">
              <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-base tracking-tight">
              Action Items
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#f3f1ef] dark:bg-[#1e222a] text-xs font-bold font-albert text-[#a7a39e] uppercase tracking-wider">
            AI Priority
          </span>
        </div>

        {/* Scrollable container with max height */}
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#e1ddd8] dark:scrollbar-thumb-[#262b35] scrollbar-track-transparent">
          {suggestions.slice(0, 5).map((suggestion) => {
            const IconComponent = suggestion.icon || Lightbulb;
            const itemContent = (
              <>
                <div className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105',
                  suggestion.priority === 'high'
                    ? 'bg-rose-50 dark:bg-rose-900/20'
                    : suggestion.priority === 'medium'
                      ? 'bg-amber-50 dark:bg-amber-900/20'
                      : 'bg-blue-50 dark:bg-blue-900/20'
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                      {suggestion.title}
                    </p>
                    <ArrowUpRight className="w-3 h-3 text-[#a7a39e] opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
                  </div>
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5 line-clamp-1 leading-snug">
                    {suggestion.description}
                  </p>
                </div>
              </>
            );

            if (suggestion.onClick) {
              return (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={suggestion.onClick}
                  className="group flex items-start gap-3 p-2.5 rounded-xl border border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35] hover:bg-[#f3f1ef]/30 dark:hover:bg-[#1e222a]/30 transition-all duration-200 w-full text-left"
                >
                  {itemContent}
                </button>
              );
            }

            return (
              <Link
                key={suggestion.id}
                href={suggestion.href}
                className="group flex items-start gap-3 p-2.5 rounded-xl border border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35] hover:bg-[#f3f1ef]/30 dark:hover:bg-[#1e222a]/30 transition-all duration-200"
              >
                {itemContent}
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
      variant={variant === 'primary' ? 'default' : 'ghost'}
      onClick={onClick}
      className={cn(
        'h-10 px-4 gap-2.5 font-albert font-medium text-sm w-full justify-start transition-all duration-200',
        variant === 'secondary' && 'glass-card rounded-xl hover:bg-white/80 dark:hover:bg-[#1e222a]/80 text-[#1a1a1a] dark:text-white',
        variant === 'primary' && 'bg-brand-accent text-white hover:opacity-90 rounded-full pl-5'
      )}
    >
      {variant === 'primary' ? (
        <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
      ) : (
        <div className="p-1.5 rounded-lg transition-colors bg-brand-accent/10 text-brand-accent">
          <Icon className="w-3.5 h-3.5" />
        </div>
      )}
      {label}
    </Button>
  );

  if (href && !onClick) {
    return <Link href={href} className="block w-full">{buttonContent}</Link>;
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
        'hover:bg-[#f3f1ef]/50 dark:hover:bg-[#1e222a]/50'
      )}
    >
      <div className={cn(
        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border transition-transform group-hover:scale-105',
        type === 'group'
          ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/30'
          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30'
      )}>
        {type === 'group' ? (
          <UsersRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        ) : (
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate text-sm">
            {name}
          </h4>
          {totalRevenue !== undefined && totalRevenue > 0 && (
            <span className="text-xs font-bold font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
              ${totalRevenue.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn(
            'text-xs font-bold font-albert uppercase tracking-wider px-1.5 py-0.5 rounded',
            type === 'group' ? 'bg-purple-100/50 text-purple-700' : 'bg-blue-100/50 text-blue-700'
          )}>
            {type === 'group' ? 'Cohort' : '1:1'}
          </span>
          <span className="text-xs text-[#a7a39e] font-albert">
            {activeEnrollments} active
          </span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-[#a7a39e] opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
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
        'hover:bg-[#f3f1ef]/50 dark:hover:bg-[#1e222a]/50'
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
          <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#1e222a]" />
          <div className="space-y-1.5">
            <div className="h-3 w-20 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-full" />
            <div className="h-6 w-36 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#f3f1ef] dark:bg-[#1e222a]" />
          <div className="w-9 h-9 rounded-lg bg-[#f3f1ef] dark:bg-[#1e222a]" />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6">
          {/* Revenue card skeleton */}
          <div className="h-36 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-[24px]" />
          
          {/* Stats row skeleton */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-[20px]" />
            ))}
          </div>

          {/* Shortcuts skeleton */}
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl" />
            ))}
          </div>

          <div className="h-48 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-[24px]" />
        </div>

        <div className="w-full lg:w-[320px] space-y-6">
          <div className="h-56 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-[24px]" />
          <div className="h-40 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-[24px]" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE DASHBOARD
// ============================================================================

// Animation variants for staggered card animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0, 0, 0.2, 1] as const, // easeOut cubic-bezier
    },
  },
};

// Decorative illustration component for WelcomeCard
function WelcomeIllustration() {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-1/2 overflow-hidden pointer-events-none opacity-30 dark:opacity-20">
      <svg viewBox="0 0 400 400" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="gaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a07855" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#a07855" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="350" cy="50" r="150" fill="url(#gaGrad)" />
        <circle cx="400" cy="300" r="100" fill="url(#gaGrad)" opacity="0.5" />
      </svg>
    </div>
  );
}

function WelcomeCard() {
  return (
    <div className="glass-card overflow-hidden relative p-8 sm:p-12 min-h-[300px] flex flex-col justify-center rounded-[24px]">
      <WelcomeIllustration />
      <div className="relative z-10 max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-[#a07855]/10">
            <Sparkles className="w-6 h-6 text-[#a07855]" />
          </div>
          <span className="text-xs font-bold text-[#a07855] uppercase tracking-[0.2em] font-albert">Coach Dashboard</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-tight leading-[1.1] mb-6">
          Ready to launch your empire?
        </h2>
        <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] font-albert leading-relaxed">
          Welcome to Coachful. We&apos;ve prepared everything you need to build, scale, and manage your coaching business with ease.
        </p>
      </div>
    </div>
  );
}

interface EmptyTodolistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  isComplete: boolean;
}

interface TodolistCardProps {
  items: EmptyTodolistItem[];
}

function TodolistCard({ items }: TodolistCardProps) {
  const completedCount = items.filter(i => i.isComplete).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <Card className="glass-card h-full rounded-[24px]">
      <CardContent className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-lg tracking-tight">
              Launch Checklist
            </h3>
            <p className="text-sm text-[#a7a39e] font-albert font-medium">
              {completedCount} of {items.length} COMPLETE
            </p>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-[#f3f1ef] dark:border-[#1e222a] flex items-center justify-center relative">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-[#a07855]"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[10px] font-bold font-albert">{Math.round(progress)}%</span>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'group flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 border border-transparent',
                'hover:bg-[#f3f1ef]/50 dark:hover:bg-[#1e222a]/50 hover:border-[#e1ddd8] dark:hover:border-[#262b35]',
                item.isComplete && 'opacity-60'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                item.isComplete
                  ? 'border-[#a07855] bg-[#a07855]'
                  : 'border-[#e1ddd8] dark:border-[#262b35] group-hover:border-[#a07855]'
              )}>
                {item.isComplete && (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-semibold font-albert',
                  item.isComplete ? 'text-[#a7a39e] line-through' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                )}>
                  {item.label}
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate mt-0.5">
                  {item.description}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#a7a39e] opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface SetGoalCardProps {
  revenueGoal?: number | null;
  revenueGoalDeadline?: string | null;
  isLoading?: boolean;
  onSetGoal: () => void;
}

function SetGoalCard({ revenueGoal, revenueGoalDeadline, isLoading, onSetGoal }: SetGoalCardProps) {
  if (isLoading) {
    return (
      <Card className="glass-card h-full rounded-[24px]">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 bg-black/5 dark:bg-white/10 rounded-full" />
            <div className="h-12 w-full bg-black/5 dark:bg-white/10 rounded-2xl" />
            <div className="h-4 w-24 bg-black/5 dark:bg-white/10 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // If goal already set, show progress
  if (revenueGoal && revenueGoal > 0) {
    const daysRemaining = revenueGoalDeadline ? getDaysRemaining(revenueGoalDeadline) : 0;
    return (
      <Card className="glass-card h-full rounded-[24px]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/20">
                <Target className="w-4 h-4 text-brand-accent" />
              </div>
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-base tracking-tight">
                Active Goal
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSetGoal}
              className="text-xs font-semibold text-[#a07855]"
            >
              Edit
            </Button>
          </div>
          <p className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            ${revenueGoal.toLocaleString()}
          </p>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Deadline passed'}
          </p>
          <Progress
            value={0}
            className="h-1.5 bg-[#f3f1ef] dark:bg-[#1e222a] mt-4"
          />
        </CardContent>
      </Card>
    );
  }

  // Empty state - encourage goal setting
  return (
    <Card className="glass-card h-full rounded-[24px] bg-gradient-to-br from-[#f3f1ef] to-white dark:from-[#11141b] dark:to-[#171b22]">
      <CardContent className="p-6 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/20">
            <Target className="w-4 h-4 text-brand-accent" />
          </div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-base tracking-tight">
            Set Your Goal
          </h3>
        </div>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm mb-6 flex-1">
          Define a revenue target to track your progress and stay motivated on your journey.
        </p>
        <Button
          onClick={onSetGoal}
          className="rounded-xl font-albert font-semibold bg-[#a07855] text-white h-10 w-fit px-6"
        >
          Set Goal
        </Button>
      </CardContent>
    </Card>
  );
}

interface CreateProgramCardProps {
  onOpenModal: () => void;
}

function RevenueEmptyCard() {
  return (
    <Card className="glass-card overflow-hidden relative rounded-[24px]">
      <CardContent className="p-8">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 mb-2">
              <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-3xl font-bold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] tracking-tight">
              Your first $1,000 is coming
            </h3>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert leading-relaxed max-w-md">
              The journey to financial freedom starts with a single enrollment. Once you connect Stripe and invite your first client, your revenue will appear here.
            </p>
          </div>
          <div className="w-full sm:w-auto flex flex-col items-center justify-center p-8 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-3xl min-w-[200px]">
            <p className="text-5xl font-bold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">$0</p>
            <p className="text-sm font-semibold font-albert text-[#a7a39e] uppercase tracking-widest">Current Revenue</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateProgramCard({ onOpenModal }: CreateProgramCardProps) {
  return (
    <div
      className="glass-card cursor-pointer group p-8 sm:p-10 flex flex-col items-center justify-center text-center rounded-[24px]"
      onClick={onOpenModal}
    >
      <div className="p-5 rounded-3xl bg-[#a07855]/10 group-hover:scale-110 transition-transform mb-6">
        <Plus className="w-10 h-10 text-[#a07855]" />
      </div>
      <h3 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3 tracking-tight">
        Build your first coaching program
      </h3>
      <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-8 max-w-sm">
        Design a structured program with weeks, days, and tasks to help your clients succeed.
      </p>
      <Button className="rounded-2xl h-12 px-8 bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] font-bold font-albert">
        Create Program
      </Button>
    </div>
  );
}

interface EmptyStateDashboardProps {
  hasStripeConnected: boolean;
  revenueGoalData?: RevenueGoalData;
  revenueGoalLoading: boolean;
  onSetGoal: () => void;
  onOpenProgramModal: () => void;
}

function EmptyStateDashboard({
  hasStripeConnected,
  revenueGoalData,
  revenueGoalLoading,
  onSetGoal,
  onOpenProgramModal,
}: EmptyStateDashboardProps) {
  // Simplified 3-item todolist for empty state
  const todoItems: EmptyTodolistItem[] = [
    {
      id: 'create-program',
      label: 'Create your first program',
      description: 'Design a coaching program for your clients',
      href: '/coach?tab=programs',
      isComplete: false, // Will be false in empty state
    },
    {
      id: 'connect-stripe',
      label: 'Connect Stripe',
      description: 'Set up payments to get paid',
      href: '/coach?tab=settings&section=payments',
      isComplete: hasStripeConnected,
    },
    {
      id: 'invite-client',
      label: 'Invite your first client',
      description: 'Send an invite to start coaching',
      href: '/coach?tab=clients',
      isComplete: false, // Will be false in empty state
    },
  ];

  return (
    <motion.div
      className="space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Welcome Card */}
      <motion.div variants={cardVariants}>
        <WelcomeCard />
      </motion.div>

      {/* Todolist + Set Goal Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={cardVariants}>
          <TodolistCard items={todoItems} />
        </motion.div>
        <motion.div variants={cardVariants}>
          <SetGoalCard
            revenueGoal={revenueGoalData?.revenueGoal}
            revenueGoalDeadline={revenueGoalData?.revenueGoalDeadline}
            isLoading={revenueGoalLoading}
            onSetGoal={onSetGoal}
          />
        </motion.div>
      </div>

      {/* Revenue Card */}
      <motion.div variants={cardVariants}>
        <RevenueEmptyCard />
      </motion.div>

      {/* Create Program Card */}
      <motion.div variants={cardVariants}>
        <CreateProgramCard onOpenModal={onOpenProgramModal} />
      </motion.div>
    </motion.div>
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
  revenueGoal: number | null;
  revenueGoalDeadline: string | null;
  revenueGoalStartDate: string | null;
  goalSetAt: string | null;
  goalAchievedCelebrated: boolean;
  // Legacy fields for backwards compatibility
  monthlyRevenueGoal: number | null;
  targetClients: number | null;
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
  const [stripeModalOpen, setStripeModalOpen] = useState(false);

  // Story availability for avatar
  const storyAvailability = useCurrentUserStoryAvailability();
  const currentUserId = user?.id || '';

  // Story view tracking for current user's own story
  const { markStoryAsViewed } = useStoryViewTracking();

  // Generate full content data for smart view tracking
  const ownContentData = useMemo(() => generateStoryContentData(
    storyAvailability.data.hasTasksToday,
    storyAvailability.data.hasDayClosed,
    storyAvailability.data.tasks?.length || 0,
    storyAvailability.data.hasWeekClosed,
    storyAvailability.data.userPostedStories?.length || 0
  ), [storyAvailability.data]);

  const hasViewedFromHook = useStoryViewStatus(currentUserId, ownContentData);
  const hasViewedOwnStory = storyAvailability.hasStory && storyAvailability.contentHash
    ? hasViewedFromHook
    : false;

  const handleOwnStoryViewed = useCallback(() => {
    if (currentUserId) {
      markStoryAsViewed(currentUserId, ownContentData);
    }
  }, [currentUserId, markStoryAsViewed, ownContentData]);

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

  // Map suggestion IDs to click handlers for opening modals
  const suggestionsWithClickHandlers = useMemo(() => {
    if (!suggestionsData?.suggestions) return [];

    const clickHandlerMap: Record<string, () => void> = {
      'connect-stripe': () => setStripeModalOpen(true),
      'create-program': () => setProgramModalOpen(true),
      'create-funnel': () => setFunnelModalOpen(true),
      'invite-client': () => setInviteModalOpen(true),
      'create-second-program': () => setProgramModalOpen(true),
    };

    return suggestionsData.suggestions.map(suggestion => ({
      ...suggestion,
      onClick: clickHandlerMap[suggestion.id],
    }));
  }, [suggestionsData?.suggestions]);

  // Fetch coach revenue goal
  const { data: revenueGoalData, isLoading: revenueGoalLoading, mutate: mutateRevenueGoal } = useSWR<RevenueGoalData>(
    '/api/coach/revenue-goal',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch revenue since goal start date (for goal progress)
  const goalStartDate = revenueGoalData?.revenueGoalStartDate;
  const { data: goalPeriodRevenueData } = useSWR<ProductsData>(
    goalStartDate ? `/api/coach/analytics/products?sinceDate=${goalStartDate}` : null,
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
  const avgRevenuePerClient = productsData?.summary?.avgRevenuePerClient ?? 0;
  const totalPosts = feedData?.summary?.totalPosts ?? 0;
  const totalLikes = feedData?.summary?.totalLikes ?? 0;
  const totalComments = feedData?.summary?.totalComments ?? 0;

  // Goal progress data
  const goalRevenue = goalPeriodRevenueData?.summary?.totalRevenue ?? 0;
  const revenueGoal = revenueGoalData?.revenueGoal ?? 0;
  const revenueGoalDeadline = revenueGoalData?.revenueGoalDeadline;
  const isGoalAchieved = revenueGoal > 0 && goalRevenue >= revenueGoal;
  const isGoalExpired = revenueGoalDeadline ? new Date(revenueGoalDeadline + 'T23:59:59') < new Date() : false;

  // Confetti celebration for goal achievement
  const triggerConfetti = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.1, 0.9),
          y: Math.random() - 0.2,
        },
        colors: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'],
      });
    }, 250);
  }, []);

  // Check if we should show celebration
  useEffect(() => {
    if (
      isGoalAchieved &&
      !revenueGoalData?.goalAchievedCelebrated &&
      revenueGoalData?.revenueGoal
    ) {
      // Trigger confetti
      triggerConfetti();

      // Mark celebration as shown
      fetch('/api/coach/revenue-goal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalAchievedCelebrated: true }),
      }).then(() => {
        mutateRevenueGoal();
      });
    }
  }, [isGoalAchieved, revenueGoalData?.goalAchievedCelebrated, revenueGoalData?.revenueGoal, triggerConfetti, mutateRevenueGoal]);

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
        label: 'Create your first program',
        description: 'Design a program clients can enroll in',
        href: '/coach?tab=programs',
        isComplete: hasProgram,
        onClick: () => setProgramModalOpen(true),
      },
      {
        id: 'stripe',
        label: 'Connect Stripe',
        description: 'Start accepting payments for your programs',
        href: '/coach?tab=settings&section=billing',
        isComplete: hasStripe,
        onClick: () => setStripeModalOpen(true),
      },
      {
        id: 'funnel',
        label: 'Create a funnel',
        description: 'Build a landing page to capture leads',
        href: '/coach?tab=funnels',
        isComplete: hasFunnel,
        onClick: () => setFunnelModalOpen(true),
      },
      {
        id: 'client',
        label: 'Close your first client',
        description: 'Invite someone to your program',
        href: '/coach?tab=clients',
        isComplete: hasClient,
        onClick: () => setInviteModalOpen(true),
      },
      // HIDDEN: Standalone squads disabled - squads now managed via Program > Community
      // {
      //   id: 'squad',
      //   label: 'Start a community',
      //   description: 'Create a squad for peer support',
      //   href: '/coach?tab=squads',
      //   isComplete: hasSquad,
      // },
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

  const isEmpty = false; // Always show main dashboard
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
      {/* HEADER with Profile Badge - DO NOT MODIFY */}
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
              hasViewed={hasViewedOwnStory}
              contentHash={storyAvailability.contentHash}
              onStoryViewed={handleOwnStoryViewed}
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
            {/* Desktop: view switcher + theme toggle */}
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
        <EmptyStateDashboard
          hasStripeConnected={orgSettings?.stripeConnectStatus === 'connected'}
          revenueGoalData={revenueGoalData}
          revenueGoalLoading={revenueGoalLoading}
          onSetGoal={() => setGoalModalOpen(true)}
          onOpenProgramModal={() => setProgramModalOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          {/* Header Row - spans full width */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#a7a39e] uppercase tracking-widest font-albert">
              Coaching Dashboard
            </h2>
            <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* MAIN COLUMN */}
            <div className="flex-1 space-y-6 min-w-0">
              {/* Revenue Area */}
              <RevenueCommandCenter
                totalRevenue={totalRevenue}
                timePeriod={timePeriod}
                activeClients={activeClients}
              />

              {/* Growth Levers - Carousel on mobile, grid on desktop */}
            <div className="sm:hidden">
              <StatCarousel>
                {[
                  <SecondaryStat
                    key="programs"
                    label="Active Programs"
                    value={programs.length}
                    subValue={`${programs.filter((p) => p.activeEnrollments > 0).length} enrolled`}
                    icon={BookOpen}
                    href="/coach?tab=programs"
                  />,
                  atRiskCount > 0 ? (
                    <SecondaryStat
                      key="risk"
                      label="Requires Review"
                      value={atRiskCount}
                      subValue="Low engagement"
                      icon={AlertTriangle}
                      href="/coach?tab=clients"
                      variant="alert"
                    />
                  ) : (
                    <SecondaryStat
                      key="community"
                      label="Feed Activity"
                      value={totalPosts}
                      subValue={`${totalComments} comments`}
                      icon={MessageSquare}
                      href="/feed"
                    />
                  ),
                  <SecondaryStat
                    key="ltv"
                    label="Client Lifetime Value"
                    value={avgRevenuePerClient > 0 ? `$${Math.round(avgRevenuePerClient).toLocaleString()}` : '—'}
                    icon={TrendingUp}
                    href="/coach?tab=analytics"
                  />,
                ]}
              </StatCarousel>
            </div>
            <div className="hidden sm:grid sm:grid-cols-3 gap-3">
              <SecondaryStat
                label="Active Programs"
                value={programs.length}
                subValue={`${programs.filter((p) => p.activeEnrollments > 0).length} enrolled`}
                icon={BookOpen}
                href="/coach?tab=programs"
              />
              {atRiskCount > 0 ? (
                <SecondaryStat
                  label="Requires Review"
                  value={atRiskCount}
                  subValue="Low engagement"
                  icon={AlertTriangle}
                  href="/coach?tab=clients"
                  variant="alert"
                />
              ) : (
                <SecondaryStat
                  label="Feed Activity"
                  value={totalPosts}
                  subValue={`${totalComments} comments`}
                  icon={MessageSquare}
                  href="/feed"
                />
              )}
              <SecondaryStat
                label="Client Lifetime Value"
                value={avgRevenuePerClient > 0 ? `$${Math.round(avgRevenuePerClient).toLocaleString()}` : '—'}
                icon={TrendingUp}
                href="/coach?tab=analytics"
              />
            </div>

            {/* Shortcuts (Quick Actions) - moved above Strategic Plan */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#a7a39e] uppercase tracking-widest font-albert">
                Shortcuts
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <QuickActionButton
                  label="New Program"
                  icon={Plus}
                  onClick={() => setProgramModalOpen(true)}
                  variant="primary"
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
                <QuickActionButton
                  label="Open Calendar"
                  icon={Calendar}
                  href="/coach?tab=scheduling"
                />
              </div>
            </div>

            {/* Goal Progress (Your Goal) */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#a7a39e] uppercase tracking-widest font-albert">
                Your Goal
              </h2>
              <RevenuePlanCard
                currentRevenue={goalRevenue > 0 ? goalRevenue : totalRevenue}
                revenueGoal={revenueGoal || undefined}
                revenueGoalDeadline={revenueGoalDeadline || undefined}
                revenueGoalStartDate={revenueGoalData?.revenueGoalStartDate || undefined}
                isLoading={revenueGoalLoading}
                isGoalAchieved={isGoalAchieved}
                isGoalExpired={isGoalExpired}
                onSetGoal={() => setGoalModalOpen(true)}
                onEditGoal={() => setGoalModalOpen(true)}
              />
            </div>

            {/* Program List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#a7a39e] uppercase tracking-widest font-albert">
                  Active Programs
                </h2>
                <Link
                  href="/coach?tab=programs"
                  className="text-xs font-bold text-[#a07855] hover:opacity-80 transition-opacity"
                >
                  MANAGE ALL →
                </Link>
              </div>
              <div className="glass-card p-1.5 rounded-[24px]">
                {programs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[#a7a39e] font-albert mb-3 text-sm italic">No active programs found.</p>
                    <Button onClick={() => setProgramModalOpen(true)} className="rounded-xl bg-[#a07855] h-9 text-sm">Create Program</Button>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {programs.slice(0, 5).map((program) => (
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
              </div>
            </div>
          </div>

          {/* SIDEBAR COLUMN */}
          <div className="w-full lg:w-[320px] space-y-6 flex-shrink-0">
            {/* Onboarding / Checklist */}
            {showGettingStarted && (
              <GettingStartedCard
                items={checklistItems}
                onDismiss={handleDismissChecklist}
                totalRevenue={totalRevenue}
              />
            )}

            {/* Action Items */}
            <WhatToDoNext
              suggestions={suggestionsWithClickHandlers}
              isLoading={suggestionsLoading}
            />

            {/* Support / Community Card */}
            <div className="glass-card rounded-[24px] overflow-hidden relative">
              {/* Decorative gradient orb */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

              <div className="p-5 relative">
                {/* Icon container */}
                <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-brand-accent" />
                </div>

                <h3 className="font-albert font-bold text-base text-[#1a1a1a] dark:text-white mb-1.5">
                  Your Community
                </h3>
                <p className="text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-albert mb-4 leading-relaxed">
                  Connect and engage with your clients.
                </p>

                <Link href="/feed">
                  <Button className="w-full bg-brand-accent text-white hover:opacity-90 rounded-xl font-semibold font-albert h-9 text-sm">
                    View Feed
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Coach Revenue Goal Modal */}
      <CoachGoalModal
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        onSave={handleSaveRevenueGoal}
        initialData={revenueGoalData?.revenueGoal ? {
          revenueGoal: revenueGoalData.revenueGoal,
          revenueGoalDeadline: revenueGoalData.revenueGoalDeadline || '',
        } : undefined}
        currentRevenue={goalRevenue}
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

      {/* HIDDEN: Standalone squads disabled - squads now managed via Program > Community */}

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
          // DEPRECATED: Squad funnels disabled
          // squads={squads}
          onClose={() => setFunnelModalOpen(false)}
          onSaved={() => {
            setFunnelModalOpen(false);
            router.push('/coach?tab=funnels');
          }}
        />
      )}

      {/* Stripe Connect Modal */}
      <StripeConnectModal
        isOpen={stripeModalOpen}
        onClose={() => setStripeModalOpen(false)}
      />
    </div>
  );
}
