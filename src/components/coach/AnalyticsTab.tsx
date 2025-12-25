'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { TrendingUp, TrendingDown, Minus, Users, Activity, AlertCircle, Heart, ChevronRight } from 'lucide-react';
import type { SquadAnalyticsSummary, SquadHealthStatus } from '@/types';

interface CommunitySummary {
  thriving: number;
  active: number;
  inactive: number;
  total: number;
}

interface AnalyticsTabProps {
  apiBasePath?: string;
}

export function AnalyticsTab({ apiBasePath = '/api/coach/analytics' }: AnalyticsTabProps) {
  const [communities, setCommunities] = useState<SquadAnalyticsSummary[]>([]);
  const [summary, setSummary] = useState<CommunitySummary>({ thriving: 0, active: 0, inactive: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(null);
  const [squadDetail, setSquadDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCommunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBasePath}/communities`);
      if (!response.ok) {
        throw new Error('Failed to fetch community analytics');
      }

      const data = await response.json();
      setCommunities(data.communities || []);
      setSummary(data.summary || { thriving: 0, active: 0, inactive: 0, total: 0 });
    } catch (err) {
      console.error('Error fetching communities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  const fetchSquadDetail = useCallback(async (squadId: string) => {
    try {
      setDetailLoading(true);
      const response = await fetch(`${apiBasePath}/squads/${squadId}?days=30`);
      if (!response.ok) {
        throw new Error('Failed to fetch squad details');
      }
      const data = await response.json();
      setSquadDetail(data);
    } catch (err) {
      console.error('Error fetching squad detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  useEffect(() => {
    if (selectedSquadId) {
      fetchSquadDetail(selectedSquadId);
    }
  }, [selectedSquadId, fetchSquadDetail]);

  const getHealthColor = (status: SquadHealthStatus) => {
    switch (status) {
      case 'thriving':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'active':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'inactive':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
  };

  const getHealthIcon = (status: SquadHealthStatus) => {
    switch (status) {
      case 'thriving':
        return <Heart className="w-4 h-4" />;
      case 'active':
        return <Activity className="w-4 h-4" />;
      case 'inactive':
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Community Health Dashboard
        </h2>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          Monitor engagement and activity across your standalone communities
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Thriving</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.thriving}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">70%+ active members</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Active</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.active}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">40-70% active members</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Inactive</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.inactive}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Needs attention</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-[#a07855]" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Total</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.total}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Communities</p>
        </div>
      </div>

      {/* Communities List */}
      {communities.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
          <Users className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            No standalone communities yet
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Create a standalone squad to track community health
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Community Details
            </h3>
          </div>
          
          <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
            {communities.map((community) => (
              <div
                key={community.squadId}
                onClick={() => setSelectedSquadId(
                  selectedSquadId === community.squadId ? null : community.squadId
                )}
                className="px-4 py-3 hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {community.squadAvatarUrl ? (
                      <Image
                        src={community.squadAvatarUrl}
                        alt={community.squadName}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a07855] to-[#8c6245] flex items-center justify-center text-white font-semibold">
                        {community.squadName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {community.squadName}
                      </h4>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                        {community.activeMembers}/{community.totalMembers} active members
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Activity rate */}
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                          {community.activityRate}%
                        </span>
                        {getTrendIcon(community.activityTrend)}
                      </div>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">activity</p>
                    </div>

                    {/* Health status badge */}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getHealthColor(community.healthStatus)}`}>
                      {getHealthIcon(community.healthStatus)}
                      {community.healthStatus}
                    </span>

                    <ChevronRight className={`w-5 h-5 text-[#5f5a55] transition-transform ${
                      selectedSquadId === community.squadId ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>

                {/* Expanded detail view */}
                {selectedSquadId === community.squadId && (
                  <div className="mt-4 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-[#a07855] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : squadDetail ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg bg-[#faf8f6] dark:bg-[#11141b]">
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1">Avg Activity (30d)</p>
                          <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                            {squadDetail.summary?.averageActivityRate || 0}%
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-[#faf8f6] dark:bg-[#11141b]">
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1">Trend</p>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(squadDetail.summary?.activityTrend || 'stable')}
                            <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                              {squadDetail.summary?.trendPercent || 0}%
                            </span>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-[#faf8f6] dark:bg-[#11141b]">
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1">Total Members</p>
                          <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                            {squadDetail.squad?.totalMembers || 0}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-[#faf8f6] dark:bg-[#11141b]">
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1">Data Points</p>
                          <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                            {squadDetail.summary?.totalDataPoints || 0}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] text-center py-4">
                        No detailed analytics available yet
                      </p>
                    )}

                    {/* Inactive community action prompt */}
                    {community.healthStatus === 'inactive' && (
                      <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-700 dark:text-red-300 font-albert">
                          <strong>Action needed:</strong> This community has low engagement. Consider reaching out to members, posting engaging content, or evaluating if it should be sunsetted.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

