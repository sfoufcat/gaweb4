'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth, useOrganizationList } from '@clerk/nextjs';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranding } from '@/contexts/BrandingContext';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/safe-storage';

type ViewMode = 'coach' | 'client';

interface ViewModeContextType {
  /** Current view mode */
  viewMode: ViewMode;
  /** Set the view mode */
  setViewMode: (mode: ViewMode) => void;
  /** Toggle between coach and client view */
  toggleViewMode: () => void;
  /** Whether the user can access coach view (is coach/super_coach of CURRENT org) */
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
  const { isLoaded: authLoaded } = useAuth();
  const { isDemoSite } = useDemoMode();

  // Use OrganizationContext to check role in CURRENT organization (Firestore-based)
  const { currentMembership, isLoading: orgLoading } = useOrganization();

  // Get Clerk native organization memberships (direct from Clerk - source of truth)
  const { userMemberships, isLoaded: clerkOrgsLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  // Get branding to determine current tenant org
  const { effectiveBranding } = useBranding();
  const isDefault = effectiveBranding?.organizationId === 'default';

  // Get the current tenant org ID (on tenant domains)
  const currentTenantOrgId = useMemo(() => {
    if (isDefault || !effectiveBranding?.organizationId || effectiveBranding.organizationId === 'default') {
      return null;
    }
    return effectiveBranding.organizationId;
  }, [isDefault, effectiveBranding?.organizationId]);

  // Find user's Clerk membership in the current tenant org
  const clerkTenantMembership = useMemo(() => {
    if (!currentTenantOrgId || !userMemberships?.data) {
      return null;
    }
    return userMemberships.data.find(m => m.organization.id === currentTenantOrgId);
  }, [currentTenantOrgId, userMemberships?.data]);

  // Check if user is org:admin in Clerk for this tenant (= super_coach equivalent)
  const isClerkAdmin = clerkTenantMembership?.role === 'org:admin';

  const [viewMode, setViewModeState] = useState<ViewMode>('client');
  const [mounted, setMounted] = useState(false);

  // Check if user is coach/super_coach of the CURRENT organization
  // Checks BOTH Clerk native memberships (source of truth) AND Firestore memberships
  const orgRole = currentMembership?.orgRole;
  const canAccessCoachView = useMemo(() => {
    const isFirestoreCoach = orgRole === 'coach' || orgRole === 'super_coach';
    console.log('[VIEW_MODE] canAccessCoachView check:', {
      isDemoSite,
      currentTenantOrgId,
      isClerkAdmin,
      clerkRole: clerkTenantMembership?.role,
      firestoreOrgRole: orgRole,
      isFirestoreCoach,
      result: isDemoSite || isClerkAdmin || isFirestoreCoach,
    });
    if (isDemoSite) return true;
    // Check Clerk first (source of truth) - org:admin = super_coach
    if (isClerkAdmin) return true;
    // Fallback to Firestore membership
    return isFirestoreCoach;
  }, [isDemoSite, isClerkAdmin, clerkTenantMembership?.role, orgRole, currentTenantOrgId]);

  // Initialize from localStorage, default to 'coach' if user has coach access
  useEffect(() => {
    setMounted(true);

    // Wait for both Clerk and Firestore to load
    if (!authLoaded || orgLoading || !clerkOrgsLoaded) return;

    const stored = safeGetItem(STORAGE_KEY) as ViewMode | null;

    if (stored === 'coach' || stored === 'client') {
      // If stored preference is coach but user doesn't have access, switch to client
      if (stored === 'coach' && !canAccessCoachView) {
        setViewModeState('client');
        safeRemoveItem(STORAGE_KEY);
      } else {
        setViewModeState(stored);
      }
    } else {
      // No stored preference - default to coach view if user has access
      if (canAccessCoachView) {
        setViewModeState('coach');
      }
    }
  }, [authLoaded, orgLoading, clerkOrgsLoaded, canAccessCoachView]);

  const setViewMode = useCallback((mode: ViewMode) => {
    // Don't allow coach view for non-coaches
    if (mode === 'coach' && !canAccessCoachView) {
      return;
    }
    setViewModeState(mode);
    safeSetItem(STORAGE_KEY, mode);
  }, [canAccessCoachView]);

  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'coach' ? 'client' : 'coach';
    setViewMode(newMode);
  }, [viewMode, setViewMode]);

  const isCoachView = viewMode === 'coach' && canAccessCoachView;
  const isClientView = !isCoachView;
  const isLoading = !mounted || !authLoaded || orgLoading || !clerkOrgsLoaded;

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
