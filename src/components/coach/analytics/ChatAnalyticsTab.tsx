'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageCircle,
  Users,
  Calendar,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ArrowUpDown,
  Hash,
  Eye,
  Megaphone,
  MessageSquare,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoChatAnalytics } from '@/lib/demo-data';

interface ChannelStats {
  channelId: string;
  channelType: string;
  name: string;
  squadId?: string;
  squadName?: string;
  memberCount: number;
  messageCount: number;
  messagesLast7Days: number;
  lastMessageAt: string | null;
  createdAt: string | null;
  image?: string;
  icon?: string; // Icon identifier for org channels (e.g., 'megaphone', 'chat', 'sparkles')
}

// Map icon string identifiers to Lucide icons
const CHANNEL_ICON_MAP: Record<string, LucideIcon> = {
  megaphone: Megaphone,
  chat: MessageSquare,
  sparkles: Sparkles,
  hash: Hash,
};

type ActivityLevel = 'thriving' | 'active' | 'inactive';

function getActivityLevel(messagesLast7Days: number): ActivityLevel {
  if (messagesLast7Days >= 10) return 'thriving';
  if (messagesLast7Days > 0) return 'active';
  return 'inactive';
}

function ActivityBadge({ level }: { level: ActivityLevel }) {
  const config = {
    thriving: {
      label: 'Thriving',
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-400',
      dot: 'bg-green-500',
    },
    active: {
      label: 'Active',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      dot: 'bg-blue-500',
    },
    inactive: {
      label: 'Inactive',
      bg: 'bg-gray-100 dark:bg-gray-800/50',
      text: 'text-gray-500 dark:text-gray-400',
      dot: 'bg-gray-400',
    },
  };

  const { label, bg, text, dot } = config[level];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

interface DailyChatStats {
  date: string;
  messageCount: number;
  activeChannels: number;
}

interface ChatSummary {
  totalChannels: number;
  activeChannels: number;
  squadChannels: number;
  totalMessages: number;
  avgMessagesPerChannel: number;
}

interface ChatAnalyticsTabProps {
  apiBasePath?: string;
}

type SortField = 'messageCount' | 'lastMessageAt' | 'memberCount';
type SortDirection = 'asc' | 'desc';

export function ChatAnalyticsTab({ apiBasePath = '/api/coach/analytics' }: ChatAnalyticsTabProps) {
  const { isDemoMode } = useDemoMode();
  
  const [channels, setChannels] = useState<ChannelStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyChatStats[]>([]);
  const [summary, setSummary] = useState<ChatSummary>({
    totalChannels: 0,
    activeChannels: 0,
    squadChannels: 0,
    totalMessages: 0,
    avgMessagesPerChannel: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'channels' | 'daily' | null>('channels');
  const [sortField, setSortField] = useState<SortField>('messageCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [days, setDays] = useState(30);
  
  // Demo data (memoized)
  const demoData = useMemo(() => generateDemoChatAnalytics(), []);

  const fetchChatStats = useCallback(async () => {
    // Skip API call in demo mode
    if (isDemoMode) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setWarning(null);

      const response = await fetch(`${apiBasePath}/chats?days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chat analytics');
      }

      const data = await response.json();
      setChannels(data.channels || []);
      setDailyStats(data.dailyStats || []);
      setSummary(data.summary || {
        totalChannels: 0,
        activeChannels: 0,
        squadChannels: 0,
        totalMessages: 0,
        avgMessagesPerChannel: 0,
      });
      if (data.warning) {
        setWarning(data.warning);
      }
    } catch (err) {
      console.error('Error fetching chat analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, days, isDemoMode]);

  useEffect(() => {
    fetchChatStats();
  }, [fetchChatStats]);
  
  // Use demo data when in demo mode
  const displayChannels: ChannelStats[] = useMemo(() => {
    if (isDemoMode) {
      return demoData.channels;
    }
    return channels;
  }, [isDemoMode, demoData.channels, channels]);
  
  const displayDailyStats: DailyChatStats[] = useMemo(() => {
    if (isDemoMode) {
      return demoData.dailyStats;
    }
    return dailyStats;
  }, [isDemoMode, demoData.dailyStats, dailyStats]);
  
  const displaySummary: ChatSummary = useMemo(() => {
    if (isDemoMode) {
      return demoData.summary;
    }
    return summary;
  }, [isDemoMode, demoData.summary, summary]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedChannels = [...displayChannels].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'messageCount':
        comparison = a.messageCount - b.messageCount;
        break;
      case 'lastMessageAt':
        const aDate = a.lastMessageAt || '';
        const bDate = b.lastMessageAt || '';
        comparison = aDate.localeCompare(bDate);
        break;
      case 'memberCount':
        comparison = a.memberCount - b.memberCount;
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
          Chat Analytics
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

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="mb-4 px-4 py-3 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-3">
          <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-albert">
              Demo Mode Active
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-albert">
              Showing sample chat analytics for demonstration purposes
            </p>
          </div>
        </div>
      )}
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 ">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-5 h-5 text-brand-accent" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Channels</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalChannels}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">{displaySummary.squadChannels} squad chats</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 ">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Active</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.activeChannels}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">With messages</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 ">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Messages</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalMessages}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Total in channels</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 ">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Avg Messages</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.avgMessagesPerChannel}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Per channel</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {/* Channels Section */}
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'channels' ? null : 'channels')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Hash className="w-5 h-5 text-brand-accent" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Chat Channels</h3>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({displayChannels.length})</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'channels' ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`border-t border-[#e1ddd8] dark:border-[#262b35] overflow-hidden transition-all duration-300 ease-out ${
            expandedSection === 'channels' ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'
          }`}>
            {displayChannels.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                No chat channels found
              </div>
            ) : (
              <>
                {/* Sort Controls */}
                <div className="px-4 py-2 bg-[#faf8f6] dark:bg-[#11141b] border-b border-[#e1ddd8] dark:border-[#262b35] flex gap-2">
                  <button
                    onClick={() => handleSort('messageCount')}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                      sortField === 'messageCount' 
                        ? 'bg-brand-accent text-white' 
                        : 'bg-white dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    Messages
                  </button>
                  <button
                    onClick={() => handleSort('lastMessageAt')}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                      sortField === 'lastMessageAt' 
                        ? 'bg-brand-accent text-white' 
                        : 'bg-white dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    Last Active
                  </button>
                  <button
                    onClick={() => handleSort('memberCount')}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                      sortField === 'memberCount' 
                        ? 'bg-brand-accent text-white' 
                        : 'bg-white dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    Members
                  </button>
                </div>

                <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
                  {sortedChannels.map((channel, index) => (
                    <div
                      key={channel.channelId}
                      className="px-4 py-3 hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {channel.image ? (
                            <img
                              src={channel.image}
                              alt={channel.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (() => {
                            // Get the appropriate icon component
                            const IconComponent = channel.icon
                              ? CHANNEL_ICON_MAP[channel.icon] || Hash
                              : Hash;
                            return (
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-accent to-[#8c6245] dark:from-[#b8896a] dark:to-brand-accent flex items-center justify-center text-white">
                                <IconComponent className="w-5 h-5" />
                              </div>
                            );
                          })()}
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{channel.name}</h4>
                              <ActivityBadge level={getActivityLevel(channel.messagesLast7Days)} />
                            </div>
                            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                              {channel.squadName ? `Squad: ${channel.squadName}` : 'Organization channel'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">
                            {channel.messageCount} messages
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {channel.memberCount}
                            </span>
                            <span>• {formatDate(channel.lastMessageAt)}</span>
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
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({displayDailyStats.length} days)</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'daily' ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`border-t border-[#e1ddd8] dark:border-[#262b35] overflow-hidden transition-all duration-300 ease-out ${
            expandedSection === 'daily' ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'
          }`}>
            {displayDailyStats.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                No activity data available
              </div>
            ) : (
              <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
                {displayDailyStats.map((day, index) => (
                  <div 
                    key={day.date} 
                    className="px-4 py-3 hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
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
                            {day.activeChannels} active {day.activeChannels === 1 ? 'channel' : 'channels'}
                          </p>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                            {day.messageCount > 0 ? `${day.messageCount} messages` : 'No message data'}
                          </p>
                        </div>
                      </div>
                      {/* Simple bar visualization */}
                      <div className="w-24 h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min(100, (day.activeChannels / Math.max(1, Math.max(...displayDailyStats.map(d => d.activeChannels)))) * 100)}%` 
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

