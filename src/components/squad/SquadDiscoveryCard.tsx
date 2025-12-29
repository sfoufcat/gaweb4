'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Users, User, Star, Repeat } from 'lucide-react';

/**
 * SquadDiscoveryCard Component
 * 
 * Card for displaying squads in the discovery grid.
 * Styled similarly to ProgramCard for visual consistency.
 */

interface DiscoverSquadData {
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
  visibility?: string;
}

interface SquadDiscoveryCardProps {
  squad: DiscoverSquadData;
}

export function SquadDiscoveryCard({ squad }: SquadDiscoveryCardProps) {
  const formatPrice = (cents: number, interval?: string) => {
    if (!cents || cents === 0) return 'Free';
    const amount = `$${(cents / 100).toFixed(0)}`;
    if (interval === 'monthly') return `${amount}/mo`;
    if (interval === 'quarterly') return `${amount}/qtr`;
    if (interval === 'yearly') return `${amount}/yr`;
    return amount;
  };

  const isCoached = !!squad.coachId;

  return (
    <Link href={`/discover/squads/${squad.id}`}>
      <div className="bg-white/70 dark:bg-[#171b22] rounded-[20px] w-full hover:shadow-lg dark:hover:shadow-black/30 transition-all cursor-pointer overflow-hidden group border border-[#e1ddd8]/50 dark:border-[#262b35]">
        {/* Cover Image */}
        <div className="relative w-full h-[140px] bg-gradient-to-br from-brand-accent/20 to-[#8c6245]/10 dark:from-brand-accent/10 dark:to-[#8c6245]/5">
          {squad.avatarUrl ? (
            <Image
              src={squad.avatarUrl}
              alt={squad.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="280px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Users className="w-10 h-10 text-brand-accent/40" />
            </div>
          )}
          
          {/* Type badge */}
          <div className="absolute top-2 left-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 backdrop-blur-sm ${
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

          {/* Price badge */}
          <div className="absolute bottom-2 right-2">
            <span className="px-2 py-1 bg-white/90 dark:bg-[#171b22]/90 text-[#1a1a1a] dark:text-[#f5f5f8] text-sm font-semibold rounded-full backdrop-blur-sm">
              {formatPrice(squad.priceInCents || 0, squad.subscriptionEnabled ? squad.billingInterval : undefined)}
            </span>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex flex-col gap-2 p-4">
          {/* Title */}
          <h3 className="font-albert font-semibold text-base text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px] leading-tight line-clamp-2">
            {squad.name}
          </h3>
          
          {/* Description */}
          {squad.description && (
            <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed line-clamp-2">
              {squad.description}
            </p>
          )}

          {/* Coach */}
          {squad.coachName && (
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
                <div className="w-5 h-5 rounded-full bg-brand-accent/20 flex items-center justify-center">
                  <User className="w-3 h-3 text-brand-accent" />
                </div>
              )}
              <span className="font-sans text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                {squad.coachName}
              </span>
            </div>
          )}
          
          {/* Meta info */}
          <div className="flex items-center gap-3 text-xs text-[#5f5a55] dark:text-[#7d8190]">
            {squad.memberCount !== undefined && squad.memberCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {squad.memberCount} members
              </span>
            )}
            
            {squad.subscriptionEnabled && squad.billingInterval && (
              <span className="flex items-center gap-1">
                <Repeat className="w-3 h-3" />
                {squad.billingInterval}
              </span>
            )}
          </div>

          {/* Join info */}
          <div className="mt-1 pt-2 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
            <span className="text-xs text-green-600 dark:text-green-400">
              Join anytime
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

