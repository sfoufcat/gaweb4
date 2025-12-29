'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, User, ArrowRight, Sparkles } from 'lucide-react';
import { ProgramCard } from '@/components/discover';
import { useMenuTitles } from '@/contexts/BrandingContext';
import { ProgramEmptyState } from './ProgramEmptyState';

/**
 * ProgramDiscovery Component
 * 
 * Displays available programs when user has no enrollments.
 * Styled similar to SquadDiscovery - shows programs in a grid,
 * separated by Group and 1:1 types, with a "Discover more content" link.
 * 
 * If no programs are available, renders ProgramEmptyState instead.
 */

interface DiscoverProgram {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  type: 'group' | 'individual';
  lengthDays: number;
  priceInCents: number;
  currency?: string;
  coachName?: string;
  coachImageUrl?: string;
  nextCohort?: {
    id: string;
    name: string;
    startDate: string;
    spotsRemaining: number;
  } | null;
  userEnrollment?: {
    status: string;
    cohortId?: string;
  } | null;
}

export function ProgramDiscovery() {
  const { programLower } = useMenuTitles();
  
  const [groupPrograms, setGroupPrograms] = useState<DiscoverProgram[]>([]);
  const [individualPrograms, setIndividualPrograms] = useState<DiscoverProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPrograms, setHasPrograms] = useState(false);

  // Fetch available programs
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/discover/programs');
        if (!response.ok) throw new Error('Failed to fetch programs');
        
        const data = await response.json();
        
        // Filter out programs user is already enrolled in
        const availableGroup = (data.groupPrograms || []).filter(
          (p: DiscoverProgram) => !p.userEnrollment
        );
        const availableIndividual = (data.individualPrograms || []).filter(
          (p: DiscoverProgram) => !p.userEnrollment
        );
        
        setGroupPrograms(availableGroup);
        setIndividualPrograms(availableIndividual);
        
        const total = availableGroup.length + availableIndividual.length;
        setHasPrograms(total > 0);
      } catch (err) {
        console.error('Error fetching programs:', err);
        setHasPrograms(false);
      } finally {
        setLoading(false);
      }
    };

    fetchPrograms();
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

        {/* Programs Grid Skeleton */}
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

  // No programs available - show empty state with "Discover more content" CTA
  if (!hasPrograms) {
    return <ProgramEmptyState />;
  }

  return (
    <div className="pt-6 pb-32">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-albert text-[36px] text-text-primary dark:text-[#f5f5f8] leading-[1.2] tracking-[-2px] mb-2">
          Join a {programLower}
        </h1>
        <p className="font-albert text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4]">
          Get structured guidance, connect with a community, and accelerate your growth journey.
        </p>
      </div>

      {/* Group Programs Section */}
      {groupPrograms.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
              Group Programs
            </h2>
            <span className="px-2 py-0.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-[12px] font-albert font-medium">
              {groupPrograms.length}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupPrograms.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        </section>
      )}

      {/* 1:1 Programs Section */}
      {individualPrograms.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
              <User className="w-4 h-4 text-purple-500" />
            </div>
            <h2 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
              1:1 Coaching Programs
            </h2>
            <span className="px-2 py-0.5 bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full text-[12px] font-albert font-medium">
              {individualPrograms.length}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {individualPrograms.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        </section>
      )}

      {/* Discover More Content Link */}
      <div className="mt-8 pt-8 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <Link
          href="/discover"
          className="group flex items-center justify-between p-5 bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#1a1512] dark:to-[#181310] border border-[#FFE4CC] dark:border-[#3d3530] rounded-[20px] hover:shadow-lg hover:border-brand-accent dark:hover:border-brand-accent/40 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0">
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
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-accent flex items-center justify-center group-hover:opacity-90 group-hover:scale-105 transition-all">
            <ArrowRight className="w-5 h-5 text-white" />
          </div>
        </Link>
      </div>
    </div>
  );
}

