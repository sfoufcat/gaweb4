'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Users, ChevronRight, MessageCircle, Plus } from 'lucide-react';
import type { Squad, SquadMember } from '@/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ChatSheet } from '@/components/chat/ChatSheet';

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
  isCoach?: boolean;
}

export function SquadCarousel({ premiumSquad, standardSquad, isLoading, squadTitle = 'My Cohort', squadTerm = 'Squad', isCoach = false }: SquadCarouselProps) {
  // Lowercase version for use in sentences
  const squadTermLower = squadTerm.toLowerCase();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const router = useRouter();
  
  // Mobile chat sheet state
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [selectedChatChannelId, setSelectedChatChannelId] = useState<string | null>(null);
  
  // Handle chat button click - open sheet on mobile, navigate on desktop
  const handleChatClick = useCallback((chatChannelId: string) => {
    if (isMobile) {
      setSelectedChatChannelId(chatChannelId);
      setChatSheetOpen(true);
    } else {
      router.push(`/chat?channel=${chatChannelId}`);
    }
  }, [isMobile, router]);
  
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
        <div className="flex-shrink-0 w-[260px] glass-card p-4 animate-pulse">
          <div className="w-full h-[140px] rounded-xl bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 mb-3" />
          <div className="h-5 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded w-3/4 mb-2" />
          <div className="h-4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded w-1/2" />
        </div>
      </div>
    );
  }
  
  if (squads.length === 0) {
    // Coach empty state - show create mastermind CTA
    if (isCoach) {
      return (
        <Link 
          href="/coach?tab=squads"
          className="block bg-gradient-to-br from-[#F0F7FF] to-[#E4F0FF] dark:from-[#141a25] dark:to-[#101520] border border-[#C8DFFF] dark:border-[#2d3d55] rounded-[20px] p-5 hover:shadow-lg hover:border-[#5B9BF5]/60 dark:hover:border-[#5B9BF5]/40 transition-all duration-300 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#C8DFFF] dark:bg-[#2d3d55] flex items-center justify-center flex-shrink-0">
              <Plus className="w-7 h-7 text-[#3B7DD8] dark:text-[#7EB3F5]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] mb-1">
                Create your {squadTermLower}
              </h3>
              <p className="font-albert text-[14px] text-text-secondary leading-[1.4]">
                Build a {squadTermLower} group for your clients to stay accountable together.
              </p>
            </div>
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#5B9BF5] dark:bg-[#3B7DD8] flex items-center justify-center group-hover:opacity-90 group-hover:scale-105 transition-all">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </div>
        </Link>
      );
    }
    
    // Member empty state - show find mastermind CTA
    return (
      <Link 
        href="/squad"
        className="block bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#1a1512] dark:to-[#181310] border border-[#FFE4CC] dark:border-[#3d3530] rounded-[20px] p-5 hover:shadow-lg hover:border-brand-accent dark:border-brand-accent/40 dark:hover:border-brand-accent/40 transition-all duration-300 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-accent bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] dark:bg-none flex items-center justify-center flex-shrink-0">
            <Users className="w-7 h-7 text-[#4A5D54] dark:text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] mb-1">
              Find a {squadTermLower}
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
  
  // Single squad - show glass card design
  if (squads.length === 1) {
    const { squad, members, type } = squads[0];
    if (!squad) return null;
    
    return (
      <>
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          {/* Squad Avatar */}
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] flex items-center justify-center flex-shrink-0">
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
              <h3 className="font-albert font-semibold text-[18px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px] truncate">
                {squad.name}
              </h3>
              {type === 'premium' && (
                <span className="glass-badge px-2 py-0.5 bg-amber-500/90 text-white rounded-full text-[10px] font-semibold">
                  Premium
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[#5f5a55] dark:text-[#b2b6c2]">
              <Users className="w-4 h-4" />
              <span className="font-albert text-[14px]">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {squad.chatChannelId && (
              <button
                onClick={() => handleChatClick(squad.chatChannelId!)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#f3f1ef] dark:bg-[#181d28] flex items-center justify-center hover:bg-[#e9e5e0] dark:hover:bg-[#272d38] transition-colors"
                aria-label="Open squad chat"
              >
                <MessageCircle className="w-5 h-5 text-[#1a1a1a] dark:text-[#f5f5f8]" />
              </button>
            )}
            <Link
              href={`/squad?squadId=${squad.id}`}
              className="flex items-center justify-center gap-1.5 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-full font-albert font-semibold text-[14px] transition-all hover:scale-[1.02]"
            >
              <span className="hidden sm:inline">Go to {squadTermLower}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
      
      {/* Mobile Chat Sheet */}
      <ChatSheet
        isOpen={chatSheetOpen}
        onClose={() => setChatSheetOpen(false)}
        initialChannelId={selectedChatChannelId}
      />
      </>
    );
  }

  // Multiple squads - show carousel with glass cards
  return (
    <>
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
              <div className="glass-card overflow-hidden h-full flex flex-col">
                {/* Cover Image Area */}
                <div className="relative w-full h-[100px] overflow-hidden flex-shrink-0">
                  {squad.avatarUrl ? (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10" />
                      <Image 
                        src={squad.avatarUrl} 
                        alt={squad.name} 
                        fill 
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" 
                        sizes="280px"
                      />
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-accent/15 via-brand-accent/8 to-[#8c6245]/5 dark:from-brand-accent/10 dark:via-brand-accent/5 dark:to-[#8c6245]/3 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-white/50 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
                        <Users className="w-6 h-6 text-brand-accent/60" />
                      </div>
                    </div>
                  )}
                  
                  {/* Badge - top left */}
                  <div className="absolute top-3 left-3 z-20">
                    <span className={`glass-badge px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 ${
                      type === 'premium'
                        ? 'bg-amber-500/90 text-white'
                        : 'bg-emerald-500/90 text-white'
                    }`}>
                      <Users className="w-3 h-3" />
                      {type === 'premium' ? 'Premium' : squadTerm}
                    </span>
                  </div>
                  
                  {/* Members badge - top right */}
                  <div className="absolute top-3 right-3 z-20">
                    <span className="glass-badge px-2.5 py-1 bg-white/90 dark:bg-[#171b22]/90 text-[#1a1a1a] dark:text-[#f5f5f8] text-[11px] font-semibold rounded-full">
                      {members.length} members
                    </span>
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex flex-col gap-2 p-4 flex-1">
                  <h3 className="font-albert font-semibold text-[17px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.3px] leading-tight line-clamp-2">
                    {squad.name}
                  </h3>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-[#e1ddd8]/40 dark:border-[#262b35]/40">
                    {squad.chatChannelId && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleChatClick(squad.chatChannelId!);
                        }}
                        className="flex-1 py-2 px-3 bg-[#f3f1ef] dark:bg-[#181d28] rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#e9e5e0] dark:hover:bg-[#272d38] transition-colors"
                      >
                        <MessageCircle className="w-4 h-4 text-[#1a1a1a] dark:text-[#f5f5f8]" />
                        <span className="font-sans text-[12px] text-[#1a1a1a] dark:text-[#f5f5f8]">Chat</span>
                      </button>
                    )}
                    <Link
                      href={`/squad?squadId=${squad.id}`}
                      className="flex-1 py-2 px-3 bg-brand-accent hover:bg-brand-accent/90 rounded-xl flex items-center justify-center gap-1 text-white transition-all"
                    >
                      <span className="font-sans text-[12px] font-medium">View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
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
          <div className="glass-card border-dashed border-brand-accent/30 h-full min-h-[220px] flex items-center justify-center hover:border-brand-accent/60 transition-all group">
            <div className="text-center p-4">
              <div className="w-10 h-10 mx-auto rounded-full bg-brand-accent/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-brand-accent" />
              </div>
              <p className="font-albert font-semibold text-[13px] text-brand-accent">
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
                ? 'bg-brand-accent w-4' 
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
              ? 'bg-brand-accent w-4' 
              : 'bg-[#e1ddd8] dark:bg-[#272d38]'
          }`}
        />
      </div>
      )}
    </div>
    
    {/* Mobile Chat Sheet */}
    <ChatSheet
      isOpen={chatSheetOpen}
      onClose={() => setChatSheetOpen(false)}
      initialChannelId={selectedChatChannelId}
    />
    </>
  );
}
