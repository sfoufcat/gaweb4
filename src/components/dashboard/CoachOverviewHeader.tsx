'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { DollarSign, Trophy, Users, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  href?: string;
  isAlert?: boolean;
}

function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  iconColor,
  iconBg,
  href,
  isAlert,
}: MetricCardProps) {
  const content = (
    <div
      className={cn(
        'flex flex-col p-3 sm:p-4 rounded-2xl transition-all duration-200',
        'bg-white/60 dark:bg-[#171b22]/60',
        'border border-[#e1ddd8]/50 dark:border-[#262b35]/50',
        'hover:bg-white/80 dark:hover:bg-[#171b22]/80',
        'hover:shadow-md hover:scale-[1.02]',
        href && 'cursor-pointer',
        isAlert && value !== '0' && value !== 0 && 'ring-2 ring-red-200 dark:ring-red-900/50'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 sm:p-2 rounded-xl', iconBg)}>
          <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', iconColor)} />
        </div>
      </div>
      <div className="space-y-0.5">
        <p className="text-xl sm:text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-tight">
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
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function LoadingSkeleton() {
  return (
    <div className="glass-card p-4 sm:p-5 mb-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg" />
        <div className="h-8 w-36 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function AllClearState() {
  return (
    <div className="glass-card p-4 sm:p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
          Coach Overview
        </h3>
        <Link
          href="/coach"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#a07855] hover:text-[#8a6847] transition-colors rounded-full bg-[#a07855]/10 hover:bg-[#a07855]/15"
        >
          Dashboard
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="flex items-center justify-center py-6 gap-3">
        <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
          <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Everything looks great!
          </p>
          <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190]">
            All clients are active and engaged
          </p>
        </div>
      </div>
    </div>
  );
}

interface CoachOverviewHeaderProps {
  className?: string;
}

export function CoachOverviewHeader({ className }: CoachOverviewHeaderProps) {
  // Fetch product analytics (revenue + top program)
  const { data: productData, isLoading: productsLoading } = useSWR(
    '/api/coach/analytics/products',
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5 * 60 * 1000, // 5 min
    }
  );

  // Fetch client analytics (active + at-risk)
  const { data: clientData, isLoading: clientsLoading } = useSWR(
    '/api/coach/analytics/clients',
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5 * 60 * 1000,
    }
  );

  const isLoading = productsLoading || clientsLoading;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Extract metrics
  const totalRevenue = productData?.summary?.totalRevenue ?? 0;
  const topProgram = productData?.programs?.[0];
  const activeClients =
    (clientData?.summary?.thrivingCount ?? 0) + (clientData?.summary?.activeCount ?? 0);
  const atRiskCount = clientData?.summary?.atRiskCount ?? 0;
  const activeRate = clientData?.summary?.activeRate ?? 0;
  const totalClients = clientData?.summary?.totalClients ?? 0;

  // Check if all metrics are positive (no at-risk, good engagement)
  const allClear = atRiskCount === 0 && activeRate >= 70 && totalClients > 0;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (allClear) {
    return <AllClearState />;
  }

  return (
    <div className={cn('glass-card p-4 sm:p-5 mb-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
          Coach Overview
        </h3>
        <Link
          href="/coach"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#a07855] hover:text-[#8a6847] transition-colors rounded-full bg-[#a07855]/10 hover:bg-[#a07855]/15"
        >
          Dashboard
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Revenue"
          value={formatCurrency(totalRevenue)}
          subValue="All time"
          icon={DollarSign}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          href="/coach?tab=analytics"
        />

        <MetricCard
          label="Top Program"
          value={topProgram?.name ? (topProgram.name.length > 12 ? topProgram.name.slice(0, 12) + '...' : topProgram.name) : 'None'}
          subValue={topProgram ? `${topProgram.enrolledCount} enrolled` : 'Create your first'}
          icon={Trophy}
          iconColor="text-amber-600 dark:text-amber-400"
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          href="/coach?tab=programs"
        />

        <MetricCard
          label="Active Clients"
          value={activeClients}
          subValue={`${Math.round(activeRate)}% engagement`}
          icon={Users}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          href="/coach?tab=clients"
        />

        <MetricCard
          label="At-Risk"
          value={atRiskCount}
          subValue={atRiskCount > 0 ? 'Need attention' : 'All good'}
          icon={AlertTriangle}
          iconColor={atRiskCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}
          iconBg={atRiskCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'}
          href="/coach?tab=clients"
          isAlert
        />
      </div>

      {/* Footer stats */}
      <div className="mt-3 pt-3 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] text-center">
          {totalClients} total clients · {Math.round(activeRate)}% engagement rate
        </p>
      </div>
    </div>
  );
}
