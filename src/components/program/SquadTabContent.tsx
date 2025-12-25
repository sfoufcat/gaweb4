'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSquad } from '@/hooks/useSquad';
import { SquadHeader } from '@/components/squad/SquadHeader';
import { SquadMemberList } from '@/components/squad/SquadMemberList';
import { SquadInviteCards } from '@/components/squad/SquadInviteCards';
import { useMenuTitles } from '@/contexts/BrandingContext';

/**
 * SquadTabContent Component
 * 
 * Matches Figma design for Squad tab.
 * Self-sufficient component that fetches its own data.
 * Shows:
 * - Squad header (avatar, name, streak gauge)
 * - Coach row with avatar and info
 * - Mood bars section (if members have moods)
 * - Squad members list
 * - "View squad stats" button (links to separate screen)
 * - "Go to chat" button
 * - Invite friends cards
 * 
 * NOTE: Squad stats are on a separate screen accessed via button.
 */

export function SquadTabContent() {
  const router = useRouter();
  const { squad: squadTitle, squadLower } = useMenuTitles();

  // Fetch squad data internally
  const {
    squad,
    members,
    isLoading,
    refetch: onRefetch,
  } = useSquad();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

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

  // Get members who have shared their mood
  const membersWithMood = members.filter(m => m.moodState);

  // Mood emoji mapping (based on MoodState type: 'energized' | 'confident' | 'neutral' | 'uncertain' | 'stuck')
  const moodEmojis: Record<string, string> = {
    energized: '🔥',
    confident: '😊',
    neutral: '😐',
    uncertain: '😕',
    stuck: '😔',
  };

  return (
    <div className="space-y-5 px-4">
      {/* Squad Header */}
      <SquadHeader squad={squad} onSquadUpdated={onRefetch} />

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

      {/* View Squad Stats Button */}
      <button
        onClick={() => router.push('/program/squad-stats')}
        className="w-full bg-white dark:bg-[#171b22] border border-[rgba(215,210,204,0.5)] rounded-[32px] px-4 py-4 font-bold text-[16px] text-[#2c2520] dark:text-[#f5f5f8] leading-[1.4] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.1)] hover:shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        View {squadLower} stats
      </button>

      {/* Invite Cards */}
      <SquadInviteCards
        hasCoach={!!squad.coachId}
        inviteCode={squad.inviteCode}
        squadName={squad.name}
        visibility={squad.visibility}
        memberCount={members.length}
        onLeaveSquad={onRefetch}
      />
    </div>
  );
}
