'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { DollarSign, Trophy, Users, AlertTriangle, ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface MetricItemProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accentColor: string;
  isAlert?: boolean;
}

function MetricItem({ label, value, icon: Icon, accentColor, isAlert }: MetricItemProps) {
  return (
    <div className={cn(
      'flex items-center gap-2.5 px-3 py-2 rounded-2xl transition-all duration-200',
      'bg-white/50 dark:bg-white/5',
      'hover:bg-white/80 dark:hover:bg-white/10',
      isAlert && value !== '0' && value !== 0 && 'ring-1 ring-red-300/50 dark:ring-red-500/30'
    )}>
      <div className={cn(
        'p-1.5 rounded-xl',
        'bg-gradient-to-br from-white/80 to-white/40 dark:from-white/10 dark:to-white/5',
        'border border-white/50 dark:border-white/10',
        'shadow-sm'
      )}>
        <Icon className={cn('w-3.5 h-3.5', accentColor.replace('bg-', 'text-').replace('/20', ''))} />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert leading-tight">
          {value}
        </span>
        <span className="text-[10px] text-[#8c8c8c] dark:text-[#7d8190] font-albert leading-tight">
          {label}
        </span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl p-3',
      'bg-white/60 dark:bg-[#171b22]/60',
      'backdrop-blur-xl',
      'border border-white/50 dark:border-white/10',
      'shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)]'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-20 bg-white/50 dark:bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-8 w-24 bg-white/50 dark:bg-white/5 rounded-full animate-pulse" />
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
      {/* Single horizontal glass strip */}
      <div className={cn(
        'relative overflow-hidden rounded-2xl p-3',
        'bg-white/60 dark:bg-[#171b22]/60',
        'backdrop-blur-xl',
        'border border-white/50 dark:border-white/10',
        'shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)]'
      )}>
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/40 via-transparent to-white/20 dark:from-white/5 dark:to-white/0 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          {/* Metrics row - horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <MetricItem
              label="Revenue"
              value={formatCurrency(totalRevenue)}
              icon={DollarSign}
              accentColor="bg-emerald-500/20"
            />

            <div className="w-px h-8 bg-[#e1ddd8]/50 dark:bg-white/10 flex-shrink-0" />

            <MetricItem
              label="Top Program"
              value={topProgram?.name ? (topProgram.name.length > 10 ? topProgram.name.slice(0, 10) + '…' : topProgram.name) : '—'}
              icon={Trophy}
              accentColor="bg-amber-500/20"
            />

            <div className="w-px h-8 bg-[#e1ddd8]/50 dark:bg-white/10 flex-shrink-0" />

            <MetricItem
              label="Active"
              value={activeClients}
              icon={TrendingUp}
              accentColor="bg-blue-500/20"
            />

            <div className="w-px h-8 bg-[#e1ddd8]/50 dark:bg-white/10 flex-shrink-0" />

            <MetricItem
              label={atRiskCount > 0 ? 'At-Risk' : 'Health'}
              value={atRiskCount > 0 ? atRiskCount : '✓'}
              icon={atRiskCount > 0 ? AlertTriangle : Users}
              accentColor={atRiskCount > 0 ? 'bg-red-500/20' : 'bg-violet-500/20'}
              isAlert={atRiskCount > 0}
            />
          </div>

          {/* Dashboard link */}
          <Link
            href="/coach"
            className={cn(
              'flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium',
              'text-[#1a1a1a] dark:text-[#f5f5f8]',
              'rounded-full',
              'bg-white/70 dark:bg-white/10',
              'border border-white/50 dark:border-white/10',
              'shadow-sm hover:shadow-md',
              'hover:bg-white dark:hover:bg-white/15',
              'transition-all duration-200'
            )}
          >
            Dashboard
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
