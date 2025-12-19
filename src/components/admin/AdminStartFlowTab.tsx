'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, RefreshCw, TrendingDown, Users, CheckCircle, BarChart3, List } from 'lucide-react';

interface FunnelStep {
  step: string;
  label: string;
  count: number;
  dropOffCount: number;
  dropOffRate: number;
  cumulativeRate: number;
}

interface SessionData {
  sessionId: string;
  createdAt: string | null;
  updatedAt: string | null;
  currentStep: string;
  currentStepLabel: string;
  stepIndex: number;
  contentCreatorQuizStep: number | null;
  country: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  workdayStyle: string | null;
  businessStage: string | null;
  goalImpact: string[] | null;
  supportNeeds: string[] | null;
  mission: string | null;
  goal: string | null;
  goalTargetDate: string | null;
  accountability: boolean | null;
  readyToInvest: boolean | null;
  selectedPlan: string | null;
  paymentStatus: string | null;
}

interface QuizOption {
  id: string;
  label: string;
  count: number;
}

interface AnalyticsData {
  summary: {
    totalSessions: number;
    completedSessions: number;
    conversionRate: number;
    timeRange: string;
    quizFilter: string;
  };
  funnel: FunnelStep[];
  sessions: SessionData[];
  stepOrder: string[];
  stepLabels: Record<string, string>;
  availableQuizzes: QuizOption[];
}

type ViewMode = 'funnel' | 'sessions';
type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | 'all';

export function AdminStartFlowTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('funnel');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [quizFilter, setQuizFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'step'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        timeRange,
        quiz: quizFilter,
      });
      const response = await fetch(`/api/admin/start-flow-analytics?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [timeRange, quizFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    if (!data?.sessions) return [];

    let sessions = [...data.sessions];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      sessions = sessions.filter(
        (session) =>
          session.email?.toLowerCase().includes(query) ||
          session.firstName?.toLowerCase().includes(query) ||
          session.lastName?.toLowerCase().includes(query) ||
          session.sessionId.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    sessions.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else {
        const stepDiff = a.stepIndex - b.stepIndex;
        return sortOrder === 'desc' ? -stepDiff : stepDiff;
      }
    });

    return sessions;
  }, [data?.sessions, searchQuery, sortBy, sortOrder]);

  const toggleSessionExpanded = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const getDropOffColor = (rate: number) => {
    if (rate <= 10) return 'text-green-600 bg-green-50';
    if (rate <= 30) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getStepBadgeColor = (stepIndex: number, totalSteps: number) => {
    const progress = stepIndex / (totalSteps - 1);
    if (progress >= 0.9) return 'bg-green-100 text-green-700 border-green-200';
    if (progress >= 0.5) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Convert 2-letter country code to flag emoji using regional indicator symbols
  const countryToFlag = (countryCode: string | null) => {
    if (!countryCode || countryCode.length !== 2) return null;
    const code = countryCode.toUpperCase();
    // Regional indicator symbols start at U+1F1E6 (A) and go to U+1F1FF (Z)
    const offset = 0x1F1E6 - 65; // 65 is ASCII code for 'A'
    const firstChar = String.fromCodePoint(code.charCodeAt(0) + offset);
    const secondChar = String.fromCodePoint(code.charCodeAt(1) + offset);
    return firstChar + secondChar;
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button
            onClick={fetchAnalytics}
            className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Total Sessions</p>
              <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {data.summary.totalSessions.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Completed</p>
              <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {data.summary.completedSessions.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Conversion Rate</p>
              <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {data.summary.conversionRate}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'funnel' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('funnel')}
                className={viewMode === 'funnel' ? 'bg-[#a07855] hover:bg-[#8c6245] text-white' : ''}
              >
                <BarChart3 className="w-4 h-4 mr-1.5" />
                Funnel
              </Button>
              <Button
                variant={viewMode === 'sessions' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('sessions')}
                className={viewMode === 'sessions' ? 'bg-[#a07855] hover:bg-[#8c6245] text-white' : ''}
              >
                <List className="w-4 h-4 mr-1.5" />
                Sessions
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {viewMode === 'sessions' && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-56 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              )}

              {/* Quiz Filter */}
              <Select value={quizFilter} onValueChange={setQuizFilter}>
                <SelectTrigger className="w-[160px] font-albert">
                  <SelectValue placeholder="All Quizzes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-albert">All Quizzes</SelectItem>
                  {data?.availableQuizzes?.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id} className="font-albert">
                      {quiz.label} ({quiz.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger className="w-[130px] font-albert">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today" className="font-albert">Today</SelectItem>
                  <SelectItem value="yesterday" className="font-albert">Yesterday</SelectItem>
                  <SelectItem value="7d" className="font-albert">Last 7 days</SelectItem>
                  <SelectItem value="30d" className="font-albert">Last 30 days</SelectItem>
                  <SelectItem value="all" className="font-albert">All time</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalytics}
                disabled={loading}
                className="border-[#e1ddd8] dark:border-[#262b35]"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Funnel View */}
        {viewMode === 'funnel' && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-albert">Step</TableHead>
                  <TableHead className="font-albert text-right">Sessions Reached</TableHead>
                  <TableHead className="font-albert text-right">Drop-off</TableHead>
                  <TableHead className="font-albert text-right">Drop-off Rate</TableHead>
                  <TableHead className="font-albert text-right">Cumulative %</TableHead>
                  <TableHead className="font-albert">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.funnel.map((step, index) => (
                  <TableRow key={step.step}>
                    <TableCell className="font-albert font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#5f5a55] dark:text-[#7d8190] w-5">{index + 1}.</span>
                        {step.label}
                      </div>
                    </TableCell>
                    <TableCell className="font-albert text-right font-semibold">
                      {step.count.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-albert text-right text-[#5f5a55] dark:text-[#b2b6c2]">
                      {index > 0 ? `-${step.dropOffCount.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {index > 0 ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-albert ${getDropOffColor(step.dropOffRate)}`}>
                          {step.dropOffRate}%
                        </span>
                      ) : (
                        <span className="text-[#5f5a55] dark:text-[#7d8190]">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-albert text-right">
                      {step.cumulativeRate}%
                    </TableCell>
                    <TableCell>
                      <div className="w-24 h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#a07855] to-[#c9a07a] rounded-full transition-all"
                          style={{ width: `${step.cumulativeRate}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Sessions View */}
        {viewMode === 'sessions' && (
          <>
            {/* Sort Controls */}
            <div className="px-4 py-2 border-b border-[#e1ddd8] dark:border-[#262b35]/50 bg-[#faf8f6]/50 dark:bg-[#0d0f13]/50">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Sort by:</span>
                <button
                  onClick={() => {
                    if (sortBy === 'date') {
                      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setSortBy('date');
                      setSortOrder('desc');
                    }
                  }}
                  className={`font-albert ${sortBy === 'date' ? 'text-[#a07855] font-medium' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}
                >
                  Date {sortBy === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'step') {
                      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setSortBy('step');
                      setSortOrder('desc');
                    }
                  }}
                  className={`font-albert ${sortBy === 'step' ? 'text-[#a07855] font-medium' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}
                >
                  Progress {sortBy === 'step' && (sortOrder === 'desc' ? '↓' : '↑')}
                </button>
                <span className="ml-auto text-[#5f5a55] dark:text-[#7d8190] font-albert">
                  {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-albert w-8"></TableHead>
                    <TableHead className="font-albert">Started</TableHead>
                    <TableHead className="font-albert w-12 text-center"></TableHead>
                    <TableHead className="font-albert">Last Step</TableHead>
                    <TableHead className="font-albert">Email</TableHead>
                    <TableHead className="font-albert">Name</TableHead>
                    <TableHead className="font-albert">Goal</TableHead>
                    <TableHead className="font-albert">Business Stage</TableHead>
                    <TableHead className="font-albert">Workday</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session) => {
                    const isExpanded = expandedSessions.has(session.sessionId);
                    const totalSteps = data.stepOrder.length;

                    return (
                      <>
                        <TableRow
                          key={session.sessionId}
                          className="cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-[#1a1e26]"
                          onClick={() => toggleSessionExpanded(session.sessionId)}
                        >
                          <TableCell>
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#5f5a55]" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#5f5a55]" />
                            )}
                          </TableCell>
                          <TableCell className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                            {formatDate(session.createdAt)}
                          </TableCell>
                          <TableCell className="text-center text-lg" title={session.country || 'Unknown'}>
                            {countryToFlag(session.country) || <span className="text-[#8c8c8c] text-sm">-</span>}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-albert border ${getStepBadgeColor(session.stepIndex, totalSteps)}`}>
                              {session.currentStepLabel}
                            </span>
                          </TableCell>
                          <TableCell className="font-albert text-sm">
                            {session.email || <span className="text-[#8c8c8c]">-</span>}
                          </TableCell>
                          <TableCell className="font-albert text-sm">
                            {session.firstName || session.lastName
                              ? `${session.firstName || ''} ${session.lastName || ''}`.trim()
                              : <span className="text-[#8c8c8c]">-</span>}
                          </TableCell>
                          <TableCell className="font-albert text-sm max-w-[200px] truncate">
                            {session.goal || <span className="text-[#8c8c8c]">-</span>}
                          </TableCell>
                          <TableCell className="font-albert text-sm">
                            {session.businessStage || <span className="text-[#8c8c8c]">-</span>}
                          </TableCell>
                          <TableCell className="font-albert text-sm">
                            {session.workdayStyle || <span className="text-[#8c8c8c]">-</span>}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <TableRow key={`${session.sessionId}-details`} className="bg-[#faf8f6]/50 dark:bg-[#0d0f13]/50">
                            <TableCell colSpan={9} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Session ID</p>
                                  <p className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8] font-mono text-xs break-all">{session.sessionId}</p>
                                </div>
                                <div>
                                  <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Country</p>
                                  <p className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                                    {session.country ? `${countryToFlag(session.country)} ${session.country}` : '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Last Updated</p>
                                  <p className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">{formatDate(session.updatedAt)}</p>
                                </div>
                                <div>
                                  <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Selected Plan</p>
                                  <p className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">{session.selectedPlan || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Payment Status</p>
                                  <p className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">{session.paymentStatus || '-'}</p>
                                </div>
                                {session.currentStep === 'content-creator' && session.contentCreatorQuizStep !== null && (
                                  <div>
                                    <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Quiz Progress</p>
                                    <p className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                                      Step {session.contentCreatorQuizStep + 1} of 29
                                    </p>
                                  </div>
                                )}
                                <div className="col-span-2">
                                  <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Mission</p>
                                  <p className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">{session.mission || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Goal Target Date</p>
                                  <p className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">{session.goalTargetDate || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Commitment</p>
                                  <p className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                                    {session.accountability !== null ? (session.accountability ? 'Accountable' : 'Not accountable') : '-'}
                                    {session.readyToInvest !== null && ` / ${session.readyToInvest ? 'Ready to invest' : 'Not ready'}`}
                                  </p>
                                </div>
                                {session.goalImpact && session.goalImpact.length > 0 && (
                                  <div className="col-span-2">
                                    <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Goal Impact</p>
                                    <div className="flex flex-wrap gap-1">
                                      {session.goalImpact.map((impact, i) => (
                                        <span key={i} className="inline-flex px-2 py-0.5 bg-[#e1ddd8] dark:bg-[#262b35] rounded text-xs font-albert">
                                          {impact}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {session.supportNeeds && session.supportNeeds.length > 0 && (
                                  <div className="col-span-2">
                                    <p className="text-[#5f5a55] dark:text-[#7d8190] font-albert text-xs uppercase tracking-wide mb-1">Support Needs</p>
                                    <div className="flex flex-wrap gap-1">
                                      {session.supportNeeds.map((need, i) => (
                                        <span key={i} className="inline-flex px-2 py-0.5 bg-[#e1ddd8] dark:bg-[#262b35] rounded text-xs font-albert">
                                          {need}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredSessions.length === 0 && (
              <div className="p-12 text-center">
                {searchQuery ? (
                  <>
                    <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-lg mb-2">No sessions found</p>
                    <p className="text-[#5f5a55]/70 dark:text-[#b2b6c2]/70 font-albert text-sm">
                      No sessions match &quot;{searchQuery}&quot;
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setSearchQuery('')}
                      className="mt-4 border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Clear search
                    </Button>
                  </>
                ) : (
                  <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No sessions found in this time period</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

