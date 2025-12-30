'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { isAdmin, isSuperAdmin } from '@/lib/admin-utils-shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminUsersTab } from '@/components/admin/AdminUsersTab';
import { AdminSquadsTab } from '@/components/admin/AdminSquadsTab';
import { AdminUsersWithoutSquadTab } from '@/components/admin/AdminUsersWithoutSquadTab';
import { AdminDiscoverTab } from '@/components/admin/discover';
import { AdminPremiumUpgradeFormsTab } from '@/components/admin/AdminPremiumUpgradeFormsTab';
import { AdminCoachingIntakeFormsTab } from '@/components/admin/AdminCoachingIntakeFormsTab';
import { AdminCoachingClientsTab } from '@/components/admin/AdminCoachingClientsTab';
import { AdminStartFlowTab } from '@/components/admin/AdminStartFlowTab';
import { AdminTracksAndProgramsTab } from '@/components/admin/tracks-programs';
import { AdminOrganizationsTab } from '@/components/admin/AdminOrganizationsTab';
import { AdminTemplatesTab } from '@/components/admin/AdminTemplatesTab';
import { AdminFeaturesTab } from '@/components/admin/AdminFeaturesTab';
import { AdminPlatformSettingsTab } from '@/components/admin/AdminPlatformSettingsTab';
import type { ClerkPublicMetadata } from '@/types';

export default function AdminPage() {
  const router = useRouter();
  const { sessionClaims, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get role from Clerk session (from JWT)
  const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
  const hasAdminAccess = isAdmin(role);
  const hasSuperAdminAccess = isSuperAdmin(role);

  // Check authorization
  useEffect(() => {
    if (isLoaded && mounted && !hasAdminAccess) {
      // Redirect unauthorized users
      router.push('/');
    }
  }, [hasAdminAccess, isLoaded, router, mounted]);

  // Show loading state
  if (!isLoaded || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#faf8f6] to-[#f5f2ed] dark:from-[#05070b] dark:to-[#11141b]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing if not authorized (will redirect)
  if (!hasAdminAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8f6] to-[#f5f2ed] dark:from-[#05070b] dark:to-[#11141b] p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-4xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
          Admin Panel
        </h1>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          Manage users and squads across Growth Addicts
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="mb-6 w-full flex-nowrap overflow-x-auto justify-start bg-white/60 dark:bg-[#11141b]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 p-1 scrollbar-hide">
            <TabsTrigger 
              value="users"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="squads"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Squads
            </TabsTrigger>
            <TabsTrigger 
              value="without-squad"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Users Without Squad
            </TabsTrigger>
            <TabsTrigger 
              value="discover"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Discover Content
            </TabsTrigger>
            <TabsTrigger 
              value="premium-forms"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Premium Upgrade Forms
            </TabsTrigger>
            <TabsTrigger 
              value="coaching-forms"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Coaching Intake Forms
            </TabsTrigger>
            <TabsTrigger 
              value="coaching-clients"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Coaching Clients
            </TabsTrigger>
            <TabsTrigger 
              value="start-tracker"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Start Tracker
            </TabsTrigger>
            {hasSuperAdminAccess && (
              <>
                <TabsTrigger 
                  value="organizations"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Organizations
                </TabsTrigger>
                <TabsTrigger 
                  value="tracks-programs"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Tracks & Programs
                </TabsTrigger>
                <TabsTrigger 
                  value="templates"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Templates
                </TabsTrigger>
                <TabsTrigger 
                  value="features"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Features
                </TabsTrigger>
                <TabsTrigger 
                  value="platform-settings"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-accent/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-brand-accent/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                >
                  Platform Settings
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="users">
            <AdminUsersTab currentUserRole={role || 'user'} />
          </TabsContent>

          <TabsContent value="squads">
            <AdminSquadsTab currentUserRole={role || 'user'} />
          </TabsContent>

          <TabsContent value="without-squad">
            <AdminUsersWithoutSquadTab currentUserRole={role || 'user'} />
          </TabsContent>

          <TabsContent value="discover">
            <AdminDiscoverTab />
          </TabsContent>

          <TabsContent value="premium-forms">
            <AdminPremiumUpgradeFormsTab />
          </TabsContent>

          <TabsContent value="coaching-forms">
            <AdminCoachingIntakeFormsTab />
          </TabsContent>

          <TabsContent value="coaching-clients">
            <AdminCoachingClientsTab />
          </TabsContent>

          <TabsContent value="start-tracker">
            <AdminStartFlowTab />
          </TabsContent>

          {hasSuperAdminAccess && (
            <>
              <TabsContent value="organizations">
                <AdminOrganizationsTab currentUserRole={role || 'user'} />
              </TabsContent>
              <TabsContent value="tracks-programs">
                <AdminTracksAndProgramsTab />
              </TabsContent>
              <TabsContent value="templates">
                <AdminTemplatesTab />
              </TabsContent>
              <TabsContent value="features">
                <AdminFeaturesTab />
              </TabsContent>
              <TabsContent value="platform-settings">
                <AdminPlatformSettingsTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}

