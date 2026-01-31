'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  DollarSign,
  BookOpen,
  Calendar,
  FileText,
  Link,
  Download,
  AlertCircle,
  ChevronDown,
  Eye,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoProductAnalytics } from '@/lib/demo-data';
import { ExpandableSearch } from '@/components/ui/expandable-search';

interface ProgramData {
  id: string;
  name: string;
  type: 'self_paced' | 'group';
  enrolledCount: number;
  activeEnrollments: number;
  completedEnrollments: number;
  totalRevenue: number;
  createdAt: string;
}

interface ContentData {
  id: string;
  type: 'course' | 'article' | 'event' | 'download' | 'link';
  title: string;
  purchaserCount: number;
  totalRevenue: number;
  priceInCents: number;
  createdAt: string;
}

interface ProductSummary {
  totalPrograms: number;
  totalContentItems: number;
  totalEnrollments: number;
  totalRevenue: number;
}

interface ProductAnalyticsTabProps {
  apiBasePath?: string;
}

type SortDirection = 'asc' | 'desc';

export function ProductAnalyticsTab({ apiBasePath = '/api/coach/analytics' }: ProductAnalyticsTabProps) {
  const { isDemoMode } = useDemoMode();

  const [programs, setPrograms] = useState<ProgramData[]>([]);
  const [content, setContent] = useState<ContentData[]>([]);
  const [summary, setSummary] = useState<ProductSummary>({
    totalPrograms: 0,
    totalContentItems: 0,
    totalEnrollments: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'programs' | 'content' | null>('programs');
  const [searchQuery, setSearchQuery] = useState('');
  const [programsSortDirection, setProgramsSortDirection] = useState<SortDirection>('desc');
  const [contentSortDirection, setContentSortDirection] = useState<SortDirection>('desc');

  // Demo data (memoized)
  const demoData = useMemo(() => generateDemoProductAnalytics(), []);

  const fetchProducts = useCallback(async () => {
    // Skip API call in demo mode
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBasePath}/products`);
      if (!response.ok) {
        throw new Error('Failed to fetch product analytics');
      }

      const data = await response.json();
      setPrograms(data.programs || []);
      setContent(data.content || []);
      setSummary({
        totalPrograms: data.summary?.totalPrograms || 0,
        totalContentItems: data.summary?.totalContentItems || 0,
        totalEnrollments: data.summary?.totalEnrollments || 0,
        totalRevenue: data.summary?.totalRevenue || 0,
      });
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, isDemoMode]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Use demo data when in demo mode
  const displayPrograms: ProgramData[] = useMemo(() => {
    if (isDemoMode) {
      return demoData.programs;
    }
    return programs;
  }, [isDemoMode, demoData.programs, programs]);

  const displayContent: ContentData[] = useMemo(() => {
    if (isDemoMode) {
      return demoData.content;
    }
    return content;
  }, [isDemoMode, demoData.content, content]);

  const displaySummary: ProductSummary = useMemo(() => {
    if (isDemoMode) {
      return {
        totalPrograms: demoData.summary.totalPrograms,
        totalContentItems: demoData.summary.totalContentItems,
        totalEnrollments: demoData.summary.totalEnrollments,
        totalRevenue: demoData.summary.totalRevenue,
      };
    }
    return summary;
  }, [isDemoMode, demoData.summary, summary]);

  // Filter and sort programs
  const filteredPrograms = useMemo(() => {
    let filtered = displayPrograms;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.type.toLowerCase().includes(query)
      );
    }

    return [...filtered].sort((a, b) => {
      const multiplier = programsSortDirection === 'asc' ? 1 : -1;
      return (a.totalRevenue - b.totalRevenue) * multiplier;
    });
  }, [displayPrograms, searchQuery, programsSortDirection]);

  // Filter and sort content
  const filteredContent = useMemo(() => {
    let filtered = displayContent;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(query) ||
        c.type.toLowerCase().includes(query)
      );
    }

    return [...filtered].sort((a, b) => {
      const multiplier = contentSortDirection === 'asc' ? 1 : -1;
      return (a.totalRevenue - b.totalRevenue) * multiplier;
    });
  }, [displayContent, searchQuery, contentSortDirection]);

  const getContentIcon = (type: ContentData['type']) => {
    switch (type) {
      case 'course': return <BookOpen className="w-4 h-4" />;
      case 'article': return <FileText className="w-4 h-4" />;
      case 'event': return <Calendar className="w-4 h-4" />;
      case 'download': return <Download className="w-4 h-4" />;
      case 'link': return <Link className="w-4 h-4" />;
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
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="mb-4 px-4 py-3 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-3">
          <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-albert">
              Demo Mode Active
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-albert">
              Showing sample product analytics for demonstration purposes
            </p>
          </div>
        </div>
      )}

      {/* Header with Search */}
      <div className="flex items-center justify-end mb-6">
        <ExpandableSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search products..."
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-brand-accent" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Programs</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalPrograms}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">{displaySummary.totalEnrollments} enrollments</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Content</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalContentItems}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Paid items</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Revenue</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {formatCurrency(displaySummary.totalRevenue)}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">All time</p>
        </div>

        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Avg Order</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalEnrollments > 0
              ? formatCurrency(displaySummary.totalRevenue / displaySummary.totalEnrollments)
              : '$0'
            }
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Per enrollment</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {/* Programs Section */}
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'programs' ? null : 'programs')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#faf8f6]/50 dark:hover:bg-[#1a1f2a]/50 transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-brand-accent" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Programs</h3>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({filteredPrograms.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {expandedSection === 'programs' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setProgramsSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                    bg-white/60 dark:bg-[#262b35]/60 border border-[#e1ddd8]/40 dark:border-[#262b35]/40
                    text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent transition-colors duration-200"
                >
                  <span>Revenue</span>
                  {programsSortDirection === 'asc' ? (
                    <ArrowUp className="w-3.5 h-3.5 text-brand-accent" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-brand-accent" />
                  )}
                </button>
              )}
              <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'programs' ? 'rotate-180' : ''}`} />
            </div>
          </button>

          <div className={`border-t border-[#e1ddd8]/60 dark:border-[#262b35]/60 overflow-hidden transition-all duration-200 ease-out ${
            expandedSection === 'programs' ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            {filteredPrograms.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                {searchQuery ? 'No programs match your search' : 'No programs yet'}
              </div>
            ) : (
              <div className="divide-y divide-[#e1ddd8]/60 dark:divide-[#262b35]/60 max-h-[500px] overflow-y-auto">
                {filteredPrograms.map((program) => (
                  <div
                    key={program.id}
                    className="px-4 py-3 hover:bg-[#faf8f6]/50 dark:hover:bg-[#1a1f2a]/50 transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{program.name}</h4>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                          {program.type === 'group' ? 'Group' : 'Self-paced'} • {program.activeEnrollments} active
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{program.enrolledCount} enrolled</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{formatCurrency(program.totalRevenue)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'content' ? null : 'content')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#faf8f6]/50 dark:hover:bg-[#1a1f2a]/50 transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Content Sales</h3>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({filteredContent.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {expandedSection === 'content' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContentSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                    bg-white/60 dark:bg-[#262b35]/60 border border-[#e1ddd8]/40 dark:border-[#262b35]/40
                    text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent transition-colors duration-200"
                >
                  <span>Revenue</span>
                  {contentSortDirection === 'asc' ? (
                    <ArrowUp className="w-3.5 h-3.5 text-brand-accent" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-brand-accent" />
                  )}
                </button>
              )}
              <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'content' ? 'rotate-180' : ''}`} />
            </div>
          </button>

          <div className={`border-t border-[#e1ddd8]/60 dark:border-[#262b35]/60 overflow-hidden transition-all duration-200 ease-out ${
            expandedSection === 'content' ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            {filteredContent.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                {searchQuery ? 'No content matches your search' : 'No paid content yet'}
              </div>
            ) : (
              <div className="divide-y divide-[#e1ddd8]/60 dark:divide-[#262b35]/60 max-h-[500px] overflow-y-auto">
                {filteredContent.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-3 hover:bg-[#faf8f6]/50 dark:hover:bg-[#1a1f2a]/50 transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                          {getContentIcon(item.type)}
                        </div>
                        <div>
                          <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{item.title}</h4>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] capitalize">
                            {item.type} • {formatCurrency(item.priceInCents / 100)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{item.purchaserCount} purchases</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{formatCurrency(item.totalRevenue)}</p>
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
