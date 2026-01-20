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
      'flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl transition-all duration-200',
      'bg-white/50 dark:bg-white/5',
      'hover:bg-white/80 dark:hover:bg-white/10',
      isAlert && value !== '0' && value !== 0 && 'ring-1 ring-red-300/50 dark:ring-red-500/30'
    )}>
      <div className={cn(
        'p-1 sm:p-1.5 rounded-lg sm:rounded-xl',
        'bg-gradient-to-br from-white/80 to-white/40 dark:from-white/10 dark:to-white/5',
        'border border-white/50 dark:border-white/10',
        'shadow-sm'
      )}>
        <Icon className={cn('w-3 h-3 sm:w-3.5 sm:h-3.5', accentColor.replace('bg-', 'text-').replace('/20', ''))} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs sm:text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert leading-tight truncate">
          {value}
        </span>
        <span className="text-[9px] sm:text-[10px] text-[#8c8c8c] dark:text-[#7d8190] font-albert leading-tight truncate">
          {label}
        </span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl p-2.5 sm:p-3',
      'bg-white/60 dark:bg-[#171b22]/60',
      'backdrop-blur-xl',
      'border border-white/50 dark:border-white/10',
      'shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)]'
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 sm:h-10 flex-1 bg-white/50 dark:bg-white/5 rounded-xl sm:rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-7 sm:h-8 w-20 sm:w-24 bg-white/50 dark:bg-white/5 rounded-full animate-pulse flex-shrink-0" />
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
    return `$${amount}`;
  };

  // Shorter program name on mobile
  const programName = topProgram?.name
    ? (topProgram.name.length > 6 ? topProgram.name.slice(0, 6) + '…' : topProgram.name)
    : '—';
  const programNameDesktop = topProgram?.name
    ? (topProgram.name.length > 10 ? topProgram.name.slice(0, 10) + '…' : topProgram.name)
    : '—';

  return (
    <div className={cn(className)}>
      {/* Single horizontal glass strip */}
      <div className={cn(
        'relative overflow-hidden rounded-2xl p-2.5 sm:p-3',
        'bg-white/60 dark:bg-[#171b22]/60',
        'backdrop-blur-xl',
        'border border-white/50 dark:border-white/10',
        'shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)]'
      )}>
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/40 via-transparent to-white/20 dark:from-white/5 dark:to-white/0 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-3">
          {/* Metrics row - flex with equal distribution */}
          <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
            <MetricItem
              label="Revenue"
              value={formatCurrency(totalRevenue)}
              icon={DollarSign}
              accentColor="bg-emerald-500/20"
            />

            <div className="w-px h-6 sm:h-8 bg-[#e1ddd8]/50 dark:bg-white/10 flex-shrink-0 hidden xs:block" />

            {/* Show different truncation on mobile vs desktop */}
            <div className="hidden sm:block">
              <MetricItem
                label="Top Program"
                value={programNameDesktop}
                icon={Trophy}
                accentColor="bg-amber-500/20"
              />
            </div>
            <div className="block sm:hidden">
              <MetricItem
                label="Program"
                value={programName}
                icon={Trophy}
                accentColor="bg-amber-500/20"
              />
            </div>

            <div className="w-px h-6 sm:h-8 bg-[#e1ddd8]/50 dark:bg-white/10 flex-shrink-0 hidden xs:block" />

            <MetricItem
              label="Active"
              value={activeClients}
              icon={TrendingUp}
              accentColor="bg-blue-500/20"
            />

            <div className="w-px h-6 sm:h-8 bg-[#e1ddd8]/50 dark:bg-white/10 flex-shrink-0 hidden xs:block" />

            <MetricItem
              label={atRiskCount > 0 ? 'Risk' : 'Health'}
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
              'flex-shrink-0 inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium',
              'text-[#1a1a1a] dark:text-[#f5f5f8]',
              'rounded-full',
              'bg-white/70 dark:bg-white/10',
              'border border-white/50 dark:border-white/10',
              'shadow-sm hover:shadow-md',
              'hover:bg-white dark:hover:bg-white/15',
              'transition-all duration-200'
            )}
          >
            <span className="hidden sm:inline">Dashboard</span>
            <span className="sm:hidden">Coach</span>
            <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
