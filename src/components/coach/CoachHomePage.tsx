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
  DollarSign,
  MessageSquare,
  Target,
  Heart,
  Calendar,
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
import { ThemeToggle } from '@/components/theme';
import { ViewSwitcher } from '@/components/shared/ViewSwitcher';
import { useCurrentUserStoryAvailability } from '@/hooks/useUserStoryAvailability';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ============================================================================
// TIME PERIOD SELECTOR
// ============================================================================

type TimePeriod = '7' | '30' | '90' | 'all';

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (value: TimePeriod) => void;
}

function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TimePeriod)}>
      <SelectTrigger className="w-[140px] h-9 rounded-xl bg-surface border-[#e1ddd8]/50 dark:border-[#262b35]/50 font-albert text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        <SelectItem value="7" className="font-albert">Last 7 days</SelectItem>
        <SelectItem value="30" className="font-albert">Last 30 days</SelectItem>
        <SelectItem value="90" className="font-albert">Last 90 days</SelectItem>
        <SelectItem value="all" className="font-albert">All time</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// STAT CARDS
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  gradient: string;
  href?: string;
  trend?: number;
  variant?: 'default' | 'alert';
}

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  gradient,
  href,
  trend,
  variant = 'default',
}: StatCardProps) {
  const isAlert = variant === 'alert';

  const content = (
    <div className="relative overflow-hidden h-full">
      {/* Background gradient */}
      <div className={cn(
        'absolute inset-0',
        isAlert ? 'opacity-20' : 'opacity-10',
        gradient
      )} />

      {/* Content */}
      <div className="relative p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className={cn(
            'p-2.5 rounded-xl backdrop-blur-sm shadow-sm',
            isAlert
              ? 'bg-amber-100/80 dark:bg-amber-900/30'
              : 'bg-white/80 dark:bg-white/10'
          )}>
            <Icon className={cn(
              'w-5 h-5',
              isAlert ? 'text-amber-600 dark:text-amber-400' : 'text-text-primary'
            )} />
          </div>
          {href && (
            <ArrowRight className="w-4 h-4 text-text-secondary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          )}
        </div>
        <div className="mt-auto">
          <p className={cn(
            'text-2xl font-bold font-albert tracking-tight',
            isAlert ? 'text-amber-700 dark:text-amber-300' : 'text-text-primary'
          )}>
            {value}
          </p>
          <p className={cn(
            'text-sm font-albert mt-0.5',
            isAlert ? 'text-amber-600/80 dark:text-amber-400/80' : 'text-text-secondary'
          )}>
            {label}
          </p>
          {(subValue || trend !== undefined) && (
            <p className={cn(
              'text-xs font-albert mt-1 flex items-center gap-1',
              isAlert
                ? 'text-amber-500/80 dark:text-amber-500/60'
                : trend && trend > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-text-tertiary'
            )}>
              {trend !== undefined && trend > 0 && <TrendingUp className="w-3 h-3" />}
              {subValue || (trend !== undefined ? `${trend > 0 ? '+' : ''}${trend}%` : '')}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const baseClassName = cn(
    'group rounded-[20px] overflow-hidden transition-all duration-300',
    isAlert
      ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-700/30'
      : 'bg-white dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35]/50',
    'shadow-sm hover:shadow-lg',
    href && 'cursor-pointer hover:scale-[1.02]'
  );

  if (href) {
    return (
      <Link href={href} className={baseClassName}>
        {content}
      </Link>
    );
  }

  return <div className={baseClassName}>{content}</div>;
}

// ============================================================================
// GOAL CARD
// ============================================================================

interface GoalCardProps {
  goal?: {
    goal?: string;
    targetDate?: string;
    progress?: { percentage: number };
  } | null;
  isLoading?: boolean;
}

function GoalCard({ goal, isLoading }: GoalCardProps) {
  if (isLoading) {
    return (
      <Card className="rounded-[28px] border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 bg-surface rounded-full" />
            <div className="h-6 w-full bg-surface rounded-lg" />
            <div className="h-3 w-32 bg-surface rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!goal?.goal) {
    return (
      <Card className="rounded-[28px] border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-text-primary font-albert">My Goal</h3>
          </div>
          <p className="text-text-secondary font-albert mb-4 text-sm">
            Set a business goal to track your progress
          </p>
          <Link href="/profile">
            <Button variant="outline" size="sm" className="rounded-xl font-albert">
              <Plus className="w-4 h-4 mr-1" />
              Set Goal
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const progress = goal.progress?.percentage || 0;
  const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
  const targetDateStr = targetDate?.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <Card className="rounded-[28px] border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-sm overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-semibold text-text-primary font-albert">My Goal</h3>
        </div>

        <p className="text-text-primary font-albert font-medium mb-4 line-clamp-2">
          {goal.goal}
        </p>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-albert">
            <span className="text-text-secondary">Progress</span>
            <span className="text-text-primary font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-[#f3f1ef] dark:bg-[#262b35] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          {targetDateStr && (
            <p className="text-xs text-text-tertiary font-albert flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Target: {targetDateStr}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ENGAGEMENT CARD
// ============================================================================

interface EngagementCardProps {
  data?: {
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
  } | null;
  isLoading?: boolean;
}

function EngagementCard({ data, isLoading }: EngagementCardProps) {
  if (isLoading) {
    return (
      <Card className="rounded-[28px] border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-28 bg-surface rounded-full" />
            <div className="h-6 w-full bg-surface rounded-lg" />
            <div className="h-3 w-36 bg-surface rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalLikes = data?.summary?.totalLikes || 0;
  const totalComments = data?.summary?.totalComments || 0;
  const totalPosts = data?.summary?.totalPosts || 0;
  const topPoster = data?.posters?.[0];

  return (
    <Card className="rounded-[28px] border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-sm overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-pink-100 dark:bg-pink-900/30">
            <MessageSquare className="w-5 h-5 text-pink-600 dark:text-pink-400" />
          </div>
          <h3 className="font-semibold text-text-primary font-albert">Feed Activity</h3>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-sm font-albert">
            <Heart className="w-4 h-4 text-red-500" />
            <span className="text-text-primary font-medium">{totalLikes}</span>
            <span className="text-text-secondary">likes</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-albert">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-text-primary font-medium">{totalComments}</span>
            <span className="text-text-secondary">comments</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm font-albert">
            <span className="text-text-secondary">{totalPosts} posts</span>
            {topPoster && (
              <span className="text-text-tertiary"> · Top: {topPoster.name}</span>
            )}
          </div>
          <Link
            href="/feed"
            className="text-sm text-brand-accent hover:underline font-albert flex items-center gap-1"
          >
            View Feed
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

interface QuickActionButtonProps {
  label: string;
  icon: React.ElementType;
  href: string;
  variant?: 'primary' | 'secondary';
}

function QuickActionButton({ label, icon: Icon, href, variant = 'secondary' }: QuickActionButtonProps) {
  return (
    <Link href={href}>
      <Button
        variant={variant === 'primary' ? 'default' : 'outline'}
        className={cn(
          'h-11 px-4 rounded-xl gap-2 font-albert',
          variant === 'primary' && 'shadow-md'
        )}
      >
        <Icon className="w-4 h-4" />
        {label}
      </Button>
    </Link>
  );
}

// ============================================================================
// PROGRAM/SQUAD CARDS
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
        'group flex items-center gap-4 p-4 rounded-xl transition-all duration-200',
        'bg-[#f8f6f4] dark:bg-[#1a1f2a]',
        'hover:bg-[#f3f1ef] dark:hover:bg-[#242a38]',
        'border border-transparent hover:border-[#e1ddd8]/50 dark:hover:border-[#262b35]/50'
      )}
    >
      <div className={cn(
        'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center',
        type === 'group'
          ? 'bg-purple-100 dark:bg-purple-900/30'
          : 'bg-blue-100 dark:bg-blue-900/30'
      )}>
        {type === 'group' ? (
          <UsersRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        ) : (
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-text-primary font-albert truncate text-sm">
          {name}
        </h4>
        <p className="text-xs text-text-secondary font-albert">
          {activeEnrollments} active
          {totalRevenue !== undefined && totalRevenue > 0 && (
            <span className="text-text-tertiary"> · ${totalRevenue.toLocaleString()}</span>
          )}
        </p>
      </div>

      <ArrowRight className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
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
        'group flex items-center gap-4 p-4 rounded-xl transition-all duration-200',
        'bg-[#f8f6f4] dark:bg-[#1a1f2a]',
        'hover:bg-[#f3f1ef] dark:hover:bg-[#242a38]',
        'border border-transparent hover:border-[#e1ddd8]/50 dark:hover:border-[#262b35]/50'
      )}
    >
      <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
        <UsersRound className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-text-primary font-albert truncate text-sm">
          {name}
        </h4>
        <p className="text-xs text-text-secondary font-albert">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>

      <ArrowRight className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="bg-[#f3f1ef] dark:bg-[#181d28] rounded-[40px] p-1 flex items-center gap-3 pr-4">
            <div className="w-[48px] h-[48px] rounded-full bg-surface" />
            <div className="space-y-1.5">
              <div className="h-4 w-24 bg-surface rounded-full" />
              <div className="h-4 w-20 bg-surface rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-surface" />
            <div className="hidden lg:block w-[28px] h-[62px] rounded-full bg-surface" />
          </div>
        </div>
        <div className="h-3 w-32 bg-surface rounded-full" />
      </div>

      {/* Time selector skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-36 bg-surface rounded-xl" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[110px] bg-surface rounded-[20px]" />
        ))}
      </div>

      {/* Two column grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 bg-surface rounded-[28px]" />
        <div className="h-48 bg-surface rounded-[28px]" />
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-surface rounded-[28px]" />
        <div className="h-72 bg-surface rounded-[28px]" />
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex p-5 rounded-[28px] bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 mb-6 shadow-sm">
        <Sparkles className="w-10 h-10 text-amber-500 dark:text-amber-400" />
      </div>
      <h3 className="text-2xl font-bold text-text-primary font-albert mb-3">
        Welcome to your coaching dashboard
      </h3>
      <p className="text-text-secondary font-albert mb-8 max-w-md mx-auto">
        Get started by creating your first program or inviting clients to join.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/coach?tab=programs">
          <Button className="h-11 px-5 rounded-xl gap-2 font-albert shadow-md">
            <Plus className="w-5 h-5" />
            Create Program
          </Button>
        </Link>
        <Link href="/coach?tab=clients">
          <Button variant="outline" className="h-11 px-5 rounded-xl gap-2 font-albert">
            <UserPlus className="w-5 h-5" />
            Invite Clients
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
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CoachHomePage() {
  const { user } = useUser();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('7');
  const [greeting, setGreeting] = useState('Good morning');
  const [mounted, setMounted] = useState(false);

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
  const days = timePeriod === 'all' ? '0' : timePeriod;

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

  const isLoading = programsLoading || squadsLoading || clientsLoading;

  // Extract data
  const programs = programsData?.programs || [];
  const squads = squadsData?.squads || [];
  const totalClients = clientsData?.summary?.totalClients ?? 0;
  const activeClients = clientsData?.summary?.activeCount ?? 0;
  const atRiskCount = clientsData?.summary?.atRiskCount ?? 0;
  const totalRevenue = productsData?.summary?.totalRevenue ?? 0;
  const totalPosts = feedData?.summary?.totalPosts ?? 0;

  // Build program revenue map
  const programRevenueMap = useMemo(() => {
    const map = new Map<string, number>();
    productsData?.programs?.forEach((p) => {
      map.set(p.id, p.totalRevenue);
    });
    return map;
  }, [productsData?.programs]);

  const isEmpty = totalClients === 0 && programs.length === 0 && squads.length === 0;
  const firstName = user?.firstName || 'Coach';
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* HEADER with Profile Badge */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          {/* Profile badge */}
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

          {/* Icons */}
          <div className="flex items-center gap-2">
            <CalendarButton className="hidden lg:block" />
            <NotificationBell className="hidden lg:block" />
            <ViewSwitcher className="hidden lg:flex" />
            <ThemeToggle className="hidden lg:flex" />
          </div>
        </div>

        {/* Date + Mobile icons */}
        <div className="flex items-center justify-between lg:justify-start">
          <p className="font-sans text-[12px] text-text-secondary leading-[1.2]">
            {currentDate}
          </p>
          <div className="flex items-center gap-2 lg:hidden">
            <NotificationIconButton />
            <CalendarIconButton />
            <ViewSwitcher horizontal />
            <ThemeToggle horizontal />
          </div>
        </div>
      </div>

      {isEmpty ? (
        <Card className="rounded-[28px] border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-sm">
          <CardContent className="p-8">
            <EmptyState />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Time Period Selector */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-text-primary font-albert">
              Overview
            </h2>
            <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Revenue"
              value={`$${totalRevenue.toLocaleString()}`}
              subValue={timePeriod !== 'all' ? `Last ${timePeriod} days` : undefined}
              icon={DollarSign}
              gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
              href="/coach?tab=analytics"
            />
            <StatCard
              label="Active Members"
              value={activeClients}
              subValue={`${totalClients} total`}
              icon={Users}
              gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
              href="/coach?tab=clients"
            />
            <StatCard
              label="Feed Posts"
              value={totalPosts}
              subValue={timePeriod !== 'all' ? `Last ${timePeriod} days` : undefined}
              icon={MessageSquare}
              gradient="bg-gradient-to-br from-purple-500 to-pink-500"
              href="/feed"
            />
            {atRiskCount > 0 ? (
              <StatCard
                label="Need Attention"
                value={atRiskCount}
                subValue="Haven't been active"
                icon={AlertTriangle}
                gradient="bg-gradient-to-br from-amber-500 to-orange-500"
                href="/coach?tab=clients"
                variant="alert"
              />
            ) : (
              <StatCard
                label="Programs"
                value={programs.length}
                subValue={`${programs.filter((p) => p.activeEnrollments > 0).length} active`}
                icon={BookOpen}
                gradient="bg-gradient-to-br from-pink-500 to-rose-500"
                href="/coach?tab=programs"
              />
            )}
          </div>

          {/* Goal + Engagement Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <GoalCard goal={userData?.goal} isLoading={userLoading} />
            <EngagementCard data={feedData} isLoading={feedLoading} />
          </div>

          {/* Quick Actions */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-text-primary font-albert mb-3">
              Quick Actions
            </h2>
            <div className="flex flex-wrap gap-2">
              <QuickActionButton
                label="New Program"
                icon={Plus}
                href="/coach?tab=programs"
                variant="primary"
              />
              <QuickActionButton
                label="New Squad"
                icon={UsersRound}
                href="/coach?tab=squads"
              />
              <QuickActionButton
                label="Invite Client"
                icon={UserPlus}
                href="/coach?tab=clients"
              />
            </div>
          </div>

          {/* Programs and Squads Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Programs Section */}
            <Card className="rounded-[28px] border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-sm overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-text-primary font-albert">
                    Your Programs
                  </h2>
                  <Link
                    href="/coach?tab=programs"
                    className="text-sm text-text-secondary hover:text-text-primary font-albert flex items-center gap-1 transition-colors"
                  >
                    View all
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                {programs.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <div className="inline-flex p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 mb-3">
                      <BookOpen className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                    </div>
                    <p className="text-text-secondary font-albert text-sm mb-3">
                      No programs yet
                    </p>
                    <Link
                      href="/coach?tab=programs"
                      className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      <Plus className="w-4 h-4" />
                      Create your first program
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
            <Card className="rounded-[28px] border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-sm overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-text-primary font-albert">
                    Your Squads
                  </h2>
                  <Link
                    href="/coach?tab=squads"
                    className="text-sm text-text-secondary hover:text-text-primary font-albert flex items-center gap-1 transition-colors"
                  >
                    View all
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                {squads.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <div className="inline-flex p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 mb-3">
                      <UsersRound className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <p className="text-text-secondary font-albert text-sm mb-3">
                      No squads yet
                    </p>
                    <Link
                      href="/coach?tab=squads"
                      className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <Plus className="w-4 h-4" />
                      Create your first squad
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
        </>
      )}
    </div>
  );
}
