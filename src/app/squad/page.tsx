'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSquad } from '@/hooks/useSquad';
import { SquadEmptyState } from '@/components/squad/SquadEmptyState';
import { SquadDiscovery } from '@/components/squad/SquadDiscovery';
import { SquadHeader } from '@/components/squad/SquadHeader';
import { SquadMemberList } from '@/components/squad/SquadMemberList';
import { SquadInviteCards } from '@/components/squad/SquadInviteCards';
import { SquadStats } from '@/components/squad/SquadStats';
import { SquadStreakSheet } from '@/components/squad/SquadStreakSheet';
import { SquadSwitcher } from '@/components/squad/SquadSwitcher';
import { UpgradeSquadChoiceModal } from '@/components/squad/UpgradeSquadChoiceModal';
import { NextSquadCallCard, type CoachInfo } from '@/components/squad/NextSquadCallCard';
import { StandardSquadCallCard } from '@/components/squad/StandardSquadCallCard';

/**
 * Squad Page
 * 
 * Main squad page with:
 * - Empty state if user not in squad
 * - Squad switcher for users with dual membership (premium + standard)
 * - Squad header with avatar, name, and stats
 * - Tab bar (Squad / Stats)
 * - Squad tab: member list + invite cards
 * - Stats tab: alignment score + contribution grid
 * - Squad streak bottom sheet modal
 * 
 * DUAL SQUAD SUPPORT:
 * - Premium users can be in both a premium and standard squad
 * - Shows a switcher at top when user has both squads
 * - Premium squad shown first by default
 * 
 * PERFORMANCE OPTIMIZED:
 * - Basic squad data loads instantly
 * - Stats tab data (percentile, contribution history) is lazy-loaded
 *   when user switches to the Stats tab
 */

type TabType = 'squad' | 'stats';

export default function SquadPage() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('squad');
  const [showStreakSheet, setShowStreakSheet] = useState(false);
  const [showUpgradeChoiceModal, setShowUpgradeChoiceModal] = useState(false);

  // Use squad hook for data fetching with lazy loading for stats
  const { 
    // Active squad (based on activeSquadType)
    squad, 
    members, 
    stats,
    // Both squads for dual membership
    premiumSquad,
    premiumMembers,
    standardSquad,
    standardMembers,
    // Squad type switching
    activeSquadType,
    setActiveSquadType,
    // Convenience flags
    hasBothSquads,
    hasPremiumSquad,
    hasStandardSquad,
    // Loading states
    isLoading: loading, 
    isLoadingStats,
    isLoadingMoreContributions,
    hasMoreContributions,
    // Actions
    fetchStatsTabData,
    loadMoreContributions,
    refetch,
  } = useSquad();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if we just joined a squad - force refetch to get fresh data
  useEffect(() => {
    const justJoined = searchParams.get('joined') === 'true';
    if (justJoined && mounted) {
      // Remove the query param from URL (clean up)
      router.replace('/squad', { scroll: false });
      // Refetch squad data to get the newly joined squad
      refetch();
    }
  }, [searchParams, mounted, refetch, router]);

  // Check if user just upgraded to premium - show squad choice modal
  useEffect(() => {
    const justUpgraded = searchParams.get('upgraded') === 'true';
    // Show modal if:
    // - User just upgraded
    // - User has a standard squad
    // - User doesn't have a premium squad yet
    // - Component is mounted and data is loaded
    if (justUpgraded && mounted && !loading && hasStandardSquad && !hasPremiumSquad && standardSquad) {
      // Remove the query param from URL (clean up)
      router.replace('/squad', { scroll: false });
      // Show the upgrade choice modal
      setShowUpgradeChoiceModal(true);
    }
  }, [searchParams, mounted, loading, hasStandardSquad, hasPremiumSquad, standardSquad, router]);

  // Find coach info from members for premium squads
  const coachInfo: CoachInfo | undefined = useMemo(() => {
    if (!squad?.isPremium || !members.length) return undefined;
    const coach = members.find(m => m.roleInSquad === 'coach');
    if (!coach) return undefined;
    return {
      firstName: coach.firstName,
      lastName: coach.lastName,
      imageUrl: coach.imageUrl,
    };
  }, [squad?.isPremium, members]);

  // Handle tab change - lazy load stats data when switching to stats tab
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'stats') {
      // Lazy load the expensive stats data
      fetchStatsTabData();
    }
  }, [fetchStatsTabData]);

  // Handle squad type switch - reset to squad tab
  const handleSquadSwitch = useCallback((type: 'premium' | 'standard') => {
    setActiveSquadType(type);
    setActiveTab('squad'); // Reset to squad tab when switching
  }, [setActiveSquadType]);

  if (!isLoaded || !mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-center px-4">
        <p className="text-text-secondary">Please sign in to view your squad.</p>
      </div>
    );
  }

  // Check if user is in discovery mode (e.g., from "Find premium squads" link)
  const discoverMode = searchParams.get('discover');
  
  // Show discovery view when explicitly requested (e.g., premium user wants to find premium squads)
  if (discoverMode === 'premium') {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32">
        {/* Back button to return to squad view */}
        {(squad || premiumSquad || standardSquad) && (
          <button
            onClick={() => router.push('/squad')}
            className="flex items-center gap-2 mb-6 pt-3 text-text-secondary hover:text-text-primary transition-colors font-albert text-[15px]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to my squad</span>
          </button>
        )}
        <SquadDiscovery />
      </div>
    );
  }

  // Show empty state if user not in any squad
  if (!squad && !premiumSquad && !standardSquad) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32">
        <SquadEmptyState />
      </div>
    );
  }

  // Show squad interface
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32">
      {/* Squad Switcher - Only show when user has both squads */}
      {hasBothSquads && premiumSquad && standardSquad && activeSquadType && (
        <div className="pt-3">
          <SquadSwitcher
            premiumSquad={premiumSquad}
            standardSquad={standardSquad}
            activeType={activeSquadType}
            onSwitch={handleSquadSwitch}
          />
        </div>
      )}

      {/* Header - only show if we have an active squad */}
      {squad && (
        <>
          <div className={hasBothSquads ? 'mb-6' : 'mb-6 pt-3'}>
            <SquadHeader squad={squad} />
          </div>

          {/* Squad Call Card */}
          {squad.isPremium ? (
            <NextSquadCallCard squad={squad} coachInfo={coachInfo} />
          ) : (
            <StandardSquadCallCard squad={squad} />
          )}

          {/* Tab Bar */}
          <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2 mb-6">
            <button
              onClick={() => handleTabChange('squad')}
              className={`flex-1 rounded-[32px] px-4 py-2 font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] transition-all duration-200 ${
                activeTab === 'squad'
                  ? 'bg-white dark:bg-[#171b22] text-text-primary dark:text-[#f5f5f8] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
                  : 'text-text-secondary dark:text-[#7d8190]'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Squad</span>
              </div>
            </button>
            <button
              onClick={() => handleTabChange('stats')}
              className={`flex-1 rounded-[32px] px-4 py-2 font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] transition-all duration-200 ${
                activeTab === 'stats'
                  ? 'bg-white dark:bg-[#171b22] text-text-primary dark:text-[#f5f5f8] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
                  : 'text-text-secondary dark:text-[#7d8190]'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Stats</span>
              </div>
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'squad' ? (
            <div>
              {/* Member List */}
              <SquadMemberList members={members} isPremium={squad.isPremium} />

              {/* Invite Cards - pass premium status and whether user has premium squad */}
              <SquadInviteCards 
                isPremium={squad.isPremium} 
                inviteCode={squad.inviteCode}
                hasPremiumSquad={hasPremiumSquad}
                hasStandardSquad={hasStandardSquad}
              />
            </div>
          ) : (
            <div>
              {/* Stats Tab */}
              {stats && (
                <SquadStats 
                  stats={stats} 
                  isLoadingExtras={isLoadingStats}
                  isLoadingMoreContributions={isLoadingMoreContributions}
                  hasMoreContributions={hasMoreContributions}
                  onOpenStreakInfo={() => setShowStreakSheet(true)}
                  onLoadMore={loadMoreContributions}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Squad Streak Bottom Sheet */}
      <SquadStreakSheet 
        isOpen={showStreakSheet}
        onClose={() => setShowStreakSheet(false)}
      />

      {/* Upgrade Squad Choice Modal - shown after premium upgrade for users with standard squad */}
      {standardSquad && (
        <UpgradeSquadChoiceModal
          open={showUpgradeChoiceModal}
          onClose={() => setShowUpgradeChoiceModal(false)}
          currentSquad={standardSquad}
          onChoiceMade={(choice) => {
            console.log('User chose:', choice);
            // Refetch squad data after choice is made
            refetch();
          }}
        />
      )}
    </div>
  );
}
