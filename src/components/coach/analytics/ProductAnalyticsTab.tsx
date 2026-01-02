'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Package, 
  Users, 
  DollarSign, 
  BookOpen,
  Calendar,
  FileText,
  Link,
  Download,
  AlertCircle,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoProductAnalytics } from '@/lib/demo-data';

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

interface SquadData {
  id: string;
  name: string;
  type: 'standalone' | 'program';
  memberCount: number;
  programId?: string;
  programName?: string;
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
  totalSquads: number;
  totalContentItems: number;
  totalEnrollments: number;
  totalMembers: number;
  totalRevenue: number;
}

interface ProductAnalyticsTabProps {
  apiBasePath?: string;
}

export function ProductAnalyticsTab({ apiBasePath = '/api/coach/analytics' }: ProductAnalyticsTabProps) {
  const { isDemoMode } = useDemoMode();
  
  const [programs, setPrograms] = useState<ProgramData[]>([]);
  const [squads, setSquads] = useState<SquadData[]>([]);
  const [content, setContent] = useState<ContentData[]>([]);
  const [summary, setSummary] = useState<ProductSummary>({
    totalPrograms: 0,
    totalSquads: 0,
    totalContentItems: 0,
    totalEnrollments: 0,
    totalMembers: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'programs' | 'squads' | 'content' | null>('programs');
  
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
      setSquads(data.squads || []);
      setContent(data.content || []);
      setSummary(data.summary || {
        totalPrograms: 0,
        totalSquads: 0,
        totalContentItems: 0,
        totalEnrollments: 0,
        totalMembers: 0,
        totalRevenue: 0,
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
  
  const displaySquads: SquadData[] = useMemo(() => {
    if (isDemoMode) {
      return demoData.squads;
    }
    return squads;
  }, [isDemoMode, demoData.squads, squads]);
  
  const displayContent: ContentData[] = useMemo(() => {
    if (isDemoMode) {
      return demoData.content;
    }
    return content;
  }, [isDemoMode, demoData.content, content]);
  
  const displaySummary: ProductSummary = useMemo(() => {
    if (isDemoMode) {
      return demoData.summary;
    }
    return summary;
  }, [isDemoMode, demoData.summary, summary]);

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
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-brand-accent" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Programs</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalPrograms}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">{displaySummary.totalEnrollments} enrollments</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Squads</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalSquads}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">{displaySummary.totalMembers} members</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Content</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalContentItems}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Paid items</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Revenue</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {formatCurrency(displaySummary.totalRevenue)}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">All time</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {/* Programs Section */}
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'programs' ? null : 'programs')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-brand-accent" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Programs</h3>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({displayPrograms.length})</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'programs' ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`border-t border-[#e1ddd8] dark:border-[#262b35] overflow-hidden transition-all duration-300 ease-out ${
            expandedSection === 'programs' ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
              {displayPrograms.length === 0 ? (
                <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                  No programs yet
                </div>
              ) : (
                <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
                  {displayPrograms.map((program, index) => (
                    <div 
                      key={program.id} 
                      className="px-4 py-3 hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
                      style={{ animationDelay: `${index * 50}ms` }}
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

        {/* Squads Section */}
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'squads' ? null : 'squads')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Squads</h3>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({displaySquads.length})</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'squads' ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`border-t border-[#e1ddd8] dark:border-[#262b35] overflow-hidden transition-all duration-300 ease-out ${
            expandedSection === 'squads' ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
              {displaySquads.length === 0 ? (
                <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                  No squads yet
                </div>
              ) : (
                <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
                  {displaySquads.map((squad, index) => (
                    <div 
                      key={squad.id} 
                      className="px-4 py-3 hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{squad.name}</h4>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                            {squad.type === 'program' ? `${squad.programName}` : 'Squad'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{squad.memberCount} members</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>

        {/* Content Section */}
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'content' ? null : 'content')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Content Sales</h3>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">({displayContent.length})</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#5f5a55] transition-transform duration-200 ${expandedSection === 'content' ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`border-t border-[#e1ddd8] dark:border-[#262b35] overflow-hidden transition-all duration-300 ease-out ${
            expandedSection === 'content' ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
              {displayContent.length === 0 ? (
                <div className="px-4 py-8 text-center text-[#5f5a55] dark:text-[#b2b6c2]">
                  No paid content yet
                </div>
              ) : (
                <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
                  {displayContent.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="px-4 py-3 hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
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

