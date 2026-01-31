'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  Users,
  Gift,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Loader2,
  Search,
  Eye,
  Plus,
  Check,
  Settings,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HowReferralsWork } from './HowReferralsWork';
import { ReferralSetupWizard } from './ReferralSetupWizard';
import { ReferralEditSheet } from './ReferralEditSheet';
import type { ReferralWithDetails, ReferralStatus, ReferralRewardType, ReferralConfig, ReferralResourceType } from '@/types';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoReferrals } from '@/lib/demo-data';

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

  // Sub-filter for programs view: 'programs' shows programs/squads, 'resources' shows courses/articles/etc
  const [programsSubFilter, setProgramsSubFilter] = useState<'programs' | 'resources'>('programs');

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProgramId, setWizardProgramId] = useState<string | undefined>(undefined);

  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ReferralConfigItem | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
  const filteredReferrals = displayReferrals.filter(r => {
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

  // Filter referrer summaries by search query
  const filteredReferrerSummaries = referrerSummaries.filter(s => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.referrerName?.toLowerCase().includes(query) ||
      s.referrerEmail?.toLowerCase().includes(query)
    );
  });

  // Filter configs by search query and sub-filter (programs vs resources)
  const filteredConfigs = displayConfigs.filter(c => {
    // First filter by sub-filter (programs/squads vs resources)
    const isProgramOrSquad = c.targetType === 'program' || c.targetType === 'squad';
    if (programsSubFilter === 'programs' && !isProgramOrSquad) return false;
    if (programsSubFilter === 'resources' && isProgramOrSquad) return false;

    // Then filter by search query
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return c.targetName.toLowerCase().includes(query);
  });

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
      <div className="flex flex-wrap items-center gap-3">
        {/* Pill Toggle */}
        <div className="inline-flex p-1 bg-[#f3f1ef] dark:bg-[#1d222b] rounded-full">
          <button
            onClick={() => setViewMode('programs')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
              viewMode === 'programs'
                ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
            }`}
          >
            Programs
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

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              viewMode === 'programs'
                ? 'Search programs...'
                : viewMode === 'referrers'
                ? 'Search referrers...'
                : 'Search referrals...'
            }
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-[#1a1a1a] dark:text-[#f5f5f8]"
          />
        </div>

        {/* Status Filter - only show for referred view */}
        {viewMode === 'referred' && (
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReferralStatus | 'all')}
              className="appearance-none px-4 py-2 pr-10 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-[#1a1a1a] dark:text-[#f5f5f8] cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="rewarded">Rewarded</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] pointer-events-none" />
          </div>
        )}
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
        <div className="space-y-4">
          {/* Programs/Resources sub-toggle */}
          <div className="inline-flex p-0.5 bg-[#f3f1ef] dark:bg-[#1d222b] rounded-full">
            <button
              onClick={() => setProgramsSubFilter('programs')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                programsSubFilter === 'programs'
                  ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
              }`}
            >
              Programs
            </button>
            <button
              onClick={() => setProgramsSubFilter('resources')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                programsSubFilter === 'resources'
                  ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
              }`}
            >
              Resources
            </button>
          </div>

          {filteredConfigs.length === 0 && !configsLoading ? (
            <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
              <Settings className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                {programsSubFilter === 'programs' ? 'No programs found' : 'No resources found'}
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-4">
                {programsSubFilter === 'programs'
                  ? 'Create a program first, then enable referrals'
                  : 'Create a resource first, then enable referrals'}
              </p>
            </div>
          ) : (
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {filteredConfigs.map((config) => (
                <div
                  key={config.targetId}
                  className="p-4 hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Program Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center flex-shrink-0">
                        <Settings className="w-5 h-5 text-[#5f5a55]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                          {config.targetName}
                        </p>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                          {TARGET_TYPE_LABELS[config.targetType] || config.targetType}
                        </p>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {config.referralConfig?.enabled ? (
                        <>
                          {/* Enabled Badge */}
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Enabled
                          </span>

                          {/* Reward */}
                          <div className="text-right">
                            <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                              {getRewardLabel(config.referralConfig)}
                            </p>
                            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                              Reward
                            </p>
                          </div>

                          {/* Copy Link */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLink(config)}
                            className="flex items-center gap-1.5"
                          >
                            {copiedId === config.targetId ? (
                              <>
                                <Check className="w-4 h-4" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copy Link
                              </>
                            )}
                          </Button>

                          {/* Edit */}
                          {!isDemoMode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditConfig(config)}
                              className="text-[#5f5a55]"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Not Enabled */}
                          <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                            Referrals not enabled
                          </span>

                          {/* Enable Button */}
                          {!isDemoMode && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEnableReferrals(config.targetId)}
                              className="flex items-center gap-1.5"
                            >
                              <Plus className="w-4 h-4" />
                              Enable
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Funnel info if enabled */}
                  {config.referralConfig?.enabled && config.funnelName && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Funnel: {config.funnelName}</span>
                    </div>
                  )}
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
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {filteredReferrerSummaries.map((summary) => (
                <div
                  key={summary.referrerId}
                  className="p-4 hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Referrer Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                        {summary.referrerImageUrl ? (
                          <Image
                            src={summary.referrerImageUrl}
                            alt={summary.referrerName}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-semibold text-sm text-[#5f5a55]">
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

                    {/* Stats */}
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {/* Referral Count */}
                      <div className="text-center">
                        <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                          {summary.totalReferrals}
                        </p>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                          referrals
                        </p>
                      </div>

                      {/* Total Earned (only show if > 0) */}
                      {summary.totalEarned > 0 && (
                        <div className="text-center">
                          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(summary.totalEarned)}
                          </p>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                            earned
                          </p>
                        </div>
                      )}

                      {/* Pending Payment (only show if > 0) */}
                      {summary.pendingPayment > 0 && (
                        <div className="text-center">
                          <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                            {formatCurrency(summary.pendingPayment)}
                          </p>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                            pending
                          </p>
                        </div>
                      )}

                      {/* Mark as Paid Button */}
                      {summary.pendingPayment > 0 && !isDemoMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkPaid(summary.referrerId, summary.pendingPayment)}
                          disabled={markingPaid === summary.referrerId}
                          className="flex items-center gap-1.5 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
                        >
                          {markingPaid === summary.referrerId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Mark Paid
                        </Button>
                      )}

                      {/* All paid indicator */}
                      {summary.totalEarned > 0 && summary.pendingPayment === 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          <CheckCircle2 className="w-3 h-3" />
                          Paid
                        </span>
                      )}
                    </div>
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
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {filteredReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="p-4 hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Referrer & Referred User */}
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Referrer */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                          {referral.referrerImageUrl ? (
                            <Image
                              src={referral.referrerImageUrl}
                              alt={referral.referrerName || ''}
                              width={32}
                              height={32}
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
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                            {referral.referrerName || 'Unknown'}
                          </p>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Referrer</p>
                        </div>
                      </div>

                      {/* Arrow */}
                      <span className="text-[#5f5a55] dark:text-[#7d8190] flex-shrink-0">→</span>

                      {/* Referred User */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                          {referral.referredUserImageUrl ? (
                            <Image
                              src={referral.referredUserImageUrl}
                              alt={referral.referredUserName || ''}
                              width={32}
                              height={32}
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
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                            {referral.referredUserName || 'Pending signup...'}
                          </p>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Referred</p>
                        </div>
                      </div>
                    </div>

                    {/* Status & Meta */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {getStatusBadge(referral.status)}
                      {referral.programName && (
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                          {referral.programName}
                        </p>
                      )}
                      {referral.squadName && (
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                          {referral.squadName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Reward Info */}
                  {referral.status === 'rewarded' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                      <Gift className="w-3.5 h-3.5" />
                      <span>{getRewardDescription(referral)}</span>
                      {referral.rewardType === 'monetary' && referral.paymentStatus === 'paid' && (
                        <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          <Check className="w-3 h-3" />
                          Paid
                        </span>
                      )}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="mt-2 text-xs text-[#a7a39e] dark:text-[#7d8190]">
                    {new Date(referral.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
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
