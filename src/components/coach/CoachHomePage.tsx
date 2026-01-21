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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ViewSwitcherInline } from '@/components/shared/ViewSwitcher';
import { useDemoMode } from '@/contexts/DemoModeContext';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  href?: string;
}

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  iconColor,
  iconBg,
  href,
}: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2.5 rounded-xl', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>
      <div className="space-y-0.5">
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
    </>
  );

  const baseClassName = cn(
    'flex flex-col p-4 rounded-2xl transition-all duration-200',
    'bg-white dark:bg-[#171b22]',
    'border border-[#e1ddd8] dark:border-[#262b35]',
    'shadow-sm',
    href && 'hover:shadow-md hover:scale-[1.02] cursor-pointer'
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

interface QuickActionProps {
  label: string;
  icon: React.ElementType;
  href: string;
}

function QuickAction({ label, icon: Icon, href }: QuickActionProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
        'bg-[#f5f3f0] dark:bg-[#1a1f2a]',
        'hover:bg-[#ebe8e4] dark:hover:bg-[#242a38]',
        'text-[#1a1a1a] dark:text-[#f5f5f8]',
        'group'
      )}
    >
      <div className="p-2 rounded-lg bg-white dark:bg-[#272d38] shadow-sm">
        <Icon className="w-4 h-4 text-[#5f5a55] dark:text-[#b5b0ab]" />
      </div>
      <span className="text-sm font-medium font-albert">{label}</span>
      <ArrowRight className="w-4 h-4 ml-auto text-[#a7a39e] dark:text-[#5f6470] group-hover:translate-x-1 transition-transform" />
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
        'flex flex-col p-4 rounded-xl transition-all duration-200',
        'bg-[#f5f3f0] dark:bg-[#1a1f2a]',
        'hover:bg-[#ebe8e4] dark:hover:bg-[#242a38]',
        'group'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert line-clamp-1">
          {name}
        </h4>
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            type === 'group'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          )}
        >
          {type === 'group' ? 'Group' : '1:1'}
        </span>
      </div>
      <p className="text-sm text-[#5f5a55] dark:text-[#b5b0ab] font-albert">
        {activeEnrollments} active {activeEnrollments === 1 ? 'client' : 'clients'}
      </p>
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
        'flex flex-col p-4 rounded-xl transition-all duration-200',
        'bg-[#f5f3f0] dark:bg-[#1a1f2a]',
        'hover:bg-[#ebe8e4] dark:hover:bg-[#242a38]',
        'group'
      )}
    >
      <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert line-clamp-1 mb-2">
        {name}
      </h4>
      <p className="text-sm text-[#5f5a55] dark:text-[#b5b0ab] font-albert">
        {memberCount} {memberCount === 1 ? 'member' : 'members'}
      </p>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-[#e1ddd8] dark:bg-[#272d38] rounded-lg" />
        <div className="h-8 w-32 bg-[#e1ddd8] dark:bg-[#272d38] rounded-lg" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]"
          />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]" />
        <div className="h-64 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex p-4 rounded-2xl bg-[#f5f3f0] dark:bg-[#1a1f2a] mb-4">
        <Sparkles className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]" />
      </div>
      <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
        Welcome to your coaching dashboard
      </h3>
      <p className="text-[#5f5a55] dark:text-[#b5b0ab] font-albert mb-6 max-w-md mx-auto">
        Get started by creating your first program or inviting clients to join your platform.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/coach?tab=programs"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Create Program
        </Link>
        <Link
          href="/coach?tab=clients"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium text-sm hover:bg-[#ebe8e4] dark:hover:bg-[#242a38] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite Clients
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
      <div className="max-w-5xl mx-auto px-4 py-8">
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Welcome back, {firstName}
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b5b0ab] font-albert mt-1">
            Here&apos;s an overview of your coaching business
          </p>
        </div>
        <ViewSwitcherInline />
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Clients"
              value={totalClients}
              subValue={`${activeClients} active`}
              icon={Users}
              iconColor="text-blue-600 dark:text-blue-400"
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              href="/coach?tab=clients"
            />
            <StatCard
              label="Programs"
              value={totalPrograms}
              subValue={`${activePrograms} with active clients`}
              icon={BookOpen}
              iconColor="text-purple-600 dark:text-purple-400"
              iconBg="bg-purple-100 dark:bg-purple-900/30"
              href="/coach?tab=programs"
            />
            <StatCard
              label="Squads"
              value={totalSquads}
              subValue={`${totalSquadMembers} total members`}
              icon={UsersRound}
              iconColor="text-emerald-600 dark:text-emerald-400"
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              href="/coach?tab=squads"
            />
          </div>

          {/* Needs Attention Alert */}
          {atRiskCount > 0 && (
            <div className="mb-8 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800 dark:text-amber-300 font-albert">
                    {atRiskCount} {atRiskCount === 1 ? 'client needs' : 'clients need'} attention
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400/80">
                    Some clients haven&apos;t been active recently. Consider reaching out.
                  </p>
                </div>
                <Link
                  href="/coach?tab=clients"
                  className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
                >
                  View clients
                </Link>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <QuickAction
                label="Create New Program"
                icon={Plus}
                href="/coach?tab=programs"
              />
              <QuickAction
                label="Create New Squad"
                icon={UsersRound}
                href="/coach?tab=squads"
              />
              <QuickAction
                label="Invite Client"
                icon={UserPlus}
                href="/coach?tab=clients"
              />
            </div>
          </div>

          {/* Programs and Squads Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Programs Section */}
            <div
              className={cn(
                'p-6 rounded-2xl',
                'bg-white dark:bg-[#171b22]',
                'border border-[#e1ddd8] dark:border-[#262b35]'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Your Programs
                </h2>
                <Link
                  href="/coach?tab=programs"
                  className="text-sm text-[#5f5a55] dark:text-[#b5b0ab] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {programs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#5f5a55] dark:text-[#b5b0ab] font-albert mb-3">
                    No programs yet
                  </p>
                  <Link
                    href="/coach?tab=programs"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#a07855] dark:text-[#b8896a] hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first program
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {programs.slice(0, 3).map((program) => (
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
            </div>

            {/* Squads Section */}
            <div
              className={cn(
                'p-6 rounded-2xl',
                'bg-white dark:bg-[#171b22]',
                'border border-[#e1ddd8] dark:border-[#262b35]'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Your Squads
                </h2>
                <Link
                  href="/coach?tab=squads"
                  className="text-sm text-[#5f5a55] dark:text-[#b5b0ab] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {squads.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#5f5a55] dark:text-[#b5b0ab] font-albert mb-3">
                    No squads yet
                  </p>
                  <Link
                    href="/coach?tab=squads"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#a07855] dark:text-[#b8896a] hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first squad
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {squads.slice(0, 3).map((squad) => (
                    <SquadCard
                      key={squad.id}
                      id={squad.id}
                      name={squad.name}
                      memberCount={squad.memberCount}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
