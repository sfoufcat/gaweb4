'use client';

import Image from 'next/image';
import { Clock, Users, Star } from 'lucide-react';
import type { Squad } from '@/types';

/**
 * SquadCard Component
 * 
 * Card displaying a public squad in the discovery grid.
 * Shows avatar, name, timezone, member count, and join button.
 * Premium squads show a star badge and coach info.
 */

interface CoachInfo {
  id: string;
  name: string;
  imageUrl: string;
}

interface PublicSquad extends Squad {
  memberCount: number;
  memberAvatars: string[];
  coach?: CoachInfo | null;
}

interface SquadCardProps {
  squad: PublicSquad;
  onJoin: () => void;
  isJoining?: boolean;
  trackLabel?: string; // Optional track label to display as badge
}

// Format timezone for display (e.g., "Europe/Amsterdam" -> "Amsterdam")
function formatTimezone(tz: string): string {
  try {
    // Extract city name from timezone
    const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
    return city;
  } catch {
    return tz;
  }
}

export function SquadCard({ squad, onJoin, isJoining, trackLabel }: SquadCardProps) {
  return (
    <div className="group bg-white border border-[#e1ddd8]/50 rounded-[20px] p-5 hover:shadow-lg hover:border-brand-accent/30 transition-all duration-300">
      {/* Header Row */}
      <div className="flex items-start gap-4 mb-4">
        {/* Squad Avatar */}
        {squad.avatarUrl ? (
          <Image 
            src={squad.avatarUrl} 
            alt={squad.name}
            width={56}
            height={56}
            className="w-14 h-14 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-accent to-[#8c6245] dark:from-[#b8896a] dark:to-brand-accent flex items-center justify-center flex-shrink-0">
            <span className="text-white font-albert font-bold text-[20px]">
              {squad.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Name & Description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] truncate">
              {squad.name}
            </h3>
            {/* Coached Badge */}
            {!!squad.coachId && (
              <div className="flex items-center gap-1 bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 rounded-full px-2 py-0.5 flex-shrink-0">
                <Star className="w-3 h-3 text-[#FF6B6B] fill-[#FF6B6B]" />
                <span className="font-albert text-[11px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                  Coached
                </span>
              </div>
            )}
            {/* Track Badge */}
            {trackLabel && (
              <span className="px-2 py-0.5 bg-brand-accent/10 text-brand-accent rounded-full text-[11px] font-albert font-medium flex-shrink-0">
                {trackLabel}
              </span>
            )}
          </div>
          {squad.description && (
            <p className="font-albert text-[14px] text-text-secondary line-clamp-2">
              {squad.description}
            </p>
          )}
        </div>
      </div>

      {/* Coach Row (for coached squads) */}
      {!!squad.coachId && squad.coach && (
        <div className="flex items-center gap-2 mb-3">
          <span className="font-albert text-[12px] text-text-secondary">Coach:</span>
          <div className="flex items-center gap-1.5">
            <span className="font-albert text-[13px] font-medium text-text-primary">
              {squad.coach.name}
            </span>
            {squad.coach.imageUrl ? (
              <Image 
                src={squad.coach.imageUrl} 
                alt={squad.coach.name}
                width={24}
                height={24}
                className="w-6 h-6 rounded-full object-cover border border-[#FF6B6B]/30"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FF8A65] to-[#FF6B6B] flex items-center justify-center">
                <span className="text-white font-albert font-bold text-[10px]">
                  {squad.coach.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Member Avatars Row */}
      {squad.memberAvatars.length > 0 && (
        <div className="flex items-center mb-4">
          <div className="flex items-center -space-x-2">
            {squad.memberAvatars.slice(0, 4).map((avatar, idx) => (
              <div
                key={idx}
                className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-[#e1ddd8]"
              >
                {avatar ? (
                  <Image 
                    src={avatar} 
                    alt="" 
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-brand-accent/20 flex items-center justify-center text-brand-accent text-[10px] font-bold">
                    ?
                  </div>
                )}
              </div>
            ))}
            {squad.memberCount > 4 && (
              <div className="w-8 h-8 rounded-full border-2 border-white bg-[#faf8f6] flex items-center justify-center">
                <span className="font-albert text-[11px] text-text-secondary font-medium">
                  +{squad.memberCount - 4}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Row: Info + Join Button */}
      <div className="flex items-center justify-between">
        {/* Timezone & Member Count */}
        <div className="flex items-center gap-3 text-text-secondary">
          {/* Timezone */}
          <div className="flex items-center gap-1.5 text-[13px] font-albert">
            <Clock className="w-4 h-4" />
            <span className="truncate max-w-[100px]">{formatTimezone(squad.timezone || 'UTC')}</span>
          </div>

          {/* Member Count */}
          <div className="flex items-center gap-1.5 text-[13px] font-albert">
            <Users className="w-4 h-4" />
            <span>{squad.memberCount}</span>
          </div>
        </div>

        {/* Join Button */}
        <button
          onClick={onJoin}
          disabled={isJoining}
          className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 disabled:bg-brand-accent/50 text-white rounded-[12px] font-albert font-semibold text-[14px] transition-all hover:scale-[1.02] disabled:scale-100"
        >
          {isJoining ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Joining...
            </span>
          ) : (
            'Join squad'
          )}
        </button>
      </div>
    </div>
  );
}

