'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Gift, 
  Users, 
  Trophy,
  Clock,
  CheckCircle2,
  Filter,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CoachReferral, CoachReferralStatus } from '@/types';

interface ReferralStats {
  total: number;
  pending: number;
  signedUp: number;
  subscribed: number;
  rewarded: number;
  totalRewardsGiven: number;
}

const STATUS_LABELS: Record<CoachReferralStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  signed_up: { label: 'Signed Up', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  subscribed: { label: 'Subscribed', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  rewarded: { label: 'Rewarded', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
};

/**
 * AdminCoachReferralsTab
 * 
 * Admin dashboard tab for viewing coach-to-coach referrals.
 */
export function AdminCoachReferralsTab() {
  const [referrals, setReferrals] = useState<CoachReferral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CoachReferralStatus | 'all'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const fetchReferrals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      
      const response = await fetch(`/api/admin/coach-referrals?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch referrals');
      }
      
      const data = await response.json();
      setReferrals(data.referrals);
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching referrals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-albert font-bold text-2xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {stats.total}
                </div>
                <div className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Total Referrals
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="font-albert font-bold text-2xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {stats.pending + stats.signedUp}
                </div>
                <div className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Pending
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-albert font-bold text-2xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {stats.subscribed + stats.rewarded}
                </div>
                <div className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Converted
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Gift className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="font-albert font-bold text-2xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {stats.totalRewardsGiven}
                </div>
                <div className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Rewards Given
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            {statusFilter === 'all' ? 'All Statuses' : STATUS_LABELS[statusFilter].label}
            <ChevronDown className="w-4 h-4" />
          </Button>
          
          {showFilterMenu && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] shadow-lg py-1 z-10">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setShowFilterMenu(false);
                }}
                className={`w-full px-4 py-2 text-left font-sans text-sm hover:bg-[#faf8f6] dark:hover:bg-[#262b35] ${
                  statusFilter === 'all' ? 'text-brand-accent font-semibold' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                }`}
              >
                All Statuses
              </button>
              {(Object.keys(STATUS_LABELS) as CoachReferralStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setShowFilterMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-left font-sans text-sm hover:bg-[#faf8f6] dark:hover:bg-[#262b35] ${
                    statusFilter === status ? 'text-brand-accent font-semibold' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}
                >
                  {STATUS_LABELS[status].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400 font-sans">{error}</p>
            <Button onClick={fetchReferrals} variant="outline" size="sm" className="mt-3">
              Try Again
            </Button>
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-12">
            <Gift className="w-12 h-12 text-[#8a8580] mx-auto mb-3" />
            <p className="font-sans text-[#5f5a55] dark:text-[#b2b6c2]">No coach referrals yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Referral Code</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Referrer Org</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Referred Email</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Status</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Rewards</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr key={referral.id} className="border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 last:border-0">
                    <td className="px-4 py-3 font-mono text-sm text-brand-accent font-semibold">
                      {referral.referralCode}
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      {referral.referrerOrgId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {referral.referredEmail || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${STATUS_LABELS[referral.status].color}`}>
                        {referral.status === 'rewarded' && <CheckCircle2 className="w-3 h-3" />}
                        {STATUS_LABELS[referral.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {referral.referrerRewarded && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                            Referrer ✓
                          </span>
                        )}
                        {referral.refereeRewarded && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                            Referee ✓
                          </span>
                        )}
                        {!referral.referrerRewarded && !referral.refereeRewarded && (
                          <span className="text-xs text-[#8a8580]">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

