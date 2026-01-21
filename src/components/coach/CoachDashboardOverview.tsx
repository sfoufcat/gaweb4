'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import {
  DollarSign,
  Users,
  AlertTriangle,
  Trophy,
  TrendingUp,
  Activity,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Send,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  onClick?: () => void;
  isAlert?: boolean;
  tooltip?: string;
}

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  iconColor,
  iconBg,
  onClick,
  isAlert,
  tooltip,
}: StatCardProps) {
  const card = (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col p-3 sm:p-4 rounded-2xl transition-all duration-200 text-left w-full',
        'bg-white dark:bg-[#171b22]',
        'border border-[#e1ddd8] dark:border-[#262b35]',
        'hover:shadow-md hover:scale-[1.02]',
        'shadow-sm',
        isAlert && value !== '0' && value !== 0 && 'ring-2 ring-red-200 dark:ring-red-900/50'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={cn('p-2 rounded-xl', iconBg)}>
          <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', iconColor)} />
        </div>
        {tooltip && (
          <Info className="w-3.5 h-3.5 text-[#a7a39e] dark:text-[#5f6470] opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <div className="space-y-0.5">
        <p className="text-lg sm:text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-tight">
          {value}
        </p>
        <p className="text-xs sm:text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert">
          {label}
        </p>
        {subValue && (
          <p className="text-[10px] sm:text-xs text-[#a7a39e] dark:text-[#5f6470] font-albert truncate">
            {subValue}
          </p>
        )}
      </div>
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="group w-full">{card}</div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px] whitespace-normal text-center">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return card;
}

function LoadingSkeleton() {
  return (
    <div className="mb-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-28 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]"
          />
        ))}
      </div>
    </div>
  );
}

function AllClearBanner() {
  return (
    <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/50">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
          <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-emerald-800 dark:text-emerald-300 font-albert">
            Everything is running smoothly!
          </p>
          <p className="text-sm text-emerald-600 dark:text-emerald-400/80">
            All clients are active and engaged. Keep up the great work.
          </p>
        </div>
      </div>
    </div>
  );
}

interface AtRiskClient {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  lastActivityAt?: string;
  activityStatus?: string;
}

interface CoachDashboardOverviewProps {
  onTabChange?: (tab: string, filters?: Record<string, string>) => void;
  className?: string;
}

export function CoachDashboardOverview({ onTabChange, className }: CoachDashboardOverviewProps) {
  const [atRiskExpanded, setAtRiskExpanded] = useState(false);
  const [nudgedUsers, setNudgedUsers] = useState<Set<string>>(new Set());
  const [nudgingUsers, setNudgingUsers] = useState<Set<string>>(new Set());

  // Fetch product analytics (revenue + top program)
  const { data: productData, isLoading: productsLoading } = useSWR(
    '/api/coach/analytics/products',
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5 * 60 * 1000,
    }
  );

  // Fetch client analytics
  const { data: clientData, isLoading: clientsLoading } = useSWR(
    '/api/coach/analytics/clients',
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5 * 60 * 1000,
    }
  );

  // Fetch community analytics
  const { data: communityData, isLoading: communityLoading } = useSWR(
    '/api/coach/analytics/communities',
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5 * 60 * 1000,
    }
  );

  // Fetch at-risk clients list (only when expanded)
  const { data: atRiskData } = useSWR<{ clients: AtRiskClient[] }>(
    atRiskExpanded ? '/api/coach/analytics/clients?status=at-risk&limit=3' : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const isLoading = productsLoading || clientsLoading || communityLoading;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Extract metrics
  const totalRevenue = productData?.summary?.totalRevenue ?? 0;
  const topProgram = productData?.programs?.[0];
  const totalClients = clientData?.summary?.totalClients ?? 0;
  const atRiskCount = clientData?.summary?.atRiskCount ?? 0;
  const activeRate = clientData?.summary?.activeRate ?? 0;
  const activeCount = clientData?.summary?.activeCount ?? Math.round(totalClients * (activeRate / 100));
  const thrivingSquads = communityData?.summary?.thriving ?? 0;
  const activeSquads = communityData?.summary?.active ?? 0;
  const inactiveSquads = communityData?.summary?.inactive ?? 0;
  const totalSquads = thrivingSquads + activeSquads + inactiveSquads;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate squad health percentage - null if no squads have members
  const hasSquadsWithMembers = (communityData?.communities ?? []).some((c: { totalMembers: number }) => c.totalMembers > 0);
  const squadHealthPercent = hasSquadsWithMembers
    ? Math.round(((thrivingSquads + activeSquads) / totalSquads) * 100)
    : null;

  // Check if everything is good (no at-risk, high engagement)
  const allClear = atRiskCount === 0 && activeRate >= 70 && totalClients > 0;

  // Handle nudge
  const handleNudge = async (userId: string) => {
    if (nudgedUsers.has(userId) || nudgingUsers.has(userId)) return;

    setNudgingUsers((prev) => new Set(prev).add(userId));
    try {
      await fetch('/api/coach/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      setNudgedUsers((prev) => new Set(prev).add(userId));
    } catch (error) {
      console.error('Failed to nudge user:', error);
    } finally {
      setNudgingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn('mb-6', className)}>
      {allClear && <AllClearBanner />}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          subValue="All time"
          icon={DollarSign}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          onClick={() => onTabChange?.('analytics', { analyticsSubTab: 'revenue' })}
          tooltip="Total revenue from programs and products"
        />

        <StatCard
          label="Total Clients"
          value={totalClients}
          subValue={`${activeCount} active`}
          icon={Users}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          onClick={() => onTabChange?.('clients')}
          tooltip="Total clients in your organization. Click to view all."
        />

        {/* At-Risk Clients - Special expandable card */}
        <div className="col-span-1">
          <div
            className={cn(
              'flex flex-col rounded-2xl transition-all duration-200 text-left w-full',
              'bg-white dark:bg-[#171b22]',
              'border border-[#e1ddd8] dark:border-[#262b35]',
              'shadow-sm',
              atRiskCount > 0 && 'ring-2 ring-red-200 dark:ring-red-900/50',
              atRiskExpanded && 'ring-2 ring-red-300 dark:ring-red-800'
            )}
          >
            <button
              onClick={() => {
                if (atRiskCount > 0) {
                  setAtRiskExpanded(!atRiskExpanded);
                } else {
                  onTabChange?.('clients');
                }
              }}
              className="flex flex-col p-3 sm:p-4 text-left w-full hover:bg-gray-50 dark:hover:bg-[#1c2028] rounded-2xl transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    'p-2 rounded-xl',
                    atRiskCount > 0
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-gray-100 dark:bg-gray-800'
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      'w-4 h-4 sm:w-5 sm:h-5',
                      atRiskCount > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-400 dark:text-gray-500'
                    )}
                  />
                </div>
                {atRiskCount > 0 && (
                  atRiskExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#a7a39e] dark:text-[#5f6470]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#a7a39e] dark:text-[#5f6470]" />
                  )
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-lg sm:text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-tight">
                  {atRiskCount}
                </p>
                <p className="text-xs sm:text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                  At-Risk Clients
                </p>
                <p className="text-[10px] sm:text-xs text-[#a7a39e] dark:text-[#5f6470] font-albert truncate">
                  {atRiskCount > 0 ? 'Click to expand' : 'None'}
                </p>
              </div>
            </button>

            {/* Expansion panel */}
            {atRiskExpanded && atRiskCount > 0 && (
              <div className="border-t border-[#e1ddd8] dark:border-[#262b35] px-3 sm:px-4 py-2 space-y-2">
                {atRiskData?.clients?.slice(0, 3).map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between gap-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="w-6 h-6 flex-shrink-0">
                        <AvatarImage src={client.photoURL} />
                        <AvatarFallback className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {getInitials(client.name || client.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {client.name || client.email.split('@')[0]}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNudge(client.id);
                      }}
                      disabled={nudgedUsers.has(client.id) || nudgingUsers.has(client.id)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0',
                        nudgedUsers.has(client.id)
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50',
                        nudgingUsers.has(client.id) && 'opacity-50 cursor-wait'
                      )}
                    >
                      {nudgedUsers.has(client.id) ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Sent</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3" />
                          <span>Nudge</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => onTabChange?.('clients', { clientFilter: 'at-risk' })}
                  className="w-full text-center text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  View all {atRiskCount} at-risk clients →
                </button>
              </div>
            )}
          </div>
        </div>

        <StatCard
          label="Top Program"
          value={
            topProgram?.name
              ? topProgram.name.length > 10
                ? topProgram.name.slice(0, 10) + '...'
                : topProgram.name
              : 'None'
          }
          subValue={topProgram ? `${topProgram.enrolledCount} enrolled` : 'Create one'}
          icon={Trophy}
          iconColor="text-amber-600 dark:text-amber-400"
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          onClick={() =>
            onTabChange?.(
              'programs',
              topProgram?.id ? { programId: topProgram.id } : undefined
            )
          }
          tooltip="Most popular program by enrollment. Click to view analytics."
        />

        <StatCard
          label="Engagement"
          value={`${Math.round(activeRate)}%`}
          subValue="Last 7 days"
          icon={TrendingUp}
          iconColor="text-teal-600 dark:text-teal-400"
          iconBg="bg-teal-100 dark:bg-teal-900/30"
          onClick={() => onTabChange?.('analytics', { analyticsSubTab: 'clients' })}
          tooltip="Percentage of clients who logged in this week"
        />

        <StatCard
          label="Squad Health"
          value={squadHealthPercent !== null ? `${squadHealthPercent}%` : '--'}
          subValue={
            squadHealthPercent !== null
              ? `${thrivingSquads + activeSquads}/${totalSquads} healthy`
              : 'No members yet'
          }
          icon={Activity}
          iconColor="text-purple-600 dark:text-purple-400"
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          onClick={() => onTabChange?.('squads')}
          tooltip="Squads with active participation. Click to review activity."
        />
      </div>
    </div>
  );
}
