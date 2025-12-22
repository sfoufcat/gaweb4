'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Squad, SquadMember, SquadStats as SquadStatsType } from '@/types';
import { SquadHeader } from '@/components/squad/SquadHeader';
import { SquadMemberList } from '@/components/squad/SquadMemberList';
import { SquadInviteCards } from '@/components/squad/SquadInviteCards';
import { useMenuTitles } from '@/contexts/BrandingContext';

/**
 * SquadTabContent Component
 * 
 * Content for the Squad tab in ProgramHub.
 * Shows:
 * - Squad header (avatar, name, streak gauge)
 * - Squad members list
 * - "View squad stats" button (links to separate screen)
 * - Invite friends cards
 * 
 * NOTE: Squad stats are NO LONGER in a pill switcher.
 * They are on a separate screen accessed via button.
 */

interface SquadTabContentProps {
  squad: Squad | null;
  members: SquadMember[];
  stats: SquadStatsType | null;
  isLoadingStats: boolean;
  onRefetch: () => void;
}

export function SquadTabContent({
  squad,
  members,
  stats,
  isLoadingStats,
  onRefetch,
}: SquadTabContentProps) {
  const router = useRouter();
  const { squad: squadTitle, squadLower } = useMenuTitles();

  // Empty state - squad not available yet
  if (!squad) {
    return (
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
          {squadTitle} not available yet
        </h2>

        <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5] text-center max-w-sm">
          Your {squadLower} will be created once your program starts. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Squad Header */}
      <SquadHeader squad={squad} onSquadUpdated={onRefetch} />

      {/* Squad Members */}
      <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
        <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1px] mb-4">
          Members
        </h3>
        <SquadMemberList members={members} isPremium={squad.isPremium} />
      </div>

      {/* View Squad Stats Button */}
      <button
        onClick={() => router.push('/program/squad-stats')}
        className="w-full bg-[#f3f1ef] dark:bg-[#11141b] text-text-primary dark:text-[#f5f5f8] rounded-[16px] p-4 flex items-center justify-between hover:bg-[#e9e5e0] dark:hover:bg-[#1d222b] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-[#171b22] flex items-center justify-center">
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="text-left">
            <p className="font-albert text-[16px] font-semibold tracking-[-0.5px]">
              View {squadLower} stats
            </p>
            <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
              Alignment scores, contribution grid & more
            </p>
          </div>
        </div>
        <svg
          className="w-5 h-5 text-text-secondary dark:text-[#7d8190]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Go to Chat Button */}
      {squad.chatChannelId && (
        <button
          onClick={() => router.push(`/chat?channel=${squad.chatChannelId}`)}
          className="w-full bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#05070b] rounded-[32px] px-6 py-4 font-bold text-[16px] leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
        isPremium={squad.isPremium}
        inviteCode={squad.inviteCode}
        squadName={squad.name}
        visibility={squad.visibility}
        memberCount={members.length}
        onLeaveSquad={onRefetch}
      />
    </div>
  );
}

