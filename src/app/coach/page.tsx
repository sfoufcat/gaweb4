'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useOrganization as useClerkOrganization, useOrganizationList } from '@clerk/nextjs';
import { isOrgCoach } from '@/lib/admin-utils-shared';
import { ClientDetailView, CustomizeBrandingTab, ChannelManagementTab, PaymentFailedBanner, CoachSidebar, MobileCoachMenu, IntegrationConnectedModal } from '@/components/coach';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, AlertCircle, Users } from 'lucide-react';
import type { ClerkPublicMetadata, OrgRole, ProgramCohort, CoachSubscription } from '@/types';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranding, useBrandingValues } from '@/contexts/BrandingContext';

// Admin components for expanded coach dashboard
import { AdminUsersTab, type ColumnKey } from '@/components/admin/AdminUsersTab';
import { AdminDiscoverTab, AdminEventsSection } from '@/components/admin/discover';
import { AdminPremiumUpgradeFormsTab } from '@/components/admin/AdminPremiumUpgradeFormsTab';
import { AdminCoachingIntakeFormsTab } from '@/components/admin/AdminCoachingIntakeFormsTab';
import { CoachFunnelsTab } from '@/components/coach/funnels';
import { CoachWebsiteTab } from '@/components/coach/website';
import { CoachProgramsTab } from '@/components/coach/programs';
import { CoachSquadsTab } from '@/components/coach/squads';
import { CoachReferralsTab } from '@/components/coach/referrals';
import { CoachCheckInsTab } from '@/components/coach/checkins';
import { CoachOnboardingFlowTab } from '@/components/coach/onboarding-flow';
import { CoachPlanTab } from '@/components/coach/CoachPlanTab';
import { DiscountCodesTab } from '@/components/coach/DiscountCodesTab';
import { AnalyticsDashboard } from '@/components/coach/analytics';
import { CoachSupportTab } from '@/components/coach/support';
import { FeatureTour } from '@/components/coach/onboarding';
import { AvailabilityEditor, CalendarView } from '@/components/scheduling';
import { CallPricingSettings } from '@/components/coach/CallPricingSettings';
import { IntegrationsTab } from '@/components/coach/settings';
import { CoachDashboardOverview } from '@/components/coach/CoachDashboardOverview';

/**
 * Coach Dashboard Page
 * 
 * Accessible by: coach, admin, super_admin
 * 
 * Features:
 * - Squad selector pill at the top
 * - Embedded SquadView for selected squad
 * - Empty state if no squads available
 * - Placeholder for squad chat (coming soon)
 */

// Valid tab values
type CoachTab = 'clients' | 'squads' | 'programs' | 'referrals' | 'analytics' | 'discounts' | 'discover' | 'upgrade-forms' | 'coaching-forms' | 'funnels' | 'website' | 'checkins' | 'onboarding' | 'channels' | 'scheduling' | 'integrations' | 'customize' | 'plan' | 'support';
const VALID_TABS: CoachTab[] = ['clients', 'squads', 'programs', 'referrals', 'analytics', 'discounts', 'discover', 'upgrade-forms', 'coaching-forms', 'funnels', 'website', 'checkins', 'onboarding', 'channels', 'scheduling', 'integrations', 'customize', 'plan', 'support'];

// Columns for Coach Dashboard (excludes 'tier' - tiers are not used in coach context)
// Uses 'programs' column instead of 'coaching' to show enrolled programs with (1:1)/(Group) prefixes
const COACH_DASHBOARD_COLUMNS: ColumnKey[] = ['select', 'avatar', 'name', 'email', 'role', 'squad', 'programs', 'invitedBy', 'created', 'actions'];

/**
 * Scheduling Tab Component
 * Contains Calendar View, Availability Settings, and Call Pricing with sub-navigation
 */
function SchedulingTab() {
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'events' | 'availability' | 'pricing'>('calendar');
  const [isEventEditorOpen, setIsEventEditorOpen] = useState(false);

  // When event editor is open, render without wrapper (editor handles its own full-page layout)
  if (activeSubTab === 'events' && isEventEditorOpen) {
    return (
      <AdminEventsSection
        key="events-section"
        apiEndpoint="/api/coach/org-discover/events"
        onEditorModeChange={setIsEventEditorOpen}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex gap-2 p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab('calendar')}
          className={`px-4 py-2 rounded-lg font-albert font-medium text-sm transition-colors ${
            activeSubTab === 'calendar'
              ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => setActiveSubTab('events')}
          className={`px-4 py-2 rounded-lg font-albert font-medium text-sm transition-colors ${
            activeSubTab === 'events'
              ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
          }`}
        >
          Events
        </button>
        <button
          onClick={() => setActiveSubTab('availability')}
          className={`px-4 py-2 rounded-lg font-albert font-medium text-sm transition-colors ${
            activeSubTab === 'availability'
              ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
          }`}
        >
          Availability
        </button>
        <button
          onClick={() => setActiveSubTab('pricing')}
          className={`px-4 py-2 rounded-lg font-albert font-medium text-sm transition-colors ${
            activeSubTab === 'pricing'
              ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
          }`}
        >
          Call Pricing
        </button>
      </div>

      {/* Content - Events has its own wrapper, other tabs need the card wrapper */}
      {activeSubTab === 'events' ? (
        <div key="events" className="animate-fadeIn">
          <AdminEventsSection
            key="events-section"
            apiEndpoint="/api/coach/org-discover/events"
            onEditorModeChange={setIsEventEditorOpen}
          />
        </div>
      ) : (
        <div key={activeSubTab} className="animate-fadeIn bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
          {activeSubTab === 'calendar' ? (
            <CalendarView mode="coach" />
          ) : activeSubTab === 'availability' ? (
            <AvailabilityEditor />
          ) : (
            <CallPricingSettings />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Coach Dashboard Page
 */
export default function CoachPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionClaims, isLoaded } = useAuth();
  const { membership: clerkMembership } = useClerkOrganization();
  const { isDemoSite } = useDemoMode();
  const [mounted, setMounted] = useState(false);
  
  // Read initial selection IDs from URL (must be before state that depends on them)
  const tabFromUrl = searchParams.get('tab') as CoachTab | null;
  const initialProgramId = searchParams.get('programId');
  const initialSquadId = searchParams.get('squadId');
  const initialFunnelId = searchParams.get('funnelId');
  const initialFlowId = searchParams.get('flowId');
  const initialClientId = searchParams.get('clientId');
  const initialDiscoverSubTab = searchParams.get('discoverSubTab');
  const initialCourseId = searchParams.get('courseId');
  const initialCustomizeSubtab = searchParams.get('customizeSubtab');
  const initialAnalyticsSubTab = searchParams.get('analyticsSubTab');
  const initialAnalyticsSquadId = searchParams.get('analyticsSquadId');
  
  // Clients tab state - selected client ID for viewing details (initialized from URL)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClientId);
  
  // Ending cohorts banner state
  interface EndingCohortData {
    cohort: ProgramCohort;
    program: { id: string; name: string; coverImageUrl?: string };
    squads: { id: string; name: string; memberCount: number }[];
    daysUntilClose: number;
    convertSquadsToCommunity: boolean;
  }
  const [endingCohorts, setEndingCohorts] = useState<EndingCohortData[]>([]);
  const [convertingSquads, setConvertingSquads] = useState<Set<string>>(new Set());
  
  // Payment failed banner state
  const [subscription, setSubscription] = useState<CoachSubscription | null>(null);

  // Integration connected modal state
  const [integrationConnectedModal, setIntegrationConnectedModal] = useState<{
    isOpen: boolean;
    provider: 'zoom' | 'google_calendar' | 'outlook_calendar' | null;
    accountEmail?: string;
  }>({ isOpen: false, provider: null });

  // Auto-detect initial tab from URL params - if selection param exists, switch to that tab
  const getInitialTab = (): CoachTab => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) return tabFromUrl;
    if (initialProgramId) return 'programs';
    if (initialSquadId) return 'squads';
    if (initialFunnelId) return 'funnels';
    if (initialFlowId) return 'checkins';
    // clientId stays on clients tab (default)
    return 'clients';
  };
  const [activeTab, setActiveTab] = useState<CoachTab>(getInitialTab());

  // Mobile view state: 'menu' shows nav, 'content' shows tab content fullscreen
  // Start in 'content' if URL has a tab param (user is deep-linking)
  const [mobileView, setMobileView] = useState<'menu' | 'content'>(() => {
    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      return urlTab ? 'content' : 'menu';
    }
    return 'menu';
  });

  // Swipe navigation for mobile - swipe right from left edge returns to menu
  const swipeHandlers = useSwipeNavigation({
    onSwipeRight: () => setMobileView('menu'),
    edgeThreshold: 30,
    swipeThreshold: 60,
  });

  // Sync mobileView with URL - when tab param is removed (e.g., clicking coach icon in bottom nav),
  // reset to menu view so user can see MobileCoachMenu
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (!tabParam) {
      setMobileView('menu');
    }
  }, [searchParams]);

  // Handler for tab changes - updates URL without navigation
  // Supports optional filters to set additional URL params (e.g., clientFilter, analyticsSubTab)
  const handleTabChange = useCallback((newTab: CoachTab, filters?: Record<string, string>) => {
    setActiveTab(newTab);
    // On mobile, switch to content view when selecting a tab
    setMobileView('content');

    // Build URL preserving existing query params (like tour=true)
    const url = new URL(window.location.href);
    if (newTab === 'clients') {
      url.searchParams.delete('tab'); // Clean URL for default tab
    } else {
      url.searchParams.set('tab', newTab);
    }
    // Only clear selection params that don't belong to the new tab
    if (newTab !== 'programs') url.searchParams.delete('programId');
    if (newTab !== 'squads') url.searchParams.delete('squadId');
    if (newTab !== 'funnels') url.searchParams.delete('funnelId');
    if (newTab !== 'checkins') url.searchParams.delete('flowId');
    if (newTab !== 'clients') {
      url.searchParams.delete('clientId');
      url.searchParams.delete('clientFilter');
    }
    // Always clear sub-tab params on any tab change (unless provided in filters)
    url.searchParams.delete('discoverSubTab');
    url.searchParams.delete('courseId');
    url.searchParams.delete('customizeSubtab');
    if (!filters?.analyticsSubTab) url.searchParams.delete('analyticsSubTab');
    url.searchParams.delete('analyticsSquadId');

    // Apply any filters passed from dashboard cards
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });
    }

    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Handler for program selection changes - updates URL
  const handleProgramSelect = useCallback((programId: string | null) => {
    // Don't update URL if navigating away from /coach
    if (window.location.pathname !== '/coach') return;

    const url = new URL(window.location.href);
    // Ensure tab is set to programs for URL persistence on refresh
    url.searchParams.set('tab', 'programs');
    if (programId) {
      url.searchParams.set('programId', programId);
    } else {
      url.searchParams.delete('programId');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Handler for squad selection changes - updates URL
  const handleSquadSelect = useCallback((squadId: string | null) => {
    // Don't update URL if navigating away from /coach
    if (window.location.pathname !== '/coach') return;

    const url = new URL(window.location.href);
    // Ensure tab is set to squads for URL persistence on refresh
    url.searchParams.set('tab', 'squads');
    if (squadId) {
      url.searchParams.set('squadId', squadId);
    } else {
      url.searchParams.delete('squadId');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Handler for client selection changes - updates URL
  const handleClientSelect = useCallback((clientId: string | null) => {
    // Don't update URL if navigating away from /coach
    if (window.location.pathname !== '/coach') return;

    setSelectedClientId(clientId);
    const url = new URL(window.location.href);
    if (clientId) {
      url.searchParams.set('clientId', clientId);
    } else {
      url.searchParams.delete('clientId');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Handler for funnel selection changes - updates URL
  const handleFunnelSelect = useCallback((funnelId: string | null) => {
    // Don't update URL if navigating away from /coach
    if (window.location.pathname !== '/coach') return;

    const url = new URL(window.location.href);
    // Ensure tab is set to funnels for URL persistence on refresh
    url.searchParams.set('tab', 'funnels');
    if (funnelId) {
      url.searchParams.set('funnelId', funnelId);
    } else {
      url.searchParams.delete('funnelId');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Handler for check-in flow selection changes - updates URL
  const handleFlowSelect = useCallback((flowId: string | null) => {
    // Don't update URL if navigating away from /coach
    if (window.location.pathname !== '/coach') return;

    const url = new URL(window.location.href);
    // Ensure tab is set to checkins for URL persistence on refresh
    url.searchParams.set('tab', 'checkins');
    if (flowId) {
      url.searchParams.set('flowId', flowId);
    } else {
      url.searchParams.delete('flowId');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Handler for discover sub-tab changes - updates URL
  const handleDiscoverSubTabChange = useCallback((subTab: string | null) => {
    // Don't update URL if navigating away from /coach
    if (window.location.pathname !== '/coach') return;

    const url = new URL(window.location.href);
    // Always ensure tab=discover is set when changing discover subtabs
    url.searchParams.set('tab', 'discover');
    if (subTab && subTab !== 'events') {
      url.searchParams.set('discoverSubTab', subTab);
    } else {
      url.searchParams.delete('discoverSubTab');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Handler for course selection changes - updates URL
  const handleCourseSelect = useCallback((courseId: string | null) => {
    // Don't update URL if navigating away from /coach
    if (window.location.pathname !== '/coach') return;

    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'discover');
    url.searchParams.set('discoverSubTab', 'courses');
    if (courseId) {
      url.searchParams.set('courseId', courseId);
    } else {
      url.searchParams.delete('courseId');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Handler for customize sub-tab changes - updates URL
  const handleCustomizeSubtabChange = useCallback((subtab: string | null) => {
    // Don't update URL if navigating away from /coach
    if (window.location.pathname !== '/coach') return;

    const url = new URL(window.location.href);
    // Always ensure tab=customize is set when changing customize subtabs
    url.searchParams.set('tab', 'customize');
    if (subtab && subtab !== 'branding') {
      url.searchParams.set('customizeSubtab', subtab);
    } else {
      url.searchParams.delete('customizeSubtab');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Handler for analytics sub-tab changes - updates URL
  const handleAnalyticsSubTabChange = useCallback((subTab: string | null) => {
    // Don't update URL if navigating away from /coach
    if (window.location.pathname !== '/coach') return;

    const url = new URL(window.location.href);
    // Always ensure tab=analytics is set when changing analytics subtabs
    url.searchParams.set('tab', 'analytics');
    if (subTab && subTab !== 'clients') {
      url.searchParams.set('analyticsSubTab', subTab);
    } else {
      url.searchParams.delete('analyticsSubTab');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Handler for analytics squad selection changes - updates URL
  const handleAnalyticsSquadSelect = useCallback((squadId: string | null) => {
    // Don't update URL if navigating away from /coach
    if (window.location.pathname !== '/coach') return;

    const url = new URL(window.location.href);
    // Always ensure tab=analytics is set when changing analytics squad
    url.searchParams.set('tab', 'analytics');
    if (squadId) {
      url.searchParams.set('analyticsSquadId', squadId);
    } else {
      url.searchParams.delete('analyticsSquadId');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  // Tabs horizontal scroll with mouse wheel - use callback ref for guaranteed attachment
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const wheelListenerRef = useRef<((e: WheelEvent) => void) | null>(null);

  const setTabsListRef = useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous listener
    if (tabsListRef.current && wheelListenerRef.current) {
      tabsListRef.current.removeEventListener('wheel', wheelListenerRef.current);
    }

    tabsListRef.current = node;

    // Attach new listener with { passive: false } to allow preventDefault
    if (node) {
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        node.scrollLeft += e.deltaY;
      };
      wheelListenerRef.current = handleWheel;
      node.addEventListener('wheel', handleWheel, { passive: false });
    }
  }, []);

  // Sliding highlight state for Vercel-style hover effect
  const [hoverStyle, setHoverStyle] = useState<{
    left: number;
    width: number;
    opacity: number;
  }>({ left: 0, width: 0, opacity: 0 });

  const handleTabMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    const container = tabsListRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      setHoverStyle({
        left: targetRect.left - containerRect.left + container.scrollLeft,
        width: targetRect.width,
        opacity: 1,
      });
    }
  }, []);

  const handleTabsMouseLeave = useCallback(() => {
    setHoverStyle(prev => ({ ...prev, opacity: 0 }));
  }, []);

  // Feature tour state - triggered by ?tour=true from onboarding
  const shouldStartTour = searchParams.get('tour') === 'true';
  const [isTourActive, setIsTourActive] = useState(false);

  // Get role and orgRole from Clerk session (not used on demo site)
  const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
  const role = isDemoSite ? 'coach' : publicMetadata?.role;  // Demo site: simulate coach role
  const metadataOrgRole = publicMetadata?.orgRole as OrgRole | undefined;
  
  // Detect org:admin from Clerk's native organization membership
  // If user is org:admin, they should be treated as super_coach regardless of metadata
  const isOrgAdmin = clerkMembership?.role === 'org:admin';
  const orgRole: OrgRole | undefined = isDemoSite ? 'super_coach' : (isOrgAdmin ? 'super_coach' : metadataOrgRole);
  
  // TENANT-SPECIFIC ACCESS CHECK
  // Get tenant org ID and user's organizations from context
  const { isDefault } = useBrandingValues();
  const { effectiveBranding } = useBranding();
  const { organizations, isLoading: orgLoading } = useOrganization();
  
  // Get Clerk native organization memberships (direct from Clerk)
  const { userMemberships, isLoaded: clerkOrgsLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  
  // Note: effectiveBranding.organizationId is 'default' on platform domain
  const currentTenantOrgId = !isDefault && effectiveBranding.organizationId !== 'default' 
    ? effectiveBranding.organizationId 
    : null;
  
  // Find user's membership in the current tenant org (Firestore-based)
  const currentTenantMembership = useMemo(() => {
    if (!currentTenantOrgId || !organizations || organizations.length === 0) {
      return null;
    }
    return organizations.find(org => org.id === currentTenantOrgId);
  }, [currentTenantOrgId, organizations]);
  
  // Find user's Clerk membership in the current tenant org
  const clerkTenantMembership = useMemo(() => {
    if (!currentTenantOrgId || !userMemberships?.data) {
      return null;
    }
    return userMemberships.data.find(m => m.organization.id === currentTenantOrgId);
  }, [currentTenantOrgId, userMemberships?.data]);
  
  // Check if user is admin in Clerk for this tenant (org:admin = super_coach equivalent)
  const isClerkAdmin = clerkTenantMembership?.role === 'org:admin';
  
  // Determine coach dashboard access:
  // - On platform domain (isDefault=true): Use publicMetadata roles (legacy behavior)
  // - On tenant domain: Check BOTH Clerk native memberships AND Firestore memberships
  const hasAccess = useMemo(() => {
    // Demo mode always has access
    if (isDemoSite) return true;
    
    // Platform domain: use publicMetadata roles (admin, super_admin, global coach)
    if (isDefault) {
      return role === 'coach' || role === 'admin' || role === 'super_admin';
    }
    
    // Tenant domain: check actual membership in THIS tenant
    // Super admins can always access (for debugging/support)
    if (role === 'super_admin') return true;
    
    // Check 1: Clerk native membership - org:admin is equivalent to super_coach
    if (isClerkAdmin) {
      return true;
    }
    
    // Check 2: Firestore membership via OrganizationContext
    if (currentTenantMembership) {
      const membershipOrgRole = currentTenantMembership.membership?.orgRole as OrgRole | undefined;
      return isOrgCoach(membershipOrgRole);
    }
    
    // No membership found - no access (loading state handled separately by isAccessLoading)
    return false;
  }, [isDemoSite, isDefault, role, isClerkAdmin, currentTenantMembership]);

  // Consolidated loading check - true while any auth/org data is still loading
  const isAccessLoading = useMemo(() => {
    if (isDemoSite) return false;
    if (!isLoaded) return true;
    // On tenant domains, wait for Clerk orgs to be fully loaded (not just initialized)
    // - clerkOrgsLoaded: Clerk SDK initialized
    // - userMemberships not ready: data undefined or still fetching
    // - orgLoading: Firestore org data still loading
    const isMembershipsReady = userMemberships?.data !== undefined && userMemberships?.isFetching !== true;
    if (!isDefault && (orgLoading || !clerkOrgsLoaded || !isMembershipsReady)) return true;
    return false;
  }, [isDemoSite, isLoaded, isDefault, orgLoading, clerkOrgsLoaded, userMemberships?.data, userMemberships?.isFetching]);
  
  // Determine access level for this tenant:
  // - Full access: super_admin, or super_coach in THIS tenant
  // - Limited access: coach in THIS tenant (but not super_coach)
  const hasFullAccess = useMemo(() => {
    if (isDemoSite) return true;
    if (role === 'super_admin') return true;
    
    if (isDefault) {
      // Platform domain: use publicMetadata roles
      return role === 'coach' || role === 'admin' || orgRole === 'super_coach';
    }
    
    // Check Clerk admin first
    if (isClerkAdmin) {
      return true;
    }
    
    // Tenant domain: check actual membership role
    if (currentTenantMembership) {
      const membershipOrgRole = currentTenantMembership.membership?.orgRole as OrgRole | undefined;
      return membershipOrgRole === 'super_coach';
    }
    
    return false;
  }, [isDemoSite, role, orgRole, isDefault, isClerkAdmin, currentTenantMembership]);
  
  const isLimitedOrgCoach = useMemo(() => {
    if (hasFullAccess) return false;
    if (isDemoSite) return false;
    
    if (isDefault) {
      // Platform domain: use publicMetadata
      return orgRole === 'coach';
    }
    
    // Tenant domain: check actual membership role
    if (currentTenantMembership) {
      const membershipOrgRole = currentTenantMembership.membership?.orgRole as OrgRole | undefined;
      return membershipOrgRole === 'coach';
    }
    
    return false;
  }, [hasFullAccess, isDemoSite, isDefault, orgRole, currentTenantMembership]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Start feature tour if URL has tour=true
  useEffect(() => {
    if (mounted && shouldStartTour && !isTourActive) {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => {
        setIsTourActive(true);
        // Remove the tour param from URL to prevent restart on refresh
        const url = new URL(window.location.href);
        url.searchParams.delete('tour');
        window.history.replaceState({}, '', url.toString());
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mounted, shouldStartTour, isTourActive]);

  // Sync tab from URL on mount only (searchParams reference changes on every render in Next.js)
  useEffect(() => {
    const tabParam = searchParams.get('tab') as CoachTab | null;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount to prevent re-renders from searchParams reference changes

  // Sync tab state when browser back/forward changes URL
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);
      const tabFromUrl = url.searchParams.get('tab') as CoachTab | null;
      setActiveTab(tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'clients');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check authorization (skip on demo site)
  useEffect(() => {
    // Skip auth redirect if coming from OAuth callback (give Clerk time to sync session)
    if (searchParams.get('calendar_connected') || searchParams.get('integration_connected')) {
      return;
    }
    // Don't redirect while still loading auth/org data
    if (isDemoSite || !mounted || isAccessLoading) return;
    // Now we know for certain: redirect if no access
    if (!hasAccess) {
      router.push('/');
    }
  }, [hasAccess, isAccessLoading, router, mounted, isDemoSite, searchParams]);

  // Handle redirect param (for OAuth callback two-step redirect from subdomain to custom domain)
  useEffect(() => {
    const redirectUrl = searchParams.get('redirect');
    if (redirectUrl && mounted) {
      // Clerk handles session sync to custom domain automatically
      window.location.href = redirectUrl;
    }
  }, [searchParams, mounted]);

  // Handle integration_connected param - show success modal
  useEffect(() => {
    const integrationConnected = searchParams.get('integration_connected');
    if (integrationConnected && mounted) {
      const validProviders = ['zoom', 'google_calendar', 'outlook_calendar'] as const;
      if (validProviders.includes(integrationConnected as typeof validProviders[number])) {
        // Fetch the connected integration's email to display in modal
        const fetchIntegrationEmail = async () => {
          try {
            const response = await fetch('/api/coach/integrations');
            if (response.ok) {
              const data = await response.json();
              const connected = data.integrations?.find(
                (i: { provider: string; status: string; accountEmail?: string }) =>
                  i.provider === integrationConnected && i.status === 'connected'
              );
              setIntegrationConnectedModal({
                isOpen: true,
                provider: integrationConnected as 'zoom' | 'google_calendar' | 'outlook_calendar',
                accountEmail: connected?.accountEmail,
              });
            } else {
              // Still show modal even if we can't fetch email
              setIntegrationConnectedModal({
                isOpen: true,
                provider: integrationConnected as 'zoom' | 'google_calendar' | 'outlook_calendar',
              });
            }
          } catch {
            // Still show modal even if we can't fetch email
            setIntegrationConnectedModal({
              isOpen: true,
              provider: integrationConnected as 'zoom' | 'google_calendar' | 'outlook_calendar',
            });
          }
        };
        fetchIntegrationEmail();

        // Clean up URL param (preserve tab)
        const url = new URL(window.location.href);
        url.searchParams.delete('integration_connected');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, [searchParams, mounted]);

  // Fetch ending cohorts for banner
  const fetchEndingCohorts = useCallback(async () => {
    try {
      const response = await fetch('/api/coach/ending-cohorts');
      if (response.ok) {
        const data = await response.json();
        setEndingCohorts(data.endingCohorts || []);
      }
    } catch (error) {
      console.error('Error fetching ending cohorts:', error);
    }
  }, []);
  
  // Fetch subscription status for payment failed banner
  const fetchSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/coach/subscription');
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription || null);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  }, []);

  useEffect(() => {
    // Skip API fetches on demo site (no real data)
    if (isDemoSite) return;
    
    if (isLoaded && mounted && hasAccess && !isLimitedOrgCoach) {
      fetchEndingCohorts();
      fetchSubscription();
    }
  }, [isLoaded, mounted, hasAccess, isLimitedOrgCoach, fetchEndingCohorts, fetchSubscription, isDemoSite]);

  // Handle squad conversion to community
  const handleConvertToCommunity = async (squadId: string) => {
    setConvertingSquads(prev => new Set(prev).add(squadId));
    try {
      const response = await fetch(`/api/coach/squads/${squadId}/convert-to-community`, {
        method: 'POST',
      });
      if (response.ok) {
        // Refresh ending cohorts to update the banner
        fetchEndingCohorts();
      }
    } catch (error) {
      console.error('Error converting squad:', error);
    } finally {
      setConvertingSquads(prev => {
        const next = new Set(prev);
        next.delete(squadId);
        return next;
      });
    }
  };

  // Loading state (on demo site, don't wait for Clerk auth)
  if ((!isDemoSite && !isLoaded) || !mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#faf8f6] to-[#f5f2ed] dark:from-[#05070b] dark:to-[#11141b] p-6 animate-pulse">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded mb-2" />
          <div className="h-4 w-64 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
        </div>
        {/* Tabs skeleton */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg flex-shrink-0" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="space-y-4">
          <div className="bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              <div className="h-10 w-28 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 py-4 border-b border-[#e1ddd8]/30 dark:border-[#262b35]/30 last:border-0">
                <div className="w-12 h-12 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                  <div className="h-4 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                </div>
                <div className="h-6 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Unauthorized - will redirect
  if (!hasAccess) {
    return null;
  }

  // Handle tour completion/skip
  const handleTourComplete = () => {
    setIsTourActive(false);
  };
  
  // Handle payment update (opens Stripe customer portal)
  const handleUpdatePayment = async () => {
    try {
      const response = await fetch('/api/coach/subscription/portal', { method: 'POST' });
      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        console.error('Failed to get portal URL');
      }
    } catch (error) {
      console.error('Error opening payment portal:', error);
    }
  };
  
  // Handle payment retry
  const handleRetryPayment = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/coach/subscription/retry-payment', { method: 'POST' });
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Error retrying payment:', error);
      return false;
    }
  };
  
  // Check if in grace period (past_due with valid graceEndsAt)
  const isInGracePeriod = subscription?.status === 'past_due' && 
    subscription?.graceEndsAt && 
    new Date(subscription.graceEndsAt) > new Date();

  return (
    <>
      {/* Desktop: Fixed sidebar - matches chat's channel list position */}
      <div
        className="hidden lg:flex fixed top-0 left-[72px] bottom-0 w-[220px] border-r border-[#e1ddd8] dark:border-[#262b35] z-30 flex-col bg-[#faf8f6] dark:bg-[#05070b]"
      >
        {/* Sidebar Header - stays fixed */}
        <div className="flex-shrink-0 p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
            Coach Dashboard
          </h2>
        </div>
        {/* Navigation - scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <CoachSidebar
            activeTab={activeTab}
            onTabChange={(tab) => handleTabChange(tab)}
            isLimitedOrgCoach={isLimitedOrgCoach}
          />
        </div>
      </div>

      {/* Mobile: Full-screen menu (shown when mobileView === 'menu') */}
      {mobileView === 'menu' && (
        <div className="lg:hidden">
          <MobileCoachMenu
            activeTab={activeTab}
            onTabSelect={(tab) => handleTabChange(tab)}
            isLimitedOrgCoach={isLimitedOrgCoach}
          />
        </div>
      )}

      {/* Main content wrapper - fixed on desktop, fullscreen on mobile when viewing content */}
      <div
        className={`min-h-screen lg:fixed lg:top-0 lg:left-[calc(72px+220px)] lg:right-0 lg:bottom-0 lg:overflow-y-auto bg-[#faf8f6] dark:bg-[#05070b] ${mobileView === 'menu' ? 'hidden lg:block' : ''}`}
        {...swipeHandlers}
      >
        {/* Feature Tour Overlay */}
        <FeatureTour
          isActive={isTourActive}
          onComplete={handleTourComplete}
          onSkip={handleTourComplete}
        />

        {/* Payment Failed Banner - shown when in grace period */}
        {isInGracePeriod && subscription?.graceEndsAt && (
          <PaymentFailedBanner
            graceEndsAt={subscription.graceEndsAt}
            onUpdatePayment={handleUpdatePayment}
            onRetryPayment={handleRetryPayment}
          />
        )}

        <div className="px-4 sm:px-8 lg:px-8 py-6 pb-32 lg:pb-8 animate-fadeIn">
          {/* Ending Cohorts Banner */}
        {endingCohorts.length > 0 && (
          <div className="mb-6 space-y-3">
            {endingCohorts.map((item) => (
              <div
                key={item.cohort.id}
                className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {item.program.name} — {item.cohort.name} ending soon
                    </h3>
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                      {item.daysUntilClose} day{item.daysUntilClose !== 1 ? 's' : ''} until squads close.
                      {item.convertSquadsToCommunity 
                        ? ' Squads will be converted to standalone squads.'
                        : ' Convert to standalone squad to keep members connected?'}
                    </p>
                    {/* Show squads that can be converted */}
                    {!item.convertSquadsToCommunity && item.squads.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.squads.map((squad) => (
                          <button
                            key={squad.id}
                            onClick={() => handleConvertToCommunity(squad.id)}
                            disabled={convertingSquads.has(squad.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#171b22] border border-amber-300 dark:border-amber-700 rounded-lg text-sm font-albert font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
                          >
                            <Users className="w-3.5 h-3.5" />
                            {convertingSquads.has(squad.id) ? 'Converting...' : `Convert "${squad.name}"`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as CoachTab)} className="w-full">
          {/* Clients Tab - Consolidated Users + Coaching Clients */}
          <TabsContent value="clients" className="animate-fadeIn">
            {/* Overview Stats - only shown on Clients tab */}
            {!selectedClientId && <CoachDashboardOverview onTabChange={(tab, filters) => handleTabChange(tab as CoachTab, filters)} />}

            {selectedClientId ? (
              <>
                {/* Back Button */}
                <button
                  onClick={() => handleClientSelect(null)}
                  className="inline-flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert transition-colors mb-6"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to clients
                </button>
                <ClientDetailView
                  clientId={selectedClientId}
                  onBack={() => handleClientSelect(null)}
                />
              </>
            ) : (
              <AdminUsersTab
                currentUserRole={role || 'user'}
                apiEndpoint={
                  isLimitedOrgCoach
                    ? '/api/coach/my-clients'  // Limited: only their assigned clients
                    : role === 'coach'
                      ? '/api/coach/org-users'  // Full access: all org users
                      : '/api/admin/users'      // Admin: all users
                }
                onSelectUser={(userId) => handleClientSelect(userId)}
                headerTitle="Clients"
                showOrgRole={hasFullAccess && (role === 'coach' || orgRole === 'super_coach')}
                currentUserOrgRole={orgRole}
                readOnly={isLimitedOrgCoach}
                visibleColumns={isLimitedOrgCoach ? ['avatar', 'name', 'email', 'coach', 'programs', 'created'] : COACH_DASHBOARD_COLUMNS}
                showInviteButton={!isLimitedOrgCoach}
              />
            )}
          </TabsContent>

          {/* Squads Tab */}
          <TabsContent value="squads" className="animate-fadeIn">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachSquadsTab apiBasePath="/api/coach/org-squads" initialSquadId={initialSquadId} onSquadSelect={handleSquadSelect} />
            </div>
          </TabsContent>

          {/* Discover Content Tab - Uses org-scoped API for coaches */}
          <TabsContent value="discover" className="animate-fadeIn">
            <AdminDiscoverTab
              apiBasePath={(role === 'coach' || orgRole === 'super_coach' || orgRole === 'coach') ? '/api/coach/org-discover' : '/api/admin/discover'}
              initialSubTab={initialDiscoverSubTab}
              onSubTabChange={handleDiscoverSubTabChange}
              initialCourseId={initialCourseId}
              onCourseSelect={handleCourseSelect}
            />
          </TabsContent>

          {/* Upgrade Forms Tab - Uses org-scoped API for coaches */}
          <TabsContent value="upgrade-forms" className="animate-fadeIn">
            <AdminPremiumUpgradeFormsTab 
              apiEndpoint={(role === 'coach' || orgRole === 'super_coach' || orgRole === 'coach') ? '/api/coach/org-forms/premium-upgrade' : '/api/admin/premium-upgrade-forms'}
            />
          </TabsContent>

          {/* Coaching Intake Forms Tab - Uses org-scoped API for coaches */}
          <TabsContent value="coaching-forms" className="animate-fadeIn">
            <AdminCoachingIntakeFormsTab 
              apiEndpoint={(role === 'coach' || orgRole === 'super_coach' || orgRole === 'coach') ? '/api/coach/org-forms/coaching-intake' : '/api/admin/coaching-intake-forms'}
            />
          </TabsContent>

          {/* Funnels Tab */}
          <TabsContent value="funnels" className="animate-fadeIn">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachFunnelsTab initialFunnelId={initialFunnelId} onFunnelSelect={handleFunnelSelect} />
            </div>
          </TabsContent>

          {/* Website Tab */}
          <TabsContent value="website" className="animate-fadeIn">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachWebsiteTab />
            </div>
          </TabsContent>

          {/* Check-ins Tab */}
          <TabsContent value="checkins" className="animate-fadeIn">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachCheckInsTab initialFlowId={initialFlowId} onFlowSelect={handleFlowSelect} />
            </div>
          </TabsContent>

          {/* Onboarding Tab */}
          <TabsContent value="onboarding" className="animate-fadeIn">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachOnboardingFlowTab />
            </div>
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="animate-fadeIn">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachReferralsTab />
            </div>
          </TabsContent>

          {/* Programs Tab - New system */}
          <TabsContent value="programs" className="animate-fadeIn">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachProgramsTab apiBasePath="/api/coach/org-programs" initialProgramId={initialProgramId} onProgramSelect={handleProgramSelect} />
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="animate-fadeIn">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <AnalyticsDashboard 
                initialSubTab={initialAnalyticsSubTab}
                onSubTabChange={handleAnalyticsSubTabChange}
                initialSquadId={initialAnalyticsSquadId}
                onSquadSelect={handleAnalyticsSquadSelect}
              />
            </div>
          </TabsContent>

          {/* Discounts Tab */}
          <TabsContent value="discounts" className="animate-fadeIn">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <DiscountCodesTab />
            </div>
          </TabsContent>

          {/* Channels Tab */}
          <TabsContent value="channels" className="animate-fadeIn">
            <ChannelManagementTab />
          </TabsContent>

          {/* Scheduling Tab */}
          <TabsContent value="scheduling" className="animate-fadeIn">
            <SchedulingTab />
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="animate-fadeIn">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <IntegrationsTab coachTier={subscription?.tier} />
            </div>
          </TabsContent>

          {/* Customize Branding Tab */}
          <TabsContent value="customize" className="animate-fadeIn">
            <CustomizeBrandingTab initialSubtab={initialCustomizeSubtab} onSubtabChange={handleCustomizeSubtabChange} />
          </TabsContent>

          {/* Plan & Billing Tab */}
          <TabsContent value="plan" className="animate-fadeIn">
            <CoachPlanTab />
          </TabsContent>

          {/* Support & Feedback Tab */}
          <TabsContent value="support" className="animate-fadeIn">
            <CoachSupportTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>

    {/* Integration Connected Modal */}
    {integrationConnectedModal.provider && (
      <IntegrationConnectedModal
        isOpen={integrationConnectedModal.isOpen}
        onClose={() => setIntegrationConnectedModal({ isOpen: false, provider: null })}
        provider={integrationConnectedModal.provider}
        accountEmail={integrationConnectedModal.accountEmail}
      />
    )}
  </>
  );
}
