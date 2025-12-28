'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Funnel as FunnelIcon,
  Eye,
  MousePointer,
  DollarSign,
  TrendingDown,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

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

export function FunnelAnalyticsTab({ apiBasePath = '/api/coach/analytics' }: FunnelAnalyticsTabProps) {
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

  const fetchFunnels = useCallback(async () => {
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
  }, [apiBasePath, period]);

  useEffect(() => {
    fetchFunnels();
  }, [fetchFunnels]);

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
      <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">{error}</p>
        <p className="text-xs text-[#5f5a55]/70 dark:text-[#b2b6c2]/70 font-albert max-w-md mx-auto">
          If this error persists, the Firestore index may need to be deployed. 
          Run <code className="px-1 py-0.5 bg-[#e1ddd8] dark:bg-[#262b35] rounded">firebase deploy --only firestore:indexes</code>
        </p>
        <button
          onClick={() => fetchFunnels()}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-[#a07855] text-white hover:bg-[#8c6245] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Period Selector */}
      <div className="flex justify-end mb-4">
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          className="px-3 py-1.5 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] text-sm focus:outline-none focus:ring-2 focus:ring-[#a07855]/30"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Views</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.totalViews.toLocaleString()}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Funnel sessions</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <MousePointer className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Completions</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.totalCompletions.toLocaleString()}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Conversions</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-[#a07855]" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Conversion Rate</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {summary.overallConversionRate}%
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Overall</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Revenue</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {formatCurrency(summary.totalRevenue)}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Period total</p>
        </div>
      </div>

      {/* Funnels List */}
      {funnels.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
          <FunnelIcon className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            No funnels yet
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Create a funnel to track conversions
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {funnels.map((funnel, index) => (
            <div 
              key={funnel.id}
              className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden animate-fadeIn"
              style={{ animationDelay: `${200 + index * 50}ms` }}
            >
              {/* Funnel Header */}
              <button
                onClick={() => setExpandedFunnelId(expandedFunnelId === funnel.id ? null : funnel.id)}
                className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${funnel.isActive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-900/30'}`}>
                    <FunnelIcon className={`w-5 h-5 ${funnel.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{funnel.name}</h4>
                      {!funnel.isActive && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                      {funnel.programName || funnel.squadName || 'General funnel'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{funnel.totalViews} views</p>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">{funnel.conversionRate}% conversion</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(funnel.totalRevenue)}</p>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">{funnel.totalCompletions} sales</p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedFunnelId === funnel.id ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Expanded Step Details */}
              <div className={`border-t border-[#e1ddd8] dark:border-[#262b35] overflow-hidden transition-all duration-300 ease-out ${
                expandedFunnelId === funnel.id ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="p-4">
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
                          className={`flex items-center gap-4 p-3 rounded-lg ${isHighestDropOff ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-[#faf8f6] dark:bg-[#11141b]'}`}
                        >
                          <div className="w-6 h-6 rounded-full bg-[#a07855] text-white text-xs flex items-center justify-center font-medium">
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
                  <div className="mt-4 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35] grid grid-cols-3 gap-4">
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

