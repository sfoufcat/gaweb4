'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users, User, ChevronRight, Plus } from 'lucide-react';
import type { ProgramEnrollmentWithDetails } from '@/hooks/useDashboard';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { MenuIcon } from '@/lib/menu-icons';
import { TypeBadge, StatusBadge } from '@/components/ui/program-badges';

interface ProgramCarouselProps {
  enrollments: ProgramEnrollmentWithDetails[];
  isLoading?: boolean;
  hasAvailablePrograms?: boolean;
  isCoach?: boolean;
}

export function ProgramCarousel({ enrollments, isLoading, hasAvailablePrograms = true, isCoach = false }: ProgramCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const { menuIcons } = useBrandingValues();
  
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cardWidth = 340; // card width + gap
    const newIndex = Math.round(container.scrollLeft / cardWidth);
    setActiveIndex(Math.max(0, Math.min(newIndex, enrollments.length - 1)));
  }, [enrollments.length]);
  
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
  }, [enrollments.length, hasAvailablePrograms]);
  
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {[1, 2].map((i) => (
          <div 
            key={i}
            className="flex-shrink-0 w-[280px] sm:w-[340px] glass-card p-4 animate-pulse"
          >
            <div className="w-full h-[160px] rounded-xl bg-text-primary/10 mb-3" />
            <div className="h-5 bg-text-primary/10 rounded w-3/4 mb-2" />
            <div className="h-4 bg-text-primary/5 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  
  if (enrollments.length === 0) {
    // Coach empty state - show create program CTA
    if (isCoach) {
      return (
        <Link 
          href="/coach?tab=programs"
          className="block bg-gradient-to-br from-[#F5F0FF] to-[#EDE4FF] dark:from-[#1a1625] dark:to-[#151220] border border-[#D8C8F8] dark:border-[#3d3055] rounded-[20px] p-5 hover:shadow-lg hover:border-[#9B7ED9]/60 dark:hover:border-[#9B7ED9]/40 transition-all duration-300 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#D8C8F8] dark:bg-[#3d3055] flex items-center justify-center flex-shrink-0">
              <Plus className="w-7 h-7 text-[#7C5CBF] dark:text-[#B89EE8]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] mb-1">
                Create a program
              </h3>
              <p className="font-albert text-[14px] text-text-secondary leading-[1.4]">
                Build structured coaching programs for your clients.
              </p>
            </div>
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#9B7ED9] dark:bg-[#7C5CBF] flex items-center justify-center group-hover:opacity-90 group-hover:scale-105 transition-all">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </div>
        </Link>
      );
    }
    
    // Member empty state - show discover CTA only if there are available programs
    if (!hasAvailablePrograms) {
      return null;
    }
    
    return (
      <Link 
        href="/discover"
        className="block bg-[#ECFFF2] dark:bg-[#1a2e1f] border border-[#D3F0D8] dark:border-[#2E5435] rounded-[20px] p-5 hover:shadow-lg hover:border-[#4CAF51]/40 dark:hover:border-[#4CAF50]/40 transition-all duration-300 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#D3F0D8] dark:bg-[#2E5435] flex items-center justify-center flex-shrink-0">
            <MenuIcon iconKey={menuIcons.program} className="w-7 h-7 text-[#2E7D6B] dark:text-[#4CAF50]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] mb-1">
              Explore programs
            </h3>
            <p className="font-albert text-[14px] text-text-secondary leading-[1.4]">
              Find structured coaching programs to accelerate your growth.
            </p>
          </div>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#4CAF51] dark:bg-[#4CAF50] flex items-center justify-center group-hover:opacity-90 group-hover:scale-105 transition-all">
            <ChevronRight className="w-5 h-5 text-white" />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="relative">
      {/* Carousel Container */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory touch-pan-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {enrollments.map((enrollment) => {
          // Check if the program has already started (start date is in the past)
          const hasStarted = enrollment.cohort 
            ? new Date(enrollment.cohort.startDate) <= new Date() 
            : false;
          
          return (
          <Link
            key={enrollment.id}
            href={`/program?programId=${enrollment.programId}`}
            className="flex-shrink-0 w-[280px] sm:w-[340px] snap-start"
          >
            <div className="glass-card overflow-hidden cursor-pointer group h-full flex flex-col">
              {/* Cover Image */}
              <div className="relative w-full h-[160px] overflow-hidden flex-shrink-0">
                {enrollment.program.coverImageUrl ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10" />
                    <Image
                      src={enrollment.program.coverImageUrl}
                      alt={enrollment.program.name}
                      fill
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                      sizes="340px"
                    />
                  </>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-accent/15 via-brand-accent/8 to-[#8c6245]/5 dark:from-brand-accent/10 dark:via-brand-accent/5 dark:to-[#8c6245]/3 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/50 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      {enrollment.program.type === 'group' ? (
                        <Users className="w-6 h-6 text-brand-accent/60" />
                      ) : (
                        <User className="w-6 h-6 text-brand-accent/60" />
                      )}
                    </div>
                  </div>
                )}

                {/* Type badge - top left */}
                <div className="absolute top-3 left-3 z-20">
                  <TypeBadge type={enrollment.program.type} />
                </div>

                
              </div>

              {/* Content */}
              <div className="flex flex-col gap-2 p-4 flex-1">
                {/* Title with status dot */}
                <div className="flex items-center gap-2">
                  <h3 className="font-albert font-semibold text-[17px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.3px] leading-tight line-clamp-1">
                    {enrollment.program.name}
                  </h3>
                  {enrollment.status === 'active' && (
                    <StatusBadge isActive={true} size="sm" />
                  )}
                </div>

                {/* Description - 2 lines max */}
                <p className="text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed line-clamp-2 min-h-[2.625rem]">
                  {enrollment.program.description || (enrollment.program.type === 'individual'
                    ? 'One-on-one coaching program'
                    : enrollment.cohort?.name || 'Group coaching program')}
                </p>
                
                {/* Progress or Status */}
                <div className="mt-auto pt-3 border-t border-[#e1ddd8]/40 dark:border-[#262b35]/40">
                  {enrollment.status === 'active' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#5f5a55] dark:text-[#b2b6c2]">
                          {enrollment.progress.isEvergreen && enrollment.progress.cycleNumber ? (
                            <>Cycle {enrollment.progress.cycleNumber} • Day {enrollment.progress.currentDay}/{enrollment.progress.totalDays}</>
                          ) : (
                            <>Day {enrollment.progress.currentDay}/{enrollment.progress.totalDays}</>
                          )}
                        </span>
                        <span className="text-[12px] font-medium text-brand-accent">
                          {enrollment.progress.percentComplete}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#e1ddd8]/60 dark:bg-[#272d38] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-accent rounded-full transition-all"
                          style={{ width: `${enrollment.progress.percentComplete}%` }}
                        />
                      </div>
                    </div>
                  ) : hasStarted ? (
                    <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                      Ready to start
                    </span>
                  ) : (
                    <span className="text-[12px] font-medium text-brand-accent">
                      Starts {enrollment.cohort ? new Date(enrollment.cohort.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'soon'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
        })}
        
        {/* Discover More Card - Only show if there are available programs */}
        {hasAvailablePrograms && (
          <Link
            href="/discover"
            className="flex-shrink-0 w-[280px] sm:w-[340px] snap-start"
          >
            <div className="glass-card border-dashed border-brand-accent/30 h-full min-h-[280px] flex items-center justify-center hover:border-brand-accent/60 transition-all group">
              <div className="text-center p-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-brand-accent/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <MenuIcon iconKey={menuIcons.program} className="w-6 h-6 text-brand-accent" />
                </div>
                <p className="font-albert font-semibold text-[14px] text-brand-accent">
                  Discover more
                </p>
              </div>
            </div>
          </Link>
        )}
      </div>
      
      {/* Dot Indicators - only show if scrolling is needed */}
      {canScroll && (enrollments.length > 1 || (enrollments.length === 1 && hasAvailablePrograms)) && (
        <div className="flex justify-center gap-1.5 mt-3">
          {enrollments.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                scrollRef.current?.scrollTo({
                  left: i * 340,
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
          {/* Extra dot for discover card - only if there are available programs */}
          {hasAvailablePrograms && (
            <button
              onClick={() => {
                scrollRef.current?.scrollTo({
                  left: enrollments.length * 340,
                  behavior: 'smooth',
                });
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                activeIndex >= enrollments.length
                  ? 'bg-brand-accent w-4' 
                  : 'bg-[#e1ddd8] dark:bg-[#272d38]'
              }`}
            />
          )}
        </div>
      )}
    </div>
  );
}
