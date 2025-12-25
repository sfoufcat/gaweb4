'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { SquadView } from '@/components/squad/SquadView';
import { ClientDetailView, CustomizeBrandingTab, ChannelManagementTab } from '@/components/coach';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, AlertCircle, Users } from 'lucide-react';
import type { ClerkPublicMetadata, OrgRole, ProgramCohort } from '@/types';

// Admin components for expanded coach dashboard
import { AdminUsersTab, type ColumnKey } from '@/components/admin/AdminUsersTab';
import { AdminSquadsTab } from '@/components/admin/AdminSquadsTab';
import { AdminDiscoverTab } from '@/components/admin/discover';
import { AdminPremiumUpgradeFormsTab } from '@/components/admin/AdminPremiumUpgradeFormsTab';
import { AdminCoachingIntakeFormsTab } from '@/components/admin/AdminCoachingIntakeFormsTab';
import { CoachFunnelsTab } from '@/components/coach/funnels';
import { CoachProgramsTab } from '@/components/coach/programs';
import { CoachPlanTab } from '@/components/coach/CoachPlanTab';

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
type CoachTab = 'clients' | 'squads' | 'programs' | 'discover' | 'upgrade-forms' | 'coaching-forms' | 'funnels' | 'channels' | 'customize' | 'plan';
const VALID_TABS: CoachTab[] = ['clients', 'squads', 'programs', 'discover', 'upgrade-forms', 'coaching-forms', 'funnels', 'channels', 'customize', 'plan'];

// Columns for Coach Dashboard (excludes 'tier' - tiers are not used in coach context)
const COACH_DASHBOARD_COLUMNS: ColumnKey[] = ['select', 'avatar', 'name', 'email', 'role', 'squad', 'coaching', 'invitedBy', 'invitedAt', 'created', 'actions'];

export default function CoachPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionClaims, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  // Clients tab state - selected client ID for viewing details
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  // Squads tab state - selected squad ID for viewing squad management
  const [selectedSquadIdForView, setSelectedSquadIdForView] = useState<string | null>(null);
  
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
  
  // Get initial tab from URL query param, default to 'clients'
  const tabFromUrl = searchParams.get('tab') as CoachTab | null;
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'clients';
  const [activeTab, setActiveTab] = useState<CoachTab>(initialTab);

  // Get role and orgRole from Clerk session
  const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
  const role = publicMetadata?.role;
  const orgRole = publicMetadata?.orgRole as OrgRole | undefined;
  const hasAccess = canAccessCoachDashboard(role, orgRole);
  
  // Determine access level:
  // - Full access: global coach role, super_coach orgRole, admin, or super_admin
  // - Limited access: orgRole === 'coach' (but not super_coach or global coach)
  const hasFullAccess = role === 'coach' || role === 'admin' || role === 'super_admin' || orgRole === 'super_coach';
  const isLimitedOrgCoach = !hasFullAccess && orgRole === 'coach';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update active tab when URL query param changes
  useEffect(() => {
    const tabParam = searchParams.get('tab') as CoachTab | null;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Check authorization
  useEffect(() => {
    if (isLoaded && mounted && !hasAccess) {
      router.push('/');
    }
  }, [hasAccess, isLoaded, router, mounted]);

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

  useEffect(() => {
    if (isLoaded && mounted && hasAccess && !isLimitedOrgCoach) {
      fetchEndingCohorts();
    }
  }, [isLoaded, mounted, hasAccess, isLimitedOrgCoach, fetchEndingCohorts]);

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

  // Loading state
  if (!isLoaded || !mounted) {
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

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 lg:px-16 py-6 pb-32">
        {/* Header */}
        <div className="mb-8">
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
                        ? ' Squads will be converted to standalone communities.'
                        : ' Convert to community to keep members connected?'}
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <TabsList className="mb-6 w-full flex-nowrap overflow-x-auto justify-start bg-white/60 dark:bg-[#11141b]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 p-1 scrollbar-hide">
            <TabsTrigger 
              value="clients"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Clients
            </TabsTrigger>
            {/* Programs tab - before Squads (full access only) */}
            {!isLimitedOrgCoach && (
              <TabsTrigger 
                value="programs"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
              >
                Programs
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="squads"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Squads
            </TabsTrigger>
            {/* Full access tabs - Channels, Funnels */}
            {!isLimitedOrgCoach && (
              <>
                <TabsTrigger 
                  value="channels"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Channels
                </TabsTrigger>
                <TabsTrigger 
                  value="funnels"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Funnels
                </TabsTrigger>
              </>
            )}
            <TabsTrigger 
              value="discover"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Content
            </TabsTrigger>
            {/* Full access tabs - second group (Forms, Customize) */}
            {!isLimitedOrgCoach && (
              <>
                <TabsTrigger 
                  value="upgrade-forms"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Upgrade Forms
                </TabsTrigger>
                <TabsTrigger 
                  value="coaching-forms"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Coaching Intake Forms
                </TabsTrigger>
                <TabsTrigger 
                  value="customize"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Customize & Settings
                </TabsTrigger>
                <TabsTrigger 
                  value="plan"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Plan & Billing
                </TabsTrigger>
              </>
            )}
          </TabsList>

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
                visibleColumns={isLimitedOrgCoach ? ['avatar', 'name', 'email', 'coach', 'coaching', 'created'] : COACH_DASHBOARD_COLUMNS}
                showInviteButton={!isLimitedOrgCoach}
              />
            )}
          </TabsContent>

          {/* Squads Tab - Consolidated My Squads + All Squads */}
          <TabsContent value="squads">
            {selectedSquadIdForView ? (
              <>
                {/* Back Button */}
                <button
                  onClick={() => setSelectedSquadIdForView(null)}
                  className="inline-flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert transition-colors mb-6"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to squads
                </button>
                <SquadView 
                  key={selectedSquadIdForView} 
                  squadId={selectedSquadIdForView}
                  showCoachBadge={true}
                />
              </>
            ) : (
              <AdminSquadsTab 
                currentUserRole={role || 'user'} 
                apiEndpoint={
                  // Limited org coaches (orgRole=coach without full access) see only coached squads
                  isLimitedOrgCoach
                    ? '/api/coach/my-squads'
                    // Full access coaches (global coach role OR super_coach) see all org squads
                    : (role === 'coach' || orgRole === 'super_coach')
                      ? '/api/coach/org-squads'
                      // Admin/super_admin sees all squads
                      : '/api/admin/squads'
                }
                onSelectSquad={(squadId) => setSelectedSquadIdForView(squadId)}
                coachesApiEndpoint={(role === 'coach' || orgRole === 'super_coach' || orgRole === 'coach') ? '/api/coach/org-coaches' : '/api/admin/coaches'}
              />
            )}
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

          {/* Programs Tab - New system */}
          <TabsContent value="programs">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <CoachProgramsTab apiBasePath="/api/coach/org-programs" />
            </div>
          </TabsContent>

          {/* Channels Tab */}
          <TabsContent value="channels">
            <ChannelManagementTab />
          </TabsContent>

          {/* Customize Branding Tab */}
          <TabsContent value="customize">
            <CustomizeBrandingTab />
          </TabsContent>

          {/* Plan & Billing Tab */}
          <TabsContent value="plan">
            <CoachPlanTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
