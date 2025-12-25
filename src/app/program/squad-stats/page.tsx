'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useSquad } from '@/hooks/useSquad';
import { SquadStats } from '@/components/squad/SquadStats';
import { SquadStreakSheet } from '@/components/squad/SquadStreakSheet';
import { useMenuTitles } from '@/contexts/BrandingContext';

/**
 * Squad Stats Screen
 * 
 * Separate screen for viewing squad statistics:
 * - Average alignment score
 * - Alignment change indicator
 * - Top percentile badge
 * - Contribution grid
 * - Explanation cards
 * 
 * Accessed from the "View squad stats" button in the Squad tab.
 * 
 * URL params:
 * - squadId: specific squad to show stats for
 * - programId: program context for back navigation
 */
export default function SquadStatsPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { squad: squadTitle, squadLower } = useMenuTitles();
  
  // Get URL params for context
  const squadIdParam = searchParams.get('squadId');
  const programIdParam = searchParams.get('programId');
  
  const {
    squad: activeSquad,
    squads,
    stats: activeStats,
    statsBySquad,
    membersBySquad,
    isLoading,
    isLoadingStats,
    fetchStatsTabData,
    hasMoreContributions,
    isLoadingMoreContributions,
    loadMoreContributions,
    setActiveSquadId,
  } = useSquad();
  
  // If squadId is provided, use that specific squad; otherwise use active squad
  const { squad, stats } = useMemo(() => {
    if (squadIdParam && squads.length > 0) {
      const targetSquad = squads.find(s => s.id === squadIdParam);
      const targetStats = statsBySquad[squadIdParam] || null;
      return { squad: targetSquad || null, stats: targetStats };
    }
    return { squad: activeSquad, stats: activeStats };
  }, [squadIdParam, squads, statsBySquad, activeSquad, activeStats]);
  
  const [mounted, setMounted] = useState(false);
  const [showStreakSheet, setShowStreakSheet] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Set the active squad if squadId is provided (ensures stats are fetched for correct squad)
  useEffect(() => {
    if (mounted && squadIdParam && squads.length > 0) {
      const targetSquad = squads.find(s => s.id === squadIdParam);
      if (targetSquad) {
        setActiveSquadId(squadIdParam);
      }
    }
  }, [mounted, squadIdParam, squads, setActiveSquadId]);
  
  // Load stats data when component mounts
  useEffect(() => {
    if (mounted && userLoaded && user) {
      fetchStatsTabData();
    }
  }, [mounted, userLoaded, user, fetchStatsTabData]);
  
  // Handle back navigation with proper context
  const handleBack = useCallback(() => {
    if (programIdParam) {
      // Navigate back to specific program's squad tab
      router.push(`/program?programId=${programIdParam}&tab=squad`);
    } else {
      // Default: navigate to main squad tab
      router.push('/program?tab=squad');
    }
  }, [router, programIdParam]);
  
  // Loading state
  if (!mounted || !userLoaded || isLoading) {
    return <SquadStatsLoading />;
  }
  
  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-center px-4">
        <p className="text-text-secondary">Please sign in to view stats.</p>
      </div>
    );
  }
  
  // No squad - redirect back
  if (!squad) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-text-secondary dark:text-[#7d8190] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors py-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-albert text-[16px] font-medium">Back</span>
        </button>
        
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] text-center">
            No {squadLower} found. Join a group program to access {squadLower} stats.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32">
      {/* Header with back button */}
      <div className="flex items-center gap-4 py-4 mb-4">
        <button
          onClick={handleBack}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#171b22] hover:bg-[#e9e5e0] dark:hover:bg-[#1d222b] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-primary dark:text-[#f5f5f8]" />
        </button>
        <div>
          <h1 className="font-albert text-[24px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.2]">
            {squad.name}
          </h1>
          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
            {squadTitle} Stats
          </p>
        </div>
      </div>
      
      {/* Stats Content */}
      {stats ? (
        <SquadStats
          stats={stats}
          isLoadingExtras={isLoadingStats}
          isLoadingMoreContributions={isLoadingMoreContributions}
          hasMoreContributions={hasMoreContributions}
          onOpenStreakInfo={() => setShowStreakSheet(true)}
          onLoadMore={loadMoreContributions}
        />
      ) : (
        <div className="space-y-3">
          {/* Loading skeleton for stats */}
          <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-6 text-center animate-pulse">
            <div className="h-5 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg mx-auto mb-4" />
            <div className="h-10 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg mx-auto" />
          </div>
        </div>
      )}
      
      {/* Squad Streak Explanation Sheet */}
      <SquadStreakSheet
        isOpen={showStreakSheet}
        onClose={() => setShowStreakSheet(false)}
      />
    </div>
  );
}

function SquadStatsLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 py-4 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
          <div className="h-4 w-24 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-lg animate-pulse" />
        </div>
      </div>
      
      {/* Stats skeleton */}
      <div className="space-y-3">
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-6 text-center animate-pulse">
          <div className="h-5 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg mx-auto mb-4" />
          <div className="h-10 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg mx-auto" />
        </div>
        
        <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[1000px] h-7 animate-pulse" />
        
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 animate-pulse">
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="w-[48px] h-[48px] rounded-[4px] bg-[#e1ddd8] dark:bg-[#262b35]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

