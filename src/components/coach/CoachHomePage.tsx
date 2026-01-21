'use client';

import React from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ViewSwitcherInline } from '@/components/shared/ViewSwitcher';
import { useDemoMode } from '@/contexts/DemoModeContext';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  gradient: string;
  href?: string;
}

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  gradient,
  href,
}: StatCardProps) {
  const content = (
    <div className="relative overflow-hidden h-full">
      {/* Background gradient */}
      <div className={cn('absolute inset-0 opacity-10', gradient)} />

      {/* Content */}
      <div className="relative p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className={cn('p-3 rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur-sm shadow-sm')}>
            <Icon className="w-6 h-6 text-text-primary" />
          </div>
          {href && (
            <ArrowRight className="w-5 h-5 text-text-secondary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          )}
        </div>
        <div className="mt-auto">
          <p className="text-3xl font-bold text-text-primary font-albert tracking-tight">
            {value}
          </p>
          <p className="text-sm text-text-secondary font-albert mt-1">
            {label}
          </p>
          {subValue && (
            <p className="text-xs text-text-tertiary font-albert mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {subValue}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const baseClassName = cn(
    'group rounded-[28px] overflow-hidden transition-all duration-300',
    'bg-white dark:bg-[#171b22]',
    'border border-[#e1ddd8]/50 dark:border-[#262b35]/50',
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
          'h-12 px-5 rounded-2xl gap-2 font-albert',
          variant === 'primary' && 'shadow-md'
        )}
      >
        <Icon className="w-4 h-4" />
        {label}
      </Button>
    </Link>
  );
}

interface ProgramCardProps {
  name: string;
  type: 'group' | 'individual';
  activeEnrollments: number;
  id: string;
}

function ProgramCard({ name, type, activeEnrollments, id }: ProgramCardProps) {
  return (
    <Link
      href={`/coach?tab=programs&programId=${id}`}
      className={cn(
        'group flex items-center gap-4 p-4 rounded-2xl transition-all duration-200',
        'bg-[#f8f6f4] dark:bg-[#1a1f2a]',
        'hover:bg-[#f3f1ef] dark:hover:bg-[#242a38]',
        'border border-transparent hover:border-[#e1ddd8]/50 dark:hover:border-[#262b35]/50'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center',
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-text-primary font-albert truncate">
          {name}
        </h4>
        <p className="text-sm text-text-secondary font-albert">
          {activeEnrollments} active {activeEnrollments === 1 ? 'client' : 'clients'}
        </p>
      </div>

      {/* Arrow */}
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
        'group flex items-center gap-4 p-4 rounded-2xl transition-all duration-200',
        'bg-[#f8f6f4] dark:bg-[#1a1f2a]',
        'hover:bg-[#f3f1ef] dark:hover:bg-[#242a38]',
        'border border-transparent hover:border-[#e1ddd8]/50 dark:hover:border-[#262b35]/50'
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
        <UsersRound className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-text-primary font-albert truncate">
          {name}
        </h4>
        <p className="text-sm text-text-secondary font-albert">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-surface rounded-xl" />
          <div className="h-5 w-48 bg-surface rounded-lg" />
        </div>
        <div className="h-9 w-36 bg-surface rounded-xl" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-surface rounded-[28px]" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-surface rounded-[28px]" />
        <div className="h-80 bg-surface rounded-[28px]" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex p-5 rounded-[28px] bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 mb-6 shadow-sm">
        <Sparkles className="w-10 h-10 text-amber-500 dark:text-amber-400" />
      </div>
      <h3 className="text-2xl font-bold text-text-primary font-albert mb-3">
        Welcome to your coaching dashboard
      </h3>
      <p className="text-text-secondary font-albert mb-8 max-w-md mx-auto text-lg">
        Get started by creating your first program or inviting clients to join your platform.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link href="/coach?tab=programs">
          <Button className="h-12 px-6 rounded-2xl gap-2 font-albert shadow-md">
            <Plus className="w-5 h-5" />
            Create Program
          </Button>
        </Link>
        <Link href="/coach?tab=clients">
          <Button variant="outline" className="h-12 px-6 rounded-2xl gap-2 font-albert">
            <UserPlus className="w-5 h-5" />
            Invite Clients
          </Button>
        </Link>
      </div>
    </div>
  );
}

interface Program {
  id: string;
  name: string;
  type: 'group' | 'individual';
  activeEnrollments: number;
  totalEnrollments: number;
}

interface Squad {
  id: string;
  name: string;
  memberCount: number;
}

interface ClientsData {
  summary?: {
    totalClients?: number;
    activeCount?: number;
    atRiskCount?: number;
  };
}

export function CoachHomePage() {
  const { user } = useUser();
  const { isDemoMode } = useDemoMode();

  // Fetch programs
  const { data: programsData, isLoading: programsLoading } = useSWR<Program[]>(
    '/api/coach/org-programs',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch squads
  const { data: squadsData, isLoading: squadsLoading } = useSWR<Squad[]>(
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

  const isLoading = programsLoading || squadsLoading || clientsLoading;

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingSkeleton />
      </div>
    );
  }

  // Extract data
  const programs = programsData || [];
  const squads = squadsData || [];
  const totalClients = clientsData?.summary?.totalClients ?? 0;
  const activeClients = clientsData?.summary?.activeCount ?? 0;
  const atRiskCount = clientsData?.summary?.atRiskCount ?? 0;
  const totalPrograms = programs.length;
  const activePrograms = programs.filter((p) => p.activeEnrollments > 0).length;
  const totalSquads = squads.length;
  const totalSquadMembers = squads.reduce((sum, s) => sum + (s.memberCount || 0), 0);

  const isEmpty = totalClients === 0 && totalPrograms === 0 && totalSquads === 0;

  const firstName = user?.firstName || 'Coach';
  const greeting = getGreeting();

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary font-albert tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-text-secondary font-albert mt-2 text-lg">
            Here&apos;s an overview of your coaching business
          </p>
        </div>
        <ViewSwitcherInline className="self-start" />
      </div>

      {isEmpty ? (
        <Card className="rounded-[28px] border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-sm">
          <CardContent className="p-8">
            <EmptyState />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Clients"
              value={totalClients}
              subValue={`${activeClients} active`}
              icon={Users}
              gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
              href="/coach?tab=clients"
            />
            <StatCard
              label="Programs"
              value={totalPrograms}
              subValue={`${activePrograms} with clients`}
              icon={BookOpen}
              gradient="bg-gradient-to-br from-purple-500 to-pink-500"
              href="/coach?tab=programs"
            />
            <StatCard
              label="Squads"
              value={totalSquads}
              subValue={`${totalSquadMembers} members`}
              icon={UsersRound}
              gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
              href="/coach?tab=squads"
            />
          </div>

          {/* Needs Attention Alert */}
          {atRiskCount > 0 && (
            <div className="mb-8 p-5 rounded-[20px] bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-800/30">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 shadow-sm">
                  <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800 dark:text-amber-300 font-albert text-lg">
                    {atRiskCount} {atRiskCount === 1 ? 'client needs' : 'clients need'} attention
                  </p>
                  <p className="text-amber-600 dark:text-amber-400/80 font-albert">
                    Some clients haven&apos;t been active recently
                  </p>
                </div>
                <Link
                  href="/coach?tab=clients"
                  className="hidden sm:flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
                >
                  View clients
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-text-primary font-albert mb-4">
              Quick Actions
            </h2>
            <div className="flex flex-wrap gap-3">
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
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-semibold text-text-primary font-albert">
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
                  <div className="text-center py-10 px-4">
                    <div className="inline-flex p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/20 mb-4">
                      <BookOpen className="w-8 h-8 text-purple-500 dark:text-purple-400" />
                    </div>
                    <p className="text-text-secondary font-albert mb-4">
                      No programs yet
                    </p>
                    <Link
                      href="/coach?tab=programs"
                      className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
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
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Squads Section */}
            <Card className="rounded-[28px] border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-sm overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-semibold text-text-primary font-albert">
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
                  <div className="text-center py-10 px-4">
                    <div className="inline-flex p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 mb-4">
                      <UsersRound className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <p className="text-text-secondary font-albert mb-4">
                      No squads yet
                    </p>
                    <Link
                      href="/coach?tab=squads"
                      className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
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
