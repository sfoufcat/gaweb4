'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
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
 * Displays the user's standalone squads (not attached to a program).
 * This includes:
 * - Coach-created standalone squads
 * - Alumni squads (converted from program squads)
 * - Peer-created squads
 * 
 * Features:
 * - Squad switcher in title when user has multiple standalone squads
 * - Squad header with name and streak
 * - Coach info (if squad has a coach)
 * - Member list with alignment indicators
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
  const [showSquadSwitcher, setShowSquadSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  
  // Get standalone squad data
  const {
    standaloneSquads,
    activeStandaloneSquad: squad,
    activeStandaloneSquadId,
    setActiveStandaloneSquadId,
    hasStandaloneSquad,
    hasMultipleStandaloneSquads,
    membersBySquad,
    statsBySquad,
    isLoading,
    refetch,
    fetchStatsTabData,
  } = useSquad();
  
  // Get members and stats for the active standalone squad
  const members = squad ? (membersBySquad[squad.id] || []) : [];
  const stats = squad ? (statsBySquad[squad.id] || null) : null;

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Close switcher when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setShowSquadSwitcher(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
  
  // Handle squad switch
  const handleSquadSwitch = (squadId: string) => {
    setActiveStandaloneSquadId(squadId);
    setShowSquadSwitcher(false);
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

  // No standalone squad - show discover page
  if (!hasStandaloneSquad || !squad) {
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
      {/* Page Title with Squad Switcher */}
      <div className="mb-6 relative" ref={switcherRef}>
        {hasMultipleStandaloneSquads ? (
          // Clickable title with dropdown for multiple squads
          <button
            onClick={() => setShowSquadSwitcher(!showSquadSwitcher)}
            className="flex items-center gap-2 group"
          >
            <h1 className="font-albert text-[28px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.2]">
              {squad.name}
            </h1>
            <ChevronDown 
              className={`w-6 h-6 text-text-secondary dark:text-[#7d8190] transition-transform ${
                showSquadSwitcher ? 'rotate-180' : ''
              }`} 
            />
          </button>
        ) : (
          // Static title for single squad
          <h1 className="font-albert text-[28px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.2]">
            {squad.name}
          </h1>
        )}
        
        {/* Squad Switcher Dropdown */}
        {showSquadSwitcher && hasMultipleStandaloneSquads && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#171b22] rounded-xl shadow-lg border border-[#e1ddd8] dark:border-[#262b35] z-50 overflow-hidden">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-medium text-text-secondary dark:text-[#7d8190] uppercase tracking-wide">
                Switch {squadLower}
              </p>
              {standaloneSquads.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSquadSwitch(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    s.id === activeStandaloneSquadId
                      ? 'bg-[#f3f1ef] dark:bg-[#262b35]'
                      : 'hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                  }`}
                >
                  {/* Squad Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#11141b] flex-shrink-0">
                    {s.avatarUrl ? (
                      <Image
                        src={s.avatarUrl}
                        alt={s.name}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-albert font-semibold text-sm text-text-secondary dark:text-[#7d8190]">
                          {s.name[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-albert font-semibold text-[15px] text-text-primary dark:text-[#f5f5f8] truncate">
                      {s.name}
                    </p>
                    <p className="text-xs text-text-secondary dark:text-[#7d8190]">
                      {membersBySquad[s.id]?.length || 0} members
                      {s.hasCoach && ' • Coached'}
                    </p>
                  </div>
                  
                  {/* Active indicator */}
                  {s.id === activeStandaloneSquadId && (
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Squad Header */}
      <div className="mb-6">
        <SquadHeader squad={squad} onSquadUpdated={refetch} />
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
