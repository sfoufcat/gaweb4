'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoSquadsWithStats, generateDemoSquadMembers } from '@/lib/demo-data';
import type { Squad, SquadMember, SquadStats, ContributionDay } from '@/types';

// Discovery squad type (from /api/squad/me when user has no squads)
// Uses optional fields to match SquadDiscoveryCard expectations
export interface DiscoverySquad {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  coachId?: string;
  coachName?: string;
  coachImageUrl?: string;
  memberCount: number;
  memberAvatars: string[];
  priceInCents?: number;
  subscriptionEnabled?: boolean;
  billingInterval?: string;
  visibility?: string;
}

const SQUAD_CACHE_KEY = 'ga-squad-cache-v2';
const CACHE_VERSION = 2;
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate mock contribution history for demo mode
 */
function generateDemoContributionHistory(days: number): ContributionDay[] {
  const history: ContributionDay[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    history.push({
      date: date.toISOString().split('T')[0],
      completionRate: 40 + Math.floor(Math.random() * 55), // 40-94%
    });
  }
  return history;
}

interface SquadCacheData {
  version: number;
  timestamp: number;
  userId: string;
  squads: Squad[];
  membersBySquad: Record<string, SquadMember[]>;
  activeSquadId: string | null;
}

/**
 * Load squad data from localStorage
 */
function loadSquadCache(userId: string): Partial<SquadCacheData> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(SQUAD_CACHE_KEY);
    if (!stored) return null;
    
    const parsed: SquadCacheData = JSON.parse(stored);
    
    // Validate version and user
    if (parsed.version !== CACHE_VERSION || parsed.userId !== userId) {
      return null;
    }
    
    // Check if cache is expired
    if (Date.now() - parsed.timestamp > CACHE_MAX_AGE) {
      return null;
    }
    
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save squad data to localStorage
 */
function saveSquadCache(userId: string, data: {
  squads: Squad[];
  membersBySquad: Record<string, SquadMember[]>;
  activeSquadId: string | null;
}): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheData: SquadCacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      userId,
      ...data,
    };
    localStorage.setItem(SQUAD_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('[SquadContext] Failed to save cache to localStorage:', error);
  }
}

interface SquadContextValue {
  // Active squad (the one currently being viewed)
  squad: Squad | null;
  members: SquadMember[];
  stats: SquadStats | null;
  
  // Multi-squad support - all squads user is in
  squads: Squad[];
  membersBySquad: Record<string, SquadMember[]>;
  statsBySquad: Record<string, SquadStats | null>;
  
  // Standalone squads (not attached to a program) - for Squad page
  standaloneSquads: Squad[];
  activeStandaloneSquad: Squad | null;
  activeStandaloneSquadId: string | null;
  setActiveStandaloneSquadId: (squadId: string) => void;
  hasStandaloneSquad: boolean;
  hasMultipleStandaloneSquads: boolean;

  // Discovery squads (available to join when user has no squads)
  discoverySquads: DiscoverySquad[];
  
  // Legacy compatibility: first coached squad and first non-coached squad
  premiumSquad: Squad | null;
  premiumMembers: SquadMember[];
  premiumStats: SquadStats | null;
  standardSquad: Squad | null;
  standardMembers: SquadMember[];
  standardStats: SquadStats | null;
  
  // Which squad is currently active
  activeSquadId: string | null;
  setActiveSquadId: (squadId: string) => void;
  
  // Convenience flags
  hasMultipleSquads: boolean;
  hasCoachedSquad: boolean;
  hasPeerSquad: boolean;
  // Legacy flags
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
  squads: Squad[];
  membersBySquad: Record<string, SquadMember[]>;
  statsBySquad: Record<string, SquadStats | null>;
  discoverySquads: DiscoverySquad[];
  activeSquadId: string | null;
  activeStandaloneSquadId: string | null;
  fetchedForUserId: string | null;
  statsLoadedForSquads: Set<string>;
  contributionDaysLoadedBySquad: Record<string, number>;
  hasMoreContributionsBySquad: Record<string, boolean>;
} = {
  squads: [],
  membersBySquad: {},
  statsBySquad: {},
  discoverySquads: [],
  activeSquadId: null,
  activeStandaloneSquadId: null,
  fetchedForUserId: null,
  statsLoadedForSquads: new Set(),
  contributionDaysLoadedBySquad: {},
  hasMoreContributionsBySquad: {},
};

interface SquadProviderProps {
  children: ReactNode;
}

/**
 * Global Squad Provider
 * 
 * Supports multi-squad membership. Users can be in multiple squads
 * (e.g., a program squad and a standalone squad).
 * 
 * The context tracks:
 * - All squads user is a member of
 * - Members and stats for each squad
 * - Which squad is currently "active" (being viewed)
 * - A switcher function to change the active squad
 * 
 * Default: First coached squad is shown if exists, else first squad.
 */
export function SquadProvider({ children }: SquadProviderProps) {
  const { user, isLoaded } = useUser();
  const { isDemoMode } = useDemoMode();
  const hasInitializedFromStorage = useRef(false);
  
  // Multi-squad state
  const [squads, setSquads] = useState<Squad[]>(globalSquadData.squads);
  const [membersBySquad, setMembersBySquad] = useState<Record<string, SquadMember[]>>(globalSquadData.membersBySquad);
  const [statsBySquad, setStatsBySquad] = useState<Record<string, SquadStats | null>>(globalSquadData.statsBySquad);
  const [discoverySquads, setDiscoverySquads] = useState<DiscoverySquad[]>(globalSquadData.discoverySquads);
  
  // Active squad
  const [activeSquadId, setActiveSquadIdState] = useState<string | null>(globalSquadData.activeSquadId);
  
  // Active standalone squad (for Squad page switcher)
  const [activeStandaloneSquadId, setActiveStandaloneSquadIdState] = useState<string | null>(globalSquadData.activeStandaloneSquadId);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(!globalSquadData.fetchedForUserId);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingMoreContributions, setIsLoadingMoreContributions] = useState(false);
  const [hasMoreContributions, setHasMoreContributions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize from localStorage on mount (only once)
  useEffect(() => {
    if (hasInitializedFromStorage.current || !user?.id) return;
    
    // Check localStorage for cached data
    const cached = loadSquadCache(user.id);
    if (cached && !globalSquadData.fetchedForUserId) {
      // Initialize from localStorage cache
      setSquads(cached.squads ?? []);
      setMembersBySquad(cached.membersBySquad ?? {});
      setActiveSquadIdState(cached.activeSquadId ?? null);
      
      // Also update global cache
      globalSquadData.squads = cached.squads ?? [];
      globalSquadData.membersBySquad = cached.membersBySquad ?? {};
      globalSquadData.activeSquadId = cached.activeSquadId ?? null;
      
      // Mark as having data (even if stale, shows instantly)
      setIsLoading(false);
    }
    
    hasInitializedFromStorage.current = true;
  }, [user?.id]);

  // Get the active squad data
  const activeSquad = squads.find(s => s.id === activeSquadId) || null;
  const activeMembers = activeSquadId ? (membersBySquad[activeSquadId] || []) : [];
  const activeStats = activeSquadId ? (statsBySquad[activeSquadId] || null) : null;
  
  // Standalone squads: squads NOT attached to a program (alumni squads, coach-created standalone, peer squads)
  // These are shown in the Squad menu/page, regardless of whether they have a coach
  const standaloneSquads = squads.filter(s => !s.programId);
  const hasStandaloneSquad = standaloneSquads.length > 0;
  const hasMultipleStandaloneSquads = standaloneSquads.length > 1;
  
  // Active standalone squad for the Squad page
  // Default to the first standalone squad if current selection is invalid
  const effectiveStandaloneId = standaloneSquads.find(s => s.id === activeStandaloneSquadId)
    ? activeStandaloneSquadId
    : (standaloneSquads[0]?.id || null);
  const activeStandaloneSquad = standaloneSquads.find(s => s.id === effectiveStandaloneId) || null;
  
  // Legacy compatibility: find first coached and first non-coached squad
  const coachedSquad = squads.find(s => s.hasCoach) || null;
  const peerSquad = squads.find(s => !s.hasCoach) || null;
  
  // Convenience flags
  const hasMultipleSquads = squads.length > 1;
  const hasCoachedSquad = !!coachedSquad;
  const hasPeerSquad = !!peerSquad;
  // Legacy flags
  const hasPremiumSquad = hasCoachedSquad;
  const hasStandardSquad = hasPeerSquad;
  const hasBothSquads = hasCoachedSquad && hasPeerSquad;

  // Set active squad ID with cache update
  const setActiveSquadId = useCallback((squadId: string) => {
    setActiveSquadIdState(squadId);
    globalSquadData.activeSquadId = squadId;
    
    // Update hasMoreContributions for the new active squad
    setHasMoreContributions(globalSquadData.hasMoreContributionsBySquad[squadId] ?? true);
  }, []);
  
  // Set active standalone squad ID (for Squad page switcher)
  const setActiveStandaloneSquadId = useCallback((squadId: string) => {
    setActiveStandaloneSquadIdState(squadId);
    globalSquadData.activeStandaloneSquadId = squadId;
  }, []);

  // Fetch squad data with staggered loading for instant UI
  const fetchSquad = useCallback(async (userId: string, isDemoMode: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Demo mode: use generated demo squads
      if (isDemoMode) {
        const demoSquadsData = generateDemoSquadsWithStats();
        // Convert to Squad format - include all 5 squads (first 3 are program-linked, last 2 are standalone)
        const demoSquads: Squad[] = demoSquadsData.map((s, index) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          description: s.description,
          avatarUrl: s.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=a07855&color=fff&size=128&bold=true`,
          organizationId: 'demo-org',
          createdBy: 'demo-coach-user',
          coachId: 'demo-coach-user',
          hasCoach: true,
          programId: s.programId,
          visibility: 'private' as const,
          type: 'manual' as const,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          inviteCode: 'DEMO123',
          // Demo streak and alignment for gauge display
          streak: 5 + (index * 3) + Math.floor(Math.random() * 10), // 5-24 day streak
          avgAlignment: 65 + (index * 5) + Math.floor(Math.random() * 15), // 65-94%
        }));
        
        const demoMembersBySquad: Record<string, SquadMember[]> = {};
        for (const squad of demoSquads) {
          const rawMembers = generateDemoSquadMembers(squad.id, 8);
          demoMembersBySquad[squad.id] = rawMembers.map(m => ({
            odId: m.odataId,
            odUserId: m.odataUserId,
            odSquadId: m.odataSquadId,
            odOrgId: 'demo-org',
            odName: `demo-org_${m.odataUserId}_${m.odataSquadId}`,
            odCreatedAt: m.joinedAt,
            odUpdatedAt: m.joinedAt,
            odHidden: false,
            id: m.odataUserId,
            odataUserId: m.odataUserId,
            odataSquadId: m.odataSquadId,
            squadId: squad.id,
            userId: m.odataUserId,
            createdAt: m.joinedAt,
            updatedAt: m.joinedAt,
            email: m.email,
            firstName: m.firstName,
            lastName: m.lastName,
            imageUrl: m.imageUrl,
            roleInSquad: m.role === 'admin' ? 'coach' as const : 'member' as const,
            joinedAt: m.joinedAt,
            alignment: { score: m.alignment?.score ?? 75, status: 'aligned' as const, checkIns: [], updatedAt: new Date().toISOString() },
            // Add alignmentScore and streak for display in SquadMemberRow
            alignmentScore: m.alignment?.score ?? 75,
            streak: m.streak ?? 4,
          }));
        }
        
        // Generate mock SquadStats for each demo squad
        const demoStatsBySquad: Record<string, SquadStats> = {};
        for (const squad of demoSquads) {
          demoStatsBySquad[squad.id] = {
            avgAlignment: squad.avgAlignment ?? 75,
            alignmentChange: Math.floor(Math.random() * 10) - 3, // -3 to +6
            topPercentile: 10 + Math.floor(Math.random() * 20), // top 10-29%
            contributionHistory: generateDemoContributionHistory(30), // Last 30 days
          };
        }
        
        const defaultActiveId = demoSquads[0]?.id || null;
        const standaloneSquadsList = demoSquads.filter(s => !s.programId);
        const defaultStandaloneId = standaloneSquadsList[0]?.id || null;
        
        globalSquadData = {
          squads: demoSquads,
          membersBySquad: demoMembersBySquad,
          statsBySquad: demoStatsBySquad,
          discoverySquads: [], // Demo mode has squads, so no discovery needed
          activeSquadId: defaultActiveId,
          activeStandaloneSquadId: defaultStandaloneId,
          fetchedForUserId: userId,
          statsLoadedForSquads: new Set(demoSquads.map(s => s.id)), // Mark all as loaded
          contributionDaysLoadedBySquad: Object.fromEntries(demoSquads.map(s => [s.id, 30])),
          hasMoreContributionsBySquad: Object.fromEntries(demoSquads.map(s => [s.id, false])),
        };

        setSquads(demoSquads);
        setMembersBySquad(demoMembersBySquad);
        setStatsBySquad(demoStatsBySquad);
        setDiscoverySquads([]);
        setActiveSquadIdState(defaultActiveId);
        setActiveStandaloneSquadIdState(defaultStandaloneId);
        setIsLoading(false);
        return;
      }

      // STEP 1: Fast fetch without stats - renders page instantly with skeletons
      const fastResponse = await fetch('/api/squad/me?includeStats=false');
      
      if (!fastResponse.ok) {
        throw new Error('Failed to fetch squad');
      }

      const fastData = await fastResponse.json();

      // Extract squads array from response (use new format or legacy)
      const fetchedSquads: Squad[] = fastData.squads?.map((s: { squad: Squad }) => s.squad).filter(Boolean) || [];
      const fetchedMembersBySquad: Record<string, SquadMember[]> = {};

      // Extract discovery squads (available when user has no squads)
      const fetchedDiscoverySquads: DiscoverySquad[] = fastData.discoverySquads || [];
      
      // Build members map from response
      if (fastData.squads) {
        for (const squadData of fastData.squads) {
          if (squadData.squad?.id) {
            fetchedMembersBySquad[squadData.squad.id] = squadData.members || [];
          }
        }
      }
      
      // Legacy fallback: if no squads array, check premium/standard fields
      if (fetchedSquads.length === 0) {
        if (fastData.premiumSquad) {
          fetchedSquads.push(fastData.premiumSquad);
          fetchedMembersBySquad[fastData.premiumSquad.id] = fastData.premiumMembers || [];
        }
        if (fastData.standardSquad) {
          fetchedSquads.push(fastData.standardSquad);
          fetchedMembersBySquad[fastData.standardSquad.id] = fastData.standardMembers || [];
        }
      }
      
      // Determine default active squad (first coached squad, or first squad)
      let defaultActiveId: string | null = null;
      const firstCoached = fetchedSquads.find(s => s.hasCoach);
      if (firstCoached) {
        defaultActiveId = firstCoached.id;
      } else if (fetchedSquads.length > 0) {
        defaultActiveId = fetchedSquads[0].id;
      }
      
      // Determine default standalone squad (first squad without programId)
      const standaloneSquadsList = fetchedSquads.filter(s => !s.programId);
      const defaultStandaloneId = standaloneSquadsList[0]?.id || null;

      // Update global cache
      globalSquadData = {
        squads: fetchedSquads,
        membersBySquad: fetchedMembersBySquad,
        statsBySquad: {},
        discoverySquads: fetchedDiscoverySquads,
        activeSquadId: defaultActiveId,
        activeStandaloneSquadId: defaultStandaloneId,
        fetchedForUserId: userId,
        statsLoadedForSquads: new Set(),
        contributionDaysLoadedBySquad: {},
        hasMoreContributionsBySquad: {},
      };

      setSquads(fetchedSquads);
      setMembersBySquad(fetchedMembersBySquad);
      setDiscoverySquads(fetchedDiscoverySquads);
      setActiveSquadIdState(defaultActiveId);
      setActiveStandaloneSquadIdState(defaultStandaloneId);
      setIsLoading(false); // Page can render now!
      
      // Save to localStorage for instant loading on next visit
      saveSquadCache(userId, {
        squads: fetchedSquads,
        membersBySquad: fetchedMembersBySquad,
        activeSquadId: defaultActiveId,
      });

      // STEP 2: Fetch full stats in background (fills in the alignment bars)
      if (fetchedSquads.length > 0) {
        const fullResponse = await fetch('/api/squad/me?includeStats=true');
        
        if (fullResponse.ok) {
          const fullData = await fullResponse.json();
          
          // Update with real alignment data
          const updatedSquads: Squad[] = fullData.squads?.map((s: { squad: Squad }) => s.squad).filter(Boolean) || fetchedSquads;
          const updatedMembersBySquad: Record<string, SquadMember[]> = {};
          const updatedStatsBySquad: Record<string, SquadStats | null> = {};
          
          if (fullData.squads) {
            for (const squadData of fullData.squads) {
              if (squadData.squad?.id) {
                updatedMembersBySquad[squadData.squad.id] = squadData.members || [];
                updatedStatsBySquad[squadData.squad.id] = squadData.stats || null;
              }
            }
          }
          
          // Legacy fallback
          if (Object.keys(updatedMembersBySquad).length === 0) {
            if (fullData.premiumSquad) {
              updatedMembersBySquad[fullData.premiumSquad.id] = fullData.premiumMembers || [];
              updatedStatsBySquad[fullData.premiumSquad.id] = fullData.premiumStats || null;
            }
            if (fullData.standardSquad) {
              updatedMembersBySquad[fullData.standardSquad.id] = fullData.standardMembers || [];
              updatedStatsBySquad[fullData.standardSquad.id] = fullData.standardStats || null;
            }
          }

          globalSquadData.squads = updatedSquads;
          globalSquadData.membersBySquad = updatedMembersBySquad;
          globalSquadData.statsBySquad = updatedStatsBySquad;

          setSquads(updatedSquads);
          setMembersBySquad(updatedMembersBySquad);
          setStatsBySquad(updatedStatsBySquad);
          
          // Update localStorage cache with full data
          saveSquadCache(userId, {
            squads: updatedSquads,
            membersBySquad: updatedMembersBySquad,
            activeSquadId: defaultActiveId,
          });
        }
      }

    } catch (err) {
      console.error('Error fetching squad:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch squad');

      // Clear cache on error
      globalSquadData = {
        squads: [],
        membersBySquad: {},
        statsBySquad: {},
        discoverySquads: [],
        activeSquadId: null,
        activeStandaloneSquadId: null,
        fetchedForUserId: userId,
        statsLoadedForSquads: new Set(),
        contributionDaysLoadedBySquad: {},
        hasMoreContributionsBySquad: {},
      };
      
      setSquads([]);
      setMembersBySquad({});
      setStatsBySquad({});
      setDiscoverySquads([]);
      setActiveSquadIdState(null);
      setActiveStandaloneSquadIdState(null);
      setIsLoading(false);
    }
  }, []);

  // Fetch expensive stats tab data (lazy loaded) - for the ACTIVE squad
  const fetchStatsTabData = useCallback(async () => {
    if (!activeSquadId) return;
    
    // Check if already loaded for this squad
    if (globalSquadData.statsLoadedForSquads.has(activeSquadId) || isLoadingStats) return;
    
    try {
      setIsLoadingStats(true);

      // Use squad ID directly instead of type
      const activeSquadData = squads.find(s => s.id === activeSquadId);
      const squadType = activeSquadData?.hasCoach ? 'premium' : 'standard';
      
      const response = await fetch(`/api/squad/stats?type=${squadType}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data: { 
        topPercentile: number; 
        contributionHistory: ContributionDay[];
        hasMore: boolean;
      } = await response.json();

      // Merge with existing stats for the active squad
      const currentStats = statsBySquad[activeSquadId];
      const updatedStats = currentStats ? {
        ...currentStats,
        topPercentile: data.topPercentile,
        contributionHistory: data.contributionHistory,
      } : {
        avgAlignment: 0,
        alignmentChange: 0,
        topPercentile: data.topPercentile,
        contributionHistory: data.contributionHistory,
      };

      // Update global cache and state
      globalSquadData.statsBySquad[activeSquadId] = updatedStats;
      globalSquadData.statsLoadedForSquads.add(activeSquadId);
      globalSquadData.contributionDaysLoadedBySquad[activeSquadId] = data.contributionHistory.length;
      globalSquadData.hasMoreContributionsBySquad[activeSquadId] = data.hasMore;
      
      setStatsBySquad(prev => ({ ...prev, [activeSquadId]: updatedStats }));
      setHasMoreContributions(data.hasMore);

    } catch (err) {
      console.error('Error fetching stats tab data:', err);
      // Don't set error - just log it, basic data is still available
    } finally {
      setIsLoadingStats(false);
    }
  }, [activeSquadId, squads, statsBySquad, isLoadingStats]);

  // Load more contribution history (pagination) - for the ACTIVE squad
  const loadMoreContributions = useCallback(async () => {
    if (!activeSquadId || isLoadingMoreContributions || !hasMoreContributions) return;
    
    const currentStats = statsBySquad[activeSquadId];
    if (!currentStats) return;
    
    try {
      setIsLoadingMoreContributions(true);

      const offset = globalSquadData.contributionDaysLoadedBySquad[activeSquadId] || 0;
      const activeSquadData = squads.find(s => s.id === activeSquadId);
      const squadType = activeSquadData?.hasCoach ? 'premium' : 'standard';
      
      const response = await fetch(`/api/squad/stats?type=${squadType}&offset=${offset}&limit=30`);
      
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

      // Update global cache and state
      globalSquadData.statsBySquad[activeSquadId] = updatedStats;
      globalSquadData.contributionDaysLoadedBySquad[activeSquadId] = (offset + data.contributionHistory.length);
      globalSquadData.hasMoreContributionsBySquad[activeSquadId] = data.hasMore;
      
      setStatsBySquad(prev => ({ ...prev, [activeSquadId]: updatedStats }));
      setHasMoreContributions(data.hasMore);

    } catch (err) {
      console.error('Error loading more contributions:', err);
    } finally {
      setIsLoadingMoreContributions(false);
    }
  }, [activeSquadId, squads, statsBySquad, isLoadingMoreContributions, hasMoreContributions]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    if (user?.id || isDemoMode) {
      // Reset all stats loading state
      globalSquadData.statsLoadedForSquads = new Set();
      globalSquadData.contributionDaysLoadedBySquad = {};
      globalSquadData.hasMoreContributionsBySquad = {};
      setHasMoreContributions(true);
      await fetchSquad(user?.id || 'demo-user', isDemoMode);
    }
  }, [user?.id, isDemoMode, fetchSquad]);

  // Initial fetch when user is available
  useEffect(() => {
    // In demo mode, skip waiting for Clerk to load
    if (!isDemoMode && !isLoaded) return;

    // No user = clear data (but not in demo mode)
    if (!user && !isDemoMode) {
      globalSquadData = {
        squads: [],
        membersBySquad: {},
        statsBySquad: {},
        discoverySquads: [],
        activeSquadId: null,
        activeStandaloneSquadId: null,
        fetchedForUserId: null,
        statsLoadedForSquads: new Set(),
        contributionDaysLoadedBySquad: {},
        hasMoreContributionsBySquad: {},
      };
      setSquads([]);
      setMembersBySquad({});
      setStatsBySquad({});
      setDiscoverySquads([]);
      setActiveSquadIdState(null);
      setActiveStandaloneSquadIdState(null);
      setIsLoading(false);
      setHasMoreContributions(true);
      return;
    }

    // In demo mode with no user, use demo user ID
    const userId = user?.id || 'demo-user';

    // Already fetched for this user = use cached data
    if (globalSquadData.fetchedForUserId === userId) {
      setSquads(globalSquadData.squads);
      setMembersBySquad(globalSquadData.membersBySquad);
      setStatsBySquad(globalSquadData.statsBySquad);
      setDiscoverySquads(globalSquadData.discoverySquads);
      setActiveSquadIdState(globalSquadData.activeSquadId);
      setActiveStandaloneSquadIdState(globalSquadData.activeStandaloneSquadId);
      setIsLoading(false);

      // Set hasMoreContributions based on active squad
      if (globalSquadData.activeSquadId) {
        setHasMoreContributions(globalSquadData.hasMoreContributionsBySquad[globalSquadData.activeSquadId] ?? true);
      }
      return;
    }

    // Fetch for new user
    fetchSquad(userId, isDemoMode);
  }, [user, isLoaded, isDemoMode, fetchSquad]);

  return (
    <SquadContext.Provider value={{
      // Active squad (shorthand)
      squad: activeSquad,
      members: activeMembers,
      stats: activeStats,
      
      // Multi-squad data
      squads,
      membersBySquad,
      statsBySquad,
      
      // Standalone squads (for Squad page)
      standaloneSquads,
      activeStandaloneSquad,
      activeStandaloneSquadId: effectiveStandaloneId,
      setActiveStandaloneSquadId,
      hasStandaloneSquad,
      hasMultipleStandaloneSquads,

      // Discovery squads (available to join when user has no squads)
      discoverySquads,

      // Legacy compatibility (first coached and first non-coached)
      premiumSquad: coachedSquad,
      premiumMembers: coachedSquad ? (membersBySquad[coachedSquad.id] || []) : [],
      premiumStats: coachedSquad ? (statsBySquad[coachedSquad.id] || null) : null,
      standardSquad: peerSquad,
      standardMembers: peerSquad ? (membersBySquad[peerSquad.id] || []) : [],
      standardStats: peerSquad ? (statsBySquad[peerSquad.id] || null) : null,
      
      // Squad switching
      activeSquadId,
      setActiveSquadId,
      
      // Convenience flags
      hasMultipleSquads,
      hasCoachedSquad,
      hasPeerSquad,
      // Legacy flags
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
 * For users with multiple squads:
 * - Use `squad`, `members`, `stats` to get the active (currently viewed) squad
 * - Use `squads` to access all squads user is in
 * - Use `setActiveSquadId` to switch between them
 * - Use `hasMultipleSquads` to check if user has multiple squad membership
 * 
 * For standalone squads (Squad page):
 * - Use `standaloneSquads` to get all squads not attached to a program
 * - Use `activeStandaloneSquad` to get the currently viewed standalone squad
 * - Use `setActiveStandaloneSquadId` to switch between standalone squads
 * - Use `hasStandaloneSquad` to check if user has any standalone squad
 * - Use `hasMultipleStandaloneSquads` to show a switcher
 * 
 * Legacy support for dual-squad (premium/standard):
 * - Use `premiumSquad`, `standardSquad` to access coached and non-coached squads
 * - Use `hasBothSquads` to check if user has dual membership
 */
export function useSquadContext(): SquadContextValue {
  const context = useContext(SquadContext);
  if (context === undefined) {
    throw new Error('useSquadContext must be used within a SquadProvider');
  }
  return context;
}

// Export legacy type for backward compatibility
export type SquadType = 'premium' | 'standard';

/**
 * @deprecated Use setActiveSquadId instead
 */
export type { SquadContextValue };
