'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  DollarSign,
  Users,
  AlertTriangle,
  Trophy,
  TrendingUp,
  Activity,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
}: StatCardProps) {
  return (
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
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-2 rounded-xl', iconBg)}>
          <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', iconColor)} />
        </div>
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

interface CoachDashboardOverviewProps {
  onTabChange?: (tab: string) => void;
  className?: string;
}

export function CoachDashboardOverview({ onTabChange, className }: CoachDashboardOverviewProps) {
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

  // Calculate squad health percentage
  const squadHealthPercent =
    totalSquads > 0 ? Math.round(((thrivingSquads + activeSquads) / totalSquads) * 100) : 100;

  // Check if everything is good (no at-risk, high engagement)
  const allClear = atRiskCount === 0 && activeRate >= 70 && totalClients > 0;

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
          onClick={() => onTabChange?.('analytics')}
        />

        <StatCard
          label="Total Clients"
          value={totalClients}
          subValue={`${Math.round(activeRate)}% active`}
          icon={Users}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          onClick={() => onTabChange?.('clients')}
        />

        <StatCard
          label="At-Risk Clients"
          value={atRiskCount}
          subValue={atRiskCount > 0 ? 'Need attention' : 'None'}
          icon={AlertTriangle}
          iconColor={
            atRiskCount > 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-400 dark:text-gray-500'
          }
          iconBg={atRiskCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'}
          onClick={() => onTabChange?.('clients')}
          isAlert
        />

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
          onClick={() => onTabChange?.('programs')}
        />

        <StatCard
          label="Engagement"
          value={`${Math.round(activeRate)}%`}
          subValue="Active rate"
          icon={TrendingUp}
          iconColor="text-teal-600 dark:text-teal-400"
          iconBg="bg-teal-100 dark:bg-teal-900/30"
          onClick={() => onTabChange?.('analytics')}
        />

        <StatCard
          label="Squad Health"
          value={`${squadHealthPercent}%`}
          subValue={`${thrivingSquads + activeSquads}/${totalSquads} healthy`}
          icon={Activity}
          iconColor="text-purple-600 dark:text-purple-400"
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          onClick={() => onTabChange?.('squads')}
        />
      </div>
    </div>
  );
}
