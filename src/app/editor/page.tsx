'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { canAccessEditorSection } from '@/lib/admin-utils-shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminDiscoverTab } from '@/components/admin/discover';
import { AdminTracksAndProgramsTab } from '@/components/admin/tracks-programs';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import type { ClerkPublicMetadata } from '@/types';

export default function EditorPage() {
  const router = useRouter();
  const { sessionClaims, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get role from Clerk session (from JWT)
  const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
  const hasEditorAccess = canAccessEditorSection(role);

  // Check authorization
  useEffect(() => {
    if (isLoaded && mounted && !hasEditorAccess) {
      // Redirect unauthorized users
      router.push('/');
    }
  }, [hasEditorAccess, isLoaded, router, mounted]);

  // Show loading state
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

  // Show nothing if not authorized (will redirect)
  if (!hasEditorAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8f6] to-[#f5f2ed] dark:from-[#05070b] dark:to-[#11141b] p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
            Content Editor
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Manage discover content, tracks, and programs
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="discover" className="w-full">
          <TabsList className="mb-6 w-full flex-nowrap overflow-x-auto justify-start bg-white/60 dark:bg-[#11141b]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 p-1 scrollbar-hide">
            <TabsTrigger 
              value="discover"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Discover Content
            </TabsTrigger>
            <TabsTrigger 
              value="tracks-programs"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#a07855]/10 data-[state=active]:to-[#8c6245]/5 data-[state=active]:text-[#1a1a1a] dark:data-[state=active]:from-[#b8896a]/10 dark:data-[state=active]:to-[#a07855]/5 dark:data-[state=active]:text-[#f5f5f8] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
            >
              Tracks & Programs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover">
            <AdminDiscoverTab />
          </TabsContent>

          <TabsContent value="tracks-programs">
            <AdminTracksAndProgramsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


