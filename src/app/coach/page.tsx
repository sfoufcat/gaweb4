'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useOrganization as useClerkOrganization, useOrganizationList } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { isOrgCoach } from '@/lib/admin-utils-shared';
import { ClientDetailView, CustomizeBrandingTab, ChannelManagementTab, PaymentFailedBanner } from '@/components/coach';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, AlertCircle, Users } from 'lucide-react';
import type { ClerkPublicMetadata, OrgRole, ProgramCohort, CoachSubscription } from '@/types';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranding, useBrandingValues } from '@/contexts/BrandingContext';

// Admin components for expanded coach dashboard
import { AdminUsersTab, type ColumnKey } from '@/components/admin/AdminUsersTab';
import { AdminDiscoverTab } from '@/components/admin/discover';
import { AdminPremiumUpgradeFormsTab } from '@/components/admin/AdminPremiumUpgradeFormsTab';
import { AdminCoachingIntakeFormsTab } from '@/components/admin/AdminCoachingIntakeFormsTab';
import { CoachFunnelsTab } from '@/components/coach/funnels';
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
type CoachTab = 'clients' | 'squads' | 'programs' | 'referrals' | 'analytics' | 'discounts' | 'discover' | 'upgrade-forms' | 'coaching-forms' | 'funnels' | 'checkins' | 'onboarding' | 'channels' | 'scheduling' | 'integrations' | 'customize' | 'plan' | 'support';
const VALID_TABS: CoachTab[] = ['clients', 'squads', 'programs', 'referrals', 'analytics', 'discounts', 'discover', 'upgrade-forms', 'coaching-forms', 'funnels', 'checkins', 'onboarding', 'channels', 'scheduling', 'integrations', 'customize', 'plan', 'support'];

// Columns for Coach Dashboard (excludes 'tier' - tiers are not used in coach context)
// Uses 'programs' column instead of 'coaching' to show enrolled programs with (1:1)/(Group) prefixes
const COACH_DASHBOARD_COLUMNS: ColumnKey[] = ['select', 'avatar', 'name', 'email', 'role', 'squad', 'programs', 'invitedBy', 'invitedAt', 'created', 'actions'];

// Tab order for directional animations (left-to-right order in UI)
const TAB_ORDER: Record<CoachTab, number> = {
  'clients': 0, 'programs': 1, 'squads': 2, 'discover': 3, 'funnels': 4, 'analytics': 5,
  'checkins': 6, 'onboarding': 7, 'channels': 8, 'referrals': 9, 'discounts': 10,
  'scheduling': 11, 'integrations': 12, 'customize': 13, 'plan': 14, 'support': 15,
  'upgrade-forms': 16, 'coaching-forms': 17,
};

// Smooth slide animation variants
const tabVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 40 : -40,
    opacity: 0,
  }),
};

/**
 * Scheduling Tab Component
 * Contains Calendar View, Availability Settings, and Call Pricing with sub-navigation
 */
function SchedulingTab() {
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'availability' | 'pricing'>('calendar');

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

      {/* Content */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
        {activeSubTab === 'calendar' ? (
          <CalendarView mode="coach" />
        ) : activeSubTab === 'availability' ? (
          <AvailabilityEditor />
        ) : (
          <CallPricingSettings />
        )}
      </div>
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
  
  // Clients tab state - selected client ID for viewing details
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
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
  
  // Get initial tab from URL query param, default to 'clients'
  const tabFromUrl = searchParams.get('tab') as CoachTab | null;
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'clients';
  const [activeTab, setActiveTab] = useState<CoachTab>(initialTab);

  // Direction tracking for animations (use ref to avoid re-renders)
  const directionRef = useRef(0);
  const prevTabRef = useRef<CoachTab>(initialTab);

  // Handler for tab changes with direction tracking
  const handleTabChange = useCallback((newTab: CoachTab) => {
    const prevOrder = TAB_ORDER[prevTabRef.current] ?? 0;
    const newOrder = TAB_ORDER[newTab] ?? 0;
    directionRef.current = newOrder > prevOrder ? 1 : -1;
    prevTabRef.current = newTab;
    setActiveTab(newTab);
  }, []);

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
    
    // Still loading? Wait - don't redirect prematurely
    if (orgLoading || !clerkOrgsLoaded) {
      return true; // Assume access while loading (page will re-check)
    }
    
    // Both systems loaded, no membership found - no access
    return false;
  }, [isDemoSite, isDefault, role, isClerkAdmin, currentTenantMembership, orgLoading, clerkOrgsLoaded]);
  
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

  // Check authorization (skip on demo site)
  useEffect(() => {
    // Skip auth redirect if coming from OAuth callback (give Clerk time to sync session)
    if (searchParams.get('calendar_connected') || searchParams.get('integration_connected')) {
      return;
    }
    if (!isDemoSite && isLoaded && mounted && !hasAccess) {
      router.push('/');
    }
  }, [hasAccess, isLoaded, router, mounted, isDemoSite, searchParams]);

  // Handle redirect param (for OAuth callback two-step redirect from subdomain to custom domain)
  useEffect(() => {
    const redirectUrl = searchParams.get('redirect');
    if (redirectUrl && mounted) {
      // Clerk handles session sync to custom domain automatically
      window.location.href = redirectUrl;
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
    <div className="min-h-screen">
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

      <div className="px-4 sm:px-8 lg:px-16 py-6 pb-32">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert tracking-[-1px]">
                Coach Dashboard
              </h1>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {isLimitedOrgCoach
                  ? 'View your assigned squads and coaching clients'
                  : role === 'coach' || orgRole === 'super_coach'
                    ? 'Manage your squads and 1:1 coaching clients'
                    : 'View and manage all squads and coaching clients'}
              </p>
            </div>
            
            {/* Demo Mode Toggle - removed as requested */}
          </div>
        </div>

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
          <TabsList
            ref={setTabsListRef}
            onMouseLeave={handleTabsMouseLeave}
            className="relative mb-6 w-full flex-nowrap overflow-x-auto overflow-y-hidden justify-start gap-1 p-1.5 scrollbar-hide bg-[#f7f5f3] dark:bg-[#1a1d24] rounded-xl"
          >
            {/* Sliding highlight */}
            <div
              className="absolute h-[calc(100%-12px)] top-1.5 rounded-lg bg-[#ebe8e4] dark:bg-[#262b35] transition-all duration-200 ease-out pointer-events-none"
              style={{
                left: hoverStyle.left,
                width: hoverStyle.width,
                opacity: hoverStyle.opacity,
              }}
            />
            {/* 1. Clients - always visible */}
            <TabsTrigger 
              value="clients"
              onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Clients
            </TabsTrigger>
            {/* 2. Programs - full access only */}
            {!isLimitedOrgCoach && (
              <TabsTrigger 
                value="programs"
                onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                Programs
              </TabsTrigger>
            )}
            {/* 3. Squads - always visible */}
            <TabsTrigger 
              value="squads"
              onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Squads
            </TabsTrigger>
            {/* 4. Content - always visible */}
            <TabsTrigger 
              value="discover"
              onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Content
            </TabsTrigger>
            {/* 5-6. Funnels, Analytics - full access only */}
            {!isLimitedOrgCoach && (
              <>
                <TabsTrigger 
                  value="funnels"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Funnels
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Analytics
                </TabsTrigger>
              </>
            )}
            {/* 7-10. Check-ins, Chats, Referrals, Discounts - full access only */}
            {!isLimitedOrgCoach && (
              <>
                <TabsTrigger 
                  value="checkins"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Check-ins
                </TabsTrigger>
                <TabsTrigger 
                  value="onboarding"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Onboarding
                </TabsTrigger>
                <TabsTrigger 
                  value="channels"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Chats
                </TabsTrigger>
                <TabsTrigger 
                  value="referrals"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Referrals
                </TabsTrigger>
                <TabsTrigger 
                  value="discounts"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Discounts
                </TabsTrigger>
              </>
            )}
            {/* 10-12. Scheduling, Customize, Plan - full access only */}
            {!isLimitedOrgCoach && (
              <>
                <TabsTrigger 
                  value="scheduling"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Scheduling
                </TabsTrigger>
                <TabsTrigger 
                  value="integrations"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Integrations
                </TabsTrigger>
                <TabsTrigger 
                  value="customize"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Customize & Settings
                </TabsTrigger>
                <TabsTrigger 
                  value="plan"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Plan
                </TabsTrigger>
                <TabsTrigger 
                  value="support"
                  onMouseEnter={handleTabMouseEnter}
              className="relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium font-albert transition-colors duration-200 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#262b35] data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Support
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              custom={directionRef.current}
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >
          {/* Clients Tab - Consolidated Users + Coaching Clients */}
          <TabsContent value="clients">
            {selectedClientId ? (
              <>
                {/* Back Button */}
                <button
                  onClick={() => setSelectedClientId(null)}
                  className="inline-flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert transition-colors mb-6"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to clients
                </button>
                <ClientDetailView
                  clientId={selectedClientId}
                  onBack={() => setSelectedClientId(null)}
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
                onSelectUser={(userId) => setSelectedClientId(userId)}
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
          <TabsContent value="squads">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachSquadsTab apiBasePath="/api/coach/org-squads" />
            </div>
          </TabsContent>

          {/* Discover Content Tab - Uses org-scoped API for coaches */}
          <TabsContent value="discover">
            <AdminDiscoverTab 
              apiBasePath={(role === 'coach' || orgRole === 'super_coach' || orgRole === 'coach') ? '/api/coach/org-discover' : '/api/admin/discover'}
            />
          </TabsContent>

          {/* Upgrade Forms Tab - Uses org-scoped API for coaches */}
          <TabsContent value="upgrade-forms">
            <AdminPremiumUpgradeFormsTab 
              apiEndpoint={(role === 'coach' || orgRole === 'super_coach' || orgRole === 'coach') ? '/api/coach/org-forms/premium-upgrade' : '/api/admin/premium-upgrade-forms'}
            />
          </TabsContent>

          {/* Coaching Intake Forms Tab - Uses org-scoped API for coaches */}
          <TabsContent value="coaching-forms">
            <AdminCoachingIntakeFormsTab 
              apiEndpoint={(role === 'coach' || orgRole === 'super_coach' || orgRole === 'coach') ? '/api/coach/org-forms/coaching-intake' : '/api/admin/coaching-intake-forms'}
            />
          </TabsContent>

          {/* Funnels Tab */}
          <TabsContent value="funnels">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachFunnelsTab />
            </div>
          </TabsContent>

          {/* Check-ins Tab */}
          <TabsContent value="checkins">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachCheckInsTab />
            </div>
          </TabsContent>

          {/* Onboarding Tab */}
          <TabsContent value="onboarding">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachOnboardingFlowTab />
            </div>
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachReferralsTab />
            </div>
          </TabsContent>

          {/* Programs Tab - New system */}
          <TabsContent value="programs">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachProgramsTab apiBasePath="/api/coach/org-programs" />
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <AnalyticsDashboard />
            </div>
          </TabsContent>

          {/* Discounts Tab */}
          <TabsContent value="discounts">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <DiscountCodesTab />
            </div>
          </TabsContent>

          {/* Channels Tab */}
          <TabsContent value="channels">
            <ChannelManagementTab />
          </TabsContent>

          {/* Scheduling Tab */}
          <TabsContent value="scheduling">
            <SchedulingTab />
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <IntegrationsTab />
            </div>
          </TabsContent>

          {/* Customize Branding Tab */}
          <TabsContent value="customize">
            <CustomizeBrandingTab />
          </TabsContent>

          {/* Plan & Billing Tab */}
          <TabsContent value="plan">
            <CoachPlanTab />
          </TabsContent>

          {/* Support & Feedback Tab */}
          <TabsContent value="support">
            <CoachSupportTab />
          </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}
