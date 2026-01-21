'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { UserRole, OrgRole } from '@/types';

type ViewMode = 'coach' | 'client';

interface ViewModeContextType {
  /** Current view mode */
  viewMode: ViewMode;
  /** Set the view mode */
  setViewMode: (mode: ViewMode) => void;
  /** Toggle between coach and client view */
  toggleViewMode: () => void;
  /** Whether the user can access coach view (has coach role) */
  canAccessCoachView: boolean;
  /** Convenience helpers */
  isCoachView: boolean;
  isClientView: boolean;
  /** Loading state while determining role */
  isLoading: boolean;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

const STORAGE_KEY = 'ga-view-mode';

interface ViewModeProviderProps {
  children: React.ReactNode;
}

export function ViewModeProvider({ children }: ViewModeProviderProps) {
  const { sessionClaims, isLoaded: authLoaded } = useAuth();
  const { isDemoSite } = useDemoMode();

  const [viewMode, setViewModeState] = useState<ViewMode>('client');
  const [mounted, setMounted] = useState(false);

  // Get role from session claims
  const publicMetadata = sessionClaims?.publicMetadata as {
    role?: UserRole;
    orgRole?: OrgRole;
  } | undefined;

  const role = publicMetadata?.role;
  const orgRole = publicMetadata?.orgRole;

  // Demo mode simulates a coach
  const canAccessCoachView = useMemo(() => {
    if (isDemoSite) return true;
    return canAccessCoachDashboard(role, orgRole);
  }, [isDemoSite, role, orgRole]);

  // Initialize from localStorage, default to 'coach' if user has coach access
  useEffect(() => {
    setMounted(true);

    if (!authLoaded) return;

    const stored = localStorage.getItem(STORAGE_KEY) as ViewMode | null;

    if (stored === 'coach' || stored === 'client') {
      // If stored preference is coach but user doesn't have access, switch to client
      if (stored === 'coach' && !canAccessCoachView) {
        setViewModeState('client');
        localStorage.removeItem(STORAGE_KEY);
      } else {
        setViewModeState(stored);
      }
    } else {
      // No stored preference - default to coach view if user has access
      if (canAccessCoachView) {
        setViewModeState('coach');
      }
    }
  }, [authLoaded, canAccessCoachView]);

  const setViewMode = useCallback((mode: ViewMode) => {
    // Don't allow coach view for non-coaches
    if (mode === 'coach' && !canAccessCoachView) {
      return;
    }
    setViewModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [canAccessCoachView]);

  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'coach' ? 'client' : 'coach';
    setViewMode(newMode);
  }, [viewMode, setViewMode]);

  const isCoachView = viewMode === 'coach' && canAccessCoachView;
  const isClientView = !isCoachView;
  const isLoading = !mounted || !authLoaded;

  // Don't block rendering while loading - just use default values
  const value = useMemo(() => ({
    viewMode: canAccessCoachView ? viewMode : 'client',
    setViewMode,
    toggleViewMode,
    canAccessCoachView,
    isCoachView,
    isClientView,
    isLoading,
  }), [viewMode, setViewMode, toggleViewMode, canAccessCoachView, isCoachView, isClientView, isLoading]);

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}

/**
 * Hook to check if we should show coach-specific content
 * Returns false during loading to prevent flash
 */
export function useIsCoachView() {
  const { isCoachView, isLoading } = useViewMode();
  return !isLoading && isCoachView;
}

/**
 * Hook to check if we should redirect in coach view
 * Useful for program/squad pages
 */
export function useShouldRedirectToCoach() {
  const { isCoachView, isLoading, canAccessCoachView } = useViewMode();
  return {
    shouldRedirect: !isLoading && isCoachView,
    isLoading,
    canAccessCoachView,
  };
}
