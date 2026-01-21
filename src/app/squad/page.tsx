'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSquad } from '@/hooks/useSquad';
import { SquadHeader } from '@/components/squad/SquadHeader';
import { SquadMemberList } from '@/components/squad/SquadMemberList';
import { SquadInviteCards } from '@/components/squad/SquadInviteCards';
import { SquadStats } from '@/components/squad/SquadStats';
import { SquadStreakSheet } from '@/components/squad/SquadStreakSheet';
import { StandardSquadCallCard } from '@/components/squad/StandardSquadCallCard';
import { NextSquadCallCard, type CoachInfo } from '@/components/squad/NextSquadCallCard';
import { SquadDiscovery } from '@/components/squad/SquadDiscovery';
import { useMenuTitles } from '@/contexts/BrandingContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useShouldRedirectToCoach } from '@/contexts/ViewModeContext';
import { DEMO_USER } from '@/lib/demo-utils';
import type { ReferralConfig } from '@/types';

/**
 * Standalone Squad Page
 *
 * Displays the user's standalone squads (not attached to a program).
 * Program-linked squads are accessed through the Program page instead.
 * This includes:
 * - Coach-created standalone squads
 * - Alumni squads (converted from program squads)
 * - Peer-created squads
 *
 * Features:
 * - Squad switcher in SquadHeader when user has multiple standalone squads
 * - Squad header with name and streak
 * - Coach info (if squad has a coach)
 * - Member list with alignment indicators
 * - Squad stats tab
 * - Chat and invite functionality
 */

type TabType = 'squad' | 'stats';

export default function StandaloneSquadPage() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { squad: squadTitle, squadLower } = useMenuTitles();
  const { isDemoMode } = useDemoMode();
  const { shouldRedirect: shouldRedirectToCoach } = useShouldRedirectToCoach();

  // Redirect coaches to coach dashboard squads tab
  useEffect(() => {
    if (shouldRedirectToCoach) {
      router.replace('/coach?tab=squads');
    }
  }, [shouldRedirectToCoach, router]);

  // In demo mode, use mock user data
  const user = useMemo(() => {
    if (isDemoMode) {
      return {
        id: DEMO_USER.id,
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
        imageUrl: DEMO_USER.imageUrl,
      };
    }
    return clerkUser;
  }, [isDemoMode, clerkUser]);

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('squad');
  const [showStreakSheet, setShowStreakSheet] = useState(false);

  // Get standalone squad data
  const {
    standaloneSquads,
    activeStandaloneSquad: squad,
    activeStandaloneSquadId,
    setActiveStandaloneSquadId,
    hasStandaloneSquad,
    membersBySquad,
    statsBySquad,
    discoverySquads,
    isLoading,
    refetch,
    fetchStatsTabData,
  } = useSquad();

  // Get members and stats for the active standalone squad
  const members = squad ? (membersBySquad[squad.id] || []) : [];
  const stats = squad ? (statsBySquad[squad.id] || null) : null;

  // Build member counts by squad for the switcher dropdown
  const memberCountsBySquad = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of standaloneSquads) {
      counts[s.id] = membersBySquad[s.id]?.length || 0;
    }
    return counts;
  }, [standaloneSquads, membersBySquad]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle squadId from URL query parameter
  useEffect(() => {
    const squadIdFromUrl = searchParams.get('squadId');
    if (squadIdFromUrl && standaloneSquads.length > 0) {
      // Check if the squadId from URL is valid (exists in user's squads)
      const validSquad = standaloneSquads.find(s => s.id === squadIdFromUrl);
      if (validSquad) {
        setActiveStandaloneSquadId(squadIdFromUrl);
      }
    }
  }, [searchParams, standaloneSquads, setActiveStandaloneSquadId]);

  // Load stats when switching to stats tab
  useEffect(() => {
    if (activeTab === 'stats' && mounted) {
      fetchStatsTabData();
    }
  }, [activeTab, mounted, fetchStatsTabData]);

  // Find coach info from members
  const coachInfo: CoachInfo | undefined = useMemo(() => {
    if (!squad || !members.length) return undefined;
    const coach = members.find(m => m.roleInSquad === 'coach');
    if (!coach) return undefined;
    return {
      firstName: coach.firstName,
      lastName: coach.lastName,
      imageUrl: coach.imageUrl,
    };
  }, [squad, members]);

  // Check if current user is the coach
  const isCoach = squad?.coachId === user?.id;

  // Get members who have shared their mood
  const membersWithMood = members.filter(m => m.moodState);

  // Mood emoji mapping
  const moodEmojis: Record<string, string> = {
    energized: '🔥',
    confident: '😊',
    neutral: '😐',
    uncertain: '😕',
    stuck: '😔',
  };

  // Handle squad switch (passed to SquadHeader)
  const handleSquadSwitch = (squadId: string) => {
    setActiveStandaloneSquadId(squadId);
  };

  // Fetch program's referralConfig if squad belongs to a program
  const [referralConfig, setReferralConfig] = useState<ReferralConfig | undefined>(undefined);

  useEffect(() => {
    const fetchReferralConfig = async () => {
      if (!squad?.programId) {
        setReferralConfig(undefined);
        return;
      }

      try {
        const response = await fetch(`/api/programs/${squad.programId}`);
        if (response.ok) {
          const data = await response.json();
          setReferralConfig(data.program?.referralConfig);
        }
      } catch (err) {
        console.error('Failed to fetch program referral config:', err);
      }
    };

    fetchReferralConfig();
  }, [squad?.programId]);

  // No user - show sign in message
  if (mounted && (isDemoMode || userLoaded) && !user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-center px-4">
        <p className="text-text-secondary">Please sign in to view your squad.</p>
      </div>
    );
  }

  // Show loading state while checking for squads
  // This prevents the "No squads available yet" flash
  // Also wait for Clerk to fully load to avoid brief empty state flash on navigation
  // Without this, there's a timing issue where isLoading is false (cached data)
  // but userLoaded is false (Clerk still initializing), causing empty state to flash
  if (isLoading || (!isDemoMode && !userLoaded)) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pt-6">
        <div className="mb-8">
          <div className="h-10 w-48 bg-surface animate-pulse rounded-lg mb-2" />
          <div className="h-5 w-96 bg-surface animate-pulse rounded-lg" />
        </div>
        <div className="space-y-4">
          <div className="h-48 bg-surface animate-pulse rounded-[20px]" />
          <div className="h-48 bg-surface animate-pulse rounded-[20px]" />
        </div>
      </div>
    );
  }

  // No standalone squad - show squad discovery page
  if (!hasStandaloneSquad || !squad) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16">
        <SquadDiscovery discoverySquads={discoverySquads} />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="font-albert font-normal text-4xl text-text-primary tracking-[-2px] leading-[1.2]">
          {squadTitle}
        </h1>
      </div>

      {/* Squad Header with switcher dropdown (when multiple squads) */}
      <div className="mb-6">
        <SquadHeader
          squad={squad}
          onSquadUpdated={refetch}
          isCoach={isCoach}
          standaloneSquads={standaloneSquads}
          activeSquadId={activeStandaloneSquadId ?? undefined}
          onSquadSwitch={handleSquadSwitch}
          memberCountsBySquad={memberCountsBySquad}
        />
      </div>

      {/* Squad Call Card */}
      {!!squad.coachId ? (
        <NextSquadCallCard
          squad={squad}
          isCoach={isCoach}
          onCallUpdated={refetch}
          coachInfo={coachInfo}
        />
      ) : (
        <StandardSquadCallCard
          squad={squad}
          onCallUpdated={refetch}
        />
      )}

      {/* Tab Bar */}
      <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('squad')}
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
            <span>{squadTitle}</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
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
        <div className="space-y-5">
          {/* Mood Bars Section */}
          {membersWithMood.length > 0 && (
            <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 space-y-4">
              <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1px]">
                How the {squadLower} is feeling
              </h3>

              <div className="space-y-3">
                {membersWithMood.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    {/* Member Avatar */}
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                      {member.imageUrl ? (
                        <Image
                          src={member.imageUrl}
                          alt={member.firstName}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="font-albert font-semibold text-xs text-text-secondary dark:text-[#7d8190]">
                            {member.firstName[0]}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Member Name */}
                    <span className="font-sans text-[14px] text-text-primary dark:text-[#f5f5f8] flex-shrink-0 w-20 truncate">
                      {member.firstName}
                    </span>

                    {/* Mood Bar */}
                    <div className="flex-1 h-3 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          member.moodState === 'energized' ? 'bg-[#4caf50] w-full' :
                          member.moodState === 'confident' ? 'bg-[#8bc34a] w-4/5' :
                          member.moodState === 'neutral' ? 'bg-[#ffeb3b] w-3/5' :
                          member.moodState === 'uncertain' ? 'bg-[#ff9800] w-2/5' :
                          'bg-[#f44336] w-1/5'
                        }`}
                      />
                    </div>

                    {/* Mood Emoji */}
                    <span className="text-lg flex-shrink-0">
                      {moodEmojis[member.moodState || 'neutral']}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Squad Members */}
          <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
            <SquadMemberList members={members} />
          </div>

          {/* Invite Cards */}
          <SquadInviteCards
            hasCoach={!!squad.coachId}
            inviteCode={squad.inviteCode}
            squadName={squad.name}
            visibility={squad.visibility}
            memberCount={members.length}
            onLeaveSquad={refetch}
            squadId={squad.id}
            programId={squad.programId || undefined}
            referralConfig={referralConfig}
          />
        </div>
      ) : (
        <div>
          {/* Stats Tab */}
          {stats ? (
            <SquadStats
              stats={stats}
              onOpenStreakInfo={() => setShowStreakSheet(true)}
            />
          ) : (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
            </div>
          )}
        </div>
      )}

      {/* Squad Streak Bottom Sheet */}
      <SquadStreakSheet
        isOpen={showStreakSheet}
        onClose={() => setShowStreakSheet(false)}
      />
    </div>
  );
}
