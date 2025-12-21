'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { SquadView } from '@/components/squad/SquadView';
import { ClientDetailView, CustomizeBrandingTab, ChannelManagementTab } from '@/components/coach';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import type { ClerkPublicMetadata, OrgRole } from '@/types';

// Admin components for expanded coach dashboard
import { AdminUsersTab } from '@/components/admin/AdminUsersTab';
import { AdminSquadsTab } from '@/components/admin/AdminSquadsTab';
import { AdminDiscoverTab } from '@/components/admin/discover';
import { AdminPremiumUpgradeFormsTab } from '@/components/admin/AdminPremiumUpgradeFormsTab';
import { AdminCoachingIntakeFormsTab } from '@/components/admin/AdminCoachingIntakeFormsTab';
import { AdminQuizzesTab } from '@/components/admin/quizzes';
import { AdminTracksAndProgramsTab } from '@/components/admin/tracks-programs';

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
type CoachTab = 'clients' | 'squads' | 'discover' | 'upgrade-forms' | 'coaching-forms' | 'quizzes' | 'tracks-programs' | 'channels' | 'customize';
const VALID_TABS: CoachTab[] = ['clients', 'squads', 'discover', 'upgrade-forms', 'coaching-forms', 'quizzes', 'tracks-programs', 'channels', 'customize'];

export default function CoachPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionClaims, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  // Clients tab state - selected client ID for viewing details
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  // Squads tab state - selected squad ID for viewing squad management
  const [selectedSquadIdForView, setSelectedSquadIdForView] = useState<string | null>(null);
  
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

  // Loading state
  if (!isLoaded || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#faf8f6] to-[#f5f2ed] dark:from-[#05070b] dark:to-[#11141b]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading...</p>
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <TabsList className="mb-6 w-full flex-nowrap overflow-x-auto justify-start bg-white/60 dark:bg-[#11141b]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 p-1 scrollbar-hide">
            <TabsTrigger 
              value="clients"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Clients
            </TabsTrigger>
            <TabsTrigger 
              value="squads"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Squads
            </TabsTrigger>
            {/* Full access tabs - first group (Programs, Channels, Quizzes) */}
            {!isLimitedOrgCoach && (
              <>
                <TabsTrigger 
                  value="tracks-programs"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Programs
                </TabsTrigger>
                <TabsTrigger 
                  value="channels"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Channels
                </TabsTrigger>
                <TabsTrigger 
                  value="quizzes"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Quizzes
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
                visibleColumns={isLimitedOrgCoach ? ['avatar', 'name', 'email', 'coach', 'coaching', 'created'] : undefined}
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
                  // Super coach sees all org squads
                  orgRole === 'super_coach'
                    ? '/api/coach/org-squads'
                    // Regular org coach or global coach sees only squads they coach
                    : (role === 'coach' || orgRole === 'coach')
                      ? '/api/coach/my-squads'
                      // Admin/super_admin sees all squads
                      : '/api/admin/squads'
                }
                onSelectSquad={(squadId) => setSelectedSquadIdForView(squadId)}
                coachesApiEndpoint={(role === 'coach' || orgRole === 'super_coach') ? '/api/coach/org-coaches' : '/api/admin/coaches'}
              />
            )}
          </TabsContent>

          {/* Discover Content Tab - Uses org-scoped API for coaches */}
          <TabsContent value="discover">
            <AdminDiscoverTab 
              apiBasePath={role === 'coach' ? '/api/coach/org-discover' : '/api/admin/discover'}
            />
          </TabsContent>

          {/* Upgrade Forms Tab - Uses org-scoped API for coaches */}
          <TabsContent value="upgrade-forms">
            <AdminPremiumUpgradeFormsTab 
              apiEndpoint={role === 'coach' ? '/api/coach/org-forms/premium-upgrade' : '/api/admin/premium-upgrade-forms'}
            />
          </TabsContent>

          {/* Coaching Intake Forms Tab - Uses org-scoped API for coaches */}
          <TabsContent value="coaching-forms">
            <AdminCoachingIntakeFormsTab 
              apiEndpoint={role === 'coach' ? '/api/coach/org-forms/coaching-intake' : '/api/admin/coaching-intake-forms'}
            />
          </TabsContent>

          {/* Quizzes Tab */}
          <TabsContent value="quizzes">
            <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden p-6">
              <AdminQuizzesTab 
                apiBasePath={role === 'coach' ? '/api/coach/org-quizzes' : '/api/admin/quizzes'}
              />
            </div>
          </TabsContent>

          {/* Tracks & Programs Tab */}
          <TabsContent value="tracks-programs">
            <AdminTracksAndProgramsTab 
              tracksApiBasePath={role === 'coach' ? '/api/coach/org-tracks' : '/api/admin/tracks'}
              programsApiBasePath={role === 'coach' ? '/api/coach/org-starter-programs' : '/api/admin/starter-programs'}
              promptsApiBasePath={role === 'coach' ? '/api/coach/org-dynamic-prompts' : '/api/admin/dynamic-prompts'}
            />
          </TabsContent>

          {/* Channels Tab */}
          <TabsContent value="channels">
            <ChannelManagementTab />
          </TabsContent>

          {/* Customize Branding Tab */}
          <TabsContent value="customize">
            <CustomizeBrandingTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
