'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { DollarSign, Trophy, Users, AlertTriangle, ArrowRight, TrendingUp } from 'lucide-react';
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
        'flex flex-col p-4 rounded-2xl transition-all duration-200',
        'bg-white dark:bg-[#171b22]',
        'border border-[#e1ddd8] dark:border-[#262b35]',
        'shadow-sm hover:shadow-md hover:scale-[1.02]',
        href && 'cursor-pointer',
        isAlert && value !== '0' && value !== 0 && 'ring-2 ring-red-200 dark:ring-red-900/50'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('p-2 rounded-xl', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
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
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-40 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

interface CoachOverviewHeaderProps {
  className?: string;
}

export function CoachOverviewHeader({ className }: CoachOverviewHeaderProps) {
  const { data: productData, isLoading: productsLoading } = useSWR(
    '/api/coach/analytics/products',
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5 * 60 * 1000,
    }
  );

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

  const totalRevenue = productData?.summary?.totalRevenue ?? 0;
  const topProgram = productData?.programs?.[0];
  const activeClients =
    (clientData?.summary?.thrivingCount ?? 0) + (clientData?.summary?.activeCount ?? 0);
  const atRiskCount = clientData?.summary?.atRiskCount ?? 0;
  const activeRate = clientData?.summary?.activeRate ?? 0;
  const totalClients = clientData?.summary?.totalClients ?? 0;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={cn(className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
            Coach Overview
          </h2>
          <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190]">
            {totalClients} clients · {Math.round(activeRate)}% engaged
          </p>
        </div>
        <Link
          href="/coach"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#a07855] hover:text-[#8a6847] transition-colors rounded-full border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] hover:bg-[#f7f5f3] dark:hover:bg-[#1d222b]"
        >
          Dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
          value={topProgram?.name ? (topProgram.name.length > 12 ? topProgram.name.slice(0, 12) + '…' : topProgram.name) : '—'}
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
          icon={TrendingUp}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          href="/coach?tab=clients"
        />

        <MetricCard
          label={atRiskCount > 0 ? 'At-Risk' : 'Client Health'}
          value={atRiskCount > 0 ? atRiskCount : '✓'}
          subValue={atRiskCount > 0 ? 'Need attention' : 'All thriving'}
          icon={atRiskCount > 0 ? AlertTriangle : Users}
          iconColor={atRiskCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-violet-600 dark:text-violet-400'}
          iconBg={atRiskCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-violet-100 dark:bg-violet-900/30'}
          href="/coach?tab=clients"
          isAlert={atRiskCount > 0}
        />
      </div>
    </div>
  );
}
