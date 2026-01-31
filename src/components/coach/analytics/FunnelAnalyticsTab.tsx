'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Funnel as FunnelIcon,
  Eye,
  MousePointer,
  DollarSign,
  TrendingDown,
  AlertCircle,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoFunnelAnalytics } from '@/lib/demo-data';
import { ExpandableSearch } from '@/components/ui/expandable-search';
import { AnalyticsDateDropdown } from './AnalyticsDateDropdown';
import { SortableTableHeader, SortDirection } from './SortableTableHeader';

interface FunnelStepData {
  stepIndex: number;
  stepId: string;
  stepType: string;
  views: number;
  completions: number;
  dropOff: number;
  dropOffRate: number;
}

interface FunnelData {
  id: string;
  name: string;
  programId?: string;
  programName?: string;
  squadId?: string;
  squadName?: string;
  isActive: boolean;
  totalViews: number;
  totalStarts: number;
  totalCompletions: number;
  totalRevenue: number;
  startRate: number;
  conversionRate: number;
  completionRate: number;
  steps: FunnelStepData[];
  highestDropOffStep?: {
    stepIndex: number;
    stepId: string;
    dropOffRate: number;
  };
  createdAt: string;
}

interface FunnelSummary {
  totalFunnels: number;
  totalViews: number;
  totalCompletions: number;
  totalRevenue: number;
  overallConversionRate: number;
}

interface FunnelAnalyticsTabProps {
  apiBasePath?: string;
}

type SortField = 'name' | 'totalViews' | 'totalStarts' | 'totalCompletions' | 'totalRevenue' | 'conversionRate';

export function FunnelAnalyticsTab({ apiBasePath = '/api/coach/analytics' }: FunnelAnalyticsTabProps) {
  const { isDemoMode } = useDemoMode();

  const [funnels, setFunnels] = useState<FunnelData[]>([]);
  const [summary, setSummary] = useState<FunnelSummary>({
    totalFunnels: 0,
    totalViews: 0,
    totalCompletions: 0,
    totalRevenue: 0,
    overallConversionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFunnelId, setExpandedFunnelId] = useState<string | null>(null);
  const [period, setPeriod] = useState<number>(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalRevenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Demo data (memoized)
  const demoData = useMemo(() => generateDemoFunnelAnalytics(), []);

  const fetchFunnels = useCallback(async () => {
    // Skip API call in demo mode
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBasePath}/funnels?days=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch funnel analytics');
      }

      const data = await response.json();
      setFunnels(data.funnels || []);
      setSummary(data.summary || {
        totalFunnels: 0,
        totalViews: 0,
        totalCompletions: 0,
        totalRevenue: 0,
        overallConversionRate: 0,
      });
    } catch (err) {
      console.error('Error fetching funnels:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, period, isDemoMode]);

  useEffect(() => {
    fetchFunnels();
  }, [fetchFunnels]);

  // Use demo data when in demo mode
  const displayFunnels: FunnelData[] = useMemo(() => {
    if (isDemoMode) {
      return demoData.funnels;
    }
    return funnels;
  }, [isDemoMode, demoData.funnels, funnels]);

  const displaySummary: FunnelSummary = useMemo(() => {
    if (isDemoMode) {
      return demoData.summary;
    }
    return summary;
  }, [isDemoMode, demoData.summary, summary]);

  // Filter and sort funnels
  const filteredFunnels = useMemo(() => {
    let filtered = displayFunnels;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.name.toLowerCase().includes(query) ||
        f.programName?.toLowerCase().includes(query) ||
        f.squadName?.toLowerCase().includes(query)
      );
    }

    return [...filtered].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier;
      }
      return ((aVal as number) - (bVal as number)) * multiplier;
    });
  }, [displayFunnels, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStepTypeName = (type: string) => {
    const names: Record<string, string> = {
      welcome: 'Welcome',
      goal_input: 'Goal Input',
      identity_input: 'Identity',
      quiz: 'Quiz',
      video: 'Video',
      testimonials: 'Testimonials',
      pricing: 'Pricing',
      checkout: 'Checkout',
      upsell: 'Upsell',
      thank_you: 'Thank You',
    };
    return names[type] || type;
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
      <div className="text-center py-12 bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">{error}</p>
        <p className="text-xs text-[#5f5a55]/70 dark:text-[#b2b6c2]/70 font-albert max-w-md mx-auto">
          If this error persists, the Firestore index may need to be deployed.
          Run <code className="px-1 py-0.5 bg-[#e1ddd8] dark:bg-[#262b35] rounded">firebase deploy --only firestore:indexes</code>
        </p>
        <button
          onClick={() => fetchFunnels()}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-brand-accent text-white hover:bg-brand-accent/90 transition-colors duration-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Date Dropdown and Search */}
      <div className="flex items-center justify-end gap-3 mb-6">
        <AnalyticsDateDropdown value={period} onChange={setPeriod} />
        <ExpandableSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search funnels..."
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
              Showing sample funnel analytics for demonstration purposes
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Views</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalViews.toLocaleString()}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Funnel sessions</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <MousePointer className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Completions</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalCompletions.toLocaleString()}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Conversions</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-brand-accent" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Conversion Rate</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.overallConversionRate}%
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Overall</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Revenue</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {formatCurrency(displaySummary.totalRevenue)}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Period total</p>
        </div>
      </div>

      {/* Funnels Table */}
      {filteredFunnels.length === 0 ? (
        <div className="text-center py-12 bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl">
          <FunnelIcon className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            {searchQuery ? 'No funnels match your search' : 'No funnels yet'}
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {searchQuery ? 'Try a different search term' : 'Create a funnel to track conversions'}
          </p>
        </div>
      ) : (
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e1ddd8]/60 dark:border-[#262b35]/60">
                  <SortableTableHeader
                    label="Funnel"
                    field="name"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTableHeader
                    label="Views"
                    field="totalViews"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableTableHeader
                    label="Starts"
                    field="totalStarts"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableTableHeader
                    label="Completions"
                    field="totalCompletions"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableTableHeader
                    label="Revenue"
                    field="totalRevenue"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableTableHeader
                    label="Conv. Rate"
                    field="conversionRate"
                    currentSort={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e1ddd8]/60 dark:divide-[#262b35]/60">
                {filteredFunnels.map((funnel) => (
                  <>
                    <tr
                      key={funnel.id}
                      className="hover:bg-[#faf8f6]/50 dark:hover:bg-[#1a1f2a]/50 transition-colors duration-200 cursor-pointer"
                      onClick={() => setExpandedFunnelId(expandedFunnelId === funnel.id ? null : funnel.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${funnel.isActive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-900/30'}`}>
                            <FunnelIcon className={`w-4 h-4 ${funnel.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{funnel.name}</span>
                              {!funnel.isActive && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                              {funnel.programName || funnel.squadName || 'General'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">{funnel.totalViews.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">{funnel.totalStarts.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">{funnel.totalCompletions.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(funnel.totalRevenue)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">{funnel.conversionRate}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronDown className={`w-4 h-4 text-[#5f5a55] transition-transform duration-200 ${expandedFunnelId === funnel.id ? 'rotate-180' : ''}`} />
                      </td>
                    </tr>

                    {/* Expanded Row Details */}
                    {expandedFunnelId === funnel.id && (
                      <tr key={`${funnel.id}-details`}>
                        <td colSpan={7} className="p-0">
                          <div className="bg-[#faf8f6]/50 dark:bg-[#11141b]/50 px-6 py-4 border-t border-[#e1ddd8]/60 dark:border-[#262b35]/60">
                            {/* Highest Drop-off Alert */}
                            {funnel.highestDropOffStep && funnel.highestDropOffStep.dropOffRate > 30 && (
                              <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                    High drop-off at Step {funnel.highestDropOffStep.stepIndex + 1}
                                  </p>
                                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                    {funnel.highestDropOffStep.dropOffRate}% of users leave at this step. Consider optimizing it.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Steps Breakdown */}
                            <h5 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-3">Step Performance</h5>
                            <div className="space-y-2">
                              {funnel.steps.map((step, index) => {
                                const isHighestDropOff = funnel.highestDropOffStep?.stepIndex === step.stepIndex;
                                return (
                                  <div
                                    key={step.stepId}
                                    className={`flex items-center gap-4 p-3 rounded-lg ${isHighestDropOff ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-white/60 dark:bg-[#171b22]/60'}`}
                                  >
                                    <div className="w-6 h-6 rounded-full bg-brand-accent text-white text-xs flex items-center justify-center font-medium">
                                      {index + 1}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                                        {getStepTypeName(step.stepType)}
                                      </p>
                                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                                        {step.views} viewed → {step.completions} completed
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-medium ${step.dropOffRate > 30 ? 'text-amber-600 dark:text-amber-400' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>
                                        {step.dropOffRate}% drop-off
                                      </p>
                                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                                        {step.dropOff} left
                                      </p>
                                    </div>
                                    {isHighestDropOff && (
                                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Funnel Summary */}
                            <div className="mt-4 pt-4 border-t border-[#e1ddd8]/60 dark:border-[#262b35]/60 grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Start Rate</p>
                                <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">{funnel.startRate}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Completion Rate</p>
                                <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">{funnel.completionRate}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Conversion Rate</p>
                                <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">{funnel.conversionRate}%</p>
                              </div>
                            </div>
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
