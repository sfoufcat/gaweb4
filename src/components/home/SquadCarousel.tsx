'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users, ChevronRight, MessageCircle } from 'lucide-react';
import type { Squad, SquadMember } from '@/types';

interface SquadData {
  squad: Squad | null;
  members: SquadMember[];
}

interface SquadCarouselProps {
  premiumSquad: SquadData;
  standardSquad: SquadData;
  isLoading?: boolean;
  squadTitle?: string;
  squadTerm?: string;
}

export function SquadCarousel({ premiumSquad, standardSquad, isLoading, squadTitle = 'My Cohort', squadTerm = 'Mastermind' }: SquadCarouselProps) {
  // Lowercase version for use in sentences
  const squadTermLower = squadTerm.toLowerCase();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  
  // Build list of squads that exist
  const squads = [
    premiumSquad.squad && { ...premiumSquad, type: 'premium' as const },
    standardSquad.squad && { ...standardSquad, type: 'standard' as const },
  ].filter(Boolean) as (SquadData & { type: 'premium' | 'standard' })[];
  
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cardWidth = 280;
    const newIndex = Math.round(container.scrollLeft / cardWidth);
    setActiveIndex(Math.max(0, Math.min(newIndex, squads.length)));
  }, [squads.length]);
  
  // Check if scrolling is actually needed
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    
    const checkScroll = () => {
      setCanScroll(container.scrollWidth > container.clientWidth);
    };
    
    checkScroll();
    const observer = new ResizeObserver(checkScroll);
    observer.observe(container);
    
    return () => observer.disconnect();
  }, [squads.length]);
  
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex-shrink-0 w-[260px] bg-white dark:bg-surface rounded-[20px] p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
            <div className="flex-1">
              <div className="h-5 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded w-3/4 mb-2" />
              <div className="h-4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (squads.length === 0) {
    // Empty state - show find squad CTA
    return (
      <Link 
        href="/squad"
        className="block bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#1a1512] dark:to-[#181310] border border-[#FFE4CC] dark:border-[#3d3530] rounded-[20px] p-5 hover:shadow-lg hover:border-[#a07855] dark:border-brand-accent/40 dark:hover:border-brand-accent/40 transition-all duration-300 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] dark:bg-brand-accent dark:from-transparent dark:to-transparent flex items-center justify-center flex-shrink-0">
            <Users className="w-7 h-7 text-[#4A5D54] dark:text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] mb-1">
              Find your {squadTermLower}
            </h3>
            <p className="font-albert text-[14px] text-text-secondary leading-[1.4]">
              Join a {squadTermLower} of growth-minded people and stay accountable together.
            </p>
          </div>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-accent flex items-center justify-center group-hover:opacity-90 group-hover:scale-105 transition-all">
            <ChevronRight className="w-5 h-5 text-white" />
          </div>
        </div>
      </Link>
    );
  }
  
  // Single squad - show simple card (no carousel needed)
  if (squads.length === 1) {
    const { squad, members, type } = squads[0];
    if (!squad) return null;
    
    return (
      <div className="bg-white dark:bg-surface rounded-[20px] p-5">
        <div className="flex items-center gap-4">
          {/* Squad Avatar */}
          <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] flex items-center justify-center flex-shrink-0">
            {squad.avatarUrl ? (
              <Image src={squad.avatarUrl} alt={squad.name} width={56} height={56} className="w-full h-full object-cover" />
            ) : (
              <span className="font-albert font-bold text-xl text-[#4A5D54]">
                {squad.name[0]}
              </span>
            )}
          </div>

          {/* Squad Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] truncate">
                {squad.name}
              </h3>
              {type === 'premium' && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded text-[10px] font-medium">
                  Premium
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-text-secondary">
              <Users className="w-4 h-4" />
              <span className="font-albert text-[14px]">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {squad.chatChannelId && (
              <Link
                href={`/chat?channel=${squad.chatChannelId}`}
                className="w-11 h-11 rounded-full bg-[#f3f1ef] dark:bg-[#181d28] flex items-center justify-center hover:bg-[#e9e5e0] dark:hover:bg-[#272d38] transition-colors"
                aria-label="Open squad chat"
              >
                <MessageCircle className="w-5 h-5 text-text-primary" />
              </Link>
            )}
            <Link
              href="/program?tab=squad"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#a07855] dark:bg-brand-accent hover:bg-[#8c6245] dark:hover:bg-brand-accent/90 text-white rounded-full font-albert font-semibold text-[14px] transition-all hover:scale-[1.02]"
            >
              Go to {squadTermLower}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Multiple squads - show carousel
  return (
    <div className="relative">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory touch-pan-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {squads.map(({ squad, members, type }) => {
          if (!squad) return null;
          
          return (
            <div
              key={squad.id}
              className="flex-shrink-0 w-[260px] sm:w-[280px] snap-start"
            >
              <div className="bg-white dark:bg-surface rounded-[20px] p-4 h-full">
                <div className="flex items-center gap-3 mb-3">
                  {/* Squad Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] flex items-center justify-center flex-shrink-0">
                    {squad.avatarUrl ? (
                      <Image src={squad.avatarUrl} alt={squad.name} width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-albert font-bold text-lg text-[#4A5D54]">
                        {squad.name[0]}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="font-albert font-semibold text-[15px] text-text-primary tracking-[-0.5px] truncate">
                        {squad.name}
                      </h3>
                      {type === 'premium' && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded text-[9px] font-medium">
                          Premium
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-text-secondary">
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-sans text-[12px]">
                        {members.length} members
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  {squad.chatChannelId && (
                    <Link
                      href={`/chat?channel=${squad.chatChannelId}`}
                      className="flex-1 py-2 px-3 bg-[#f3f1ef] dark:bg-[#181d28] rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#e9e5e0] dark:hover:bg-[#272d38] transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 text-text-primary" />
                      <span className="font-sans text-[12px] text-text-primary">Chat</span>
                    </Link>
                  )}
                  <Link
                    href="/program?tab=squad"
                    className="flex-1 py-2 px-3 bg-[#a07855] dark:bg-brand-accent hover:bg-[#8c6245] dark:hover:bg-brand-accent/90 rounded-xl flex items-center justify-center gap-1 text-white transition-all"
                  >
                    <span className="font-sans text-[12px] font-medium">View</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Find Another Squad Card */}
        <Link
          href="/program"
          className="flex-shrink-0 w-[260px] sm:w-[280px] snap-start"
        >
          <div className="bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#1a1512] dark:to-[#181310] border border-dashed border-[#a07855] dark:border-brand-accent/30 rounded-[20px] h-full min-h-[140px] flex items-center justify-center hover:border-[#a07855] dark:border-brand-accent/60 dark:hover:border-brand-accent/60 transition-all group">
            <div className="text-center p-4">
              <div className="w-10 h-10 mx-auto rounded-full bg-[#a07855]/10 dark:bg-brand-accent/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-[#a07855] dark:text-brand-accent" />
              </div>
              <p className="font-albert font-semibold text-[13px] text-[#a07855] dark:text-brand-accent">
                Find another {squadTermLower}
              </p>
            </div>
          </div>
        </Link>
      </div>
      
      {/* Dot Indicators - only show if scrolling is needed */}
      {canScroll && (
      <div className="flex justify-center gap-1.5 mt-3">
        {squads.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              scrollRef.current?.scrollTo({
                left: i * 280,
                behavior: 'smooth',
              });
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              i === activeIndex 
                ? 'bg-[#a07855] w-4' 
                : 'bg-[#e1ddd8] dark:bg-[#272d38]'
            }`}
          />
        ))}
        <button
          onClick={() => {
            scrollRef.current?.scrollTo({
              left: squads.length * 280,
              behavior: 'smooth',
            });
          }}
          className={`w-2 h-2 rounded-full transition-all ${
            activeIndex >= squads.length
              ? 'bg-[#a07855] w-4' 
              : 'bg-[#e1ddd8] dark:bg-[#272d38]'
          }`}
        />
      </div>
      )}
    </div>
  );
}


