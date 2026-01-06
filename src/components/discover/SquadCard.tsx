'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Users, User, Star } from 'lucide-react';

/**
 * SquadCard Component
 *
 * Card for displaying squads in horizontal scroll layout.
 * Styled similarly to ProgramCard for visual consistency.
 */

interface SquadCardData {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  coachId?: string;
  coachName?: string;
  coachImageUrl?: string;
  memberCount?: number;
  priceInCents?: number;
  subscriptionEnabled?: boolean;
  billingInterval?: string;
}

interface SquadCardProps {
  squad: SquadCardData;
  variant?: 'default' | 'compact';
  /** When true (default), card uses w-full for grid layouts. Set to false for horizontal scroll carousels. */
  fullWidth?: boolean;
}

export function SquadCard({ squad, variant = 'default', fullWidth = true }: SquadCardProps) {
  const formatPrice = (cents: number) => {
    if (!cents || cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(0)}`;
  };

  const isCoached = !!squad.coachId;
  const isCompact = variant === 'compact';

  // Width classes: fullWidth for grids, fixed width for carousels
  const widthClass = fullWidth
    ? 'w-full'
    : isCompact ? 'w-[200px]' : 'w-[280px]';

  return (
    <Link href={`/discover/squads/${squad.id}`}>
      <div className={`glass-card flex-shrink-0 overflow-hidden cursor-pointer group ${widthClass}`}>
        {/* Cover Image */}
        <div className={`relative w-full overflow-hidden ${
          isCompact ? 'h-[100px]' : 'h-[140px]'
        }`}>
          {squad.avatarUrl ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10" />
              <Image
                src={squad.avatarUrl}
                alt={squad.name}
                fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                sizes={fullWidth ? "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" : isCompact ? "200px" : "280px"}
              />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-accent/15 via-brand-accent/8 to-[#8c6245]/5 dark:from-brand-accent/10 dark:via-brand-accent/5 dark:to-[#8c6245]/3 flex items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-white/50 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Users className="w-6 h-6 text-brand-accent/60" />
              </div>
            </div>
          )}

          {/* Type badge - top left */}
          <div className="absolute top-3 left-3 z-20">
            <span className={`glass-badge px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 ${
              isCoached
                ? 'bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] text-white'
                : 'bg-emerald-500/90 text-white'
            }`}>
              {isCoached ? (
                <>
                  <Star className="w-3 h-3 fill-white" />
                  Coached
                </>
              ) : (
                <>
                  <Users className="w-3 h-3" />
                  Community
                </>
              )}
            </span>
          </div>

          {/* Price badge - top right */}
          <div className="absolute top-3 right-3 z-20">
            <span className="glass-badge px-3 py-1.5 bg-white/90 dark:bg-[#171b22]/90 text-[#1a1a1a] dark:text-[#f5f5f8] text-sm font-bold rounded-full border border-white/50 dark:border-[#ffffff]/[0.08]">
              {formatPrice(squad.priceInCents || 0)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className={`flex flex-col gap-2 ${isCompact ? 'p-3' : 'p-5'}`}>
          {/* Title - fixed height for 2 lines */}
          <h3 className={`font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.3px] leading-tight line-clamp-2 ${
            isCompact ? 'text-sm' : 'text-[17px] h-[2.65em]'
          }`}>
            {squad.name}
          </h3>

          {/* Description - 3 lines max */}
          {!isCompact && (
            <p className="text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed line-clamp-3">
              {squad.description || '\u00A0'}
            </p>
          )}

          {/* Coach and Members row */}
          <div className="flex items-center justify-between">
            {squad.coachName ? (
              <div className="flex items-center gap-2">
                {squad.coachImageUrl ? (
                  <Image
                    src={squad.coachImageUrl}
                    alt={squad.coachName}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-brand-accent/20 dark:bg-brand-accent/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-brand-accent" />
                  </div>
                )}
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  {squad.coachName}
                </span>
              </div>
            ) : (
              <div />
            )}
            {squad.memberCount !== undefined && squad.memberCount > 0 && (
              <span className="meta-pill text-[#5f5a55] dark:text-[#b2b6c2]">
                <Users className="w-3 h-3 text-brand-accent" />
                {squad.memberCount} members
              </span>
            )}
          </div>

          {/* Footer - simple CTA */}
          {!isCompact && (
            <div className="mt-1 pt-3 border-t border-[#e1ddd8]/40 dark:border-[#262b35]/40">
              <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                Join Squad
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
