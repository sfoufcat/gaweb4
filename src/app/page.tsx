'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useUser, SignInButton, SignUpButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHabits } from '@/hooks/useHabits';
import { useAlignment } from '@/hooks/useAlignment';
import { useDashboard } from '@/hooks/useDashboard';
import { useAvailableCheckIns } from '@/hooks/useCheckInFlow';
import { useDynamicPrompts, getGradientClass, getGradientStyle } from '@/hooks/useDynamicPrompts';
import * as LucideIcons from 'lucide-react';
import { useCurrentUserStoryAvailability } from '@/hooks/useUserStoryAvailability';
import { useStoryViewTracking, useStoryViewStatus, generateStoryContentData } from '@/hooks/useStoryViewTracking';
import { HabitCheckInModal } from '@/components/habits/HabitCheckInModal';
import { DailyFocusSection } from '@/components/tasks/DailyFocusSection';
import { StoryAvatar } from '@/components/stories/StoryAvatar';
import { AlignmentGauge } from '@/components/alignment';
import { NotificationBell } from '@/components/notifications';
import { ThemeToggle } from '@/components/theme';
import { ProgramCheckInModal, type ProgramCheckInData } from '@/components/programs/ProgramCheckInModal';
import type { Habit, MorningCheckIn, EveningCheckIn, Task, GoalHistoryEntry } from '@/types';
import Image from 'next/image';
import { Calendar, Users, ChevronRight, ChevronDown, Trophy, BookOpen, User } from 'lucide-react';
import { useSquadContext } from '@/contexts/SquadContext';
import { useProgramPrompt } from '@/hooks/useProgramPrompt';
import { useDiscoverRecommendation } from '@/hooks/useDiscoverRecommendation';
import { useStarterProgram } from '@/hooks/useStarterProgram';
import { useWeeklyFocus } from '@/hooks/useWeeklyFocus';
import { useHomeTutorial } from '@/hooks/useHomeTutorial';
import { HomeTutorialOverlay } from '@/components/tutorial';
import { useMenuTitles } from '@/contexts/BrandingContext';
import { useDailyFocusLimit } from '@/hooks/useDailyFocusLimit';
import { useAvailablePrograms } from '@/hooks/useAvailablePrograms';
import { ProgramCarousel } from '@/components/home/ProgramCarousel';
import { SquadCarousel } from '@/components/home/SquadCarousel';

/**
 * Homepage / Dashboard
 * Matches EXACTLY: https://www.figma.com/design/8y6xbjQJTnzqNEFpfB4Wyi/GrowthAddicts--Backup-?node-id=1484-8842&m=dev
 * Mobile design adapted for desktop/responsive
 */

export default function Dashboard() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [mounted, setMounted] = useState(false);
  const [_userMission, setUserMission] = useState<string | null>(null);
  const [userGoal, setUserGoal] = useState<{ goal?: string; targetDate?: string; progress?: { percentage: number } } | null>(null);
  const [recentlyAchievedGoal, setRecentlyAchievedGoal] = useState<GoalHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good evening');
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  
  // Program completion check-in state
  const [showProgramCheckIn, setShowProgramCheckIn] = useState(false);
  const [programCheckInData, setProgramCheckInData] = useState<{ programId: string | null; programName: string | null } | null>(null);
  const [showProgramCheckInModal, setShowProgramCheckInModal] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showAllHabits, setShowAllHabits] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  // ==========================================================================
  // UNIFIED DASHBOARD DATA - Single API call for all homepage data
  // ==========================================================================
  const {
    checkIns: dashboardCheckIns,
    tasks: dashboardTasks,
    programEnrollments,
    squads: dashboardSquads,
    isLoading: dashboardLoading,
    refetch: refetchDashboard,
  } = useDashboard();
  
  // Map dashboard data to existing variable names for compatibility
  const morningCheckIn = dashboardCheckIns?.morning as MorningCheckIn | null;
  const eveningCheckIn = dashboardCheckIns?.evening as EveningCheckIn | null;
  const weeklyReflection = dashboardCheckIns?.weekly as { completedAt?: string } | null;
  const focusTasks = dashboardTasks?.focus || [];
  const checkInLoading = dashboardLoading;
  
  // Get org's daily focus limit
  const { limit: focusLimit } = useDailyFocusLimit();
  
  // Check if there are available programs to discover
  const { hasAvailablePrograms } = useAvailablePrograms();
  
  const eveningCheckInLoading = dashboardLoading;
  const tasksLoading = dashboardLoading;
  const enrollmentsLoading = dashboardLoading;
  
  // Check which check-in flows are enabled for this organization
  const { 
    isMorningEnabled, 
    isEveningEnabled, 
    isWeeklyEnabled,
    isLoading: flowsLoading 
  } = useAvailableCheckIns();
  
  // Fetch dynamic prompts (custom flows with conditions)
  const { activePrompts: dynamicPrompts } = useDynamicPrompts();
  
  // Helper: Check if today is the user's first day (based on createdAt in local timezone)
  const isUserFirstDay = useCallback((createdAt: string | null): boolean => {
    if (!createdAt) return false;
    const createdDate = new Date(createdAt);
    const today = new Date();
    return (
      createdDate.getFullYear() === today.getFullYear() &&
      createdDate.getMonth() === today.getMonth() &&
      createdDate.getDate() === today.getDate()
    );
  }, []);
  
  // Guard to prevent infinite loop: billing sync updates Clerk metadata,
  // which causes useUser() to return a new reference, triggering re-renders
  const billingSyncAttemptedRef = useRef(false);

  // Handle carousel scroll to update dot indicator
  const handleCarouselScroll = useCallback(() => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.offsetWidth - 32; // Account for padding
    const newIndex = Math.round(scrollLeft / (cardWidth + 12)); // 12 = gap-3
    setCarouselIndex(Math.min(2, Math.max(0, newIndex)));
  }, []);

  // Scroll to specific carousel index
  const scrollToIndex = useCallback((index: number) => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const cardWidth = container.offsetWidth - 32;
    container.scrollTo({
      left: index * (cardWidth + 12),
      behavior: 'smooth'
    });
  }, []);
  
  // Integrate habits hook
  const { habits, isLoading: habitsLoading, markComplete, fetchHabits } = useHabits();
  
  // Integrate alignment hook for daily alignment & streak
  const { alignment, summary, isLoading: alignmentLoading } = useAlignment();
  
  // Integrate squad context for My Squad section
  const { squad, members, isLoading: squadLoading } = useSquadContext();
  
  // Get customizable menu titles
  const { mySquad: mySquadTitle, squad: squadTerm } = useMenuTitles();
  
  // Program-based prompts have replaced track-based prompts
  
  // Determine if we should show weekly prompts
  // (Friday/Saturday/Sunday and weekly reflection not yet completed)
  const shouldUseWeeklyPrompt = useMemo(() => {
    const dayOfWeek = new Date().getDay();
    const isWeeklyReflectionPeriod = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0; // Fri, Sat, Sun
    const weeklyReflectionCompleted = weeklyReflection?.completedAt != null;
    return isWeeklyReflectionPeriod && !weeklyReflectionCompleted;
  }, [weeklyReflection]);
  
  // Get program-specific prompt for Dynamic Section
  const { prompt: programPrompt, programName, isLoading: programPromptLoading, hasEnrollment: hasPromptEnrollment } = useProgramPrompt();
  
  // Get discover recommendation for the discover card
  const { recommendation: discoverRecommendation, isLoading: discoverLoading } = useDiscoverRecommendation();
  
  // Unified loading state for card carousel - wait for all card data to prevent reordering
  const carouselDataLoading = checkInLoading || programPromptLoading || discoverLoading;
  
  // Starter Program state for task sync and completion
  const { 
    hasEnrollment,
    enrollment: programEnrollment,
    program, 
    isCompleted: programIsCompleted,
    trackDisplayName,
    syncTasks: syncProgramTasks,
    refresh: refreshProgram,
  } = useStarterProgram();
  
  // Weekly focus hook for displaying focus in header
  const { weeklyFocusSummary, isLoading: weeklyFocusLoading } = useWeeklyFocus();
  
  // State for program completion modal
  const [showProgramCompletionModal, setShowProgramCompletionModal] = useState(false);
  const [hasShownCompletionModal, setHasShownCompletionModal] = useState(false);
  
  // State for home tutorial
  const [hasCompletedHomeTutorial, setHasCompletedHomeTutorial] = useState(false);
  const [tutorialDataLoaded, setTutorialDataLoaded] = useState(false);
  
  // Home tutorial hook (must be after state declaration)
  const homeTutorial = useHomeTutorial({
    userId: user?.id,
    hasCompletedTutorialFromServer: hasCompletedHomeTutorial,
    hasTrack: hasEnrollment,
    isAuthenticated: !!user,
    serverDataLoaded: tutorialDataLoaded,
  });
  
  // Track if we've synced program tasks this session
  const hasSyncedProgramTasksRef = useRef(false);
  
  // Story availability for current user
  const storyAvailability = useCurrentUserStoryAvailability();
  
  // Story view tracking for current user's own story - use reactive hook for cross-component sync
  const { markStoryAsViewed } = useStoryViewTracking();
  const currentUserId = user?.id || '';
  
  // Generate full content data for smart view tracking
  // This ensures content removal (story expiry) doesn't turn the ring green
  const ownContentData = useMemo(() => generateStoryContentData(
    storyAvailability.data.hasTasksToday,
    storyAvailability.data.hasDayClosed,
    storyAvailability.data.tasks?.length || 0,
    storyAvailability.data.hasWeekClosed,
    storyAvailability.data.userPostedStories?.length || 0
  ), [storyAvailability.data]);
  
  const hasViewedFromHook = useStoryViewStatus(currentUserId, ownContentData);
  const hasViewedOwnStory = storyAvailability.hasStory && storyAvailability.contentHash 
    ? hasViewedFromHook 
    : false;
  
  const handleOwnStoryViewed = useCallback(() => {
    if (currentUserId) {
      markStoryAsViewed(currentUserId, ownContentData);
    }
  }, [currentUserId, markStoryAsViewed, ownContentData]);

  // Check if current time is within morning window (7 AM - 12 PM)
  const isMorningWindow = useCallback(() => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 12;
  }, []);

  // Check if current time is within evening window (5 PM - 11 PM)
  const isEveningWindow = useCallback(() => {
    const hour = new Date().getHours();
    return hour >= 17 && hour < 23;
  }, []);

  // Check if it's a weekend (no daily check-ins on weekends)
  const isWeekend = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }, []);

  // Determine if check-ins are completed
  const isMorningCheckInCompleted = !!morningCheckIn?.completedAt;
  const isEveningCheckInCompleted = !!eveningCheckIn?.completedAt;
  
  // Compute program pending state (when user needs to do morning check-in for tasks)
  const programPending = useMemo(() => {
    if (!hasEnrollment || !programEnrollment || !program) return null;
    
    const today = new Date().toISOString().split('T')[0];
    const startDate = programEnrollment.startedAt; // YYYY-MM-DD format
    const enrollmentDate = programEnrollment.createdAt?.split('T')[0]; // Day enrollment was created
    const isEnrollmentDay = enrollmentDate === today;
    const hour = new Date().getHours();
    const isInMorningWindow = hour >= 7 && hour < 12;
    const isAfterNoon = hour >= 12;
    
    // Program starts tomorrow (enrolled after noon today)
    if (startDate > today) {
      return {
        startsTomorrow: true,
        startsToday: false,
        programName: program.name,
      };
    }
    
    // On enrollment day after noon, if check-in not done, show "starts tomorrow"
    // (because morning window passed, tasks won't sync today)
    if (isEnrollmentDay && isAfterNoon && !isMorningCheckInCompleted) {
      return {
        startsTomorrow: true,
        startsToday: false,
        programName: program.name,
      };
    }
    
    // Show "complete check-in" card if:
    // 1. It's enrollment day morning (before noon), OR
    // 2. It's morning window (7-12) on any subsequent day
    // AND morning check-in not completed
    if (startDate <= today && (isEnrollmentDay || isInMorningWindow) && !isMorningCheckInCompleted) {
      return {
        startsTomorrow: false,
        startsToday: true,
        programName: program.name,
      };
    }
    
    return null;
  }, [hasEnrollment, programEnrollment, program, isMorningCheckInCompleted]);
  
  // Compute whether to show "Load program tasks" card
  // Shown when user has program enrollment but missed morning check-in and has no tasks
  const canLoadProgramTasks = useMemo(() => {
    // Only show when:
    // - User has active enrollment (not completed)
    // - Not already showing programPending card (which handles morning window)
    // - User has zero focus tasks (and check loading is done)
    // - Morning check-in not completed
    // - Outside morning window (when Daily Focus is actually visible)
    return (
      hasEnrollment && 
      !programIsCompleted &&
      !programPending &&
      !tasksLoading &&
      focusTasks.length === 0 &&
      !isMorningCheckInCompleted &&
      !isMorningWindow()
    );
  }, [hasEnrollment, programIsCompleted, programPending, tasksLoading, focusTasks.length, isMorningCheckInCompleted, isMorningWindow]);
  
  // Check if all focus tasks are completed (when focus is at limit)
  const allFocusTasksCompleted = focusTasks.length >= focusLimit && 
    focusTasks.every(task => task.status === 'completed');
  
  // Should show morning check-in CTA (during morning hours when not completed, not on weekends, AND flow is enabled)
  const shouldShowMorningCheckInCTA = !checkInLoading && !flowsLoading && isMorningEnabled && !isWeekend && isMorningWindow() && !isMorningCheckInCompleted;
  
  // Should show evening check-in CTA:
  // - Only after we've loaded the evening check-in status (to avoid flash)
  // - Flow must be enabled for this organization
  // - Not on weekends (no daily check-ins on Saturday/Sunday)
  // - In evening window (5-11 PM) and not completed, OR
  // - All 3 focus tasks completed AND morning completed AND not evening completed
  const shouldShowEveningCheckInCTA = !eveningCheckInLoading && !flowsLoading && isEveningEnabled && !isWeekend && !isEveningCheckInCompleted && (
    isEveningWindow() || 
    (allFocusTasksCompleted && isMorningCheckInCompleted)
  );
  
  // Determine evening CTA text
  const eveningCTAText = isEveningWindow() ? 'Begin evening check-in' : 'Close your day';
  const eveningCTASubtext = isEveningWindow() ? 'Reflect on your day' : 'All tasks completed!';

  // Determine if weekly reflection should be shown
  const shouldShowWeeklyReflectionCTA = useMemo(() => {
    // Flow must be enabled
    if (!isWeeklyEnabled || flowsLoading) return false;
    
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    
    // Check if it's Friday, Saturday, or Sunday
    const isFriday = dayOfWeek === 5;
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;
    
    // Already completed this week
    if (weeklyReflection?.completedAt) {
      return false;
    }
    
    // Saturday or Sunday - show regardless
    if (isSaturday || isSunday) {
      return true;
    }
    
    // Friday - only show after evening check-in is completed
    if (isFriday && isEveningCheckInCompleted) {
      return true;
    }
    
    return false;
  }, [isEveningCheckInCompleted, weeklyReflection, isWeeklyEnabled, flowsLoading]);
  
  // Should hide Daily Focus (during morning hours when check-in not completed, not on weekends, only if morning flow is enabled)
  const shouldHideDailyFocus = !checkInLoading && !flowsLoading && isMorningEnabled && !isWeekend && isMorningWindow() && !isMorningCheckInCompleted;
  
  // First day experience logic
  const isFirstDay = isUserFirstDay(userCreatedAt);
  const currentHour = new Date().getHours();
  const isMorningWindowClosed = currentHour >= 12;
  
  // Determine if we're showing "missed check-in" version (first day, after 12pm, no check-in)
  const showFirstDayMissedCheckin = isFirstDay && isMorningWindowClosed && !isMorningCheckInCompleted;
  
  // Check if any prompt is active (morning, evening, weekly, or dynamic prompts)
  const hasActivePrompt = shouldShowMorningCheckInCTA || shouldShowEveningCheckInCTA || shouldShowWeeklyReflectionCTA || dynamicPrompts.length > 0;
  
  // Dynamic headline based on time of day and check-in/task state
  const dynamicHeadline = useMemo(() => {
    const hour = new Date().getHours();
    
    // Weekend - show relaxed weekend message
    if (isWeekend) {
      const day = new Date().getDay();
      if (day === 6) { // Saturday
        return "Enjoy your weekend rest.";
      }
      return "Have a great Sunday."; // Sunday
    }
    
    // Day closed - highest priority
    if (isEveningCheckInCompleted) {
      return "Another day of growth complete.";
    }
    
    // All tasks completed (but day not closed yet)
    if (allFocusTasksCompleted && isMorningCheckInCompleted) {
      return "You crushed it today.";
    }
    
    // Morning window
    if (hour >= 5 && hour < 12) {
      if (!isMorningCheckInCompleted) {
        return "Start your day with intention.";
      }
      return "Focus on what matters today.";
    }
    
    // Afternoon (12 PM - 5 PM)
    if (hour >= 12 && hour < 17) {
      if (isMorningCheckInCompleted) {
        return "Keep the momentum going.";
      }
      return "There's still time to make today count.";
    }
    
    // Evening (5 PM onwards)
    return "Slow down and reflect on your day.";
  }, [isWeekend, isEveningCheckInCompleted, allFocusTasksCompleted, isMorningCheckInCompleted]);

  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // Check-ins, tasks, enrollments are now fetched via unified useDashboard hook

  // Sync program tasks after morning check-in is completed
  // This creates tasks from the user's active starter program if needed
  useEffect(() => {
    // Skip if not ready or already synced this session
    if (!user || !isMorningCheckInCompleted || hasSyncedProgramTasksRef.current) return;
    
    // Only sync if user has an active enrollment
    if (!hasEnrollment) return;
    
    const doSync = async () => {
      hasSyncedProgramTasksRef.current = true;
      
      try {
        const result = await syncProgramTasks();
        
        if (result.tasksCreated > 0) {
          console.log(`[HOME] Synced ${result.tasksCreated} program tasks for day ${result.currentDayIndex}`);
        }
        
        // Check if program just completed (user finished last day)
        if (result.currentDayIndex === program?.lengthDays && !hasShownCompletionModal) {
          setShowProgramCompletionModal(true);
          setHasShownCompletionModal(true);
        }
      } catch (error) {
        console.error('[HOME] Error syncing program tasks:', error);
      }
    };

    doSync();
  }, [user, isMorningCheckInCompleted, hasEnrollment, syncProgramTasks, program?.lengthDays, hasShownCompletionModal]);

  // Show completion modal if program is already completed on load
  useEffect(() => {
    if (programIsCompleted && !hasShownCompletionModal && program) {
      // Check sessionStorage to avoid showing multiple times
      const completionKey = `programCompleted_${program.id}`;
      const alreadyShown = sessionStorage.getItem(completionKey);
      
      if (!alreadyShown) {
        setShowProgramCompletionModal(true);
        setHasShownCompletionModal(true);
        sessionStorage.setItem(completionKey, 'true');
      }
    }
  }, [programIsCompleted, hasShownCompletionModal, program]);

  // Handle program check-in modal from unified dashboard data
  useEffect(() => {
    if (!dashboardLoading && dashboardCheckIns?.program?.show) {
      setShowProgramCheckIn(true);
      setProgramCheckInData({
        programId: dashboardCheckIns.program.programId,
        programName: dashboardCheckIns.program.programName,
      });
      setShowProgramCheckInModal(true);
    }
  }, [dashboardLoading, dashboardCheckIns?.program]);

  useEffect(() => {
    async function fetchUserData() {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        // SELF-HEALING: Sync billing status with Stripe and Clerk
        // This ensures we have the latest subscription status even if webhooks failed
        // The sync endpoint now updates BOTH Firebase and Clerk metadata
        // IMPORTANT: Only sync once per session to prevent infinite loops
        // (Clerk metadata updates cause useUser to return new reference)
        if (!billingSyncAttemptedRef.current) {
          billingSyncAttemptedRef.current = true;
          try {
            const syncResponse = await fetch('/api/billing/sync', { method: 'POST' });
            const syncResult = await syncResponse.json();
            console.log('[BILLING_SYNC] Result:', syncResult);
            
            // If sync found a subscription and updated Clerk, force a session refresh
            // so the middleware sees the new billing status immediately
            if (syncResult.synced && syncResult.status === 'active') {
              console.log('[BILLING_SYNC] Found active subscription, Clerk updated');
            }
          } catch (syncError) {
            console.warn('[BILLING_SYNC] Failed, continuing with cached data:', syncError);
          }
        }
        
        const response = await fetch('/api/user/me');
        if (response.ok) {
          const data = await response.json();
          
          // Handle user data and onboarding redirects
          // NOTE: Billing access is now handled by middleware via Clerk metadata
          // This dashboard only handles onboarding flow redirects
          if (data.user) {
            const onboardingStatus = data.user.onboardingStatus;
            const hasCompletedOnboarding = data.user.hasCompletedOnboarding;
            const convertedToMember = data.user.convertedToMember;
            
            // Check if user just completed payment (prevents race condition with Clerk JWT refresh)
            const justCompletedPayment = typeof window !== 'undefined' && 
              sessionStorage.getItem('ga_just_completed_payment') === 'true';
            
            if (justCompletedPayment) {
              // Clear the flag after using it
              sessionStorage.removeItem('ga_just_completed_payment');
              console.log('[DASHBOARD] User just completed payment, skipping billing redirects');
              // Don't redirect - let user stay on dashboard
              // Their billing status will sync eventually
            }
            
            // Check Clerk billing status to prevent redirect loops
            // If user has active billing, they should NOT be sent to /onboarding/plan
            const clerkBillingStatus = (user?.publicMetadata as { billingStatus?: string })?.billingStatus;
            const hasActiveBilling = justCompletedPayment || clerkBillingStatus === 'active' || clerkBillingStatus === 'trialing';
            
            // IMPORTANT: Users who converted from guest flow should NEVER be redirected to old onboarding
            // They completed onboarding via /start/* flow and paid - treat them as fully onboarded
            if (convertedToMember) {
              console.log('[DASHBOARD] User converted from guest flow, skipping onboarding redirects');
              // Don't redirect - let them stay on dashboard
            }
            // If user hasn't completed onboarding, redirect to appropriate step
            // BUT: If they have active billing, don't redirect to plan page (would cause loop)
            else if (!hasCompletedOnboarding) {
              if (!onboardingStatus || onboardingStatus === 'welcome') {
                router.push('/onboarding/welcome');
                return;
              } else if (onboardingStatus === 'workday') {
                router.push('/onboarding/workday');
                return;
              } else if (onboardingStatus === 'obstacles') {
                router.push('/onboarding/obstacles');
                return;
              } else if (onboardingStatus === 'business_stage') {
                router.push('/onboarding/business-stage');
                return;
              } else if (onboardingStatus === 'goal_impact') {
                router.push('/onboarding/goal-impact');
                return;
              } else if (onboardingStatus === 'support_needs') {
                router.push('/onboarding/support-needs');
                return;
              } else if (onboardingStatus === 'create_profile_intro') {
                router.push('/onboarding/create-profile-intro');
                return;
              } else if (onboardingStatus === 'edit_profile') {
                router.push('/profile?edit=true&fromOnboarding=true');
                return;
              } else if (onboardingStatus === 'mission') {
                router.push('/onboarding');
                return;
              } else if (onboardingStatus === 'goal') {
                router.push('/onboarding/goal');
                return;
              } else if (onboardingStatus === 'transformation') {
                router.push('/onboarding/transformation');
                return;
              } else if (onboardingStatus === 'plan' || onboardingStatus === 'completed') {
                // User at plan step - BUT if already billed, stay on dashboard
                // This prevents redirect loop: home -> plan -> home -> plan...
                if (!hasActiveBilling) {
                  router.push('/onboarding/plan');
                  return;
                }
                // If billed but Firebase says not completed, just stay on dashboard
                // The billing sync should eventually fix Firebase
                console.log('[DASHBOARD] User has billing but hasCompletedOnboarding=false, staying on dashboard');
              } else {
                // Unknown status - only send to plan if not billed
                if (!hasActiveBilling) {
                  router.push('/onboarding/plan');
                  return;
                }
                console.log('[DASHBOARD] Unknown onboarding status but user is billed, staying on dashboard');
              }
            }
            // If hasCompletedOnboarding is true, user has paid and can use the app
            // Middleware would have blocked them if billing was invalid
          } else if (data.exists === false) {
            // New user - but check if they're from guest flow first
            // If they have active billing but no Firebase document, they're likely
            // in the middle of guest flow account linking - wait for it to complete
            const clerkBillingStatus = (user?.publicMetadata as { billingStatus?: string })?.billingStatus;
            if (clerkBillingStatus === 'active' || clerkBillingStatus === 'trialing') {
              console.log('[DASHBOARD] User has billing but no Firebase doc - likely guest flow in progress, waiting...');
              // Don't redirect - stay on dashboard loading state
              // The link-account process will create the document shortly
              return;
            }
            // No billing = truly new user, start onboarding
            router.push('/onboarding/welcome');
            return;
          }
          
          setUserMission(data.user?.identity || null);
          setUserGoal(data.goal || null);
          setUserCreatedAt(data.user?.createdAt || null);
          setHasCompletedHomeTutorial(data.user?.hasCompletedHomeTutorial || false);
          setTutorialDataLoaded(true);
          
          // Check if user has recently achieved a goal (within last 7 days)
          if (!data.goal && data.user?.goalHistory && Array.isArray(data.user.goalHistory)) {
            const completedGoals = data.user.goalHistory.filter(
              (g: GoalHistoryEntry) => g.completedAt !== null
            );
            if (completedGoals.length > 0) {
              // Sort by completedAt date, most recent first
              completedGoals.sort((a: GoalHistoryEntry, b: GoalHistoryEntry) => 
                new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
              );
              const mostRecent = completedGoals[0];
              // Check if completed within last 7 days
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              if (new Date(mostRecent.completedAt!) >= sevenDaysAgo) {
                setRecentlyAchievedGoal(mostRecent);
              }
            }
          } else {
            setRecentlyAchievedGoal(null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    if (isLoaded) {
      fetchUserData();
    }
  }, [user, isLoaded, router]);

  if (!isLoaded || !mounted) {
    return null;
  }

  if (!user) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center space-y-8 px-4">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl overflow-hidden relative">
          <Image 
            src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af"
            alt="Growth Addicts Logo"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div>
          <h1 className="text-5xl sm:text-7xl font-serif font-bold text-earth-900 tracking-tight mb-4">
            Growth Addicts
          </h1>
          <p className="text-earth-600 text-lg max-w-md mx-auto">
            Define your mission. Align your life. Find your tribe.
          </p>
        </div>
        <div className="flex gap-4">
          <SignInButton mode="modal">
            <button className="px-8 py-4 bg-earth-900 text-white rounded-full font-medium hover:scale-105 transition-all cursor-pointer">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="px-8 py-4 border border-earth-200 rounded-full font-medium hover:bg-earth-50 transition-all cursor-pointer">
              Join
            </button>
          </SignUpButton>
        </div>
      </div>
    );
  }

  // Daily Focus is now handled by DailyFocusSection component

  // Format time helper
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const displayHour = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Capitalize first letter helper
  const capitalizeFirstLetter = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Format frequency for display
  const formatFrequency = (frequencyType: string, frequencyValue: number[] | number): string => {
    if (frequencyType === 'daily') {
      return 'Daily';
    } else if (frequencyType === 'weekly_specific_days') {
      // Our day format: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
      const dayNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
      if (Array.isArray(frequencyValue)) {
        if (frequencyValue.length === 5 && 
            frequencyValue.every(d => [0,1,2,3,4].includes(d))) {
          return 'Workdays';
        }
        return frequencyValue.map(d => dayNames[d]).join(', ');
      }
    } else if (frequencyType === 'weekly_number') {
      return `${frequencyValue}x/week`;
    } else if (frequencyType === 'monthly_specific_days') {
      if (Array.isArray(frequencyValue)) {
        return `Days: ${frequencyValue.join(', ')}`;
      }
    } else if (frequencyType === 'monthly_number') {
      return `${frequencyValue}x/month`;
    }
    return 'Custom';
  };

  // Check if habit is completed today
  const isCompletedToday = (habit: Habit) => {
    const today = new Date().toISOString().split('T')[0];
    return habit.progress.completionDates.includes(today);
  };

  // Check if habit is skipped today
  const isSkippedToday = (habit: Habit) => {
    const today = new Date().toISOString().split('T')[0];
    return habit.progress.skipDates?.includes(today) || false;
  };

  // Check if habit should show today based on frequency
  const shouldShowToday = (habit: Habit): boolean => {
    // JavaScript getDay(): 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
    // Our selector saves: 0=Monday, 1=Tuesday, 2=Wednesday, ..., 6=Sunday
    // So we need to convert
    const jsDay = new Date().getDay(); // 0-6 (Sun-Sat)
    const ourDay = jsDay === 0 ? 6 : jsDay - 1; // Convert to our format (0-6, Mon-Sun)
    
    if (habit.frequencyType === 'daily') {
      return true;
    } else if (habit.frequencyType === 'weekly_specific_days') {
      if (Array.isArray(habit.frequencyValue)) {
        return habit.frequencyValue.includes(ourDay);
      }
    } else if (habit.frequencyType === 'weekly_number') {
      return true;
    } else if (habit.frequencyType === 'monthly_specific_days') {
      const dayOfMonth = new Date().getDate();
      if (Array.isArray(habit.frequencyValue)) {
        return habit.frequencyValue.includes(dayOfMonth);
      }
    } else if (habit.frequencyType === 'monthly_number') {
      return true;
    }
    
    return true;
  };

  // Handle habit click to show modal (only if not completed)
  const handleHabitClick = (habit: Habit) => {
    const completedToday = isCompletedToday(habit);
    
    // Don't show modal if already completed today
    if (completedToday) {
      return;
    }
    
    // If skipped or incomplete, show modal
    setSelectedHabit(habit);
    setShowCheckInModal(true);
  };

  // Handle marking habit as complete
  const handleCompleteHabit = async () => {
    if (!selectedHabit) return;
    
    try {
      await markComplete(selectedHabit.id);
      setShowCheckInModal(false);
      setSelectedHabit(null);
    } catch (error) {
      console.error('Failed to mark habit complete:', error);
    }
  };

  // Handle skipping habit for today
  const handleSkipHabit = async () => {
    if (!selectedHabit) return;
    
    try {
      const response = await fetch(`/api/habits/${selectedHabit.id}/skip`, {
        method: 'POST',
      });

      const data = await response.json();

      // If already skipped, that's okay - just close modal
      if (!response.ok && data.error === 'Habit already skipped today') {
        setShowCheckInModal(false);
        setSelectedHabit(null);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to skip habit');
      }

      await fetchHabits(); // Refresh habits
      setShowCheckInModal(false);
      setSelectedHabit(null);
    } catch (error) {
      console.error('Failed to skip habit:', error);
    }
  };

  // Get habits to display (limit to 2 for homepage unless expanded, filter by today and exclude archived)
  const todaysHabits = habits.filter(h => !h.archived && shouldShowToday(h));
  const displayHabits = showAllHabits ? todaysHabits : todaysHabits.slice(0, 2);
  
  console.log('Homepage - All habits:', habits.length);
  console.log('Homepage - Todays habits:', todaysHabits.length);
  console.log('Homepage - Habits details:', habits.map(h => ({ 
    name: h.text, 
    frequencyType: h.frequencyType, 
    frequencyValue: h.frequencyValue,
    archived: h.archived 
  })));

  // Calculate days left for goal
  const calculateDaysLeft = (targetDate: string) => {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const goalDaysLeft = userGoal?.targetDate ? calculateDaysLeft(userGoal.targetDate) : null;
  const goalProgress = userGoal?.progress?.percentage || 0;

  // ============================================================================
  // CAROUSEL CARD RENDER HELPERS
  // ============================================================================
  
  // Card type definitions for dynamic ordering
  type CardType = 'prompt' | 'goal' | 'discover' | 'status' | 'welcome' | 'track' | 'program_checkin';
  
  // Determine the prompt card content (morning/evening/weekly)
  const renderPromptCard = (isMobile: boolean) => {
    const baseClasses = isMobile 
      ? "w-[calc(100vw-32px)] flex-shrink-0 snap-center h-[200px] rounded-[32px] overflow-hidden relative flex flex-col justify-center items-center"
      : "h-[200px] rounded-[32px] overflow-hidden relative p-6 flex flex-col items-center justify-center hover:scale-[1.02] transition-transform cursor-pointer";
    
    if (shouldShowMorningCheckInCTA) {
      return (
        <Link 
          key="prompt"
          href="/checkin/morning/start" 
          className={`${baseClasses} bg-gradient-to-br from-emerald-500 to-teal-600`}
        >
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 text-center">
            <p className={`font-albert ${isMobile ? 'text-[24px]' : 'text-[28px]'} text-white leading-[1.2] tracking-[-1.3px] font-medium`}>
              Begin Morning Check-In
            </p>
            <p className="font-sans text-[14px] text-white/80 leading-[1.2] mt-2">
              Start your day with intention
            </p>
          </div>
        </Link>
      );
    }
    
    if (shouldShowEveningCheckInCTA) {
      return (
        <Link 
          key="prompt"
          href="/checkin/evening/start"
          className={`${baseClasses} bg-gradient-to-br from-indigo-500 to-purple-600`}
        >
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 text-center">
            <p className={`font-albert ${isMobile ? 'text-[24px]' : 'text-[28px]'} text-white leading-[1.2] tracking-[-1.3px] font-medium`}>
              {eveningCTAText}
            </p>
            <p className="font-sans text-[14px] text-white/80 leading-[1.2] mt-2">
              {eveningCTASubtext}
            </p>
          </div>
        </Link>
      );
    }
    
    if (shouldShowWeeklyReflectionCTA) {
      return (
        <Link 
          key="prompt"
          href="/checkin/weekly/checkin"
          className={`${baseClasses} bg-gradient-to-br from-amber-500 to-orange-600`}
        >
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 text-center">
            <Calendar className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} text-white mb-3 mx-auto`} />
            <p className={`font-albert ${isMobile ? 'text-[24px]' : 'text-[28px]'} text-white leading-[1.2] tracking-[-1.3px] font-medium`}>
              Start Weekly Reflection
            </p>
            <p className="font-sans text-[14px] text-white/80 leading-[1.2] mt-2">
              Close your week with intention
            </p>
          </div>
        </Link>
      );
    }
    
    // If we have dynamic prompts (custom flows), show the first one
    if (dynamicPrompts.length > 0) {
      const prompt = dynamicPrompts[0];
      const { displayConfig } = prompt;
      const gradientClass = getGradientClass(displayConfig.gradient);
      const gradientStyle = getGradientStyle(displayConfig.gradient);
      
      // Get icon component if it's a Lucide icon name
      const iconName = displayConfig.icon || 'sparkles';
      const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
        iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      ];
      
      return (
        <Link 
          key={`dynamic-${prompt.id}`}
          href={prompt.url}
          className={`${baseClasses} ${gradientClass || ''}`}
          style={gradientStyle}
        >
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 text-center">
            {IconComponent ? (
              <IconComponent className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} text-white mb-3 mx-auto`} />
            ) : displayConfig.icon && (
              <span className={`${isMobile ? 'text-[28px]' : 'text-[32px]'} mb-3 block`}>
                {displayConfig.icon}
              </span>
            )}
            <p className={`font-albert ${isMobile ? 'text-[24px]' : 'text-[28px]'} text-white leading-[1.2] tracking-[-1.3px] font-medium`}>
              {displayConfig.title}
            </p>
            {displayConfig.subtitle && (
              <p className="font-sans text-[14px] text-white/80 leading-[1.2] mt-2">
                {displayConfig.subtitle}
              </p>
            )}
          </div>
        </Link>
      );
    }
    
    return null;
  };
  
  // Goal card (handles goal/no goal/recently achieved/loading states)
  const renderGoalCard = (isMobile: boolean) => {
    const baseClasses = isMobile
      ? "w-[calc(100vw-32px)] flex-shrink-0 snap-center h-[200px] rounded-[32px] overflow-hidden relative"
      : "h-[200px] rounded-[32px] overflow-hidden relative cursor-pointer hover:scale-[1.02] transition-transform";
    
    if (userGoal) {
      return (
        <Link key="goal" href="/goal" className={`${baseClasses} bg-gradient-to-br from-gray-700 to-gray-900 p-6`}>
          <div className="absolute inset-0 bg-black/55" />
          <div className="relative z-10 h-full flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={`font-sans ${isMobile ? 'text-[11px]' : 'text-[12px]'} text-white/90 leading-[1.2] mb-1.5`}>
                My goal
              </p>
              <p className={`font-albert ${isMobile ? 'text-[20px]' : 'text-[24px]'} text-white leading-[1.25] tracking-[-1.2px] mb-1.5`}>
                {capitalizeFirstLetter(userGoal.goal || '')}
              </p>
              <p className={`font-sans ${isMobile ? 'text-[12px]' : 'text-[14px]'} text-white/60 leading-[1.2]`}>
                {goalDaysLeft !== null && goalDaysLeft >= 0 ? `${goalDaysLeft} days left` : 'Goal date passed'}
              </p>
            </div>
            <div className={`relative ${isMobile ? 'w-[90px] h-[90px]' : 'w-[100px] h-[100px]'} flex-shrink-0`}>
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="white" strokeWidth="8" strokeDasharray={`${(goalProgress / 100) * 251.2} 251.2`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <span className={`font-albert ${isMobile ? 'text-[16px]' : 'text-[18px]'} font-semibold tracking-[-1px]`}>{Math.round(goalProgress)}%</span>
                <span className={`font-sans ${isMobile ? 'text-[11px]' : 'text-[12px]'} text-white/60`}>complete</span>
              </div>
            </div>
          </div>
        </Link>
      );
    }
    
    if (recentlyAchievedGoal) {
      return (
        <Link key="goal" href="/onboarding/goal" className={`${baseClasses} bg-gradient-to-br from-amber-500 to-amber-700 flex flex-col justify-center items-center cursor-pointer`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 text-center">
            <p className={`font-albert ${isMobile ? 'text-[18px]' : 'text-[22px]'} text-white leading-[1.2] tracking-[-1.2px] font-medium mb-1`}>
              🎉 You achieved:
            </p>
            <p className={`font-sans ${isMobile ? 'text-[14px]' : 'text-[16px]'} text-white leading-[1.3] font-medium mb-3 px-2`}>
              {capitalizeFirstLetter(recentlyAchievedGoal.goal)}
            </p>
            <span className={`px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full font-sans ${isMobile ? 'text-[12px]' : 'text-[14px]'} text-white font-medium`}>
              Set a new goal →
            </span>
          </div>
        </Link>
      );
    }
    
    if (loading || (isMorningWindow() && checkInLoading) || (isEveningWindow() && eveningCheckInLoading)) {
      return (
        <div key="goal" className={`${baseClasses} bg-gradient-to-br from-gray-700 to-gray-900 p-6 flex flex-col justify-center items-center`}>
          <div className="absolute inset-0 bg-black/55" />
          <div className="relative z-10">
            <div className={`animate-pulse ${isMobile ? 'w-24' : 'w-20'} h-4 bg-white/20 rounded mb-2 mx-auto`} />
            <div className={`animate-pulse ${isMobile ? 'w-32' : 'w-40'} h-6 bg-white/20 rounded mx-auto`} />
          </div>
        </div>
      );
    }
    
    // No goal set
    return (
      <Link key="goal" href="/onboarding/goal" className={`${baseClasses} bg-gradient-to-br from-gray-700 to-gray-900 p-6 flex flex-col justify-center items-center cursor-pointer`}>
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 text-center">
          <p className={`font-sans ${isMobile ? 'text-[11px]' : 'text-[12px]'} text-white/90 leading-[1.2] mb-1.5`}>
            My goal
          </p>
          <p className={`font-albert ${isMobile ? 'text-[18px]' : 'text-[24px]'} text-white leading-[1.3] tracking-[-1.2px] mb-3`}>
            Set a new goal
          </p>
          <span className={`px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full font-sans ${isMobile ? 'text-[12px]' : 'text-[14px]'} text-white font-medium`}>
            Get started →
          </span>
        </div>
      </Link>
    );
  };
  
  // Discover card - shows recommended content from Discover section
  const renderDiscoverCard = (isMobile: boolean) => {
    const baseClasses = isMobile
      ? "w-[calc(100vw-32px)] flex-shrink-0 snap-center h-[200px] rounded-[32px] overflow-hidden relative bg-gradient-to-br from-violet-500 to-purple-600 flex flex-col justify-center items-center"
      : "h-[200px] rounded-[32px] overflow-hidden relative bg-gradient-to-br from-violet-500 to-purple-600 p-6 flex flex-col justify-center items-center hover:scale-[1.02] transition-transform cursor-pointer";
    
    // Don't render while loading or if no recommendation
    if (!discoverRecommendation) {
      return null;
    }
    
    const href = discoverRecommendation.type === 'article' 
      ? `/discover/articles/${discoverRecommendation.id}`
      : `/discover/courses/${discoverRecommendation.id}`;
    
    return (
      <Link key="discover" href={href} className={baseClasses}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 px-6 text-center">
          {/* Content type badge */}
          <span className={`inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full font-sans ${isMobile ? 'text-[10px]' : 'text-[11px]'} text-white/90 font-medium mb-3 uppercase tracking-wide`}>
            {discoverRecommendation.type === 'article' ? 'Article' : 'Course'}
          </span>
          {/* Title */}
          <p className={`font-albert ${isMobile ? 'text-[20px]' : 'text-[22px]'} text-white leading-[1.2] tracking-[-1.2px] font-semibold mb-2 line-clamp-2`}>
            {discoverRecommendation.title}
          </p>
          {/* Description */}
          <p className={`font-sans ${isMobile ? 'text-[12px]' : 'text-[13px]'} text-white/80 leading-[1.4] line-clamp-2`}>
            {discoverRecommendation.description}
          </p>
        </div>
      </Link>
    );
  };
  
  // Status card
  const renderStatusCard = (isMobile: boolean) => {
    const baseClasses = isMobile
      ? "w-[calc(100vw-32px)] flex-shrink-0 snap-center h-[200px] rounded-[32px] overflow-hidden relative bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
      : "h-[200px] rounded-[32px] overflow-hidden relative bg-gradient-to-br from-indigo-500 to-purple-600 p-6 flex items-center justify-center";
    
    return (
      <div key="status" className={baseClasses}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 text-center">
          <p className={`font-albert ${isMobile ? 'text-[24px]' : 'text-[28px]'} text-white leading-[1.2] tracking-[-1.3px]`}>
            {isEveningCheckInCompleted ? 'Day closed ✨' : 
             isMorningCheckInCompleted ? 'Day started ✓' : 
             'Ready to grow'}
          </p>
          {allFocusTasksCompleted && !isEveningCheckInCompleted && isMorningCheckInCompleted && (
            <p className="font-sans text-[14px] text-white/70 leading-[1.2] mt-2">
              All tasks done!
            </p>
          )}
        </div>
      </div>
    );
  };
  
  // Program check-in card (shown when user completes a program)
  const renderProgramCheckInCard = (isMobile: boolean) => {
    const baseClasses = isMobile
      ? "w-[calc(100vw-32px)] flex-shrink-0 snap-center h-[200px] rounded-[32px] overflow-hidden relative bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col justify-center items-center cursor-pointer"
      : "h-[200px] rounded-[32px] overflow-hidden relative bg-gradient-to-br from-amber-400 to-orange-500 p-6 flex flex-col justify-center items-center cursor-pointer hover:scale-[1.02] transition-transform";
    
    return (
      <button 
        key="program_checkin" 
        onClick={() => setShowProgramCheckInModal(true)}
        className={baseClasses}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 text-center px-6">
          <div className="w-14 h-14 mx-auto mb-3 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <p className={`font-albert ${isMobile ? 'text-[22px]' : 'text-[24px]'} text-white leading-[1.2] tracking-[-1.2px] font-semibold mb-2`}>
            Complete your program review
          </p>
          <p className={`font-sans ${isMobile ? 'text-[13px]' : 'text-[14px]'} text-white/80 leading-[1.4]`}>
            {programCheckInData?.programName || 'Program'} completed!
          </p>
        </div>
      </button>
    );
  };
  
  // Track-specific prompt card
  const renderTrackPromptCard = (isMobile: boolean) => {
    const baseClasses = isMobile
      ? "w-[calc(100vw-32px)] flex-shrink-0 snap-center h-[200px] rounded-[32px] overflow-hidden relative bg-gradient-to-br from-rose-500 to-pink-600 flex flex-col justify-center items-center"
      : "h-[200px] rounded-[32px] overflow-hidden relative bg-gradient-to-br from-rose-500 to-pink-600 p-6 flex flex-col justify-center items-center";
    
    // Don't render while loading or if no prompt available
    if (!programPrompt) {
      return null;
    }
    
    return (
      <div key="track" className={baseClasses}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 px-6 text-center">
          {/* Program badge */}
          <span className={`inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full font-sans ${isMobile ? 'text-[10px]' : 'text-[11px]'} text-white/90 font-medium mb-3 uppercase tracking-wide`}>
            {programName || 'Daily'} Tip
          </span>
          {/* Prompt title */}
          <p className={`font-albert ${isMobile ? 'text-[22px]' : 'text-[24px]'} text-white leading-[1.2] tracking-[-1.2px] font-semibold mb-2`}>
            {programPrompt.title}
          </p>
          {/* Prompt description */}
          <p className={`font-sans ${isMobile ? 'text-[13px]' : 'text-[14px]'} text-white/80 leading-[1.4] line-clamp-2`}>
            {programPrompt.description}
          </p>
        </div>
      </div>
    );
  };
  
  // Welcome card (for first day)
  const renderWelcomeCard = (isMobile: boolean, isMissedCheckin: boolean = false) => {
    const baseClasses = isMobile
      ? "w-[calc(100vw-32px)] flex-shrink-0 snap-center h-[200px] rounded-[32px] overflow-hidden relative bg-gradient-to-br from-rose-400 to-orange-400 flex flex-col justify-center items-center"
      : "h-[200px] rounded-[32px] overflow-hidden relative bg-gradient-to-br from-rose-400 to-orange-400 p-6 flex flex-col justify-center items-center";
    
    return (
      <div key="welcome" className={baseClasses}>
        <div className="absolute inset-0 bg-black/5" />
        <div className="relative z-10 text-center px-6">
          {isMissedCheckin ? (
            <>
              <p className={`font-albert ${isMobile ? 'text-[22px]' : 'text-[26px]'} text-white leading-[1.2] tracking-[-1.3px] font-medium mb-2`}>
                Welcome to GrowthAddicts! 🚀
              </p>
              <p className={`font-sans ${isMobile ? 'text-[13px]' : 'text-[14px]'} text-white/90 leading-[1.4]`}>
                Your morning check-in starts tomorrow.
              </p>
            </>
          ) : (
            <>
              <p className={`font-albert ${isMobile ? 'text-[24px]' : 'text-[28px]'} text-white leading-[1.2] tracking-[-1.3px] font-medium mb-2`}>
                Welcome to GrowthAddicts! 🚀
              </p>
              <p className={`font-sans ${isMobile ? 'text-[14px]' : 'text-[15px]'} text-white/90 leading-[1.3]`}>
                Let&apos;s crush your goals.
              </p>
            </>
          )}
        </div>
      </div>
    );
  };
  
  // Determine card order based on current state
  const getCardOrder = (): CardType[] => {
    // PROGRAM CHECK-IN TAKES PRIORITY
    // If user has pending program check-in, show it first
    if (showProgramCheckIn) {
      return ['program_checkin', 'goal', 'track'];
    }
    
    // FIRST DAY LOGIC
    if (isFirstDay) {
      // First day + Morning window still open (7am-12pm): Prompt - Goal - Track
      if (isMorningWindow() && !isMorningCheckInCompleted) {
        return ['prompt', 'goal', 'track'];
      }
      // First day + Morning check-in completed: Goal - Track - Welcome
      if (isMorningCheckInCompleted) {
        return ['goal', 'track', 'welcome'];
      }
      // First day + Morning window closed + NO check-in: Goal - Welcome - Track
      if (isMorningWindowClosed && !isMorningCheckInCompleted) {
        return ['goal', 'welcome', 'track'];
      }
    }
    
    // NORMAL DAYS LOGIC
    // Check-in active (morning/evening/weekly): Check-In - Goal - Track Prompt
    if (hasActivePrompt) {
      return ['prompt', 'goal', 'track'];
    }
    
    // No check-in active: Goal - Track Prompt - Discover
    return ['goal', 'track', 'discover'];
  };
  
  // Render a card by type
  const renderCard = (cardType: CardType, isMobile: boolean): React.ReactNode => {
    switch (cardType) {
      case 'prompt':
        return renderPromptCard(isMobile);
      case 'goal':
        return renderGoalCard(isMobile);
      case 'discover':
        return renderDiscoverCard(isMobile);
      case 'status':
        return renderStatusCard(isMobile);
      case 'welcome':
        return renderWelcomeCard(isMobile, showFirstDayMissedCheckin);
      case 'track':
        return renderTrackPromptCard(isMobile);
      case 'program_checkin':
        return renderProgramCheckInCard(isMobile);
      default:
        return null;
    }
  };
  
  // Get the current card order
  const cardOrder = getCardOrder();

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      
      {/* HEADER with Profile and Alignment Score */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          {/* User Profile - Avatar opens story, text links to profile */}
          <div data-tour="profile-header" className="bg-[#f3f1ef] dark:bg-[#181d28] rounded-[40px] p-1 flex items-center gap-3 pr-4">
            {/* Story Avatar - Opens story player when clicked */}
            <StoryAvatar
              user={{
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                imageUrl: user.imageUrl || '',
              }}
              userId={currentUserId}
              hasStory={storyAvailability.hasStory}
              showRing={storyAvailability.showRing}
              showCheck={storyAvailability.showCheck}
              userPostedStories={storyAvailability.data.userPostedStories}
              goal={storyAvailability.data.goal}
              tasks={storyAvailability.data.tasks}
              hasDayClosed={storyAvailability.data.hasDayClosed}
              completedTasks={storyAvailability.data.completedTasks}
              eveningCheckIn={storyAvailability.data.eveningCheckIn}
              hasWeekClosed={storyAvailability.data.hasWeekClosed}
              weeklyReflection={storyAvailability.data.weeklyReflection}
              hasViewed={hasViewedOwnStory}
              contentHash={storyAvailability.contentHash}
              onStoryViewed={handleOwnStoryViewed}
              size="md"
            />
            {/* Profile Link */}
            <Link href="/profile" className="text-left hover:opacity-80 transition-opacity">
              <p className="font-albert text-[18px] font-semibold text-text-primary leading-[1.3] tracking-[-1px]">
                Hi {user.firstName},
              </p>
              <p className="font-albert text-[18px] font-normal text-text-primary leading-[1.3] tracking-[-1px]">
                {greeting}!
              </p>
            </Link>
          </div>

          {/* Notification Bell + Alignment Score + Theme Toggle (desktop only) */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div data-tour="streak">
            <AlignmentGauge
              alignment={alignment}
              summary={summary}
              isLoading={alignmentLoading}
              size="sm"
            />
            </div>
            {/* Desktop: vertical theme toggle */}
            <ThemeToggle className="hidden lg:flex" />
          </div>
        </div>

        {/* Date + Theme Toggle (mobile only) */}
        <div className="flex items-center justify-between lg:justify-start">
          <p className="font-sans text-[12px] text-text-secondary leading-[1.2]">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          {/* Mobile: horizontal theme toggle */}
          <ThemeToggle horizontal className="lg:hidden" />
        </div>

        {/* Main Headline - Dynamic based on time + state */}
        <h1 className="font-albert text-[36px] text-text-primary leading-[1.2] tracking-[-2px]">
          {dynamicHeadline}
        </h1>

        {/* Weekly Focus - shown under headline if user has one */}
        {!weeklyFocusLoading && weeklyFocusSummary && (
          <p className="font-sans text-[14px] text-text-secondary leading-[1.4] mt-2">
            <span className="font-medium text-text-primary">This week&apos;s focus:</span>{' '}
            {weeklyFocusSummary}
          </p>
        )}
      </div>

      {/* DYNAMIC WIDGET CAROUSEL (Mobile) / GRID (Desktop) */}
      <div data-tour="dynamic-section" className="relative mb-6">
        {carouselDataLoading ? (
          <>
            {/* Mobile: Skeleton Carousel */}
            <div className="lg:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="flex gap-3" style={{ width: 'max-content' }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-[calc(100vw-32px)] flex-shrink-0 snap-center h-[200px] rounded-[32px] bg-surface animate-pulse">
                    <div className="h-full flex flex-col justify-center items-center px-6">
                      <div className="w-20 h-5 bg-text-primary/10 rounded-full mb-3" />
                      <div className="w-3/4 h-7 bg-text-primary/10 rounded-lg mb-2" />
                      <div className="w-full h-4 bg-text-primary/5 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Mobile: Skeleton Dots */}
            <div className="lg:hidden flex justify-center gap-2 mt-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`h-2 rounded-full bg-text-primary/20 ${i === 0 ? 'w-6' : 'w-2'}`} />
              ))}
            </div>
            {/* Desktop: Skeleton Grid */}
            <div className="hidden lg:grid lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[200px] rounded-[32px] bg-surface animate-pulse">
                  <div className="h-full flex flex-col justify-center items-center px-6">
                    <div className="w-20 h-5 bg-text-primary/10 rounded-full mb-3" />
                    <div className="w-3/4 h-7 bg-text-primary/10 rounded-lg mb-2" />
                    <div className="w-full h-4 bg-text-primary/5 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
        {/* Mobile: Horizontal Scroll-Snap Carousel */}
        <div 
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="lg:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-3" style={{ width: 'max-content' }}>
            {/* Dynamic cards based on state */}
            {cardOrder.map((cardType) => renderCard(cardType, true))}
          </div>
        </div>

        {/* Carousel Dots - Mobile only */}
        <div className="lg:hidden flex justify-center gap-2 mt-3">
          {[0, 1, 2].map((index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                carouselIndex === index 
                  ? 'bg-text-primary w-6' 
                  : 'bg-text-primary/30 hover:bg-text-primary/50'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Desktop: 3-Column Grid */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-4">
          {/* Dynamic cards based on state */}
          {cardOrder.map((cardType) => renderCard(cardType, false))}
        </div>
          </>
        )}
      </div>

      {/* DAILY FOCUS SECTION */}
      {checkInLoading && isMorningWindow() ? (
        <div data-tour="daily-focus" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
              Daily Focus
            </h2>
          </div>
          <div className="bg-white dark:bg-surface rounded-[20px] p-4 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-text-primary/10" />
                <div className="flex-1 h-5 bg-text-primary/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : shouldHideDailyFocus ? (
        <div data-tour="daily-focus" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
              Daily Focus
            </h2>
          </div>
          <div className="bg-white dark:bg-surface rounded-[20px] p-6 text-center">
            <div className="max-w-[320px] mx-auto">
              <div className="w-12 h-12 bg-[#f3f1ef] dark:bg-[#181d28] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[#a7a39e] dark:text-[#787470]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-sans text-[16px] text-[#5f5a55] dark:text-[#b5b0ab] leading-[1.4]">
                Your focus for today will appear here after the morning check-in.
              </p>
              <p className="font-sans text-[14px] text-[#a7a39e] dark:text-[#787470] mt-2">
                Please complete the morning check-in first.
              </p>
              <Link
                href="/checkin/morning/start"
                className="inline-block mt-4 px-6 py-3 bg-[#2c2520] dark:bg-[#b8896a] text-white rounded-full font-sans text-[14px] font-medium hover:bg-[#1a1a1a] dark:hover:bg-[#a07855] transition-colors"
              >
                Start Check-In
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div data-tour="daily-focus">
        <DailyFocusSection 
          isDayClosed={isEveningCheckInCompleted} 
          onTasksChange={storyAvailability.refetch}
          programPending={programPending}
          canLoadProgramTasks={canLoadProgramTasks}
          programName={program?.name}
          onLoadProgramTasks={async () => { await syncProgramTasks(); }}
        />
        </div>
      )}

      {/* HABITS SECTION */}
      <div data-tour="habits">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
            Habits
          </h2>
          <div className="flex items-center gap-3">
            <Link href="/habits" className="font-sans text-[12px] text-brand-accent hover:opacity-80 transition-opacity leading-[1.2]">
              All
            </Link>
            <Link href="/habits/new" className="font-sans text-[12px] text-brand-accent hover:opacity-80 transition-opacity leading-[1.2]">
              Add
            </Link>
          </div>
        </div>

        {habitsLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white dark:bg-surface rounded-[20px] p-4 flex gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 bg-text-primary/10 rounded" />
                  <div className="h-3 w-1/2 bg-text-primary/10 rounded" />
                </div>
                <div className="space-y-1 text-right">
                  <div className="h-3 w-12 bg-text-primary/10 rounded ml-auto" />
                  <div className="h-3 w-8 bg-text-primary/10 rounded ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : displayHabits.length === 0 ? (
          <div className="bg-white dark:bg-surface rounded-[20px] p-6 text-center">
            {showFirstDayMissedCheckin ? (
              /* First day + missed morning check-in: Special encouraging copy */
              <>
                <p className="font-sans text-[15px] text-text-primary font-medium mb-2">
                  You&apos;ve taken your first step. Great job!
                </p>
                <p className="font-sans text-[14px] text-text-secondary leading-[1.5] mb-2">
                  The day is almost over, so enjoy the rest of it and recharge.
                </p>
                <p className="font-sans text-[14px] text-text-secondary leading-[1.5] mb-3">
                  Tomorrow your journey begins with the morning check-in, and I&apos;ll remind you when it&apos;s time.
                </p>
                <p className="font-sans text-[13px] text-text-muted leading-[1.5] mb-4">
                  In the meantime, you can add your first habit to start building momentum today.
                </p>
                <Link 
                  href="/habits/new"
                  className="inline-block px-6 py-2 bg-earth-900 dark:bg-[#b8896a] text-white rounded-full font-sans text-[12px] font-medium hover:scale-105 transition-all"
                >
                  Add your first habit
                </Link>
              </>
            ) : (
              /* Normal empty state */
              <>
                <p className="font-sans text-[14px] text-text-secondary mb-3">
                  No habits yet. Start building consistency!
                </p>
                <Link 
                  href="/habits/new"
                  className="inline-block px-6 py-2 bg-earth-900 dark:bg-[#b8896a] text-white rounded-full font-sans text-[12px] font-medium hover:scale-105 transition-all"
                >
                  Create your first habit
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {displayHabits.map((habit) => {
              const completedToday = isCompletedToday(habit);
              const skippedToday = isSkippedToday(habit);
              const current = habit.progress.currentCount;
              const target = habit.targetRepetitions || null;
              const progressText = target ? `${current}/${target}` : `${current}`;

              return (
                <button
                  key={habit.id}
                  onClick={() => handleHabitClick(habit)}
                  className={`${
                    completedToday ? 'bg-[#f3f1ef] dark:bg-[#181d28] cursor-default opacity-60' : 
                    skippedToday ? 'bg-[#f3f1ef] dark:bg-[#181d28] opacity-70 hover:opacity-80 hover:scale-[1.01]' : 
                    'bg-white dark:bg-surface hover:scale-[1.01]'
                  } rounded-[20px] p-4 flex gap-3 w-full text-left transition-all`}
                >
                  <div className="flex-1">
                    <p className={`font-albert text-[18px] font-semibold tracking-[-1px] ${
                      completedToday || skippedToday ? 'line-through text-text-primary' : 'text-text-primary'
                    }`}>
                      {habit.text}
                    </p>
                    
                    {/* Status or linked routine */}
                    {completedToday ? (
                      <p className="font-sans text-[12px] text-[#4CAF50] leading-[1.2] mt-1">
                        Completed today
                      </p>
                    ) : skippedToday ? (
                      <p className="font-sans text-[12px] text-text-secondary leading-[1.2] mt-1">
                        Skipped for today
                      </p>
                    ) : habit.linkedRoutine ? (
                      <p className="font-sans text-[12px] text-text-secondary leading-[1.2] mt-1">
                        {habit.linkedRoutine}
                      </p>
                    ) : null}
                  </div>
                  
                  {/* Right side: Schedule, reminder, progress */}
                  <div className="flex flex-col items-end justify-center gap-1 text-right">
                    {/* Schedule */}
                    <p className="font-sans text-[12px] text-text-muted leading-[1.2]">
                      {formatFrequency(habit.frequencyType, habit.frequencyValue)}
                    </p>
                    
                    {/* Reminder */}
                    {habit.reminder && (
                      <p className="font-sans text-[12px] text-text-muted leading-[1.2]">
                        {formatTime(habit.reminder.time)}
                      </p>
                    )}
                    
                    {/* Progress */}
                    <p className="font-sans text-[12px] text-text-muted leading-[1.2]">
                      {progressText}
                    </p>
                  </div>
                </button>
              );
            })}
            
            {todaysHabits.length > 2 && (
              <button
                onClick={() => setShowAllHabits(!showAllHabits)}
                className="w-full flex items-center justify-center gap-1 py-2 hover:opacity-70 transition-opacity"
              >
                <span className="font-sans text-[12px] text-text-secondary">
                  {showAllHabits ? 'Show less' : 'Show more'}
                </span>
                <div className={`transition-transform duration-300 ${showAllHabits ? 'rotate-180' : 'rotate-0'}`}>
                  <ChevronDown className="w-4 h-4 text-text-secondary" strokeWidth={2} />
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      {/* My Program Section - Horizontal Carousel */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
            My Program
          </h2>
          {hasAvailablePrograms && (
            <Link href="/discover" className="font-sans text-[12px] text-brand-accent leading-[1.2]">
              Discover more
            </Link>
          )}
        </div>
        <ProgramCarousel 
          enrollments={[...programEnrollments.active, ...programEnrollments.upcoming]}
          isLoading={enrollmentsLoading}
          hasAvailablePrograms={hasAvailablePrograms}
        />
      </div>

      {/* My Cohort Section - Horizontal Carousel */}
      <div data-tour="my-squad" className="mt-8">
        <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px] mb-3">
          {mySquadTitle}
        </h2>
        <SquadCarousel 
          premiumSquad={dashboardSquads?.premium || { squad: null, members: [] }}
          standardSquad={dashboardSquads?.standard || { squad: null, members: [] }}
          isLoading={squadLoading}
          squadTitle={mySquadTitle}
          squadTerm={squadTerm}
        />
      </div>

      {/* Habit Check-In Modal */}
      {selectedHabit && (
        <HabitCheckInModal
          habit={selectedHabit}
          isOpen={showCheckInModal}
          onClose={() => {
            setShowCheckInModal(false);
            setSelectedHabit(null);
          }}
          onComplete={handleCompleteHabit}
          onSkip={handleSkipHabit}
        />
      )}

      {/* Program Check-In Modal (new comprehensive flow) */}
      <ProgramCheckInModal
        isOpen={showProgramCheckInModal}
        onClose={async () => {
          setShowProgramCheckInModal(false);
          // Dismiss check-in (will show card for 24 hours)
          try {
            await fetch('/api/programs/checkin', { method: 'DELETE' });
          } catch (error) {
            console.error('Error dismissing program check-in:', error);
          }
        }}
        onComplete={async (data: ProgramCheckInData) => {
          try {
            const response = await fetch('/api/programs/checkin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...data,
                programId: programCheckInData?.programId,
              }),
            });
            
            if (response.ok) {
              setShowProgramCheckInModal(false);
              setShowProgramCheckIn(false);
              setProgramCheckInData(null);
              
              // If user chose to continue, refresh program state
              if (data.continueChoice === 'continue') {
                await refreshProgram();
              }
            }
          } catch (error) {
            console.error('Error saving program check-in:', error);
          }
        }}
        programName={programCheckInData?.programName || 'Program'}
        programDays={30}
      />

      {/* Program Completion Modal (legacy) */}
      {showProgramCompletionModal && program && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowProgramCompletionModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white dark:bg-[#171b22] rounded-3xl max-w-md w-full p-8 shadow-2xl animate-in zoom-in-95 fade-in duration-300">
            {/* Celebration emoji */}
            <div className="text-center mb-6">
              <span className="text-6xl">🎉</span>
            </div>
            
            {/* Title */}
            <h2 className="font-albert text-[28px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] text-center mb-3">
              You&apos;ve completed the {trackDisplayName} Starter Program!
            </h2>
            
            {/* Subtitle */}
            <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] text-center mb-8 leading-relaxed">
              Amazing work! You&apos;ve built solid habits over the past {program.lengthDays} days. What would you like to do next?
            </p>
            
            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={async () => {
                  // Restart program (re-enroll in same program track)
                  try {
                    await fetch('/api/programs/enrollment', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ track: program?.track || 'general' }),
                    });
                    await refreshProgram();
                    setShowProgramCompletionModal(false);
                  } catch (error) {
                    console.error('Error restarting program:', error);
                  }
                }}
                className="w-full py-4 px-6 bg-[#2c2520] dark:bg-[#b8896a] text-white rounded-2xl font-sans font-semibold text-[15px] hover:bg-[#1a1a1a] dark:hover:bg-[#a07855] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Restart Program
              </button>
              
              <button
                onClick={() => setShowProgramCompletionModal(false)}
                className="w-full py-4 px-6 bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] rounded-2xl font-sans font-semibold text-[15px] hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Keep going on my own
              </button>
              
              <button
                onClick={() => {
                  setShowProgramCompletionModal(false);
                  router.push('/discover');
                }}
                className="w-full py-4 px-6 text-[#a07855] dark:text-[#b8896a] font-sans font-semibold text-[15px] hover:text-[#8c6245] dark:hover:text-[#a07855] dark:text-[#b8896a] transition-colors"
              >
                Explore new programs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Program Completion Banner (shows on Home when program completed) */}
      {programIsCompleted && program && !showProgramCompletionModal && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 shadow-lg animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div className="flex-1">
                <p className="font-albert text-[16px] font-semibold text-white tracking-[-0.5px]">
                  You&apos;ve completed the {trackDisplayName} Starter Program!
                </p>
              </div>
              <button
                onClick={() => setShowProgramCompletionModal(true)}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-full font-sans text-[12px] text-white font-medium transition-colors"
              >
                Options
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Home Tutorial Overlay */}
      <HomeTutorialOverlay
        isActive={homeTutorial.isActive}
        currentStep={homeTutorial.currentStep}
        currentStepIndex={homeTutorial.currentStepIndex}
        totalSteps={homeTutorial.totalSteps}
        onNext={homeTutorial.nextStep}
        onPrev={homeTutorial.prevStep}
        onComplete={homeTutorial.completeTutorial}
        onExit={homeTutorial.exitTutorial}
      />
    </div>
  );
}
