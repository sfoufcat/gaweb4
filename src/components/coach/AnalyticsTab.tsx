'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Activity,
  AlertCircle,
  Heart,
  ChevronDown,
  Eye,
} from 'lucide-react';
import type { SquadAnalyticsSummary, SquadHealthStatus } from '@/types';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoCommunityHealth } from '@/lib/demo-data';
import { ExpandableSearch } from '@/components/ui/expandable-search';
import { SortableTableHeader, SortDirection } from '@/components/coach/analytics/SortableTableHeader';

interface CommunitySummary {
  thriving: number;
  active: number;
  inactive: number;
  total: number;
}

interface AnalyticsTabProps {
  apiBasePath?: string;
  /** Optional squad ID to restore selection from URL */
  initialSquadId?: string | null;
  /** Callback when squad selection changes (for URL persistence) */
  onSquadSelect?: (squadId: string | null) => void;
}

type SortField = 'squadName' | 'totalMembers' | 'activeMembers' | 'activityRate' | 'healthStatus';

export function AnalyticsTab({ apiBasePath = '/api/coach/analytics', initialSquadId, onSquadSelect }: AnalyticsTabProps) {
  const { isDemoMode } = useDemoMode();

  const [communities, setCommunities] = useState<SquadAnalyticsSummary[]>([]);
  const [summary, setSummary] = useState<CommunitySummary>({ thriving: 0, active: 0, inactive: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(initialSquadId ?? null);
  const [squadDetail, setSquadDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [excludeAdmins, setExcludeAdmins] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('activityRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Demo data (memoized)
  const demoData = useMemo(() => generateDemoCommunityHealth(), []);

  const fetchCommunities = useCallback(async () => {
    // Skip API call in demo mode
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (excludeAdmins) {
        params.set('excludeAdmins', 'true');
      }

      const response = await fetch(`${apiBasePath}/communities?${params.toString()}`);
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
  }, [apiBasePath, excludeAdmins, isDemoMode]);

  // Use demo data when in demo mode
  const displayCommunities: SquadAnalyticsSummary[] = useMemo(() => {
    if (isDemoMode) {
      return demoData.communities.map(dc => ({
        squadId: dc.squadId,
        squadName: dc.name,
        totalMembers: dc.memberCount,
        activeMembers: Math.round(dc.memberCount * (dc.activeRate / 100)),
        activityRate: dc.activeRate,
        healthStatus: dc.healthStatus as SquadHealthStatus,
        activityTrend: dc.trend as 'up' | 'down' | 'stable',
        trendPercent: dc.trend === 'up' ? 5 : dc.trend === 'down' ? -5 : 0,
        lastActivityDate: dc.lastActivityAt ?? undefined,
      }));
    }
    return communities;
  }, [isDemoMode, demoData.communities, communities]);

  const displaySummary: CommunitySummary = useMemo(() => {
    if (isDemoMode) {
      return demoData.summary;
    }
    return summary;
  }, [isDemoMode, demoData.summary, summary]);

  // Filter and sort communities
  const filteredCommunities = useMemo(() => {
    let filtered = displayCommunities;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.squadName.toLowerCase().includes(query)
      );
    }

    return [...filtered].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'squadName') {
        return a.squadName.localeCompare(b.squadName) * multiplier;
      }
      if (sortField === 'healthStatus') {
        const order = { thriving: 3, active: 2, inactive: 1 };
        return (order[a.healthStatus] - order[b.healthStatus]) * multiplier;
      }
      return ((a[sortField] as number) - (b[sortField] as number)) * multiplier;
    });
  }, [displayCommunities, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

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

  // Notify parent when squad selection changes (for URL persistence)
  useEffect(() => {
    onSquadSelect?.(selectedSquadId);
  }, [selectedSquadId, onSquadSelect]);

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
        return <Heart className="w-3.5 h-3.5" />;
      case 'active':
        return <Activity className="w-3.5 h-3.5" />;
      case 'inactive':
        return <AlertCircle className="w-3.5 h-3.5" />;
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Search and Toggle */}
      <div className="flex items-center justify-end gap-4 mb-6">
        <button
          onClick={() => setExcludeAdmins(!excludeAdmins)}
          className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent dark:hover:text-brand-accent transition-colors duration-200 underline-offset-2 hover:underline"
        >
          {excludeAdmins ? 'Include coaches' : 'Exclude coaches'}
        </button>
        <ExpandableSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search communities..."
        />
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="mb-4 px-4 py-3 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-3">
          <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-albert">
              Demo Mode Active
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-albert">
              Showing sample community health data for demonstration purposes
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Thriving</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.thriving}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">70%+ active</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Active</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.active}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">40-70% active</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Inactive</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.inactive}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Needs attention</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-brand-accent" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Total</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.total}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Communities</p>
        </div>
      </div>

      {/* Communities Table */}
      {filteredCommunities.length === 0 && !isDemoMode ? (
        <div className="text-center py-12 bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl">
          <Users className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            {searchQuery ? 'No communities match your search' : 'No standalone communities yet'}
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {searchQuery ? 'Try a different search term' : 'Create a standalone squad to track community health'}
          </p>
        </div>
      ) : (
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e1ddd8]/60 dark:border-[#262b35]/60">
                  <SortableTableHeader
                    label="Community"
                    field="squadName"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTableHeader
                    label="Members"
                    field="totalMembers"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableTableHeader
                    label="Active"
                    field="activeMembers"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableTableHeader
                    label="Activity %"
                    field="activityRate"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableTableHeader
                    label="Status"
                    field="healthStatus"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="center"
                  />
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e1ddd8]/60 dark:divide-[#262b35]/60">
                {filteredCommunities.map((community) => (
                  <>
                    <tr
                      key={community.squadId}
                      className="hover:bg-[#faf8f6]/50 dark:hover:bg-[#1a1f2a]/50 transition-colors duration-200 cursor-pointer"
                      onClick={() => setSelectedSquadId(
                        selectedSquadId === community.squadId ? null : community.squadId
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {community.squadAvatarUrl ? (
                            <Image
                              src={community.squadAvatarUrl}
                              alt={community.squadName}
                              width={36}
                              height={36}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-accent to-[#8c6245] dark:from-[#b8896a] dark:to-brand-accent flex items-center justify-center text-white font-semibold text-sm">
                              {community.squadName.charAt(0)}
                            </div>
                          )}
                          <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">
                            {community.squadName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">{community.totalMembers}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">{community.activeMembers}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                            {community.activityRate}%
                          </span>
                          {getTrendIcon(community.activityTrend)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getHealthColor(community.healthStatus)}`}>
                            {getHealthIcon(community.healthStatus)}
                            <span className="capitalize">{community.healthStatus}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronDown className={`w-4 h-4 text-[#5f5a55] transition-transform duration-200 ${
                          selectedSquadId === community.squadId ? 'rotate-180' : ''
                        }`} />
                      </td>
                    </tr>

                    {/* Expanded Row Details */}
                    {selectedSquadId === community.squadId && (
                      <tr key={`${community.squadId}-details`}>
                        <td colSpan={6} className="p-0">
                          <div className="bg-[#faf8f6]/50 dark:bg-[#11141b]/50 px-6 py-4 border-t border-[#e1ddd8]/60 dark:border-[#262b35]/60">
                            {detailLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : squadDetail ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 rounded-lg bg-white/60 dark:bg-[#171b22]/60">
                                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1">Avg Activity (30d)</p>
                                  <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                                    {squadDetail.summary?.averageActivityRate || 0}%
                                  </p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/60 dark:bg-[#171b22]/60">
                                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1">Trend</p>
                                  <div className="flex items-center gap-2">
                                    {getTrendIcon(squadDetail.summary?.activityTrend || 'stable')}
                                    <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                                      {squadDetail.summary?.trendPercent || 0}%
                                    </span>
                                  </div>
                                </div>
                                <div className="p-3 rounded-lg bg-white/60 dark:bg-[#171b22]/60">
                                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1">Total Members</p>
                                  <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                                    {squadDetail.squad?.totalMembers || 0}
                                  </p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/60 dark:bg-[#171b22]/60">
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
                                  <strong>Action needed:</strong> This community has low engagement. Consider reaching out to members or posting engaging content.
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
