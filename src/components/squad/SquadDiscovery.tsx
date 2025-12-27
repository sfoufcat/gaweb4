'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Star, ArrowRight, Sparkles } from 'lucide-react';
import { SquadDiscoveryCard } from './SquadDiscoveryCard';
import { useMenuTitles } from '@/contexts/BrandingContext';

/**
 * SquadDiscovery Component
 * 
 * Displays available squads when user has no squad.
 * Styled like ProgramDiscovery - shows squads in a grid,
 * separated by Coached and Community types, with a "Discover more content" link.
 * 
 * If no squads are available, shows an empty state with link to programs.
 */

interface DiscoverSquad {
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

export function SquadDiscovery() {
  const { squadLower } = useMenuTitles();
  
  const [coachedSquads, setCoachedSquads] = useState<DiscoverSquad[]>([]);
  const [communitySquads, setCommunitySquads] = useState<DiscoverSquad[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSquads, setHasSquads] = useState(false);

  // Fetch available squads
  useEffect(() => {
    const fetchSquads = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/squad/discover');
        if (!response.ok) throw new Error('Failed to fetch squads');
        
        const data = await response.json();
        
        // Combine all squads from the API response
        const allSquads: DiscoverSquad[] = [
          ...(data.trackSquads || []),
          ...(data.generalSquads || []),
          ...(data.otherTrackSquads || []),
          ...(data.premiumSquads || []),
          ...(data.standardSquads || []),
        ];
        
        // Separate into coached and community squads
        const coached = allSquads.filter((s: DiscoverSquad) => !!s.coachId);
        const community = allSquads.filter((s: DiscoverSquad) => !s.coachId);
        
        setCoachedSquads(coached);
        setCommunitySquads(community);
        
        const total = coached.length + community.length;
        setHasSquads(total > 0);
      } catch (err) {
        console.error('Error fetching squads:', err);
        setHasSquads(false);
      } finally {
        setLoading(false);
      }
    };

    fetchSquads();
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className="pt-6 pb-32">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-10 w-48 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse mb-2" />
          <div className="h-5 w-72 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
        </div>

        {/* Squads Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div 
              key={i}
              className="bg-white/60 dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35] rounded-[20px] overflow-hidden animate-pulse"
            >
              <div className="h-[140px] bg-[#e1ddd8]/40 dark:bg-[#222631]" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded w-3/4" />
                <div className="h-4 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded w-full" />
                <div className="h-4 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No squads available - show empty state with programs CTA
  if (!hasSquads) {
    return (
      <div className="pt-6 pb-32">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-albert text-[36px] text-text-primary dark:text-[#f5f5f8] leading-[1.2] tracking-[-2px] mb-2">
            Join a {squadLower}
          </h1>
          <p className="font-albert text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4]">
            Connect with a community of growth-minded people working toward their goals together.
          </p>
        </div>

        {/* Empty state */}
        <div className="text-center py-12 px-4">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#a07855]/20 to-[#8c6245]/10 dark:from-[#a07855]/10 dark:to-[#8c6245]/5 flex items-center justify-center">
            <Users className="w-10 h-10 text-[#a07855]/60" />
          </div>
          <h3 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-2">
            No {squadLower}s available yet
          </h3>
          <p className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2] mb-6 max-w-[360px] mx-auto">
            Join a program to get access to a coached {squadLower} with guided accountability.
          </p>
        </div>

        {/* Discover Programs CTA */}
        <div className="mt-4">
          <Link
            href="/discover"
            className="group flex items-center justify-between p-5 bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#1a1512] dark:to-[#181310] border border-[#FFE4CC] dark:border-[#3d3530] rounded-[20px] hover:shadow-lg hover:border-[#a07855]/40 dark:hover:border-[#b8896a]/40 transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#a07855] to-[#8c6245] dark:from-[#b8896a] dark:to-[#a07855] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-albert font-semibold text-[18px] text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-1">
                  Discover programs
                </h3>
                <p className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4]">
                  Get structured guidance, coaching, and join a {squadLower} automatically.
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#a07855] dark:bg-[#b8896a] flex items-center justify-center group-hover:bg-[#8c6245] dark:group-hover:bg-[#a07855] group-hover:scale-105 transition-all">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 pb-32">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-albert text-[36px] text-text-primary dark:text-[#f5f5f8] leading-[1.2] tracking-[-2px] mb-2">
          Join a {squadLower}
        </h1>
        <p className="font-albert text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4]">
          Connect with a community of growth-minded people working toward their goals together.
        </p>
      </div>

      {/* Coached Squads Section */}
      {coachedSquads.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 dark:from-[#FF8A65]/20 dark:to-[#FF6B6B]/20 flex items-center justify-center">
              <Star className="w-4 h-4 text-[#FF6B6B] fill-[#FF6B6B]" />
            </div>
            <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
              Coached {squadLower}s
            </h2>
            <span className="px-2 py-0.5 bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 dark:from-[#FF8A65]/20 dark:to-[#FF6B6B]/20 text-[#FF6B6B] rounded-full text-[12px] font-albert font-medium">
              {coachedSquads.length}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coachedSquads.map((squad) => (
              <SquadDiscoveryCard key={squad.id} squad={squad} />
            ))}
          </div>
        </section>
      )}

      {/* Community Squads Section */}
      {communitySquads.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
              Community {squadLower}s
            </h2>
            <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[12px] font-albert font-medium">
              {communitySquads.length}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {communitySquads.map((squad) => (
              <SquadDiscoveryCard key={squad.id} squad={squad} />
            ))}
          </div>
        </section>
      )}

      {/* Discover More Content Link */}
      <div className="mt-8 pt-8 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <Link
          href="/discover"
          className="group flex items-center justify-between p-5 bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#1a1512] dark:to-[#181310] border border-[#FFE4CC] dark:border-[#3d3530] rounded-[20px] hover:shadow-lg hover:border-[#a07855]/40 dark:hover:border-[#b8896a]/40 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#a07855] to-[#8c6245] dark:from-[#b8896a] dark:to-[#a07855] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-albert font-semibold text-[18px] text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-1">
                Discover more content
              </h3>
              <p className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4]">
                Explore courses, articles, events, and more to fuel your growth.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#a07855] dark:bg-[#b8896a] flex items-center justify-center group-hover:bg-[#8c6245] dark:group-hover:bg-[#a07855] group-hover:scale-105 transition-all">
            <ArrowRight className="w-5 h-5 text-white" />
          </div>
        </Link>
      </div>
    </div>
  );
}
