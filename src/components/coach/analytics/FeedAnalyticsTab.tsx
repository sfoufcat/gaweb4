'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Heart, 
  MessageCircle, 
  Users, 
  Calendar,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';

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
type SortDirection = 'asc' | 'desc';

export function FeedAnalyticsTab({ apiBasePath = '/api/coach/analytics' }: FeedAnalyticsTabProps) {
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

  const fetchFeedStats = useCallback(async () => {
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
  }, [apiBasePath, days]);

  useEffect(() => {
    fetchFeedStats();
  }, [fetchFeedStats]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedPosters = [...posters].sort((a, b) => {
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

      {/* Period Selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Feed Analytics
        </h3>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#5f5a55]" />
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] text-sm font-albert"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-brand-accent" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Posts</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.totalPosts}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">In period</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Engagement</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.totalEngagement}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
            {summary.totalLikes} likes, {summary.totalComments} comments
          </p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Active Posters</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.activePosters}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Members posting</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Avg Engagement</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.avgEngagementPerPost}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Per post</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {/* Top Posters Section */}
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'posters' ? null : 'posters')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-brand-accent" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Top Posters</h3>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({posters.length})</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'posters' ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`border-t border-[#e1ddd8] dark:border-[#262b35] overflow-hidden transition-all duration-300 ease-out ${
            expandedSection === 'posters' ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'
          }`}>
            {posters.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                No posts in this period
              </div>
            ) : (
              <>
                {/* Sort Controls */}
                <div className="px-4 py-2 bg-[#faf8f6] dark:bg-[#11141b] border-b border-[#e1ddd8] dark:border-[#262b35] flex gap-2">
                  <button
                    onClick={() => handleSort('postCount')}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                      sortField === 'postCount' 
                        ? 'bg-brand-accent text-white' 
                        : 'bg-white dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    Posts
                  </button>
                  <button
                    onClick={() => handleSort('lastPostAt')}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                      sortField === 'lastPostAt' 
                        ? 'bg-brand-accent text-white' 
                        : 'bg-white dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    Date
                  </button>
                  <button
                    onClick={() => handleSort('totalEngagement')}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                      sortField === 'totalEngagement' 
                        ? 'bg-brand-accent text-white' 
                        : 'bg-white dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    Engagement
                  </button>
                </div>

                <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
                  {sortedPosters.map((poster, index) => (
                    <div 
                      key={poster.userId} 
                      className="px-4 py-3 hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
                      style={{ animationDelay: `${index * 50}ms` }}
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
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'daily' ? null : 'daily')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Daily Activity</h3>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({dailyStats.length} days)</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'daily' ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`border-t border-[#e1ddd8] dark:border-[#262b35] overflow-hidden transition-all duration-300 ease-out ${
            expandedSection === 'daily' ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'
          }`}>
            {dailyStats.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                No activity data available
              </div>
            ) : (
              <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
                {dailyStats.map((day, index) => (
                  <div 
                    key={day.date} 
                    className="px-4 py-3 hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
                    style={{ animationDelay: `${index * 30}ms` }}
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
                      {/* Simple bar visualization */}
                      <div className="w-24 h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-accent rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min(100, (day.postCount / Math.max(1, Math.max(...dailyStats.map(d => d.postCount)))) * 100)}%` 
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

