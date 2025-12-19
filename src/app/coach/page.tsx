'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { SquadView } from '@/components/squad/SquadView';
import { CoachingClientsTab, CoachingClientView, CustomizeBrandingTab } from '@/components/coach';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Image from 'next/image';
import type { Squad, ClerkPublicMetadata } from '@/types';

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

export default function CoachPage() {
  const router = useRouter();
  const { sessionClaims, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  // Squad data
  const [squads, setSquads] = useState<Squad[]>([]);
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Coaching clients state
  const [selectedCoachingClientId, setSelectedCoachingClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'squads' | 'coaching' | 'users' | 'all-squads' | 'discover' | 'upgrade-forms' | 'coaching-forms' | 'quizzes' | 'tracks-programs' | 'customize'>('squads');

  // Get role from Clerk session
  const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
  const hasAccess = canAccessCoachDashboard(role);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check authorization
  useEffect(() => {
    if (isLoaded && mounted && !hasAccess) {
      router.push('/');
    }
  }, [hasAccess, isLoaded, router, mounted]);

  // Fetch squads
  useEffect(() => {
    const fetchSquads = async () => {
      if (!isLoaded || !mounted || !hasAccess) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/coach/squads');
        if (!response.ok) {
          throw new Error('Failed to fetch squads');
        }

        const data = await response.json();
        const fetchedSquads = data.squads || [];
        setSquads(fetchedSquads);

        // Set default selection to first squad
        if (fetchedSquads.length > 0 && !selectedSquadId) {
          setSelectedSquadId(fetchedSquads[0].id);
        }
      } catch (err) {
        console.error('Error fetching squads:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch squads');
      } finally {
        setLoading(false);
      }
    };

    fetchSquads();
  }, [isLoaded, mounted, hasAccess, selectedSquadId]);

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

  // Get selected squad for display
  const selectedSquad = squads.find(s => s.id === selectedSquadId);

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 lg:px-16 py-6 pb-32">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert tracking-[-1px]">
            Coach Dashboard
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {role === 'coach' 
              ? 'Manage your squads and 1:1 coaching clients'
              : 'View and manage all squads and coaching clients'}
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <TabsList className="mb-6 w-full flex-nowrap overflow-x-auto justify-start bg-white/60 dark:bg-[#11141b]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 p-1 scrollbar-hide">
            <TabsTrigger 
              value="squads"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              My Squads
            </TabsTrigger>
            <TabsTrigger 
              value="coaching"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Coaching Clients
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="all-squads"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              All Squads
            </TabsTrigger>
            <TabsTrigger 
              value="discover"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Discover Content
            </TabsTrigger>
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
              value="quizzes"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Quizzes
            </TabsTrigger>
            <TabsTrigger 
              value="tracks-programs"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Tracks & Programs
            </TabsTrigger>
            <TabsTrigger 
              value="customize"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Customize
            </TabsTrigger>
          </TabsList>

          {/* Squads Tab */}
          <TabsContent value="squads">
            {/* Error State */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-6">
                <p className="text-red-600 dark:text-red-300 font-albert mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-albert"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading Squads */}
            {loading && !error && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading squads...</p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && squads.length === 0 && (
              <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-3xl p-12 text-center">
                <div className="w-20 h-20 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-[#a07855] dark:text-[#b8896a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 font-albert tracking-[-1px]">
                  {role === 'coach' 
                    ? "You're not coaching any squads yet."
                    : 'No squads available'}
                </h2>
                <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert max-w-md mx-auto">
                  {role === 'coach'
                    ? "When you're assigned as a coach to a premium squad, it will appear here."
                    : 'Create your first squad from the Admin Panel.'}
                </p>
              </div>
            )}

            {/* Squad Content */}
            {!loading && !error && squads.length > 0 && (
              <>
                {/* Squad Selector - Pill Style */}
                <div className="mb-8">
                  <Select
                    value={selectedSquadId || undefined}
                    onValueChange={(value) => setSelectedSquadId(value)}
                  >
                    <SelectTrigger 
                      className="w-full max-w-md bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-full px-6 py-4 h-auto shadow-sm hover:shadow-md dark:hover:shadow-none transition-all duration-200 focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
                    >
                      <div className="flex items-center gap-3">
                        {selectedSquad && (
                          <>
                            {/* Squad Avatar */}
                            {selectedSquad.avatarUrl ? (
                              <Image 
                                src={selectedSquad.avatarUrl} 
                                alt={selectedSquad.name}
                                width={32}
                                height={32}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] flex items-center justify-center text-[#4A5D54] text-sm font-bold">
                                {selectedSquad.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="text-left">
                              <SelectValue>
                                <span className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                                  {selectedSquad.name}
                                </span>
                              </SelectValue>
                              {selectedSquad.isPremium && (
                                <span className="block text-xs bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent font-semibold">
                                  Premium squad
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 backdrop-blur-xl border border-[#e1ddd8]/50 rounded-2xl shadow-lg overflow-hidden dark:bg-[#171b22]/95 dark:border-[#262b35]/50">
                      {squads.map((squad) => (
                        <SelectItem 
                          key={squad.id} 
                          value={squad.id}
                          className="px-4 py-3 cursor-pointer hover:bg-[#f3f1ef] focus:bg-[#f3f1ef] rounded-xl mx-1 my-0.5 dark:hover:bg-[#1e222a] dark:focus:bg-[#1e222a]"
                        >
                          <div className="flex items-center gap-3">
                            {squad.avatarUrl ? (
                              <Image 
                                src={squad.avatarUrl} 
                                alt={squad.name}
                                width={32}
                                height={32}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] flex items-center justify-center text-[#4A5D54] text-sm font-bold dark:from-[#b8896a] dark:to-[#a07855] dark:text-white">
                                {squad.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                                {squad.name}
                              </p>
                              {squad.isPremium && (
                                <span className="text-xs bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent font-semibold">
                                  Premium squad
                                </span>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Squad Chat Button */}
                {selectedSquad?.chatChannelId && (
                  <div className="mb-6">
                    <button
                      onClick={() => router.push(`/chat?channel=${selectedSquad.chatChannelId}`)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#a07855] hover:bg-[#8c6245] text-white rounded-full font-albert text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Open squad chat
                    </button>
                  </div>
                )}

                {/* Embedded Squad View */}
                {selectedSquadId && (
                  <SquadView 
                    key={selectedSquadId} 
                    squadId={selectedSquadId}
                    showCoachBadge={true}
                  />
                )}
              </>
            )}
          </TabsContent>

          {/* Coaching Clients Tab */}
          <TabsContent value="coaching">
            {selectedCoachingClientId ? (
              <CoachingClientView
                clientId={selectedCoachingClientId}
                onBack={() => setSelectedCoachingClientId(null)}
              />
            ) : (
              <CoachingClientsTab
                onSelectClient={(clientId) => setSelectedCoachingClientId(clientId)}
              />
            )}
          </TabsContent>

          {/* Users Tab - Uses org-scoped API for coaches */}
          <TabsContent value="users">
            <AdminUsersTab 
              currentUserRole={role || 'user'} 
              apiEndpoint={role === 'coach' ? '/api/coach/org-users' : '/api/admin/users'}
            />
          </TabsContent>

          {/* All Squads Tab - Uses org-scoped API for coaches */}
          <TabsContent value="all-squads">
            <AdminSquadsTab 
              currentUserRole={role || 'user'} 
              apiEndpoint={role === 'coach' ? '/api/coach/org-squads' : '/api/admin/squads'}
            />
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
              <AdminQuizzesTab />
            </div>
          </TabsContent>

          {/* Tracks & Programs Tab */}
          <TabsContent value="tracks-programs">
            <AdminTracksAndProgramsTab />
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
