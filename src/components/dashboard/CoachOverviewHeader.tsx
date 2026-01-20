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
  accentColor: string;
  href?: string;
  isAlert?: boolean;
}

function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  accentColor,
  href,
  isAlert,
}: MetricCardProps) {
  const content = (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[20px] p-4 transition-all duration-300',
        'bg-white/70 dark:bg-[#171b22]/70',
        'backdrop-blur-xl',
        'border border-white/50 dark:border-white/10',
        'shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)]',
        'hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)]',
        'hover:bg-white/90 dark:hover:bg-[#171b22]/90',
        'hover:scale-[1.02] hover:-translate-y-0.5',
        href && 'cursor-pointer',
        isAlert && value !== '0' && value !== 0 && 'ring-2 ring-red-300/50 dark:ring-red-500/30'
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-transparent dark:from-white/5 pointer-events-none" />

      {/* Accent glow */}
      <div
        className={cn(
          'absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity',
          accentColor
        )}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={cn(
            'p-2 rounded-xl backdrop-blur-sm',
            'bg-gradient-to-br from-white/80 to-white/40 dark:from-white/10 dark:to-white/5',
            'border border-white/50 dark:border-white/10',
            'shadow-sm'
          )}>
            <Icon className={cn('w-4 h-4', accentColor.replace('bg-', 'text-').replace('/20', ''))} />
          </div>
          <ArrowRight className="w-4 h-4 text-[#c4c0bb] dark:text-[#4a4f5a] group-hover:text-[#a07855] group-hover:translate-x-0.5 transition-all" />
        </div>
        <div className="space-y-0.5">
          <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-tight">
            {value}
          </p>
          <p className="text-sm font-medium text-[#6b6560] dark:text-[#9ca3af] font-albert">
            {label}
          </p>
          {subValue && (
            <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] font-albert">
              {subValue}
            </p>
          )}
        </div>
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
        <div className="space-y-2">
          <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 rounded-lg animate-pulse" />
        </div>
        <div className="h-10 w-28 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[120px] bg-white/50 dark:bg-[#171b22]/50 rounded-[20px] backdrop-blur-xl border border-white/30 dark:border-white/5 animate-pulse"
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
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] transition-all duration-200 rounded-full bg-white/70 dark:bg-[#171b22]/70 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-[#171b22] hover:scale-[1.02]"
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
          accentColor="bg-emerald-500/20"
          href="/coach?tab=analytics"
        />

        <MetricCard
          label="Top Program"
          value={topProgram?.name ? (topProgram.name.length > 12 ? topProgram.name.slice(0, 12) + '…' : topProgram.name) : '—'}
          subValue={topProgram ? `${topProgram.enrolledCount} enrolled` : 'Create your first'}
          icon={Trophy}
          accentColor="bg-amber-500/20"
          href="/coach?tab=programs"
        />

        <MetricCard
          label="Active Clients"
          value={activeClients}
          subValue={`${Math.round(activeRate)}% engagement`}
          icon={TrendingUp}
          accentColor="bg-blue-500/20"
          href="/coach?tab=clients"
        />

        <MetricCard
          label={atRiskCount > 0 ? 'At-Risk' : 'Client Health'}
          value={atRiskCount > 0 ? atRiskCount : '✓'}
          subValue={atRiskCount > 0 ? 'Need attention' : 'All thriving'}
          icon={atRiskCount > 0 ? AlertTriangle : Users}
          accentColor={atRiskCount > 0 ? 'bg-red-500/20' : 'bg-violet-500/20'}
          href="/coach?tab=clients"
          isAlert={atRiskCount > 0}
        />
      </div>
    </div>
  );
}
