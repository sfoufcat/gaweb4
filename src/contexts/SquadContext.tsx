'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import type { Squad, SquadMember, SquadStats, SquadType, ContributionDay } from '@/types';

interface SquadContextValue {
  // Active squad (the one currently being viewed)
  squad: Squad | null;
  members: SquadMember[];
  stats: SquadStats | null;
  
  // Dual squad support
  premiumSquad: Squad | null;
  premiumMembers: SquadMember[];
  premiumStats: SquadStats | null;
  standardSquad: Squad | null;
  standardMembers: SquadMember[];
  standardStats: SquadStats | null;
  
  // Which squad type is currently active
  activeSquadType: SquadType | null;
  setActiveSquadType: (type: SquadType) => void;
  
  // Convenience flags
  hasBothSquads: boolean;
  hasPremiumSquad: boolean;
  hasStandardSquad: boolean;
  
  // Loading states
  isLoading: boolean;
  isLoadingStats: boolean;
  isLoadingMoreContributions: boolean;
  hasMoreContributions: boolean;
  error: string | null;
  
  // Actions
  refetch: () => Promise<void>;
  fetchStatsTabData: () => Promise<void>;
  loadMoreContributions: () => Promise<void>;
}

const SquadContext = createContext<SquadContextValue | undefined>(undefined);

// Global cache to persist across re-renders and navigation
let globalSquadData: {
  premiumSquad: Squad | null;
  premiumMembers: SquadMember[];
  premiumStats: SquadStats | null;
  standardSquad: Squad | null;
  standardMembers: SquadMember[];
  standardStats: SquadStats | null;
  activeSquadType: SquadType | null;
  fetchedForUserId: string | null;
  // Stats loading tracking per squad type
  premiumStatsLoaded: boolean;
  standardStatsLoaded: boolean;
  premiumContributionDaysLoaded: number;
  standardContributionDaysLoaded: number;
  premiumHasMoreContributions: boolean;
  standardHasMoreContributions: boolean;
} = {
  premiumSquad: null,
  premiumMembers: [],
  premiumStats: null,
  standardSquad: null,
  standardMembers: [],
  standardStats: null,
  activeSquadType: null,
  fetchedForUserId: null,
  premiumStatsLoaded: false,
  standardStatsLoaded: false,
  premiumContributionDaysLoaded: 0,
  standardContributionDaysLoaded: 0,
  premiumHasMoreContributions: true,
  standardHasMoreContributions: true,
};

interface SquadProviderProps {
  children: ReactNode;
}

/**
 * Global Squad Provider
 * 
 * Supports dual squad membership for premium users.
 * Premium users can be in both a standard squad and a premium squad.
 * 
 * The context tracks:
 * - Both squads (premium and standard) with their members/stats
 * - Which squad is currently "active" (being viewed)
 * - A switcher function to change the active squad
 * 
 * Default: Premium squad is shown first when user has both.
 */
export function SquadProvider({ children }: SquadProviderProps) {
  const { user, isLoaded } = useUser();
  
  // Premium squad state
  const [premiumSquad, setPremiumSquad] = useState<Squad | null>(globalSquadData.premiumSquad);
  const [premiumMembers, setPremiumMembers] = useState<SquadMember[]>(globalSquadData.premiumMembers);
  const [premiumStats, setPremiumStats] = useState<SquadStats | null>(globalSquadData.premiumStats);
  
  // Standard squad state
  const [standardSquad, setStandardSquad] = useState<Squad | null>(globalSquadData.standardSquad);
  const [standardMembers, setStandardMembers] = useState<SquadMember[]>(globalSquadData.standardMembers);
  const [standardStats, setStandardStats] = useState<SquadStats | null>(globalSquadData.standardStats);
  
  // Active squad type (which one is being viewed)
  const [activeSquadType, setActiveSquadTypeState] = useState<SquadType | null>(globalSquadData.activeSquadType);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(!globalSquadData.fetchedForUserId);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingMoreContributions, setIsLoadingMoreContributions] = useState(false);
  const [hasMoreContributions, setHasMoreContributions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convenience flags
  const hasPremiumSquad = !!premiumSquad;
  const hasStandardSquad = !!standardSquad;
  const hasBothSquads = hasPremiumSquad && hasStandardSquad;

  // Get the active squad data based on activeSquadType
  const squad = activeSquadType === 'premium' ? premiumSquad : activeSquadType === 'standard' ? standardSquad : null;
  const members = activeSquadType === 'premium' ? premiumMembers : activeSquadType === 'standard' ? standardMembers : [];
  const stats = activeSquadType === 'premium' ? premiumStats : activeSquadType === 'standard' ? standardStats : null;

  // Set active squad type with cache update
  const setActiveSquadType = useCallback((type: SquadType) => {
    setActiveSquadTypeState(type);
    globalSquadData.activeSquadType = type;
    
    // Update hasMoreContributions for the new active squad
    if (type === 'premium') {
      setHasMoreContributions(globalSquadData.premiumHasMoreContributions);
    } else {
      setHasMoreContributions(globalSquadData.standardHasMoreContributions);
    }
  }, []);

  // Fetch squad data with staggered loading for instant UI
  const fetchSquad = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // STEP 1: Fast fetch without stats - renders page instantly with skeletons
      const fastResponse = await fetch('/api/squad/me?includeStats=false');
      
      if (!fastResponse.ok) {
        throw new Error('Failed to fetch squad');
      }

      const fastData = await fastResponse.json();

      // Update state for both squad types
      const newPremiumSquad = fastData.premiumSquad || null;
      const newPremiumMembers = fastData.premiumMembers || [];
      const newStandardSquad = fastData.standardSquad || null;
      const newStandardMembers = fastData.standardMembers || [];
      
      // Determine default active squad type (premium first if exists)
      let defaultActiveType: SquadType | null = null;
      if (newPremiumSquad) {
        defaultActiveType = 'premium';
      } else if (newStandardSquad) {
        defaultActiveType = 'standard';
      }

      // Update global cache
      globalSquadData = {
        premiumSquad: newPremiumSquad,
        premiumMembers: newPremiumMembers,
        premiumStats: fastData.premiumStats || null,
        standardSquad: newStandardSquad,
        standardMembers: newStandardMembers,
        standardStats: fastData.standardStats || null,
        activeSquadType: defaultActiveType,
        fetchedForUserId: userId,
        premiumStatsLoaded: false,
        standardStatsLoaded: false,
        premiumContributionDaysLoaded: 0,
        standardContributionDaysLoaded: 0,
        premiumHasMoreContributions: true,
        standardHasMoreContributions: true,
      };

      setPremiumSquad(newPremiumSquad);
      setPremiumMembers(newPremiumMembers);
      setPremiumStats(fastData.premiumStats || null);
      setStandardSquad(newStandardSquad);
      setStandardMembers(newStandardMembers);
      setStandardStats(fastData.standardStats || null);
      setActiveSquadTypeState(defaultActiveType);
      setIsLoading(false); // Page can render now!

      // STEP 2: Fetch full stats in background for both squads (fills in the alignment bars)
      if (newPremiumSquad || newStandardSquad) {
        const fullResponse = await fetch('/api/squad/me?includeStats=true');
        
        if (fullResponse.ok) {
          const fullData = await fullResponse.json();
          
          // Update with real alignment data
          globalSquadData.premiumSquad = fullData.premiumSquad || null;
          globalSquadData.premiumMembers = fullData.premiumMembers || [];
          globalSquadData.premiumStats = fullData.premiumStats || null;
          globalSquadData.standardSquad = fullData.standardSquad || null;
          globalSquadData.standardMembers = fullData.standardMembers || [];
          globalSquadData.standardStats = fullData.standardStats || null;

          setPremiumSquad(fullData.premiumSquad || null);
          setPremiumMembers(fullData.premiumMembers || []);
          setPremiumStats(fullData.premiumStats || null);
          setStandardSquad(fullData.standardSquad || null);
          setStandardMembers(fullData.standardMembers || []);
          setStandardStats(fullData.standardStats || null);
        }
      }

    } catch (err) {
      console.error('Error fetching squad:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch squad');
      
      // Clear cache on error
      globalSquadData = {
        premiumSquad: null,
        premiumMembers: [],
        premiumStats: null,
        standardSquad: null,
        standardMembers: [],
        standardStats: null,
        activeSquadType: null,
        fetchedForUserId: userId,
        premiumStatsLoaded: false,
        standardStatsLoaded: false,
        premiumContributionDaysLoaded: 0,
        standardContributionDaysLoaded: 0,
        premiumHasMoreContributions: true,
        standardHasMoreContributions: true,
      };
      
      setPremiumSquad(null);
      setPremiumMembers([]);
      setPremiumStats(null);
      setStandardSquad(null);
      setStandardMembers([]);
      setStandardStats(null);
      setActiveSquadTypeState(null);
      setIsLoading(false);
    }
  }, []);

  // Fetch expensive stats tab data (lazy loaded) - for the ACTIVE squad
  const fetchStatsTabData = useCallback(async () => {
    if (!activeSquadType) return;
    
    // Check if already loaded for the active squad type
    const isLoaded = activeSquadType === 'premium' 
      ? globalSquadData.premiumStatsLoaded 
      : globalSquadData.standardStatsLoaded;
    
    if (isLoaded || isLoadingStats) return;
    
    try {
      setIsLoadingStats(true);

      const response = await fetch(`/api/squad/stats?type=${activeSquadType}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data: { 
        topPercentile: number; 
        contributionHistory: ContributionDay[];
        hasMore: boolean;
      } = await response.json();

      // Merge with existing stats for the active squad
      const currentStats = activeSquadType === 'premium' ? premiumStats : standardStats;
      const updatedStats = currentStats ? {
        ...currentStats,
        topPercentile: data.topPercentile,
        contributionHistory: data.contributionHistory,
      } : null;

      // Update global cache and state based on active squad type
      if (activeSquadType === 'premium') {
        globalSquadData.premiumStats = updatedStats;
        globalSquadData.premiumStatsLoaded = true;
        globalSquadData.premiumContributionDaysLoaded = data.contributionHistory.length;
        globalSquadData.premiumHasMoreContributions = data.hasMore;
        setPremiumStats(updatedStats);
      } else {
        globalSquadData.standardStats = updatedStats;
        globalSquadData.standardStatsLoaded = true;
        globalSquadData.standardContributionDaysLoaded = data.contributionHistory.length;
        globalSquadData.standardHasMoreContributions = data.hasMore;
        setStandardStats(updatedStats);
      }
      
      setHasMoreContributions(data.hasMore);

    } catch (err) {
      console.error('Error fetching stats tab data:', err);
      // Don't set error - just log it, basic data is still available
    } finally {
      setIsLoadingStats(false);
    }
  }, [activeSquadType, premiumStats, standardStats, isLoadingStats]);

  // Load more contribution history (pagination) - for the ACTIVE squad
  const loadMoreContributions = useCallback(async () => {
    if (!activeSquadType || isLoadingMoreContributions || !hasMoreContributions) return;
    
    const currentStats = activeSquadType === 'premium' ? premiumStats : standardStats;
    if (!currentStats) return;
    
    try {
      setIsLoadingMoreContributions(true);

      const offset = activeSquadType === 'premium' 
        ? globalSquadData.premiumContributionDaysLoaded 
        : globalSquadData.standardContributionDaysLoaded;
      
      const response = await fetch(`/api/squad/stats?type=${activeSquadType}&offset=${offset}&limit=30`);
      
      if (!response.ok) {
        throw new Error('Failed to load more contributions');
      }

      const data: { 
        contributionHistory: ContributionDay[];
        hasMore: boolean;
      } = await response.json();

      // Append new data to existing contribution history
      const updatedStats = {
        ...currentStats,
        contributionHistory: [...currentStats.contributionHistory, ...data.contributionHistory],
      };

      // Update global cache and state based on active squad type
      if (activeSquadType === 'premium') {
        globalSquadData.premiumStats = updatedStats;
        globalSquadData.premiumContributionDaysLoaded += data.contributionHistory.length;
        globalSquadData.premiumHasMoreContributions = data.hasMore;
        setPremiumStats(updatedStats);
      } else {
        globalSquadData.standardStats = updatedStats;
        globalSquadData.standardContributionDaysLoaded += data.contributionHistory.length;
        globalSquadData.standardHasMoreContributions = data.hasMore;
        setStandardStats(updatedStats);
      }
      
      setHasMoreContributions(data.hasMore);

    } catch (err) {
      console.error('Error loading more contributions:', err);
    } finally {
      setIsLoadingMoreContributions(false);
    }
  }, [activeSquadType, premiumStats, standardStats, isLoadingMoreContributions, hasMoreContributions]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    if (user?.id) {
      // Reset all stats loading state
      globalSquadData.premiumStatsLoaded = false;
      globalSquadData.standardStatsLoaded = false;
      globalSquadData.premiumContributionDaysLoaded = 0;
      globalSquadData.standardContributionDaysLoaded = 0;
      globalSquadData.premiumHasMoreContributions = true;
      globalSquadData.standardHasMoreContributions = true;
      setHasMoreContributions(true);
      await fetchSquad(user.id);
    }
  }, [user?.id, fetchSquad]);

  // Initial fetch when user is available
  useEffect(() => {
    if (!isLoaded) return;

    // No user = clear data
    if (!user) {
      globalSquadData = {
        premiumSquad: null,
        premiumMembers: [],
        premiumStats: null,
        standardSquad: null,
        standardMembers: [],
        standardStats: null,
        activeSquadType: null,
        fetchedForUserId: null,
        premiumStatsLoaded: false,
        standardStatsLoaded: false,
        premiumContributionDaysLoaded: 0,
        standardContributionDaysLoaded: 0,
        premiumHasMoreContributions: true,
        standardHasMoreContributions: true,
      };
      setPremiumSquad(null);
      setPremiumMembers([]);
      setPremiumStats(null);
      setStandardSquad(null);
      setStandardMembers([]);
      setStandardStats(null);
      setActiveSquadTypeState(null);
      setIsLoading(false);
      setHasMoreContributions(true);
      return;
    }

    // Already fetched for this user = use cached data
    if (globalSquadData.fetchedForUserId === user.id) {
      setPremiumSquad(globalSquadData.premiumSquad);
      setPremiumMembers(globalSquadData.premiumMembers);
      setPremiumStats(globalSquadData.premiumStats);
      setStandardSquad(globalSquadData.standardSquad);
      setStandardMembers(globalSquadData.standardMembers);
      setStandardStats(globalSquadData.standardStats);
      setActiveSquadTypeState(globalSquadData.activeSquadType);
      setIsLoading(false);
      
      // Set hasMoreContributions based on active squad type
      if (globalSquadData.activeSquadType === 'premium') {
        setHasMoreContributions(globalSquadData.premiumHasMoreContributions);
      } else if (globalSquadData.activeSquadType === 'standard') {
        setHasMoreContributions(globalSquadData.standardHasMoreContributions);
      }
      return;
    }

    // Fetch for new user
    fetchSquad(user.id);
  }, [user, isLoaded, fetchSquad]);

  return (
    <SquadContext.Provider value={{
      // Active squad (shorthand)
      squad,
      members,
      stats,
      
      // Both squads
      premiumSquad,
      premiumMembers,
      premiumStats,
      standardSquad,
      standardMembers,
      standardStats,
      
      // Squad type switching
      activeSquadType,
      setActiveSquadType,
      
      // Convenience flags
      hasBothSquads,
      hasPremiumSquad,
      hasStandardSquad,
      
      // Loading states
      isLoading,
      isLoadingStats,
      isLoadingMoreContributions,
      hasMoreContributions,
      error,
      
      // Actions
      refetch,
      fetchStatsTabData,
      loadMoreContributions,
    }}>
      {children}
    </SquadContext.Provider>
  );
}

/**
 * Hook to access the shared squad data
 * 
 * Returns the globally cached squad data that was fetched at app startup.
 * No duplicate API calls - everyone gets the same cached data.
 * 
 * For premium users with both squads:
 * - Use `squad`, `members`, `stats` to get the active (currently viewed) squad
 * - Use `premiumSquad`, `standardSquad` to access both squads directly
 * - Use `setActiveSquadType` to switch between them
 * - Use `hasBothSquads` to check if user has dual membership
 */
export function useSquadContext(): SquadContextValue {
  const context = useContext(SquadContext);
  if (context === undefined) {
    throw new Error('useSquadContext must be used within a SquadProvider');
  }
  return context;
}
