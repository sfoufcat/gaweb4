'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Heart,
  Users,
  Calendar,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoFeedAnalytics } from '@/lib/demo-data';
import { ExpandableSearch } from '@/components/ui/expandable-search';
import { AnalyticsDateDropdown } from './AnalyticsDateDropdown';
import { AnalyticsSortDropdown, type SortDirection } from './AnalyticsSortDropdown';

interface PosterStats {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  postCount: number;
  lastPostAt: string | null;
  totalEngagement: number;
}

interface DailyStats {
  date: string;
  postCount: number;
  engagementCount: number;
}

interface FeedSummary {
  totalPosts: number;
  totalEngagement: number;
  totalLikes: number;
  totalComments: number;
  activePosters: number;
  avgEngagementPerPost: number;
}

interface FeedAnalyticsTabProps {
  apiBasePath?: string;
}

type SortField = 'postCount' | 'lastPostAt' | 'totalEngagement';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'postCount', label: 'Posts' },
  { value: 'lastPostAt', label: 'Date' },
  { value: 'totalEngagement', label: 'Engagement' },
];

export function FeedAnalyticsTab({ apiBasePath = '/api/coach/analytics' }: FeedAnalyticsTabProps) {
  const { isDemoMode } = useDemoMode();

  const [posters, setPosters] = useState<PosterStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [summary, setSummary] = useState<FeedSummary>({
    totalPosts: 0,
    totalEngagement: 0,
    totalLikes: 0,
    totalComments: 0,
    activePosters: 0,
    avgEngagementPerPost: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'posters' | 'daily' | null>('posters');
  const [sortField, setSortField] = useState<SortField>('postCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [days, setDays] = useState(30);
  const [searchQuery, setSearchQuery] = useState('');

  // Demo data (memoized)
  const demoData = useMemo(() => generateDemoFeedAnalytics(), []);

  const fetchFeedStats = useCallback(async () => {
    // Skip API call in demo mode
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setWarning(null);

      const response = await fetch(`${apiBasePath}/feed?days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to fetch feed analytics');
      }

      const data = await response.json();
      setPosters(data.posters || []);
      setDailyStats(data.dailyStats || []);
      setSummary(data.summary || {
        totalPosts: 0,
        totalEngagement: 0,
        totalLikes: 0,
        totalComments: 0,
        activePosters: 0,
        avgEngagementPerPost: 0,
      });
      if (data.warning) {
        setWarning(data.warning);
      }
    } catch (err) {
      console.error('Error fetching feed analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, days, isDemoMode]);

  // Use demo data when in demo mode
  const displayPosters: PosterStats[] = useMemo(() => {
    if (isDemoMode) {
      return demoData.posters;
    }
    return posters;
  }, [isDemoMode, demoData.posters, posters]);

  const displayDailyStats: DailyStats[] = useMemo(() => {
    if (isDemoMode) {
      return demoData.dailyStats;
    }
    return dailyStats;
  }, [isDemoMode, demoData.dailyStats, dailyStats]);

  const displaySummary: FeedSummary = useMemo(() => {
    if (isDemoMode) {
      return demoData.summary;
    }
    return summary;
  }, [isDemoMode, demoData.summary, summary]);

  useEffect(() => {
    fetchFeedStats();
  }, [fetchFeedStats]);

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  // Filter posters by search query
  const filteredPosters = useMemo(() => {
    if (!searchQuery) return displayPosters;
    const query = searchQuery.toLowerCase();
    return displayPosters.filter(poster =>
      poster.name.toLowerCase().includes(query) ||
      poster.email.toLowerCase().includes(query)
    );
  }, [displayPosters, searchQuery]);

  const sortedPosters = [...filteredPosters].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'postCount':
        comparison = a.postCount - b.postCount;
        break;
      case 'lastPostAt':
        const aDate = a.lastPostAt || '';
        const bDate = b.lastPostAt || '';
        comparison = aDate.localeCompare(bDate);
        break;
      case 'totalEngagement':
        comparison = a.totalEngagement - b.totalEngagement;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
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
      {/* Warning Banner */}
      {warning && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-albert">{warning}</p>
        </div>
      )}

      {/* Header with Controls */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Feed Analytics
        </h3>
        <div className="flex items-center gap-2">
          <ExpandableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search posters..."
          />
          <AnalyticsDateDropdown value={days} onChange={setDays} />
        </div>
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
              Showing sample feed analytics for demonstration purposes
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-brand-accent" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Posts</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalPosts}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">In period</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Engagement</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalEngagement}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
            {displaySummary.totalLikes} likes, {displaySummary.totalComments} comments
          </p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Active Posters</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.activePosters}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Members posting</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Avg Engagement</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.avgEngagementPerPost}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Per post</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {/* Top Posters Section */}
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'posters' ? null : 'posters')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#faf8f6]/50 dark:hover:bg-[#1a1f2a]/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-brand-accent" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Top Posters</h3>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({filteredPosters.length})</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'posters' ? 'rotate-180' : ''}`} />
          </button>

          <div className={`border-t border-[#e1ddd8]/40 dark:border-[#262b35]/40 overflow-hidden transition-all duration-200 ease-out ${
            expandedSection === 'posters' ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'
          }`}>
            {filteredPosters.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                {searchQuery ? 'No posters match your search' : 'No posts in this period'}
              </div>
            ) : (
              <>
                {/* Sort Dropdown */}
                <div className="px-4 py-2 bg-[#faf8f6]/50 dark:bg-[#11141b]/50 border-b border-[#e1ddd8]/40 dark:border-[#262b35]/40 flex justify-end">
                  <AnalyticsSortDropdown
                    options={SORT_OPTIONS}
                    value={sortField}
                    direction={sortDirection}
                    onChange={handleSortChange}
                  />
                </div>

                <div className="divide-y divide-[#e1ddd8]/40 dark:divide-[#262b35]/40">
                  {sortedPosters.map((poster) => (
                    <div
                      key={poster.userId}
                      className="px-4 py-3 hover:bg-[#faf8f6]/50 dark:hover:bg-[#1a1f2a]/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {poster.avatarUrl ? (
                            <img
                              src={poster.avatarUrl}
                              alt={poster.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-accent to-[#8c6245] dark:from-[#b8896a] dark:to-brand-accent flex items-center justify-center text-white font-semibold text-sm">
                              {poster.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{poster.name}</h4>
                            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">{poster.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{poster.postCount} posts</p>
                          <div className="flex items-center gap-2 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3" /> {poster.totalEngagement}
                            </span>
                            <span>• {formatDate(poster.lastPostAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Daily Activity Section */}
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'daily' ? null : 'daily')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#faf8f6]/50 dark:hover:bg-[#1a1f2a]/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Daily Activity</h3>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({displayDailyStats.length} days)</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'daily' ? 'rotate-180' : ''}`} />
          </button>

          <div className={`border-t border-[#e1ddd8]/40 dark:border-[#262b35]/40 overflow-hidden transition-all duration-200 ease-out ${
            expandedSection === 'daily' ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'
          }`}>
            {displayDailyStats.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                No activity data available
              </div>
            ) : (
              <div className="divide-y divide-[#e1ddd8]/40 dark:divide-[#262b35]/40">
                {displayDailyStats.map((day) => (
                  <div
                    key={day.date}
                    className="px-4 py-3 hover:bg-[#faf8f6]/50 dark:hover:bg-[#1a1f2a]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 text-center">
                          <p className="text-lg font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                            {new Date(day.date).getDate()}
                          </p>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                            {new Date(day.date).toLocaleDateString('en-US', { month: 'short' })}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">
                            {day.postCount} {day.postCount === 1 ? 'post' : 'posts'}
                          </p>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                            {day.engagementCount} engagement
                          </p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="w-24 h-2 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-accent rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (day.postCount / Math.max(1, Math.max(...displayDailyStats.map(d => d.postCount)))) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
