'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSquad } from '@/hooks/useSquad';
import { SquadHeader } from '@/components/squad/SquadHeader';
import { SquadMemberList } from '@/components/squad/SquadMemberList';
import { SquadInviteCards } from '@/components/squad/SquadInviteCards';
import { SquadStats } from '@/components/squad/SquadStats';
import { SquadStreakSheet } from '@/components/squad/SquadStreakSheet';
import { StandardSquadCallCard } from '@/components/squad/StandardSquadCallCard';
import { NextSquadCallCard, type CoachInfo } from '@/components/squad/NextSquadCallCard';
import { useMenuTitles } from '@/contexts/BrandingContext';

/**
 * Standalone Squad Page
 * 
 * Displays the user's standard (non-program) squad.
 * This page is shown when a user has a coach-created standalone squad
 * but no program enrollment.
 * 
 * Features:
 * - Squad header with name and streak
 * - Coach info (if squad has a coach)
 * - Member list with mood indicators
 * - Squad stats tab
 * - Chat and invite functionality
 */

type TabType = 'squad' | 'stats';

export default function StandaloneSquadPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();
  const { squad: squadTitle, squadLower } = useMenuTitles();
  
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('squad');
  const [showStreakSheet, setShowStreakSheet] = useState(false);
  
  // Get standard squad data specifically
  const {
    standardSquad: squad,
    standardMembers: members,
    standardStats: stats,
    isLoading,
    refetch,
    fetchStatsTabData,
  } = useSquad();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Loading state
  if (!mounted || !userLoaded || isLoading) {
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

  // No standard squad - this shouldn't happen if navigation is correct
  // but handle gracefully by redirecting to discover
  if (!squad) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-24 h-24 rounded-full bg-[#f3f1ef] dark:bg-[#171b22] flex items-center justify-center mb-6">
            <svg
              className="w-12 h-12 text-text-secondary dark:text-[#7d8190]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
          </div>

          <h2 className="font-albert text-[24px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3] text-center mb-3">
            No {squadLower} found
          </h2>

          <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5] text-center max-w-sm mb-6">
            You&apos;re not currently part of a {squadLower}. Discover programs to join one!
          </p>

          <button
            onClick={() => router.push('/discover')}
            className="px-6 py-3 bg-[#a07855] hover:bg-[#8c6245] text-white rounded-full font-albert font-semibold transition-colors"
          >
            Discover Programs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="font-albert text-[28px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.2]">
          {squadTitle}
        </h1>
      </div>

      {/* Squad Header */}
      <div className="mb-6">
        <SquadHeader squad={squad} onSquadUpdated={refetch} />
      </div>

      {/* Squad Call Card */}
      {(squad.hasCoach ?? squad.isPremium) ? (
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

      {/* Coach Row (if squad has a coach) */}
      {coachInfo && (
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 mb-6">
          <div className="flex items-center gap-3">
            {/* Coach Avatar */}
            <div className="w-[48px] h-[48px] rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
              {coachInfo.imageUrl ? (
                <Image
                  src={coachInfo.imageUrl}
                  alt={`${coachInfo.firstName} ${coachInfo.lastName}`}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="font-albert font-semibold text-lg text-text-secondary dark:text-[#7d8190]">
                    {coachInfo.firstName[0]}
                  </span>
                </div>
              )}
            </div>

            {/* Coach Info */}
            <div className="flex-1">
              <p className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3]">
                {coachInfo.firstName} {coachInfo.lastName}
              </p>
              <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                {squadTitle} Coach
              </p>
            </div>

            {/* Message Button */}
            <button
              onClick={() => router.push('/chat')}
              className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#11141b] flex items-center justify-center hover:bg-[#e9e5e0] dark:hover:bg-[#1d222b] transition-colors"
            >
              <svg
                className="w-5 h-5 text-text-primary dark:text-[#f5f5f8]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
            </button>
          </div>
        </div>
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
            <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1px] mb-4">
              Members ({members.length})
            </h3>
            <SquadMemberList members={members} hasCoach={squad.hasCoach ?? squad.isPremium} />
          </div>

          {/* Go to Chat Button */}
          {squad.chatChannelId && (
            <button
              onClick={() => router.push(`/chat?channel=${squad.chatChannelId}`)}
              className="w-full bg-[#a07855] border border-[rgba(215,210,204,0.5)] rounded-[32px] px-4 py-4 font-bold text-[16px] text-white leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
              Go to {squadLower} chat
            </button>
          )}

          {/* Invite Cards */}
          <SquadInviteCards
            hasCoach={squad.hasCoach ?? squad.isPremium}
            inviteCode={squad.inviteCode}
            squadName={squad.name}
            visibility={squad.visibility}
            memberCount={members.length}
            onLeaveSquad={refetch}
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
