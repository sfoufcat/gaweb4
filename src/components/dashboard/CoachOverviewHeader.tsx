'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { DollarSign, Trophy, Users, AlertTriangle, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  gradient: string;
  href?: string;
  isHighlight?: boolean;
}

function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  gradient,
  href,
  isHighlight,
}: MetricCardProps) {
  const content = (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 transition-all duration-300',
        'hover:scale-[1.03] hover:shadow-xl',
        href && 'cursor-pointer',
        gradient
      )}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20" />
        <div className="absolute -left-2 -bottom-2 w-16 h-16 rounded-full bg-white/10" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
            <Icon className="w-4 h-4 text-white" />
          </div>
          {isHighlight && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 text-white" />
              <span className="text-[10px] font-medium text-white uppercase tracking-wide">Top</span>
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <p className="text-2xl font-bold text-white font-albert tracking-tight drop-shadow-sm">
            {value}
          </p>
          <p className="text-sm text-white/80 font-albert font-medium">
            {label}
          </p>
          {subValue && (
            <p className="text-xs text-white/60 font-albert">
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
    <div className="mb-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-40 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 rounded-2xl animate-pulse"
            style={{
              background: `linear-gradient(135deg, rgba(160, 120, 85, ${0.1 + i * 0.05}) 0%, rgba(140, 100, 70, ${0.1 + i * 0.05}) 100%)`
            }}
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
  // Fetch product analytics (revenue + top program)
  const { data: productData, isLoading: productsLoading } = useSWR(
    '/api/coach/analytics/products',
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5 * 60 * 1000,
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

  // Format currency
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
    <div className={cn('mb-8', className)}>
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
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#a07855] to-[#8a6847] hover:from-[#8a6847] hover:to-[#7a5837] transition-all duration-200 rounded-full shadow-md hover:shadow-lg hover:scale-[1.02]"
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
          subValue="All time earnings"
          icon={DollarSign}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20"
          href="/coach?tab=analytics"
        />

        <MetricCard
          label="Top Program"
          value={topProgram?.name ? (topProgram.name.length > 10 ? topProgram.name.slice(0, 10) + '…' : topProgram.name) : '—'}
          subValue={topProgram ? `${topProgram.enrolledCount} enrolled` : 'Create your first'}
          icon={Trophy}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20"
          href="/coach?tab=programs"
          isHighlight={!!topProgram}
        />

        <MetricCard
          label="Active Clients"
          value={activeClients}
          subValue={`${Math.round(activeRate)}% engagement`}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20"
          href="/coach?tab=clients"
        />

        <MetricCard
          label={atRiskCount > 0 ? 'At-Risk' : 'Client Health'}
          value={atRiskCount > 0 ? atRiskCount : '✓'}
          subValue={atRiskCount > 0 ? 'Need your attention' : 'All clients thriving'}
          icon={atRiskCount > 0 ? AlertTriangle : Users}
          gradient={atRiskCount > 0
            ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20'
            : 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20'
          }
          href="/coach?tab=clients"
        />
      </div>
    </div>
  );
}
