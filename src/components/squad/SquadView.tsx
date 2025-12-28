'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import type { Squad, SquadMember, SquadStats as SquadStatsType } from '@/types';
import { SquadEmptyState } from '@/components/squad/SquadEmptyState';
import { SquadHeader } from '@/components/squad/SquadHeader';
import { SquadMemberList } from '@/components/squad/SquadMemberList';
import { SquadInviteCards } from '@/components/squad/SquadInviteCards';
import { SquadStats } from '@/components/squad/SquadStats';
import { SquadStreakSheet } from '@/components/squad/SquadStreakSheet';
import { NextSquadCallCard, type CoachInfo } from '@/components/squad/NextSquadCallCard';
import { StandardSquadCallCard } from '@/components/squad/StandardSquadCallCard';
import { useMenuTitles } from '@/contexts/BrandingContext';

/**
 * SquadView Component
 * 
 * Reusable squad view component that can be:
 * - Used in /squad for the current user's squad
 * - Used in /coach for viewing any squad (with squadId prop)
 * 
 * When squadId is provided, fetches that specific squad.
 * When squadId is not provided, fetches the current user's squad.
 */

type TabType = 'squad' | 'stats';

interface SquadViewProps {
  squadId?: string; // Optional: if provided, fetches this specific squad
  showCoachBadge?: boolean; // Show coach badge if current user is the coach
}

interface SquadData {
  squad: Squad | null;
  members: SquadMember[];
  stats: SquadStatsType | null;
}

export function SquadView({ squadId, showCoachBadge = false }: SquadViewProps) {
  const { user, isLoaded: userLoaded } = useUser();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('squad');
  const [showStreakSheet, setShowStreakSheet] = useState(false);
  
  // Get customizable menu titles
  const { squad: squadTitle } = useMenuTitles();
  
  // Squad data state
  const [squadData, setSquadData] = useState<SquadData>({
    squad: null,
    members: [],
    stats: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSquadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // If squadId is provided, fetch that specific squad; otherwise fetch current user's squad
      const endpoint = squadId 
        ? `/api/coach/squads/${squadId}`
        : '/api/squad/me';

      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error('Failed to fetch squad');
      }

      const data = await response.json();
      setSquadData({
        squad: data.squad,
        members: data.members || [],
        stats: data.stats,
      });

    } catch (err) {
      console.error('Error fetching squad:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch squad');
      setSquadData({
        squad: null,
        members: [],
        stats: null,
      });
    } finally {
      setLoading(false);
    }
  }, [squadId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && userLoaded) {
      fetchSquadData();
    }
  }, [mounted, userLoaded, squadId, fetchSquadData]);

  const { squad, members, stats } = squadData;

  // Check if current user is actually the coach of this squad (NOT just admin access)
  const isActualCoach = squad?.coachId === user?.id;

  // Determine if squad has a coach
  const squadHasCoach = !!squad?.coachId;

  // Check if squad is in grace period (has programId AND gracePeriodStartDate)
  const isInGracePeriod = squad?.programId && squad?.gracePeriodStartDate && !squad?.isClosed;

  // State for converting to community
  const [converting, setConverting] = useState(false);
  const [convertSuccess, setConvertSuccess] = useState(false);

  // Handle conversion to community
  const handleConvertToCommunity = async () => {
    if (!squad?.id) return;
    setConverting(true);
    try {
      const response = await fetch(`/api/coach/squads/${squad.id}/convert-to-community`, {
        method: 'POST',
      });
      if (response.ok) {
        setConvertSuccess(true);
        fetchSquadData(); // Refresh squad data
      }
    } catch (error) {
      console.error('Error converting squad:', error);
    } finally {
      setConverting(false);
    }
  };
  
  // Find coach info from members for squads with coaches
  const coachInfo: CoachInfo | undefined = useMemo(() => {
    if (!squadHasCoach || !members.length) return undefined;
    const coach = members.find(m => m.roleInSquad === 'coach');
    if (!coach) return undefined;
    return {
      firstName: coach.firstName,
      lastName: coach.lastName,
      imageUrl: coach.imageUrl,
    };
  }, [squadHasCoach, members]);

  if (!userLoaded || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-center px-4">
        <p className="text-text-secondary">Please sign in to view this squad.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-center px-4">
        <div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchSquadData}
            className="px-4 py-2 bg-[#a07855] text-white rounded-lg hover:bg-[#8c6245] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show empty state if no squad
  if (!squad) {
    return <SquadEmptyState />;
  }

  // Show squad interface
  return (
    <div>
      {/* Header */}
      <div className="mb-6 pt-3">
        <SquadHeader squad={squad} isCoach={isActualCoach} />
        
        {/* Coach Badge - only show if showCoachBadge is true and user is actually the coach */}
        {showCoachBadge && isActualCoach && (
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-[#a07855] to-[#8c6245] text-white shadow-sm">
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              You&apos;re the coach
            </span>
          </div>
        )}
      </div>

      {/* Grace Period Conversion Card - only show to coach when squad is in grace period */}
      {showCoachBadge && isActualCoach && isInGracePeriod && !convertSuccess && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                Program ending soon
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                This squad is in grace period. Convert to a mastermind to keep members connected after the program ends.
              </p>
              <button
                onClick={handleConvertToCommunity}
                disabled={converting}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-albert font-medium transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {converting ? 'Converting...' : 'Convert to Mastermind'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversion Success Message */}
      {convertSuccess && (
        <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-albert font-semibold text-green-800 dark:text-green-200">
                Squad converted to mastermind!
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 font-albert">
                Members can continue connecting in this mastermind.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Squad Call Card - show coach-scheduled or member-proposed based on hasCoach */}
      {squadHasCoach ? (
        <NextSquadCallCard 
          squad={squad} 
          isCoach={showCoachBadge && isActualCoach}
          onCallUpdated={fetchSquadData}
          coachInfo={coachInfo}
        />
      ) : (
        <StandardSquadCallCard 
          squad={squad}
          onCallUpdated={fetchSquadData}
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
        <div>
          {/* Member List */}
          <SquadMemberList members={members} />

          {/* Invite Cards - only show in non-coach view */}
          {!squadId && (
            <SquadInviteCards 
              hasCoach={squadHasCoach} 
              inviteCode={squad.inviteCode}
              squadName={squad.name}
              visibility={squad.visibility}
              memberCount={members.length}
            />
          )}
        </div>
      ) : (
        <div>
          {/* Stats Tab */}
          {stats && (
            <SquadStats 
              stats={stats} 
              onOpenStreakInfo={() => setShowStreakSheet(true)}
            />
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

