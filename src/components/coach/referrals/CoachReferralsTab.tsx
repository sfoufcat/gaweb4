'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { 
  Users, 
  Gift, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Filter,
  ChevronDown,
  Loader2,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReferralWithDetails, ReferralStatus } from '@/types';

interface ReferralStats {
  total: number;
  pending: number;
  completed: number;
  rewarded: number;
  conversionRate: number;
}

/**
 * CoachReferralsTab Component
 * 
 * Dashboard tab for coaches to view and manage referrals:
 * - Summary stats (total referrals, conversion rate, rewards granted)
 * - List of all referrals across programs/squads
 * - Filter by program/squad/status
 */
export function CoachReferralsTab() {
  const [referrals, setReferrals] = useState<ReferralWithDetails[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  const fetchReferrals = useCallback(async (resetOffset = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const currentOffset = resetOffset ? 0 : offset;
      
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString(),
      });
      
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      
      const response = await fetch(`/api/coach/referrals?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch referrals');
      }
      
      const data = await response.json();
      
      if (resetOffset) {
        setReferrals(data.referrals || []);
        setOffset(0);
      } else {
        setReferrals(prev => resetOffset ? data.referrals : [...prev, ...data.referrals]);
      }
      
      setStats(data.stats || null);
      setHasMore(data.pagination?.hasMore || false);
    } catch (err) {
      console.error('Error fetching referrals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset, limit]);

  useEffect(() => {
    fetchReferrals(true);
  }, [statusFilter]);

  const loadMore = () => {
    setOffset(prev => prev + limit);
    fetchReferrals(false);
  };

  // Filter referrals by search query
  const filteredReferrals = referrals.filter(r => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.referrerName?.toLowerCase().includes(query) ||
      r.referrerEmail?.toLowerCase().includes(query) ||
      r.referredUserName?.toLowerCase().includes(query) ||
      r.referredUserEmail?.toLowerCase().includes(query) ||
      r.programName?.toLowerCase().includes(query) ||
      r.squadName?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: ReferralStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'rewarded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <Gift className="w-3 h-3" />
            Rewarded
          </span>
        );
    }
  };

  const getRewardDescription = (r: ReferralWithDetails) => {
    if (!r.rewardType) return null;
    
    switch (r.rewardType) {
      case 'free_time':
        const days = (r.rewardDetails as { freeDays?: number })?.freeDays;
        return `${days || 0} free days`;
      case 'free_program':
        const programName = (r.rewardDetails as { programName?: string })?.programName;
        return `Free access: ${programName || 'program'}`;
      case 'discount_code':
        const code = (r.rewardDetails as { code?: string })?.code;
        const displayValue = (r.rewardDetails as { displayValue?: string })?.displayValue;
        return `${displayValue || ''} discount (${code || ''})`;
      default:
        return r.rewardType;
    }
  };

  if (loading && referrals.length === 0) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
          ))}
        </div>
        <div className="h-12 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Referrals
          </h2>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Track referrals and rewards across your programs
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {stats.total}
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Total Referrals
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {stats.pending}
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Pending
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {stats.rewarded}
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Rewards Granted
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {stats.conversionRate}%
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Conversion Rate
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search referrals..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
          />
        </div>
        
        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReferralStatus | 'all')}
            className="appearance-none px-4 py-2 pr-10 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="rewarded">Rewarded</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] pointer-events-none" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchReferrals(true)}
            className="mt-2 text-red-600"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Referrals List */}
      {filteredReferrals.length === 0 && !loading ? (
        <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
          <Users className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            No referrals yet
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {statusFilter !== 'all' 
              ? `No ${statusFilter} referrals found`
              : 'Enable referrals on a program to start tracking'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
            {filteredReferrals.map((referral) => (
              <div
                key={referral.id}
                className="p-4 hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Referrer & Referred User */}
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Referrer */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                        {referral.referrerImageUrl ? (
                          <Image
                            src={referral.referrerImageUrl}
                            alt={referral.referrerName || ''}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-albert font-semibold text-xs text-text-secondary">
                              {referral.referrerName?.[0] || '?'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                          {referral.referrerName || 'Unknown'}
                        </p>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Referrer</p>
                      </div>
                    </div>
                    
                    {/* Arrow */}
                    <span className="text-[#5f5a55] dark:text-[#7d8190] flex-shrink-0">→</span>
                    
                    {/* Referred User */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                        {referral.referredUserImageUrl ? (
                          <Image
                            src={referral.referredUserImageUrl}
                            alt={referral.referredUserName || ''}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-albert font-semibold text-xs text-text-secondary">
                              {referral.referredUserName?.[0] || '?'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                          {referral.referredUserName || 'Pending signup...'}
                        </p>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Referred</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status & Meta */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {getStatusBadge(referral.status)}
                    {referral.programName && (
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                        {referral.programName}
                      </p>
                    )}
                    {referral.squadName && (
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                        {referral.squadName}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Reward Info */}
                {referral.status === 'rewarded' && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <Gift className="w-3.5 h-3.5" />
                    <span>{getRewardDescription(referral)}</span>
                  </div>
                )}
                
                {/* Timestamp */}
                <p className="mt-2 text-xs text-[#a7a39e] dark:text-[#7d8190]">
                  {new Date(referral.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
          
          {/* Load More */}
          {hasMore && (
            <div className="p-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}







