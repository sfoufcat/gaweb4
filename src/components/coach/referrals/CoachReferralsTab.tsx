'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import {
  Users,
  Gift,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  Eye,
  Plus,
  Check,
  Settings,
  Link as LinkIcon,
  Copy,
  Pencil,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HowReferralsWork } from './HowReferralsWork';
import { ReferralSetupWizard } from './ReferralSetupWizard';
import { ReferralEditSheet } from './ReferralEditSheet';
import type { ReferralWithDetails, ReferralStatus, ReferralRewardType, ReferralConfig, ReferralResourceType } from '@/types';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoReferrals } from '@/lib/demo-data';
import { cn } from '@/lib/utils';

interface ReferralStats {
  total: number;
  pending: number;
  completed: number;
  rewarded: number;
  conversionRate: number;
}

interface ReferrerSummary {
  referrerId: string;
  referrerName: string;
  referrerEmail?: string;
  referrerImageUrl?: string;
  totalReferrals: number;
  completedReferrals: number;
  totalEarned: number; // in cents
  pendingPayment: number; // in cents
  referrals: ReferralWithDetails[];
}

interface ReferralConfigItem {
  targetType: 'program' | 'squad' | ReferralResourceType;
  targetId: string;
  targetName: string;
  referralConfig: ReferralConfig | null;
  funnelName?: string;
}

// Display labels for target types
const TARGET_TYPE_LABELS: Record<string, string> = {
  program: 'Program',
  squad: 'Squad',
  course: 'Course',
  article: 'Article',
  download: 'Download',
  video: 'Video',
  link: 'Link',
};

type ViewMode = 'programs' | 'referrers' | 'referred';
type TypeFilter = 'all' | 'programs' | 'resources';
type SortField = 'name' | 'type' | 'status' | 'reward' | 'referrals' | 'earned' | 'date';
type SortDirection = 'asc' | 'desc';

/**
 * CoachReferralsTab Component
 *
 * Dashboard tab for coaches to view and manage referrals:
 * - Programs view: Shows all programs/squads with their referral configs
 * - Referrers view: Aggregated by person with payment tracking
 * - Referred view: Individual referral records
 */
export function CoachReferralsTab() {
  const { isDemoMode } = useDemoMode();

  const [referrals, setReferrals] = useState<ReferralWithDetails[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [configs, setConfigs] = useState<ReferralConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode toggle - default to 'programs' to show configs
  const [viewMode, setViewMode] = useState<ViewMode>('programs');

  // Type filter for programs view: 'all', 'programs', or 'resources'
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProgramId, setWizardProgramId] = useState<string | undefined>(undefined);

  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ReferralConfigItem | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  // Mark as paid loading state
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  // Copy link state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Demo data (memoized)
  const demoData = useMemo(() => generateDemoReferrals(), []);

  // Search expand/collapse handlers
  const handleSearchExpand = useCallback(() => {
    setIsSearchExpanded(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSearchCollapse = useCallback(() => {
    setIsSearchExpanded(false);
    setSearchQuery('');
  }, []);

  // Sort toggle handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  // Fetch referral configs
  const fetchConfigs = useCallback(async () => {
    if (isDemoMode) {
      setConfigsLoading(false);
      return;
    }

    try {
      setConfigsLoading(true);
      const response = await fetch('/api/coach/referral-config');
      if (!response.ok) throw new Error('Failed to fetch configs');
      const data = await response.json();
      setConfigs(data.configs || []);
    } catch (err) {
      console.error('Error fetching configs:', err);
    } finally {
      setConfigsLoading(false);
    }
  }, [isDemoMode]);

  const fetchReferrals = useCallback(async (resetOffset = false) => {
    // Skip API call in demo mode
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const currentOffset = resetOffset ? 0 : offset;

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString(),
      });

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/coach/referrals?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch referrals');
      }

      const data = await response.json();

      if (resetOffset) {
        setReferrals(data.referrals || []);
        setOffset(0);
      } else {
        setReferrals(prev => resetOffset ? data.referrals : [...prev, ...data.referrals]);
      }

      setStats(data.stats || null);
      setHasMore(data.pagination?.hasMore || false);
    } catch (err) {
      console.error('Error fetching referrals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset, limit, isDemoMode]);

  useEffect(() => {
    fetchConfigs();
    fetchReferrals(true);
  }, [statusFilter, isDemoMode]);

  // Wizard handlers
  const handleEnableReferrals = (programId?: string) => {
    setWizardProgramId(programId);
    setWizardOpen(true);
  };

  const handleWizardSuccess = () => {
    fetchConfigs();
    fetchReferrals(true);
  };

  // Edit config handler
  const handleEditConfig = (config: ReferralConfigItem) => {
    setEditingConfig(config);
    setEditSheetOpen(true);
  };

  const handleEditSuccess = () => {
    fetchConfigs();
  };

  // Copy referral link
  const handleCopyLink = async (config: ReferralConfigItem) => {
    if (!config.referralConfig?.funnelId) return;

    // Construct the referral link - this assumes the funnel has a public URL
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/f/${config.referralConfig.funnelId}?ref=REFERRER_CODE`;

    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(config.targetId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Mark as paid handler
  const handleMarkPaid = async (referrerId: string, amount: number) => {
    if (isDemoMode) return;

    setMarkingPaid(referrerId);
    try {
      const response = await fetch('/api/coach/referrals/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerId, amount }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark as paid');
      }

      fetchReferrals(true);
    } catch (err) {
      console.error('Error marking as paid:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark as paid');
    } finally {
      setMarkingPaid(null);
    }
  };

  // Use demo data when in demo mode
  const displayReferrals: ReferralWithDetails[] = useMemo(() => {
    if (isDemoMode) {
      const nowIso = new Date().toISOString();
      let filtered = demoData.referrals.map(dr => ({
        id: dr.id,
        organizationId: 'demo-org',
        referrerId: dr.referrerId,
        referredUserId: dr.referredId || '',
        funnelId: 'demo-funnel',
        flowSessionId: 'demo-session',
        referrerName: dr.referrerName,
        referrerEmail: dr.referrerEmail,
        referrerImageUrl: dr.referrerImageUrl,
        referredUserName: dr.referredName,
        referredUserEmail: dr.referredEmail,
        referredUserImageUrl: dr.referredImageUrl,
        programId: dr.programId,
        programName: dr.programName,
        squadId: dr.squadId,
        squadName: dr.squadName,
        status: dr.status as ReferralStatus,
        rewardType: dr.rewardType as ReferralRewardType | undefined,
        createdAt: dr.createdAt,
        updatedAt: nowIso,
        completedAt: dr.completedAt,
        rewardGrantedAt: dr.rewardedAt,
      }));

      if (statusFilter !== 'all') {
        filtered = filtered.filter(r => r.status === statusFilter);
      }

      return filtered;
    }
    return referrals;
  }, [isDemoMode, demoData.referrals, referrals, statusFilter]);

  const displayStats: ReferralStats | null = useMemo(() => {
    if (isDemoMode) {
      return demoData.stats;
    }
    return stats;
  }, [isDemoMode, demoData.stats, stats]);

  // Demo configs
  const displayConfigs: ReferralConfigItem[] = useMemo(() => {
    if (isDemoMode) {
      return [
        {
          targetType: 'program' as const,
          targetId: 'demo-program-1',
          targetName: 'Morning Accountability',
          referralConfig: {
            enabled: true,
            funnelId: 'demo-funnel-1',
            reward: { type: 'discount_code' as const, discountType: 'percentage' as const, discountValue: 20 },
          },
          funnelName: 'Join Morning Accountability',
        },
        {
          targetType: 'program' as const,
          targetId: 'demo-program-2',
          targetName: '12-Week Transformation',
          referralConfig: {
            enabled: true,
            funnelId: 'demo-funnel-2',
            reward: { type: 'monetary' as const, monetaryAmount: 2500 },
          },
          funnelName: 'Join 12-Week Transformation',
        },
        {
          targetType: 'course' as const,
          targetId: 'demo-course-1',
          targetName: 'Mindfulness Masterclass',
          referralConfig: {
            enabled: true,
            funnelId: 'demo-funnel-3',
            reward: { type: 'free_program' as const, freeProgramId: 'demo-program-1' },
          },
          funnelName: 'Get Mindfulness Course',
        },
        {
          targetType: 'program' as const,
          targetId: 'demo-program-3',
          targetName: 'Habit Builder',
          referralConfig: null,
        },
        {
          targetType: 'article' as const,
          targetId: 'demo-article-1',
          targetName: 'The Ultimate Guide to Productivity',
          referralConfig: null,
        },
      ];
    }
    return configs;
  }, [isDemoMode, configs]);

  // Aggregate referrals by referrer
  const referrerSummaries: ReferrerSummary[] = useMemo(() => {
    const summaryMap = new Map<string, ReferrerSummary>();

    for (const r of displayReferrals) {
      const existing = summaryMap.get(r.referrerId);

      const monetaryAmount = r.rewardType === 'monetary'
        ? ((r.rewardDetails as { monetaryAmount?: number })?.monetaryAmount || 0)
        : 0;

      const isPaid = r.paymentStatus === 'paid';
      const isCompleted = r.status === 'completed' || r.status === 'rewarded';

      if (existing) {
        existing.totalReferrals++;
        if (isCompleted) existing.completedReferrals++;
        if (monetaryAmount > 0 && isCompleted) {
          existing.totalEarned += monetaryAmount;
          if (!isPaid) {
            existing.pendingPayment += monetaryAmount;
          }
        }
        existing.referrals.push(r);
      } else {
        summaryMap.set(r.referrerId, {
          referrerId: r.referrerId,
          referrerName: r.referrerName || 'Unknown',
          referrerEmail: r.referrerEmail,
          referrerImageUrl: r.referrerImageUrl,
          totalReferrals: 1,
          completedReferrals: isCompleted ? 1 : 0,
          totalEarned: (monetaryAmount > 0 && isCompleted) ? monetaryAmount : 0,
          pendingPayment: (monetaryAmount > 0 && isCompleted && !isPaid) ? monetaryAmount : 0,
          referrals: [r],
        });
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) => b.totalReferrals - a.totalReferrals);
  }, [displayReferrals]);

  const loadMore = () => {
    setOffset(prev => prev + limit);
    fetchReferrals(false);
  };

  // Filter referrals by search query
  const filteredReferrals = useMemo(() => {
    let result = displayReferrals.filter(r => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        r.referrerName?.toLowerCase().includes(query) ||
        r.referrerEmail?.toLowerCase().includes(query) ||
        r.referredUserName?.toLowerCase().includes(query) ||
        r.referredUserEmail?.toLowerCase().includes(query) ||
        r.programName?.toLowerCase().includes(query) ||
        r.squadName?.toLowerCase().includes(query)
      );
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = (a.referrerName || '').localeCompare(b.referrerName || '');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'date':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [displayReferrals, searchQuery, sortField, sortDirection]);

  // Filter referrer summaries by search query
  const filteredReferrerSummaries = useMemo(() => {
    let result = referrerSummaries.filter(s => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        s.referrerName?.toLowerCase().includes(query) ||
        s.referrerEmail?.toLowerCase().includes(query)
      );
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.referrerName.localeCompare(b.referrerName);
          break;
        case 'referrals':
          cmp = a.totalReferrals - b.totalReferrals;
          break;
        case 'earned':
          cmp = a.totalEarned - b.totalEarned;
          break;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [referrerSummaries, searchQuery, sortField, sortDirection]);

  // Filter configs by search query and type filter
  const filteredConfigs = useMemo(() => {
    let result = displayConfigs.filter(c => {
      // First filter by type filter
      const isProgramOrSquad = c.targetType === 'program' || c.targetType === 'squad';
      if (typeFilter === 'programs' && !isProgramOrSquad) return false;
      if (typeFilter === 'resources' && isProgramOrSquad) return false;

      // Then filter by search query
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return c.targetName.toLowerCase().includes(query);
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.targetName.localeCompare(b.targetName);
          break;
        case 'type':
          cmp = a.targetType.localeCompare(b.targetType);
          break;
        case 'status':
          const aEnabled = a.referralConfig?.enabled ? 1 : 0;
          const bEnabled = b.referralConfig?.enabled ? 1 : 0;
          cmp = aEnabled - bEnabled;
          break;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [displayConfigs, typeFilter, searchQuery, sortField, sortDirection]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getRewardLabel = (config: ReferralConfig | null) => {
    if (!config?.reward) return 'No reward';
    switch (config.reward.type) {
      case 'free_program':
        return 'Free Product';
      case 'discount_code':
        const discountVal = config.reward.discountType === 'percentage'
          ? `${config.reward.discountValue}%`
          : formatCurrency(config.reward.discountValue || 0);
        return `${discountVal} discount`;
      case 'monetary':
        return formatCurrency(config.reward.monetaryAmount || 0);
      default:
        return 'No reward';
    }
  };

  const getStatusBadge = (status: ReferralStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'rewarded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <Gift className="w-3 h-3" />
            Rewarded
          </span>
        );
    }
  };

  const getRewardDescription = (r: ReferralWithDetails) => {
    if (!r.rewardType) return null;

    switch (r.rewardType) {
      case 'free_program':
        const programName = (r.rewardDetails as { programName?: string })?.programName;
        return `Free access: ${programName || 'program'}`;
      case 'discount_code':
        const code = (r.rewardDetails as { code?: string })?.code;
        const displayValue = (r.rewardDetails as { displayValue?: string })?.displayValue;
        return `${displayValue || ''} discount (${code || ''})`;
      case 'monetary':
        const amount = (r.rewardDetails as { monetaryAmount?: number })?.monetaryAmount || 0;
        return `Cash reward: ${formatCurrency(amount)}`;
      default:
        return r.rewardType;
    }
  };

  // Sortable header component
  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors",
        className
      )}
    >
      {children}
      <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortField === field ? "opacity-100" : "opacity-40")} />
    </button>
  );

  if (loading && configsLoading && displayReferrals.length === 0 && !isDemoMode) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
          ))}
        </div>
        <div className="h-12 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="px-4 py-3 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-3">
          <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Demo Mode Active
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Showing sample referral data for demonstration purposes
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
            Referrals
          </h2>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            Track referrals and rewards across your programs
          </p>
        </div>
        {!isDemoMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEnableReferrals()}
            className="text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] hover:bg-transparent"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Referral
          </Button>
        )}
      </div>

      {/* How Referrals Work */}
      <HowReferralsWork defaultOpen={false} />

      {/* Wizard Dialog */}
      <ReferralSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialProgramId={wizardProgramId}
        onSuccess={handleWizardSuccess}
      />

      {/* Edit Sheet */}
      {editingConfig && (
        <ReferralEditSheet
          open={editSheetOpen}
          onOpenChange={setEditSheetOpen}
          config={editingConfig}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Stats Cards */}
      {displayStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {displayStats.total}
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  Total Referrals
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {displayStats.pending}
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  Pending
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {displayStats.rewarded}
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  Rewards Granted
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {displayStats.conversionRate}%
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  Conversion Rate
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Toggle and Filters */}
      <div className="flex items-center justify-between gap-3">
        {/* Left side: Pill Toggle */}
        <div className="inline-flex p-1 bg-[#f3f1ef] dark:bg-[#1d222b] rounded-full">
          <button
            onClick={() => setViewMode('programs')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
              viewMode === 'programs'
                ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setViewMode('referrers')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
              viewMode === 'referrers'
                ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
            }`}
          >
            Referrers
          </button>
          <button
            onClick={() => setViewMode('referred')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
              viewMode === 'referred'
                ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
            }`}
          >
            Referred
          </button>
        </div>

        {/* Right side: Filters + Search */}
        <div className="flex items-center gap-2">
          {/* Type filter dropdown - only for programs view */}
          {viewMode === 'programs' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors">
                  {typeFilter === 'all' ? 'All' : typeFilter === 'programs' ? 'Programs' : 'Resources'}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem onClick={() => setTypeFilter('all')}>
                  <span className={cn(typeFilter === 'all' && 'font-medium')}>All</span>
                  {typeFilter === 'all' && <Check className="w-4 h-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('programs')}>
                  <span className={cn(typeFilter === 'programs' && 'font-medium')}>Programs</span>
                  {typeFilter === 'programs' && <Check className="w-4 h-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('resources')}>
                  <span className={cn(typeFilter === 'resources' && 'font-medium')}>Resources</span>
                  {typeFilter === 'resources' && <Check className="w-4 h-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Status filter dropdown - only for referred view */}
          {viewMode === 'referred' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors">
                  {statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                  <span className={cn(statusFilter === 'all' && 'font-medium')}>All Status</span>
                  {statusFilter === 'all' && <Check className="w-4 h-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>
                  <span className={cn(statusFilter === 'pending' && 'font-medium')}>Pending</span>
                  {statusFilter === 'pending' && <Check className="w-4 h-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('completed')}>
                  <span className={cn(statusFilter === 'completed' && 'font-medium')}>Completed</span>
                  {statusFilter === 'completed' && <Check className="w-4 h-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('rewarded')}>
                  <span className={cn(statusFilter === 'rewarded' && 'font-medium')}>Rewarded</span>
                  {statusFilter === 'rewarded' && <Check className="w-4 h-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Animated search input with fade */}
          <div
            className="flex items-center overflow-hidden transition-all duration-300 ease-out"
            style={{
              width: isSearchExpanded ? '200px' : 0,
              opacity: isSearchExpanded ? 1 : 0,
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder={
                viewMode === 'programs'
                  ? 'Search...'
                  : viewMode === 'referrers'
                  ? 'Search referrers...'
                  : 'Search referrals...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9ca3af] focus:outline-none focus:ring-0 transition-opacity duration-300"
            />
          </div>

          {/* Search toggle button */}
          <button
            onClick={isSearchExpanded ? handleSearchCollapse : handleSearchExpand}
            className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            title={isSearchExpanded ? "Close search" : "Search"}
          >
            {isSearchExpanded ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchReferrals(true)}
            className="mt-2 text-red-600"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'programs' ? (
        /* Programs View - Referral Configs */
        <div className="space-y-0">
          {filteredConfigs.length === 0 && !configsLoading ? (
            <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
              <Settings className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                No referrals configured
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-4">
                {typeFilter === 'resources'
                  ? 'Enable referrals on your resources to start tracking'
                  : typeFilter === 'programs'
                  ? 'Enable referrals on your programs to start tracking'
                  : 'Enable referrals on a program or resource to start tracking'}
              </p>
              {!isDemoMode && (
                <Button
                  onClick={() => handleEnableReferrals()}
                  className="bg-brand-accent hover:bg-brand-accent/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Enable Referrals
                </Button>
              )}
            </div>
          ) : (
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[#faf8f6] dark:bg-[#1a1e26] border-b border-[#e1ddd8] dark:border-[#262b35]">
              <div className="col-span-4">
                <SortableHeader field="name">Name</SortableHeader>
              </div>
              <div className="col-span-2">
                <SortableHeader field="type">Type</SortableHeader>
              </div>
              <div className="col-span-2">
                <SortableHeader field="status">Status</SortableHeader>
              </div>
              <div className="col-span-2">
                <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">Reward</span>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">Actions</span>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {filteredConfigs.map((config) => (
                <div
                  key={config.targetId}
                  className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors"
                >
                  {/* Name */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center flex-shrink-0">
                      <Settings className="w-4 h-4 text-[#5f5a55]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {config.targetName}
                      </p>
                      {config.referralConfig?.enabled && config.funnelName && (
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" />
                          {config.funnelName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-2">
                    <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                      {TARGET_TYPE_LABELS[config.targetType] || config.targetType}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    {config.referralConfig?.enabled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle2 className="w-3 h-3" />
                        Enabled
                      </span>
                    ) : (
                      <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                        Not enabled
                      </span>
                    )}
                  </div>

                  {/* Reward */}
                  <div className="col-span-2">
                    <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {config.referralConfig?.enabled ? getRewardLabel(config.referralConfig) : '—'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    {config.referralConfig?.enabled ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(config)}
                          className="h-8 px-2"
                        >
                          {copiedId === config.targetId ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        {!isDemoMode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditConfig(config)}
                            className="h-8 px-2 text-[#5f5a55]"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      !isDemoMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEnableReferrals(config.targetId)}
                          className="h-8"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Enable
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      ) : viewMode === 'referrers' ? (
        /* Referrers View */
        filteredReferrerSummaries.length === 0 && !loading ? (
          <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
            <Users className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
              No referrers yet
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-4">
              Enable referrals on a program and share the link with your members
            </p>
            {!isDemoMode && (
              <Button
                onClick={() => handleEnableReferrals()}
                className="bg-brand-accent hover:bg-brand-accent/90 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Enable Referrals
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[#faf8f6] dark:bg-[#1a1e26] border-b border-[#e1ddd8] dark:border-[#262b35]">
              <div className="col-span-4">
                <SortableHeader field="name">Referrer</SortableHeader>
              </div>
              <div className="col-span-2">
                <SortableHeader field="referrals">Referrals</SortableHeader>
              </div>
              <div className="col-span-2">
                <SortableHeader field="earned">Earned</SortableHeader>
              </div>
              <div className="col-span-2">
                <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">Pending</span>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">Actions</span>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {filteredReferrerSummaries.map((summary) => (
                <div
                  key={summary.referrerId}
                  className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors"
                >
                  {/* Referrer */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                      {summary.referrerImageUrl ? (
                        <Image
                          src={summary.referrerImageUrl}
                          alt={summary.referrerName}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="font-semibold text-xs text-[#5f5a55]">
                            {summary.referrerName[0] || '?'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {summary.referrerName}
                      </p>
                      {summary.referrerEmail && (
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                          {summary.referrerEmail}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Referrals */}
                  <div className="col-span-2">
                    <span className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {summary.totalReferrals}
                    </span>
                  </div>

                  {/* Earned */}
                  <div className="col-span-2">
                    {summary.totalEarned > 0 ? (
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(summary.totalEarned)}
                      </span>
                    ) : (
                      <span className="text-sm text-[#a7a39e]">—</span>
                    )}
                  </div>

                  {/* Pending */}
                  <div className="col-span-2">
                    {summary.pendingPayment > 0 ? (
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(summary.pendingPayment)}
                      </span>
                    ) : summary.totalEarned > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle2 className="w-3 h-3" />
                        Paid
                      </span>
                    ) : (
                      <span className="text-sm text-[#a7a39e]">—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end">
                    {summary.pendingPayment > 0 && !isDemoMode && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkPaid(summary.referrerId, summary.pendingPayment)}
                        disabled={markingPaid === summary.referrerId}
                        className="h-8 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
                      >
                        {markingPaid === summary.referrerId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Mark Paid
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        /* Referred View - Individual Referrals */
        filteredReferrals.length === 0 && !loading ? (
          <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
            <Users className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
              No referrals yet
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-4">
              {statusFilter !== 'all'
                ? `No ${statusFilter} referrals found`
                : 'Enable referrals on a program and share the link with your members'}
            </p>
            {statusFilter === 'all' && !isDemoMode && (
              <Button
                onClick={() => handleEnableReferrals()}
                className="bg-brand-accent hover:bg-brand-accent/90 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Enable Referrals
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[#faf8f6] dark:bg-[#1a1e26] border-b border-[#e1ddd8] dark:border-[#262b35]">
              <div className="col-span-3">
                <SortableHeader field="name">Referrer</SortableHeader>
              </div>
              <div className="col-span-3">
                <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">Referred</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">Program</span>
              </div>
              <div className="col-span-2">
                <SortableHeader field="status">Status</SortableHeader>
              </div>
              <div className="col-span-2">
                <SortableHeader field="date">Date</SortableHeader>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {filteredReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors"
                >
                  {/* Referrer */}
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                      {referral.referrerImageUrl ? (
                        <Image
                          src={referral.referrerImageUrl}
                          alt={referral.referrerName || ''}
                          width={28}
                          height={28}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="font-semibold text-xs text-[#5f5a55]">
                            {referral.referrerName?.[0] || '?'}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                      {referral.referrerName || 'Unknown'}
                    </span>
                  </div>

                  {/* Referred */}
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                      {referral.referredUserImageUrl ? (
                        <Image
                          src={referral.referredUserImageUrl}
                          alt={referral.referredUserName || ''}
                          width={28}
                          height={28}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="font-semibold text-xs text-[#5f5a55]">
                            {referral.referredUserName?.[0] || '?'}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                      {referral.referredUserName || 'Pending...'}
                    </span>
                  </div>

                  {/* Program */}
                  <div className="col-span-2">
                    <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate block">
                      {referral.programName || referral.squadName || '—'}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    {getStatusBadge(referral.status)}
                  </div>

                  {/* Date */}
                  <div className="col-span-2">
                    <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                      {new Date(referral.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="p-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
