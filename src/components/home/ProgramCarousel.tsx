'use client';

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users, User, ChevronRight, BookOpen } from 'lucide-react';
import type { ProgramEnrollmentWithDetails } from '@/hooks/useDashboard';

interface ProgramCarouselProps {
  enrollments: ProgramEnrollmentWithDetails[];
  isLoading?: boolean;
}

export function ProgramCarousel({ enrollments, isLoading }: ProgramCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cardWidth = 280; // card width + gap
    const newIndex = Math.round(container.scrollLeft / cardWidth);
    setActiveIndex(Math.max(0, Math.min(newIndex, enrollments.length - 1)));
  }, [enrollments.length]);
  
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {[1, 2].map((i) => (
          <div 
            key={i}
            className="flex-shrink-0 w-[260px] bg-white dark:bg-surface rounded-[20px] p-4 animate-pulse"
          >
            <div className="w-full h-32 rounded-xl bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 mb-3" />
            <div className="h-5 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded w-3/4 mb-2" />
            <div className="h-4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  
  if (enrollments.length === 0) {
    // Empty state - show discover CTA
    return (
      <Link 
        href="/discover"
        className="block bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#1a1512] dark:to-[#181310] border border-[#FFE4CC] dark:border-[#3d3530] rounded-[20px] p-5 hover:shadow-lg hover:border-[#a07855]/40 dark:hover:border-[#b8896a]/40 transition-all duration-300 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#a07855]/20 to-[#8c6245]/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-7 h-7 text-[#a07855]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] mb-1">
              Explore programs
            </h3>
            <p className="font-albert text-[14px] text-text-secondary leading-[1.4]">
              Find structured coaching programs to accelerate your growth.
            </p>
          </div>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#a07855] dark:bg-[#b8896a] flex items-center justify-center group-hover:bg-[#8c6245] dark:group-hover:bg-[#a07855] group-hover:scale-105 transition-all">
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
        {enrollments.map((enrollment) => (
          <Link
            key={enrollment.id}
            href={`/discover/programs/${enrollment.programId}`}
            className="flex-shrink-0 w-[260px] sm:w-[280px] snap-start"
          >
            <div className="bg-white dark:bg-surface rounded-[20px] overflow-hidden hover:shadow-lg transition-all group">
              {/* Program Cover */}
              <div className="relative w-full h-32 bg-gradient-to-br from-[#a07855]/20 to-[#8c6245]/10">
                {enrollment.program.coverImageUrl ? (
                  <Image 
                    src={enrollment.program.coverImageUrl} 
                    alt={enrollment.program.name} 
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {enrollment.program.type === 'group' ? (
                      <Users className="w-12 h-12 text-[#a07855]/40" />
                    ) : (
                      <User className="w-12 h-12 text-[#a07855]/40" />
                    )}
                  </div>
                )}
                
                {/* Status Badge */}
                {enrollment.status === 'upcoming' ? (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-amber-500 text-white rounded-full text-[11px] font-medium">
                    Upcoming
                  </div>
                ) : (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-green-500 text-white rounded-full text-[11px] font-medium">
                    Active
                  </div>
                )}
                
                {/* Type Badge */}
                <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-[11px] font-medium ${
                  enrollment.program.type === 'group'
                    ? 'bg-blue-500 text-white'
                    : 'bg-purple-500 text-white'
                }`}>
                  {enrollment.program.type === 'group' ? 'Group' : '1:1'}
                </div>
              </div>
              
              {/* Content */}
              <div className="p-4">
                <h3 className="font-albert font-semibold text-[15px] text-text-primary tracking-[-0.5px] truncate mb-1">
                  {enrollment.program.name}
                </h3>
                
                {enrollment.cohort && (
                  <p className="font-sans text-[12px] text-text-secondary mb-3 truncate">
                    {enrollment.cohort.name}
                  </p>
                )}
                
                {/* Progress */}
                {enrollment.status === 'active' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-[11px] text-text-muted">
                        Day {enrollment.progress.currentDay}/{enrollment.progress.totalDays}
                      </span>
                      <span className="font-sans text-[11px] text-text-muted">
                        {enrollment.progress.percentComplete}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#e1ddd8] dark:bg-[#272d38] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#a07855] rounded-full transition-all"
                        style={{ width: `${enrollment.progress.percentComplete}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="font-sans text-[12px] text-amber-600 dark:text-amber-400">
                    Starts {enrollment.cohort ? new Date(enrollment.cohort.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'soon'}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
        
        {/* Discover More Card */}
        <Link
          href="/discover"
          className="flex-shrink-0 w-[260px] sm:w-[280px] snap-start"
        >
          <div className="bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#1a1512] dark:to-[#181310] border border-dashed border-[#a07855]/30 dark:border-[#b8896a]/30 rounded-[20px] h-full min-h-[200px] flex items-center justify-center hover:border-[#a07855]/60 dark:hover:border-[#b8896a]/60 transition-all group">
            <div className="text-center p-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#a07855]/10 dark:bg-[#b8896a]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6 text-[#a07855] dark:text-[#b8896a]" />
              </div>
              <p className="font-albert font-semibold text-[14px] text-[#a07855] dark:text-[#b8896a]">
                Discover more
              </p>
            </div>
          </div>
        </Link>
      </div>
      
      {/* Dot Indicators */}
      {enrollments.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {enrollments.map((_, i) => (
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
          {/* Extra dot for discover card */}
          <button
            onClick={() => {
              scrollRef.current?.scrollTo({
                left: enrollments.length * 280,
                behavior: 'smooth',
              });
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              activeIndex >= enrollments.length
                ? 'bg-[#a07855] w-4' 
                : 'bg-[#e1ddd8] dark:bg-[#272d38]'
            }`}
          />
        </div>
      )}
    </div>
  );
}

