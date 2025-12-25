'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { useMenuTitles } from '@/contexts/BrandingContext';

// Components for different sections
import { ProgramDiscovery } from '@/components/program/ProgramDiscovery';
import { PlatformEmptyState } from '@/components/program/PlatformEmptyState';
import { ProgramListView } from '@/components/program/ProgramListView';
import { ProgramDetailView } from '@/components/program/ProgramDetailView';
import { SquadTabContent } from '@/components/program/SquadTabContent';

/**
 * Program Hub Page
 * 
 * Matches Figma designs for the main Program tab.
 * Contains:
 * - Top pill switcher: Program | Squad (Squad only visible for group programs)
 * - Program tab: Shows enrolled programs (1 or 2) with details
 * - Squad tab: Shows squad members, invite cards, and "View squad stats" button
 * 
 * Routes:
 * - /program - Program tab (default)
 * - /program?tab=squad - Squad tab
 * - /program?programId=xxx - Program details view
 */

type TabType = 'program' | 'squad';

export default function ProgramHubPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Customizable menu titles
  const { squad: squadTitle, program: programTitle } = useMenuTitles();
  
  // Program data
  const { 
    enrollments,
    groupProgram,
    individualProgram,
    hasEnrollments,
    hasGroupProgram,
    hasBothPrograms,
    isPlatformMode,
    isLoading: programsLoading,
  } = useMyPrograms();
  
  // Local state
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('program');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  
  // Determine if Squad tab should be visible for the selected program
  // For group programs: always show squad tab
  // For individual programs: show if client community is enabled and user joined
  const getShowSquadTab = (enrollment: typeof selectedProgram) => {
    if (!enrollment) return false;
    if (enrollment.program.type === 'group') return true;
    // For individual programs, show if community is enabled and user joined
    return enrollment.program.clientCommunityEnabled && enrollment.enrollment.joinedCommunity;
  };
  
  // Legacy: for main view when single program
  const showSquadTab = hasGroupProgram || (
    individualProgram?.program.clientCommunityEnabled && individualProgram?.enrollment.joinedCommunity
  );
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Read initial tab and programId from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType | null;
    const programIdParam = searchParams.get('programId');
    
    if (tabParam === 'squad' && showSquadTab) {
      setActiveTab('squad');
    } else {
      setActiveTab('program');
    }
    
    if (programIdParam) {
      setSelectedProgramId(programIdParam);
    }
  }, [searchParams, showSquadTab]);
  
  // Handle tab change
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setSelectedProgramId(null); // Clear selected program when switching tabs
    
    // Update URL without navigation
    const newUrl = tab === 'squad' ? '/program?tab=squad' : '/program';
    router.replace(newUrl, { scroll: false });
  }, [router]);
  
  // Handle program selection
  const handleSelectProgram = useCallback((programId: string) => {
    setSelectedProgramId(programId);
    router.replace(`/program?programId=${programId}`, { scroll: false });
  }, [router]);
  
  // Handle back from program details
  const handleBackFromDetails = useCallback(() => {
    setSelectedProgramId(null);
    router.replace('/program', { scroll: false });
  }, [router]);
  
  // Get selected program details
  const selectedProgram = useMemo(() => {
    if (!selectedProgramId) return null;
    return enrollments.find(e => e.program.id === selectedProgramId) || null;
  }, [selectedProgramId, enrollments]);
  
  // Loading state - return null, let ProgramDetailView handle skeleton
  const isLoading = !userLoaded || !mounted || programsLoading;
  
  if (isLoading) {
    return null;
  }
  
  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-center px-4">
        <p className="text-text-secondary">Please sign in to view your programs.</p>
      </div>
    );
  }
  
  // Platform mode: show links to tenant domains
  if (isPlatformMode) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
        <PlatformEmptyState />
      </div>
    );
  }
  
  // No enrollments: show available programs or empty state
  if (!hasEnrollments) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16">
        <ProgramDiscovery />
      </div>
    );
  }
  
  // If showing program details view (selected a specific program)
  if (selectedProgram) {
    const programShowSquadTab = getShowSquadTab(selectedProgram);
    // Get the squad ID for this program (community squad for individual, cohort squad for group)
    const programSquadId = selectedProgram.program.type === 'individual'
      ? selectedProgram.program.clientCommunitySquadId
      : selectedProgram.squad?.id; // squad ID from enrollment for group programs
    
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
        {/* Top Pill Switcher - Show for this specific program */}
        {programShowSquadTab && (
          <div className="mb-6">
            <PillSwitcher
              activeTab={activeTab}
              onTabChange={handleTabChange}
              showSquadTab={programShowSquadTab}
              programTitle={programTitle}
              squadTitle={selectedProgram.program.type === 'individual' ? 'Community' : squadTitle}
            />
          </div>
        )}
        
        {activeTab === 'program' || !programShowSquadTab ? (
          <ProgramDetailView 
            program={selectedProgram}
            onBack={handleBackFromDetails}
          />
        ) : (
          <SquadTabContent 
            programId={selectedProgram.program.id}
            squadId={programSquadId || undefined}
            onBack={handleBackFromDetails}
          />
        )}
      </div>
    );
  }
  
  // Main view - when user has multiple programs, just show list (no pill menu)
  if (hasBothPrograms) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
        <ProgramListView 
          enrollments={enrollments}
          onSelectProgram={handleSelectProgram}
        />
      </div>
    );
  }
  
  // Single program view - show pill menu if has squad
  const singleProgram = groupProgram || individualProgram!;
  const singleProgramSquadId = singleProgram.program.type === 'individual'
    ? singleProgram.program.clientCommunitySquadId
    : singleProgram.squad?.id;
    
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Top Pill Switcher - Only if has squad */}
      {showSquadTab && (
        <div className="mb-6">
          <PillSwitcher
            activeTab={activeTab}
            onTabChange={handleTabChange}
            showSquadTab={showSquadTab}
            programTitle={programTitle}
            squadTitle={singleProgram.program.type === 'individual' ? 'Community' : squadTitle}
          />
        </div>
      )}
      
      {/* Tab Content */}
      {activeTab === 'program' || !showSquadTab ? (
        <ProgramDetailView 
          program={singleProgram}
          showBackButton={false}
        />
      ) : (
        <SquadTabContent 
          programId={singleProgram.program.id}
          squadId={singleProgramSquadId || undefined}
        />
      )}
    </div>
  );
}

/**
 * Pill Switcher Component
 * Full-width tabs matching Profile page style
 */
interface PillSwitcherProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  showSquadTab: boolean;
  programTitle: string;
  squadTitle: string;
}

function PillSwitcher({ 
  activeTab, 
  onTabChange, 
  showSquadTab,
  programTitle,
  squadTitle,
}: PillSwitcherProps) {
  return (
    <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2 w-full">
      {/* Program Tab */}
      <button
        onClick={() => onTabChange('program')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-[32px] transition-all ${
          activeTab === 'program'
            ? 'bg-white dark:bg-[#1e222a] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
            : 'bg-transparent'
        }`}
      >
        {/* Chart bar icon */}
        <svg 
          className={`w-5 h-5 ${activeTab === 'program' ? 'text-text-secondary dark:text-[#b2b6c2]' : 'text-text-secondary dark:text-[#7d8190]'}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className={`font-albert text-lg font-semibold tracking-[-1px] leading-[1.3] ${
          activeTab === 'program' ? 'text-text-primary dark:text-[#f5f5f8]' : 'text-text-secondary dark:text-[#7d8190]'
        }`}>
          {programTitle}
        </span>
      </button>
      
      {/* Squad Tab - Only visible if user has group program */}
      {showSquadTab && (
        <button
          onClick={() => onTabChange('squad')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-[32px] transition-all ${
            activeTab === 'squad'
              ? 'bg-white dark:bg-[#1e222a] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
              : 'bg-transparent'
          }`}
        >
          {/* Users group icon */}
          <svg 
            className={`w-5 h-5 ${activeTab === 'squad' ? 'text-text-secondary dark:text-[#b2b6c2]' : 'text-text-secondary dark:text-[#7d8190]'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className={`font-albert text-lg font-semibold tracking-[-1px] leading-[1.3] ${
            activeTab === 'squad' ? 'text-text-primary dark:text-[#f5f5f8]' : 'text-text-secondary dark:text-[#7d8190]'
          }`}>
            {squadTitle}
          </span>
        </button>
      )}
    </div>
  );
}
