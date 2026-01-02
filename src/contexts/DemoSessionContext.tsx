'use client';

/**
 * Demo Session Context
 * 
 * Provides session-scoped demo data management for the demo site.
 * All data is stored in React state and synced to sessionStorage.
 * Each browser tab gets its own isolated demo session.
 * 
 * Features:
 * - Session-isolated demo data (each tab has its own data)
 * - CRUD operations for all entity types
 * - Persists to sessionStorage for page refresh survival
 * - Initializes with realistic seed data
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { getDemoSessionId, isDemoSubdomain } from '@/lib/demo-utils';
import {
  generateDemoClients,
  generateDemoSquadsWithStats,
  generateDemoSquadMembers,
  generateDemoProgramsWithStats,
  generateDemoProgramDays,
  generateDemoProgramCohorts,
  generateDemoFunnels,
  generateDemoReferrals,
  generateDemoCommunityHealth,
  generateDemoFeedAnalytics,
  generateDemoChatAnalytics,
  generateDemoProductAnalytics,
  generateDemoFunnelAnalytics,
  type DemoClient,
  type DemoSquadWithStats,
  type DemoSquadMember,
  type DemoProgramWithStats,
  type DemoProgramDay,
  type DemoProgramCohort,
  type DemoFunnel,
  type DemoReferral,
} from '@/lib/demo-data';

// ============================================================================
// Types
// ============================================================================

interface DemoSessionState {
  clients: DemoClient[];
  squads: DemoSquadWithStats[];
  squadMembers: Record<string, DemoSquadMember[]>; // Keyed by squadId
  programs: DemoProgramWithStats[];
  programDays: Record<string, DemoProgramDay[]>; // Keyed by programId
  programCohorts: Record<string, DemoProgramCohort[]>; // Keyed by programId
  funnels: DemoFunnel[];
  referrals: DemoReferral[];
}

interface DemoSessionActions {
  // Clients
  addClient: (client: Omit<DemoClient, 'userId'>) => string;
  updateClient: (userId: string, updates: Partial<DemoClient>) => void;
  deleteClient: (userId: string) => void;
  
  // Squads
  addSquad: (squad: Omit<DemoSquadWithStats, 'id'>) => string;
  updateSquad: (id: string, updates: Partial<DemoSquadWithStats>) => void;
  deleteSquad: (id: string) => void;
  addSquadMember: (squadId: string, member: Omit<DemoSquadMember, 'odataId'>) => string;
  removeSquadMember: (squadId: string, odataId: string) => void;
  
  // Programs
  addProgram: (program: Omit<DemoProgramWithStats, 'id'>) => string;
  updateProgram: (id: string, updates: Partial<DemoProgramWithStats>) => void;
  deleteProgram: (id: string) => void;
  updateProgramDay: (programId: string, dayIndex: number, updates: Partial<DemoProgramDay>) => void;
  addProgramCohort: (programId: string, cohort: Omit<DemoProgramCohort, 'id'>) => string;
  updateProgramCohort: (programId: string, cohortId: string, updates: Partial<DemoProgramCohort>) => void;
  deleteProgramCohort: (programId: string, cohortId: string) => void;
  
  // Funnels
  addFunnel: (funnel: Omit<DemoFunnel, 'id'>) => string;
  updateFunnel: (id: string, updates: Partial<DemoFunnel>) => void;
  deleteFunnel: (id: string) => void;
  
  // Referrals (read-only typically, but included for completeness)
  addReferral: (referral: Omit<DemoReferral, 'id'>) => string;
  
  // Utilities
  resetSession: () => void;
  getSquadMembers: (squadId: string) => DemoSquadMember[];
  getProgramDays: (programId: string) => DemoProgramDay[];
  getProgramCohorts: (programId: string) => DemoProgramCohort[];
}

interface DemoSessionContextValue extends DemoSessionState, DemoSessionActions {
  isInitialized: boolean;
  sessionId: string;
  isDemoSite: boolean;
}

const DemoSessionContext = createContext<DemoSessionContextValue | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'demo-session-data';

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function createInitialState(): DemoSessionState {
  const { clients } = generateDemoClients(18);
  const squads = generateDemoSquadsWithStats();
  const programs = generateDemoProgramsWithStats();
  const funnels = generateDemoFunnels();
  const { referrals } = generateDemoReferrals();
  
  // Pre-generate squad members for each squad
  const squadMembers: Record<string, DemoSquadMember[]> = {};
  for (const squad of squads) {
    squadMembers[squad.id] = generateDemoSquadMembers(squad.id, squad.memberCount);
  }
  
  // Pre-generate program days and cohorts
  const programDays: Record<string, DemoProgramDay[]> = {};
  const programCohorts: Record<string, DemoProgramCohort[]> = {};
  for (const program of programs) {
    programDays[program.id] = generateDemoProgramDays(program.id, program.durationDays);
    programCohorts[program.id] = generateDemoProgramCohorts(program.id);
  }
  
  return {
    clients,
    squads,
    squadMembers,
    programs,
    programDays,
    programCohorts,
    funnels,
    referrals,
  };
}

// ============================================================================
// Provider Component
// ============================================================================

interface DemoSessionProviderProps {
  children: ReactNode;
}

export function DemoSessionProvider({ children }: DemoSessionProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isDemoSite, setIsDemoSite] = useState(false);
  const [state, setState] = useState<DemoSessionState>(() => createInitialState());

  // Initialize on mount
  useEffect(() => {
    const demo = isDemoSubdomain();
    setIsDemoSite(demo);
    
    if (demo) {
      const id = getDemoSessionId();
      setSessionId(id);
      
      // Try to load from sessionStorage
      const storageKey = `${STORAGE_KEY_PREFIX}-${id}`;
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          setState(parsed);
        }
      } catch {
        // Use fresh initial state
      }
    }
    
    setIsInitialized(true);
  }, []);

  // Save to sessionStorage when state changes
  useEffect(() => {
    if (!isInitialized || !isDemoSite || !sessionId) return;
    
    const storageKey = `${STORAGE_KEY_PREFIX}-${sessionId}`;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // sessionStorage quota exceeded or not available
    }
  }, [state, isInitialized, isDemoSite, sessionId]);

  // ============================================================================
  // Client Actions
  // ============================================================================

  const addClient = useCallback((client: Omit<DemoClient, 'userId'>): string => {
    const userId = generateId('client');
    const newClient: DemoClient = { ...client, userId };
    setState(prev => ({ ...prev, clients: [...prev.clients, newClient] }));
    return userId;
  }, []);

  const updateClient = useCallback((userId: string, updates: Partial<DemoClient>) => {
    setState(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.userId === userId ? { ...c, ...updates } : c),
    }));
  }, []);

  const deleteClient = useCallback((userId: string) => {
    setState(prev => ({
      ...prev,
      clients: prev.clients.filter(c => c.userId !== userId),
    }));
  }, []);

  // ============================================================================
  // Squad Actions
  // ============================================================================

  const addSquad = useCallback((squad: Omit<DemoSquadWithStats, 'id'>): string => {
    const id = generateId('squad');
    const newSquad: DemoSquadWithStats = { ...squad, id };
    setState(prev => ({
      ...prev,
      squads: [...prev.squads, newSquad],
      squadMembers: { ...prev.squadMembers, [id]: [] },
    }));
    return id;
  }, []);

  const updateSquad = useCallback((id: string, updates: Partial<DemoSquadWithStats>) => {
    setState(prev => ({
      ...prev,
      squads: prev.squads.map(s => s.id === id ? { ...s, ...updates } : s),
    }));
  }, []);

  const deleteSquad = useCallback((id: string) => {
    setState(prev => {
      const { [id]: _, ...remainingMembers } = prev.squadMembers;
      return {
        ...prev,
        squads: prev.squads.filter(s => s.id !== id),
        squadMembers: remainingMembers,
      };
    });
  }, []);

  const addSquadMember = useCallback((squadId: string, member: Omit<DemoSquadMember, 'odataId'>): string => {
    const odataId = generateId('member');
    const newMember: DemoSquadMember = { ...member, odataId };
    setState(prev => ({
      ...prev,
      squadMembers: {
        ...prev.squadMembers,
        [squadId]: [...(prev.squadMembers[squadId] || []), newMember],
      },
      squads: prev.squads.map(s => 
        s.id === squadId ? { ...s, memberCount: s.memberCount + 1 } : s
      ),
    }));
    return odataId;
  }, []);

  const removeSquadMember = useCallback((squadId: string, odataId: string) => {
    setState(prev => ({
      ...prev,
      squadMembers: {
        ...prev.squadMembers,
        [squadId]: (prev.squadMembers[squadId] || []).filter(m => m.odataId !== odataId),
      },
      squads: prev.squads.map(s => 
        s.id === squadId ? { ...s, memberCount: Math.max(0, s.memberCount - 1) } : s
      ),
    }));
  }, []);

  const getSquadMembers = useCallback((squadId: string): DemoSquadMember[] => {
    return state.squadMembers[squadId] || [];
  }, [state.squadMembers]);

  // ============================================================================
  // Program Actions
  // ============================================================================

  const addProgram = useCallback((program: Omit<DemoProgramWithStats, 'id'>): string => {
    const id = generateId('program');
    const newProgram: DemoProgramWithStats = { ...program, id };
    const days = generateDemoProgramDays(id, program.durationDays);
    setState(prev => ({
      ...prev,
      programs: [...prev.programs, newProgram],
      programDays: { ...prev.programDays, [id]: days },
      programCohorts: { ...prev.programCohorts, [id]: [] },
    }));
    return id;
  }, []);

  const updateProgram = useCallback((id: string, updates: Partial<DemoProgramWithStats>) => {
    setState(prev => ({
      ...prev,
      programs: prev.programs.map(p => p.id === id ? { ...p, ...updates } : p),
    }));
  }, []);

  const deleteProgram = useCallback((id: string) => {
    setState(prev => {
      const { [id]: _days, ...remainingDays } = prev.programDays;
      const { [id]: _cohorts, ...remainingCohorts } = prev.programCohorts;
      return {
        ...prev,
        programs: prev.programs.filter(p => p.id !== id),
        programDays: remainingDays,
        programCohorts: remainingCohorts,
      };
    });
  }, []);

  const updateProgramDay = useCallback((programId: string, dayIndex: number, updates: Partial<DemoProgramDay>) => {
    setState(prev => ({
      ...prev,
      programDays: {
        ...prev.programDays,
        [programId]: (prev.programDays[programId] || []).map(d => 
          d.dayIndex === dayIndex ? { ...d, ...updates } : d
        ),
      },
    }));
  }, []);

  const addProgramCohort = useCallback((programId: string, cohort: Omit<DemoProgramCohort, 'id'>): string => {
    const id = generateId('cohort');
    const newCohort: DemoProgramCohort = { ...cohort, id };
    setState(prev => ({
      ...prev,
      programCohorts: {
        ...prev.programCohorts,
        [programId]: [...(prev.programCohorts[programId] || []), newCohort],
      },
    }));
    return id;
  }, []);

  const updateProgramCohort = useCallback((programId: string, cohortId: string, updates: Partial<DemoProgramCohort>) => {
    setState(prev => ({
      ...prev,
      programCohorts: {
        ...prev.programCohorts,
        [programId]: (prev.programCohorts[programId] || []).map(c => 
          c.id === cohortId ? { ...c, ...updates } : c
        ),
      },
    }));
  }, []);

  const deleteProgramCohort = useCallback((programId: string, cohortId: string) => {
    setState(prev => ({
      ...prev,
      programCohorts: {
        ...prev.programCohorts,
        [programId]: (prev.programCohorts[programId] || []).filter(c => c.id !== cohortId),
      },
    }));
  }, []);

  const getProgramDays = useCallback((programId: string): DemoProgramDay[] => {
    return state.programDays[programId] || [];
  }, [state.programDays]);

  const getProgramCohorts = useCallback((programId: string): DemoProgramCohort[] => {
    return state.programCohorts[programId] || [];
  }, [state.programCohorts]);

  // ============================================================================
  // Funnel Actions
  // ============================================================================

  const addFunnel = useCallback((funnel: Omit<DemoFunnel, 'id'>): string => {
    const id = generateId('funnel');
    const newFunnel: DemoFunnel = { ...funnel, id };
    setState(prev => ({ ...prev, funnels: [...prev.funnels, newFunnel] }));
    return id;
  }, []);

  const updateFunnel = useCallback((id: string, updates: Partial<DemoFunnel>) => {
    setState(prev => ({
      ...prev,
      funnels: prev.funnels.map(f => f.id === id ? { ...f, ...updates } : f),
    }));
  }, []);

  const deleteFunnel = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      funnels: prev.funnels.filter(f => f.id !== id),
    }));
  }, []);

  // ============================================================================
  // Referral Actions
  // ============================================================================

  const addReferral = useCallback((referral: Omit<DemoReferral, 'id'>): string => {
    const id = generateId('referral');
    const newReferral: DemoReferral = { ...referral, id };
    setState(prev => ({ ...prev, referrals: [...prev.referrals, newReferral] }));
    return id;
  }, []);

  // ============================================================================
  // Utility Actions
  // ============================================================================

  const resetSession = useCallback(() => {
    setState(createInitialState());
    if (sessionId) {
      const storageKey = `${STORAGE_KEY_PREFIX}-${sessionId}`;
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
    }
  }, [sessionId]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value = useMemo<DemoSessionContextValue>(() => ({
    // State
    ...state,
    isInitialized,
    sessionId,
    isDemoSite,
    
    // Actions
    addClient,
    updateClient,
    deleteClient,
    addSquad,
    updateSquad,
    deleteSquad,
    addSquadMember,
    removeSquadMember,
    getSquadMembers,
    addProgram,
    updateProgram,
    deleteProgram,
    updateProgramDay,
    addProgramCohort,
    updateProgramCohort,
    deleteProgramCohort,
    getProgramDays,
    getProgramCohorts,
    addFunnel,
    updateFunnel,
    deleteFunnel,
    addReferral,
    resetSession,
  }), [
    state,
    isInitialized,
    sessionId,
    isDemoSite,
    addClient,
    updateClient,
    deleteClient,
    addSquad,
    updateSquad,
    deleteSquad,
    addSquadMember,
    removeSquadMember,
    getSquadMembers,
    addProgram,
    updateProgram,
    deleteProgram,
    updateProgramDay,
    addProgramCohort,
    updateProgramCohort,
    deleteProgramCohort,
    getProgramDays,
    getProgramCohorts,
    addFunnel,
    updateFunnel,
    deleteFunnel,
    addReferral,
    resetSession,
  ]);

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useDemoSession(): DemoSessionContextValue {
  const context = useContext(DemoSessionContext);
  
  if (context === undefined) {
    // Return a default value for non-demo contexts
    const emptyState = createInitialState();
    return {
      ...emptyState,
      isInitialized: false,
      sessionId: '',
      isDemoSite: false,
      addClient: () => '',
      updateClient: () => {},
      deleteClient: () => {},
      addSquad: () => '',
      updateSquad: () => {},
      deleteSquad: () => {},
      addSquadMember: () => '',
      removeSquadMember: () => {},
      getSquadMembers: () => [],
      addProgram: () => '',
      updateProgram: () => {},
      deleteProgram: () => {},
      updateProgramDay: () => {},
      addProgramCohort: () => '',
      updateProgramCohort: () => {},
      deleteProgramCohort: () => {},
      getProgramDays: () => [],
      getProgramCohorts: () => [],
      addFunnel: () => '',
      updateFunnel: () => {},
      deleteFunnel: () => {},
      addReferral: () => '',
      resetSession: () => {},
    };
  }
  
  return context;
}

// ============================================================================
// Analytics Hooks (computed from session state)
// ============================================================================

export function useDemoAnalytics() {
  const { clients, squads } = useDemoSession();
  
  return useMemo(() => {
    // These are generated fresh but use the same seed, so they're consistent
    const communityHealth = generateDemoCommunityHealth();
    const feedAnalytics = generateDemoFeedAnalytics();
    const chatAnalytics = generateDemoChatAnalytics();
    const productAnalytics = generateDemoProductAnalytics();
    const funnelAnalytics = generateDemoFunnelAnalytics();
    
    return {
      communityHealth,
      feedAnalytics,
      chatAnalytics,
      productAnalytics,
      funnelAnalytics,
      // Client summary based on actual session clients
      clientSummary: {
        totalClients: clients.length,
        thrivingCount: clients.filter(c => c.status === 'thriving').length,
        activeCount: clients.filter(c => c.status === 'active').length,
        inactiveCount: clients.filter(c => c.status === 'inactive').length,
        atRiskCount: clients.filter(c => c.atRisk).length,
        activeRate: Math.round(
          (clients.filter(c => c.status === 'thriving' || c.status === 'active').length / clients.length) * 100
        ),
      },
      // Squad summary based on actual session squads
      squadSummary: {
        totalSquads: squads.length,
        totalMembers: squads.reduce((sum, s) => sum + s.memberCount, 0),
      },
    };
  }, [clients, squads]);
}

