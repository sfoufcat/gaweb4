'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import type { Program, ProgramDay, ProgramCohort, ProgramTaskTemplate, ProgramHabitTemplate, ProgramWithStats, ProgramEnrollment, ProgramFeature, ProgramTestimonial, ProgramFAQ, ReferralConfig, CoachTier, ProgramCompletionConfig, ProgramModule, ProgramWeek, TaskDistribution, DayCourseAssignment, CallSummary, UnifiedEvent, ClientViewContext, CohortViewContext, CohortWeekContent, ClientProgramWeek, ClientProgramDay } from '@/types';
import { ProgramLandingPageEditor } from './ProgramLandingPageEditor';
import { ModuleWeeksSidebar, type SidebarSelection } from './ModuleWeeksSidebar';
import { ModuleEditor } from './ModuleEditor';
import { WeekEditor } from './WeekEditor';
import { WeekFillModal } from './WeekFillModal';
import { ProgramSettingsModal, ProgramSettingsButton } from './ProgramSettingsModal';
import { DayCourseSelector } from './DayCourseSelector';
import { ProgramScheduleEditor } from './ProgramScheduleEditor';
import type { DiscoverCourse } from '@/types/discover';
import { Button } from '@/components/ui/button';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Plus, Users, User, Calendar, DollarSign, Clock, Eye, EyeOff, Trash2, Settings, Settings2, ChevronRight, UserMinus, FileText, LayoutTemplate, Globe, ExternalLink, Copy, Target, X, ListTodo, Repeat, ChevronDown, ChevronUp, Gift, Sparkles, AlertTriangle, Edit2, Trophy, Phone, ArrowLeft, List, CalendarDays, Check, PenLine } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScheduleCallModal } from '@/components/scheduling';
import { ClientDetailSlideOver } from '@/components/coach';
import { AIHelperModal } from '@/components/ai';
import type { ProgramContentDraft, LandingPageDraft, AIGenerationContext } from '@/lib/ai/types';
import { ReferralConfigForm } from '@/components/coach/referrals';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { NewProgramModal } from './NewProgramModal';
import { EnrollmentSettingsModal } from './EnrollmentSettingsModal';
import type { OrgEnrollmentRules } from '@/types';
import { DEFAULT_ENROLLMENT_RULES } from '@/types';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { StatusBadge, TypeBadge, VisibilityBadge } from '@/components/ui/program-badges';
import { CoachSelector } from '@/components/coach/CoachSelector';
import { ClientSelector } from './ClientSelector';
import { CohortSelector } from './CohortSelector';
import { LimitReachedModal, useLimitCheck } from '@/components/coach';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useDemoSession } from '@/contexts/DemoSessionContext';

import { generateDemoProgramsWithStats, generateDemoProgramDays, generateDemoProgramCohorts } from '@/lib/demo-data';
import { calculateProgramDayIndex, getActiveCycleNumber } from '@/lib/program-client-utils';

// Animation variants for subtle fade transitions (calendar/row switching)
const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Next call info structure
interface NextCallInfo {
  datetime: string;
  title: string;
  isRecurring: boolean;
  location?: string;
}

// Credits info structure
interface CreditsInfo {
  creditsRemaining: number;
  monthlyAllowance: number;
  creditsUsedThisMonth: number;
}

// Enrollment with user info
interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    imageUrl: string;
  };
  callCredits?: CreditsInfo | null;
  nextCall?: NextCallInfo | null;
}

// Coach type for multi-select
interface OrgCoach {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
}

interface CoachProgramsTabProps {
  apiBasePath?: string;
}

type ProgramType = 'group' | 'individual';

export function CoachProgramsTab({ apiBasePath = '/api/coach/org-programs' }: CoachProgramsTabProps) {
  const { isDemoMode, openSignupModal } = useDemoMode();
  const demoSession = useDemoSession();
  
  const [programs, setPrograms] = useState<ProgramWithStats[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithStats | null>(null);
  const [programDays, setProgramDays] = useState<ProgramDay[]>([]);
  const [programCohorts, setProgramCohorts] = useState<ProgramCohort[]>([]);
  const [programModules, setProgramModules] = useState<ProgramModule[]>([]);
  const [programWeeks, setProgramWeeks] = useState<ProgramWeek[]>([]);
  const [availableCallSummaries, setAvailableCallSummaries] = useState<CallSummary[]>([]);
  const [availableEvents, setAvailableEvents] = useState<UnifiedEvent[]>([]);
  const [organizationCourses, setOrganizationCourses] = useState<DiscoverCourse[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1);
  const [sidebarSelection, setSidebarSelection] = useState<SidebarSelection | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1])); // Week 1 expanded by default
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Demo data (memoized)
  const demoPrograms = useMemo(() => generateDemoProgramsWithStats(), []);
  
  // Tenant required state - shown when accessing from platform domain
  const [tenantRequired, setTenantRequired] = useState<{
    tenantUrl: string | null;
    subdomain: string | null;
  } | null>(null);
  
  // View mode: 'list' | 'days' | 'cohorts' | 'enrollments' | 'landing' | 'referrals'
  const [viewMode, setViewMode] = useState<'list' | 'days' | 'cohorts' | 'enrollments' | 'landing' | 'referrals'>('list');
  const [viewModeDirection, setViewModeDirection] = useState<1 | -1>(1); // Animation direction for program tabs
  const prevViewModeRef = useRef(viewMode);
  
  // Content display mode: 'row' (sidebar + editor) | 'calendar' (full-width calendar)
  const [contentDisplayMode, setContentDisplayMode] = useState<'row' | 'calendar'>('row');
  const [contentDirection, setContentDirection] = useState<1 | -1>(1); // Animation direction for Row/Calendar
  // Derived values to avoid TypeScript narrowing issues in ternaries
  const isRowMode = contentDisplayMode === 'row';
  const isCalendarMode = contentDisplayMode === 'calendar';

  // Program type filter: 'all' | 'individual' | 'group'
  const [programTypeFilter, setProgramTypeFilter] = useState<'all' | 'individual' | 'group'>('all');

  // Enrollments state
  const [programEnrollments, setProgramEnrollments] = useState<EnrollmentWithUser[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [removeConfirmEnrollment, setRemoveConfirmEnrollment] = useState<EnrollmentWithUser | null>(null);
  const [removingEnrollment, setRemovingEnrollment] = useState(false);
  const [togglingCommunity, setTogglingCommunity] = useState<string | null>(null); // enrollment ID being toggled
  
  // Schedule call modal state (for enrollments)
  const [scheduleCallEnrollment, setScheduleCallEnrollment] = useState<EnrollmentWithUser | null>(null);

  // Client detail slide-over state
  const [selectedClient, setSelectedClient] = useState<EnrollmentWithUser | null>(null);

  // Client view context state (for 1:1/individual programs)
  const [clientViewContext, setClientViewContext] = useState<ClientViewContext>({ mode: 'template' });
  const [clientWeeks, setClientWeeks] = useState<ClientProgramWeek[]>([]);
  const [clientDays, setClientDays] = useState<ClientProgramDay[]>([]);
  const [loadingClientWeeks, setLoadingClientWeeks] = useState(false);
  const [loadingClientDays, setLoadingClientDays] = useState(false);
  const [loadedEnrollmentId, setLoadedEnrollmentId] = useState<string | null>(null);

  // Computed days array - use clientDays for 1:1 programs in client mode, otherwise programDays
  const daysToUse = useMemo(() => {
    const isClientMode = selectedProgram?.type === 'individual' && clientViewContext.mode === 'client';
    const dataMatchesContext = clientViewContext.mode === 'client' && loadedEnrollmentId === clientViewContext.enrollmentId;
    return (isClientMode && dataMatchesContext) ? clientDays : programDays;
  }, [selectedProgram?.type, clientViewContext, loadedEnrollmentId, clientDays, programDays]);

  // Cohort view context state (for group programs)
  const [cohortViewContext, setCohortViewContext] = useState<CohortViewContext>({ mode: 'template' });
  const [cohortWeekContent, setCohortWeekContent] = useState<CohortWeekContent | null>(null);
  const [loadingCohortContent, setLoadingCohortContent] = useState(false);

  // Modal states
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isNewProgramModalOpen, setIsNewProgramModalOpen] = useState(false);
  const pendingNumModulesRef = useRef<number>(1); // For new program creation
  const [isCohortModalOpen, setIsCohortModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editingCohort, setEditingCohort] = useState<ProgramCohort | null>(null);
  
  // AI Helper modals
  const [isAIProgramContentModalOpen, setIsAIProgramContentModalOpen] = useState(false);
  const [isAILandingPageModalOpen, setIsAILandingPageModalOpen] = useState(false);
  const [isWeekFillModalOpen, setIsWeekFillModalOpen] = useState(false);
  const [weekToFill, setWeekToFill] = useState<ProgramWeek | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPageDropdownOpen, setIsPageDropdownOpen] = useState(false);
  
  // Enrollment settings modal state
  const [isEnrollmentSettingsOpen, setIsEnrollmentSettingsOpen] = useState(false);
  const [enrollmentRules, setEnrollmentRules] = useState<OrgEnrollmentRules>(DEFAULT_ENROLLMENT_RULES);

  // Plan tier for limit checking
  const [currentTier, setCurrentTier] = useState<CoachTier>('starter');
  const { checkLimit, showLimitModal, modalProps } = useLimitCheck(currentTier);
  
  
  // Collapsible section state
  const [isCoverImageExpanded, setIsCoverImageExpanded] = useState(false);
  
  // Program form
  const [programFormData, setProgramFormData] = useState<{
    name: string;
    type: ProgramType;
    description: string;
    coverImageUrl: string;
    lengthDays: number;
    priceInCents: number;
    currency: string;
    subscriptionEnabled: boolean;
    billingInterval: 'monthly' | 'quarterly' | 'yearly';
    squadCapacity: number;
    coachInSquads: boolean;
    assignedCoachIds: string[];
    isActive: boolean;
    isPublished: boolean;
    defaultHabits: ProgramHabitTemplate[];
    applyCoachesToExistingSquads: boolean;
    clientCommunityEnabled: boolean;
    dailyFocusSlots: number;
    includeWeekends: boolean;
    defaultStartDate: string;
    allowCustomStartDate: boolean;
    completionConfig: ProgramCompletionConfig;
    callCreditsPerMonth: number;
    taskDistribution: TaskDistribution;
  }>({
    name: '',
    type: 'group',
    description: '',
    coverImageUrl: '',
    lengthDays: 30,
    priceInCents: 0,
    currency: 'usd',
    subscriptionEnabled: false,
    billingInterval: 'monthly',
    squadCapacity: 10,
    coachInSquads: true,
    assignedCoachIds: [],
    isActive: true,
    isPublished: false,
    defaultHabits: [],
    applyCoachesToExistingSquads: false,
    clientCommunityEnabled: false,
    dailyFocusSlots: 2,
    includeWeekends: true,
    defaultStartDate: '',
    allowCustomStartDate: true,
    completionConfig: {
      showConfetti: true,
      upsellProgramId: undefined,
      upsellHeadline: '',
      upsellDescription: '',
    },
    callCreditsPerMonth: 0,
    taskDistribution: 'spread',
  });
  
  // Available coaches for selection
  const [availableCoaches, setAvailableCoaches] = useState<OrgCoach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  
  // Cohort form
  const [cohortFormData, setCohortFormData] = useState<{
    name: string;
    startDate: string;
    endDate: string;
    enrollmentOpen: boolean;
    maxEnrollment: number | null;
    convertSquadsToCommunity: boolean;
  }>({
    name: '',
    startDate: '',
    endDate: '',
    enrollmentOpen: true,
    maxEnrollment: null,
    convertSquadsToCommunity: false,
  });
  
  // Day editor state
  const [dayFormData, setDayFormData] = useState<{
    title: string;
    summary: string;
    dailyPrompt: string;
    tasks: ProgramTaskTemplate[];
    habits: ProgramHabitTemplate[];
    courseAssignments: DayCourseAssignment[];
  }>({
    title: '',
    summary: '',
    dailyPrompt: '',
    tasks: [],
    habits: [],
    courseAssignments: [],
  });
  
  // Landing page form
  const [landingPageFormData, setLandingPageFormData] = useState<{
    heroHeadline?: string;
    heroSubheadline?: string;
    heroCtaText?: string;
    coachBio: string;
    coachHeadline?: string;
    coachBullets: string[];
    keyOutcomes: string[];
    features: ProgramFeature[];
    testimonials: ProgramTestimonial[];
    faqs: ProgramFAQ[];
    showEnrollmentCount: boolean;
    showCurriculum: boolean;
    orderBumps?: import('@/types').OrderBumpConfig;
  }>({
    heroHeadline: '',
    heroSubheadline: '',
    heroCtaText: '',
    coachBio: '',
    coachHeadline: '',
    coachBullets: [],
    keyOutcomes: [],
    features: [],
    testimonials: [],
    faqs: [],
    showEnrollmentCount: false,
    showCurriculum: false,
    orderBumps: undefined,
  });
  
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [landingPageSaved, setLandingPageSaved] = useState(true);
  const [deleteConfirmProgram, setDeleteConfirmProgram] = useState<Program | null>(null);
  
  // Habit sync state
  const [syncingHabits, setSyncingHabits] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Track previous program ID to detect actual selection changes vs updates
  const prevProgramId = useRef<string | null>(null);
  const [deleteConfirmCohort, setDeleteConfirmCohort] = useState<ProgramCohort | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View mode order for directional animations
  const VIEW_MODE_ORDER: Record<string, number> = {
    'list': 0, 'days': 1, 'cohorts': 2, 'enrollments': 3, 'landing': 4, 'referrals': 5,
  };

  // Handler for view mode changes with direction tracking
  const handleViewModeChange = useCallback((newMode: typeof viewMode) => {
    const prevOrder = VIEW_MODE_ORDER[prevViewModeRef.current] ?? 0;
    const newOrder = VIEW_MODE_ORDER[newMode] ?? 0;
    setViewModeDirection(newOrder > prevOrder ? 1 : -1);
    prevViewModeRef.current = newMode;
    setViewMode(newMode);
  }, []);

  // Get current enrollment's day index for "Jump to Today" feature
  const currentEnrollment = useMemo(() => {
    if (clientViewContext.mode !== 'client') return null;
    const enrollment = programEnrollments.find(e => e.id === clientViewContext.enrollmentId);

    // Debug logging for day calculation issues
    if (clientViewContext.mode === 'client') {
      console.log('[currentEnrollment] Debug:', {
        enrollmentId: clientViewContext.enrollmentId,
        enrollmentsCount: programEnrollments.length,
        foundEnrollment: !!enrollment,
        enrollmentStatus: enrollment?.status,
        enrollmentStartedAt: enrollment?.startedAt,
        selectedProgramId: selectedProgram?.id,
      });
    }

    if (!enrollment || !selectedProgram) return null;

    // Calculate the current day index using proper weekday-aware calculation
    // Calculate for active, completed, and stopped enrollments (not upcoming)
    let currentDayIndex = 0;
    const shouldCalculateDay = enrollment.startedAt &&
      (enrollment.status === 'active' || enrollment.status === 'completed' || enrollment.status === 'stopped');

    if (shouldCalculateDay) {
      const cycleNumber = getActiveCycleNumber(enrollment);
      const result = calculateProgramDayIndex(
        enrollment.startedAt,
        selectedProgram.lengthDays,
        selectedProgram.includeWeekends !== false, // defaults to true
        cycleNumber,
        enrollment.cycleStartedAt
      );
      currentDayIndex = result.dayIndex;

      console.log('[currentEnrollment] Day calculation:', {
        startedAt: enrollment.startedAt,
        programLengthDays: selectedProgram.lengthDays,
        includeWeekends: selectedProgram.includeWeekends !== false,
        cycleNumber,
        calculatedDayIndex: currentDayIndex,
      });

      // For completed enrollments, show the last day
      if (enrollment.status === 'completed') {
        currentDayIndex = selectedProgram.lengthDays;
      }
    } else {
      console.log('[currentEnrollment] Skipping day calculation:', {
        hasStartedAt: !!enrollment.startedAt,
        status: enrollment.status,
        shouldCalculateDay,
      });
    }

    return { ...enrollment, currentDayIndex };
  }, [clientViewContext, programEnrollments, selectedProgram]);

  const handleJumpToToday = useCallback(() => {
    const currentDayIndex = currentEnrollment?.currentDayIndex;
    if (!currentDayIndex || !selectedProgram) return;

    // Set sidebar selection and selected day
    setSidebarSelection({ type: 'day', dayIndex: currentDayIndex });
    setSelectedDayIndex(currentDayIndex);

    // Load day data into form - use daysToUse to respect client mode
    const day = daysToUse.find(d => d.dayIndex === currentDayIndex);
    if (day) {
      setDayFormData({
        title: day.title || '',
        summary: day.summary || '',
        dailyPrompt: day.dailyPrompt || '',
        tasks: day.tasks || [],
        habits: day.habits || [],
        courseAssignments: day.courseAssignments || [],
      });
    } else {
      setDayFormData({ title: '', summary: '', dailyPrompt: '', tasks: [], habits: [], courseAssignments: [] });
    }
  }, [currentEnrollment, selectedProgram, daysToUse]);

  const fetchPrograms = useCallback(async () => {
    // Skip API call in demo mode
    if (isDemoMode) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setTenantRequired(null);

      const response = await fetch(apiBasePath);
      
      // Check for tenant_required error
      if (response.status === 403) {
        const data = await response.json();
        if (data.error === 'tenant_required') {
          setTenantRequired({
            tenantUrl: data.tenantUrl,
            subdomain: data.subdomain,
          });
          setLoading(false);
          return;
        }
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch programs');
      }

      const data = await response.json();
      setPrograms(data.programs || []);
    } catch (err) {
      console.error('Error fetching programs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch programs');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, isDemoMode]);
  
  // Use demo data when in demo mode (from session context for interactivity)
  const allPrograms: ProgramWithStats[] = useMemo(() => {
    if (isDemoMode) {
      return demoSession.programs.map(dp => ({
        id: dp.id,
        name: dp.name,
        slug: dp.slug,
        description: dp.description,
        coverImageUrl: dp.coverImageUrl,
        type: dp.type,
        lengthDays: dp.durationDays,
        priceInCents: dp.priceInCents,
        currency: 'USD',
        isPublished: dp.isPublished,
        isActive: true,
        organizationId: 'demo-org',
        createdAt: dp.createdAt,
        updatedAt: dp.updatedAt,
        totalEnrollments: dp.enrolledCount,
        activeEnrollments: dp.activeEnrollments,
      }));
    }
    return programs;
  }, [isDemoMode, demoSession.programs, programs]);

  // Filter programs by type
  const displayPrograms = useMemo(() => {
    if (programTypeFilter === 'all') return allPrograms;
    return allPrograms.filter(p => p.type === programTypeFilter);
  }, [allPrograms, programTypeFilter]);

  // Count programs by type for filter badges
  const individualCount = useMemo(() => allPrograms.filter(p => p.type === 'individual').length, [allPrograms]);
  const groupCount = useMemo(() => allPrograms.filter(p => p.type === 'group').length, [allPrograms]);

  // Fetch available coaches for assignment
  const fetchCoaches = useCallback(async () => {
    try {
      setLoadingCoaches(true);
      const response = await fetch('/api/coach/org-coaches');
      if (response.ok) {
        const data = await response.json();
        setAvailableCoaches(data.coaches || []);
      }
    } catch (err) {
      console.error('Error fetching coaches:', err);
    } finally {
      setLoadingCoaches(false);
    }
  }, []);

  const fetchProgramDetails = useCallback(async (programId: string, options?: { numModulesToCreate?: number }) => {
    // Use demo data in demo mode (from session context for interactivity)
    if (isDemoMode) {
      const sessionDays = demoSession.getProgramDays(programId);
      const sessionCohorts = demoSession.getProgramCohorts(programId);
      
      const now = new Date().toISOString();
      const days: ProgramDay[] = sessionDays.map(dd => ({
        id: dd.id,
        programId: dd.programId,
        dayIndex: dd.dayIndex,
        title: dd.title,
        summary: dd.summary,
        dailyPrompt: dd.dailyPrompt,
        tasks: dd.tasks.map(t => ({ label: t.label, type: t.type, isPrimary: t.isPrimary, estimatedMinutes: t.estimatedMinutes, notes: t.notes })),
        habits: dd.habits.map(h => ({ 
          title: h.title, 
          description: h.description, 
          frequency: (h.frequency === 'weekly' ? 'weekday' : h.frequency) as 'daily' | 'weekday' | 'custom',
        })),
        createdAt: now,
        updatedAt: now,
      }));
      
      const cohorts: ProgramCohort[] = sessionCohorts.map(dc => ({
        id: dc.id,
        programId: dc.programId,
        organizationId: 'demo-org',
        name: dc.name,
        startDate: dc.startDate,
        endDate: dc.endDate,
        enrollmentOpen: dc.isActive ?? true,
        maxEnrollment: dc.maxParticipants ?? undefined,
        currentEnrollment: dc.enrolledCount ?? 0,
        status: dc.isActive ? 'active' as const : 'upcoming' as const,
        createdAt: now,
        updatedAt: now,
      }));
      
      setProgramDays(days);
      setProgramCohorts(cohorts);
      
      // Load first day data
      const day1 = days.find(d => d.dayIndex === 1);
      if (day1) {
        setDayFormData({
          title: day1.title || '',
          summary: day1.summary || '',
          dailyPrompt: day1.dailyPrompt || '',
          tasks: day1.tasks || [],
          habits: day1.habits || [],
          courseAssignments: day1.courseAssignments || [],
        });
      } else {
        setDayFormData({ title: '', summary: '', dailyPrompt: '', tasks: [], habits: [], courseAssignments: [] });
      }
      
      setLoadingDetails(false);
      return;
    }
    
    try {
      setLoadingDetails(true);

      const response = await fetch(`${apiBasePath}/${programId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch program details');
      }

      const data = await response.json();
      setProgramDays(data.days || []);
      setProgramCohorts(data.cohorts || []);

      // Always fetch modules and weeks
      const program = data.program as Program;
      try {
        const [modulesRes, weeksRes] = await Promise.all([
          fetch(`${apiBasePath}/${programId}/modules`),
          fetch(`${apiBasePath}/${programId}/weeks`),
        ]);

        let modules: ProgramModule[] = [];
        let weeks: ProgramWeek[] = [];

        if (modulesRes.ok) {
          const modulesData = await modulesRes.json();
          modules = modulesData.modules || [];
        }
        if (weeksRes.ok) {
          const weeksData = await weeksRes.json();
          weeks = weeksData.weeks || [];
        }

        // Auto-initialize modules if no modules exist
        if (modules.length === 0 && program) {
          try {
            const numModulesToCreate = options?.numModulesToCreate || 1;
            const includeWeekends = program.includeWeekends !== false;
            const daysPerWeek = includeWeekends ? 7 : 5;
            const totalDays = program.lengthDays || 30;
            const numWeeks = Math.ceil(totalDays / daysPerWeek);
            const weeksPerModule = Math.ceil(numWeeks / numModulesToCreate);

            // Create all modules
            const modulePromises = [];
            for (let m = 0; m < numModulesToCreate; m++) {
              modulePromises.push(
                fetch(`${apiBasePath}/${programId}/modules`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: `Module ${m + 1}`,
                    order: m + 1,
                    startDayIndex: 1, // Will be recalculated by week assignment
                    endDayIndex: totalDays,
                  }),
                }).then(res => res.ok ? res.json() : null)
              );
            }

            const moduleResults = await Promise.all(modulePromises);
            modules = moduleResults.filter(r => r?.module).map(r => r.module);

            if (modules.length > 0) {
              // Create weeks and distribute across modules
              const weekPromises = [];
              for (let weekIdx = 0; weekIdx < numWeeks; weekIdx++) {
                const weekNum = weekIdx + 1;
                const startDay = weekIdx * daysPerWeek + 1;
                const endDay = Math.min(startDay + daysPerWeek - 1, totalDays);
                
                // Determine which module this week belongs to
                const moduleIndex = Math.min(Math.floor(weekIdx / weeksPerModule), modules.length - 1);
                const targetModule = modules[moduleIndex];
                const orderInModule = (weekIdx % weeksPerModule) + 1;

                weekPromises.push(
                  fetch(`${apiBasePath}/${programId}/weeks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      moduleId: targetModule.id,
                      weekNumber: weekNum,
                      order: orderInModule,
                      startDayIndex: startDay,
                      endDayIndex: endDay,
                      distribution: 'repeat-daily',
                    }),
                  }).then(res => res.ok ? res.json() : null)
                );
              }

              const weekResults = await Promise.all(weekPromises);
              weeks = weekResults.filter(r => r?.week).map(r => r.week);

              console.log(`[fetchProgramDetails] Auto-initialized ${modules.length} module(s) with ${weeks.length} weeks for program ${programId}`);
            }
          } catch (initErr) {
            console.error('Error auto-initializing modules:', initErr);
          }
        }

        setProgramModules(modules);
        setProgramWeeks(weeks);

        // Fetch available call summaries and events for manual linking
        try {
          const [summariesRes, eventsRes] = await Promise.all([
            fetch(`/api/coach/call-summaries?programId=${programId}`),
            fetch(`/api/programs/${programId}/events`),
          ]);

          if (summariesRes.ok) {
            const summariesData = await summariesRes.json();
            setAvailableCallSummaries(summariesData.summaries || []);
          } else {
            setAvailableCallSummaries([]);
          }

          if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            // Filter to only include call events (coaching_1on1, squad_call, etc.)
            const callEvents = (eventsData.events || []).filter((e: UnifiedEvent) =>
              e.eventType === 'coaching_1on1' || e.eventType === 'squad_call'
            );
            setAvailableEvents(callEvents);
          } else {
            setAvailableEvents([]);
          }
        } catch (linkDataErr) {
          console.error('Error fetching call summaries/events:', linkDataErr);
          setAvailableCallSummaries([]);
          setAvailableEvents([]);
        }
      } catch (err) {
        console.error('Error fetching modules/weeks:', err);
        setProgramModules([]);
        setProgramWeeks([]);
      }

      // Load first day data
      const day1 = data.days?.find((d: ProgramDay) => d.dayIndex === 1);
      if (day1) {
        setDayFormData({
          title: day1.title || '',
          summary: day1.summary || '',
          dailyPrompt: day1.dailyPrompt || '',
          tasks: day1.tasks || [],
          habits: day1.habits || [],
          courseAssignments: day1.courseAssignments || [],
        });
      } else {
        setDayFormData({ title: '', summary: '', dailyPrompt: '', tasks: [], habits: [], courseAssignments: [] });
      }
      
      // Load landing page data from program (program already declared above)
      if (program) {
        setLandingPageFormData({
          // Hero section
          heroHeadline: program.heroHeadline || '',
          heroSubheadline: program.heroSubheadline || '',
          heroCtaText: program.heroCtaText || '',
          // Coach section
          coachBio: program.coachBio || '',
          coachHeadline: program.coachHeadline || '',
          coachBullets: program.coachBullets || [],
          // Other content
          keyOutcomes: program.keyOutcomes || [],
          features: program.features || [],
          testimonials: program.testimonials || [],
          faqs: program.faqs || [],
          showEnrollmentCount: program.showEnrollmentCount || false,
          showCurriculum: program.showCurriculum || false,
          // Order bumps
          orderBumps: program.orderBumps,
        });
        setLandingPageSaved(true);
      }
    } catch (err) {
      console.error('Error fetching program details:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [apiBasePath]);

  const fetchProgramEnrollments = useCallback(async (programId: string) => {
    try {
      setLoadingEnrollments(true);

      const response = await fetch(`${apiBasePath}/${programId}/enrollments`);
      if (!response.ok) {
        throw new Error('Failed to fetch enrollments');
      }

      const data = await response.json();
      setProgramEnrollments(data.enrollments || []);
    } catch (err) {
      console.error('Error fetching enrollments:', err);
      setProgramEnrollments([]);
    } finally {
      setLoadingEnrollments(false);
    }
  }, [apiBasePath]);

  const fetchOrganizationCourses = useCallback(async () => {
    try {
      const response = await fetch('/api/coach/org-discover/courses');
      if (response.ok) {
        const data = await response.json();
        setOrganizationCourses(data.courses || []);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  }, []);

  // Fetch client-specific weeks for 1:1 programs
  const fetchClientWeeks = useCallback(async (programId: string, enrollmentId: string) => {
    try {
      setLoadingClientWeeks(true);
      const response = await fetch(`${apiBasePath}/${programId}/client-weeks?enrollmentId=${enrollmentId}`);
      if (response.ok) {
        const data = await response.json();
        setClientWeeks(data.clientWeeks || []);
        setLoadedEnrollmentId(enrollmentId); // Track which enrollment this data is for
      } else if (response.status === 404) {
        // Client weeks don't exist yet - need to initialize
        setClientWeeks([]);
        setLoadedEnrollmentId(enrollmentId);
      } else {
        // Other error - still set enrollmentId to clear loading state
        console.error('Error fetching client weeks:', response.status);
        setClientWeeks([]);
        setLoadedEnrollmentId(enrollmentId);
      }
    } catch (err) {
      console.error('Error fetching client weeks:', err);
      setClientWeeks([]);
      setLoadedEnrollmentId(enrollmentId); // Set on error to clear loading state
    } finally {
      setLoadingClientWeeks(false);
    }
  }, [apiBasePath]);

  // Initialize client weeks for an enrollment (copy from template)
  const initializeClientWeeks = useCallback(async (programId: string, enrollmentId: string) => {
    try {
      setLoadingClientWeeks(true);
      const response = await fetch(`${apiBasePath}/${programId}/client-weeks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId }),
      });
      if (response.ok) {
        // Fetch the newly created client weeks
        await fetchClientWeeks(programId, enrollmentId);
      }
    } catch (err) {
      console.error('Error initializing client weeks:', err);
    } finally {
      setLoadingClientWeeks(false);
    }
  }, [apiBasePath, fetchClientWeeks]);

  // Fetch client-specific days for 1:1 programs
  const fetchClientDays = useCallback(async (programId: string, enrollmentId: string) => {
    try {
      setLoadingClientDays(true);
      const response = await fetch(`${apiBasePath}/${programId}/client-days?enrollmentId=${enrollmentId}`);
      if (response.ok) {
        const data = await response.json();
        setClientDays(data.clientDays || []);
      } else if (response.status === 404) {
        // Client days don't exist yet
        setClientDays([]);
      }
    } catch (err) {
      console.error('Error fetching client days:', err);
      setClientDays([]);
    } finally {
      setLoadingClientDays(false);
    }
  }, [apiBasePath]);

  // Fetch cohort-specific week content for group programs
  const fetchCohortWeekContent = useCallback(async (programId: string, cohortId: string, weekId: string) => {
    try {
      setLoadingCohortContent(true);
      const response = await fetch(`${apiBasePath}/${programId}/cohorts/${cohortId}/week-content/${weekId}`);
      if (response.ok) {
        const data = await response.json();
        setCohortWeekContent(data.content || null);
      } else {
        setCohortWeekContent(null);
      }
    } catch (err) {
      console.error('Error fetching cohort week content:', err);
      setCohortWeekContent(null);
    } finally {
      setLoadingCohortContent(false);
    }
  }, [apiBasePath]);

  const handleRemoveEnrollment = async () => {
    if (!removeConfirmEnrollment || !selectedProgram) return;
    
    try {
      setRemovingEnrollment(true);
      
      const response = await fetch(
        `${apiBasePath}/${selectedProgram.id}/enrollments/${removeConfirmEnrollment.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove user');
      }

      // Refresh enrollments list
      await fetchProgramEnrollments(selectedProgram.id);
      setRemoveConfirmEnrollment(null);
    } catch (err) {
      console.error('Error removing enrollment:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove user');
    } finally {
      setRemovingEnrollment(false);
    }
  };

  // Toggle community membership for an enrollment
  const handleToggleCommunity = async (enrollment: EnrollmentWithUser, joinCommunity: boolean) => {
    if (!selectedProgram) return;
    
    try {
      setTogglingCommunity(enrollment.id);
      
      const response = await fetch(`${apiBasePath}/${selectedProgram.id}/enrollments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: enrollment.id,
          joinCommunity,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update community membership');
      }

      // Update local state
      setProgramEnrollments(prev => prev.map(e => 
        e.id === enrollment.id 
          ? { ...e, joinedCommunity: joinCommunity }
          : e
      ));
    } catch (err) {
      console.error('Error toggling community membership:', err);
      alert(err instanceof Error ? err.message : 'Failed to update community membership');
    } finally {
      setTogglingCommunity(null);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  // Fetch current tier for limit checking
  useEffect(() => {
    const fetchTier = async () => {
      try {
        const response = await fetch('/api/coach/subscription');
        if (response.ok) {
          const data = await response.json();
          if (data.tier) {
            setCurrentTier(data.tier);
          }
        }
      } catch (err) {
        console.error('[CoachProgramsTab] Error fetching tier:', err);
      }
    };
    fetchTier();
  }, []);

  // Fetch enrollment rules for settings modal
  useEffect(() => {
    const fetchEnrollmentRules = async () => {
      try {
        const response = await fetch('/api/coach/branding/enrollment-rules');
        if (response.ok) {
          const data = await response.json();
          if (data.rules) {
            setEnrollmentRules(data.rules);
          }
        }
      } catch (err) {
        console.error('[CoachProgramsTab] Error fetching enrollment rules:', err);
      }
    };
    if (!isDemoMode) {
      fetchEnrollmentRules();
    }
  }, [isDemoMode]);

  useEffect(() => {
    if (selectedProgram) {
      // Only reset to day 1 if selecting a DIFFERENT program, not when updating same program
      const isNewSelection = prevProgramId.current !== selectedProgram.id;
      
      if (isNewSelection) {
        // Pass numModulesToCreate for new programs (ref > 1 means user configured in modal)
        const numModules = pendingNumModulesRef.current;
        fetchProgramDetails(selectedProgram.id, numModules > 1 ? { numModulesToCreate: numModules } : undefined);
        setSelectedDayIndex(1);
        // Reset after use
        pendingNumModulesRef.current = 1;
      }
      
      prevProgramId.current = selectedProgram.id;
    }
  }, [selectedProgram, fetchProgramDetails]);

  // Fetch enrollments when switching to enrollments view
  useEffect(() => {
    if (viewMode === 'enrollments' && selectedProgram) {
      fetchProgramEnrollments(selectedProgram.id);
    }
  }, [viewMode, selectedProgram, fetchProgramEnrollments]);

  // Fetch enrollments for individual programs when viewing content (needed for client selector)
  useEffect(() => {
    if (viewMode === 'days' && selectedProgram?.type === 'individual') {
      fetchProgramEnrollments(selectedProgram.id);
    }
  }, [viewMode, selectedProgram, fetchProgramEnrollments]);

  // Fetch client weeks and days when client is selected (for 1:1 programs)
  useEffect(() => {
    if (clientViewContext.mode === 'client' && selectedProgram?.type === 'individual') {
      // Clear tracking immediately to prevent showing stale data during fetch
      setLoadedEnrollmentId(null);
      fetchClientWeeks(selectedProgram.id, clientViewContext.enrollmentId);
      fetchClientDays(selectedProgram.id, clientViewContext.enrollmentId);
    } else {
      // Reset client content when switching to template mode
      setClientWeeks([]);
      setClientDays([]);
      setLoadedEnrollmentId(null);
    }
  }, [clientViewContext, selectedProgram, fetchClientWeeks, fetchClientDays]);

  // Reset client/cohort view context when switching programs
  useEffect(() => {
    setClientViewContext({ mode: 'template' });
    setClientWeeks([]);
    setClientDays([]);
    setLoadedEnrollmentId(null);
    setCohortViewContext({ mode: 'template' });
    setCohortWeekContent(null);
    // Also reset sidebar selection to null - it will be set by the next useEffect once weeks load
    setSidebarSelection(null);
  }, [selectedProgram?.id]);

  // Set default sidebar selection when program weeks are loaded
  // In template mode: select first week
  // This runs after fetchProgramDetails populates programWeeks
  useEffect(() => {
    // Only set default if sidebar selection is null (fresh program load)
    // And only for template mode
    if (!sidebarSelection && programWeeks.length > 0 && clientViewContext.mode === 'template') {
      // Find the first week (smallest weekNumber)
      const firstWeek = [...programWeeks].sort((a, b) => a.weekNumber - b.weekNumber)[0];
      if (firstWeek) {
        setSidebarSelection({ type: 'week', id: firstWeek.id, weekNumber: firstWeek.weekNumber, moduleId: firstWeek.moduleId });
        // Ensure week 1 is expanded
        setExpandedWeeks(new Set([firstWeek.weekNumber]));
      }
    }
  }, [programWeeks, sidebarSelection, clientViewContext.mode]);

  // Jump to today when a client is selected (for 1:1 programs)
  // Also jump to first week for cohorts in group programs
  useEffect(() => {
    if (selectedProgram?.type === 'individual' && clientViewContext.mode === 'client' && currentEnrollment?.currentDayIndex && currentEnrollment.currentDayIndex > 0) {
      // Set sidebar selection to today's day
      setSidebarSelection({ type: 'day', dayIndex: currentEnrollment.currentDayIndex });
      setSelectedDayIndex(currentEnrollment.currentDayIndex);
    } else if (selectedProgram?.type === 'group' && cohortViewContext.mode === 'cohort' && programWeeks.length > 0) {
      // For cohorts, select first week
      const firstWeek = [...programWeeks].sort((a, b) => a.weekNumber - b.weekNumber)[0];
      if (firstWeek) {
        setSidebarSelection({ type: 'week', id: firstWeek.id, weekNumber: firstWeek.weekNumber, moduleId: firstWeek.moduleId });
        setExpandedWeeks(new Set([firstWeek.weekNumber]));
      }
    }
  }, [clientViewContext.mode, cohortViewContext.mode, currentEnrollment?.currentDayIndex, selectedProgram?.type, programWeeks]);

  // Load day data when day index changes (use client days when in client mode)
  useEffect(() => {
    if (!selectedProgram) return;

    const isClientMode = clientViewContext.mode === 'client' && selectedProgram.type === 'individual';
    // Only use client data if it matches the current context (prevents stale data)
    const dataMatchesContext = clientViewContext.mode === 'client' && loadedEnrollmentId === clientViewContext.enrollmentId;
    const daysToUse = (isClientMode && dataMatchesContext) ? clientDays : programDays;

    // In client mode, we might not have days yet (they're created on first save)
    // In that case, fall back to template days for initial display
    let day = daysToUse.find(d => d.dayIndex === selectedDayIndex);
    if (!day && isClientMode && programDays.length > 0) {
      day = programDays.find(d => d.dayIndex === selectedDayIndex);
    }

    if (day) {
      setDayFormData({
        title: day.title || '',
        summary: day.summary || '',
        dailyPrompt: day.dailyPrompt || '',
        tasks: day.tasks || [],
        habits: day.habits || [],
        courseAssignments: day.courseAssignments || [],
      });
    } else {
      setDayFormData({ title: '', summary: '', dailyPrompt: '', tasks: [], habits: [], courseAssignments: [] });
    }
  }, [selectedDayIndex, programDays, clientDays, clientViewContext, selectedProgram, loadedEnrollmentId]);

  // Auto-expand the week containing the selected day
  useEffect(() => {
    if (!selectedProgram) return;
    const includeWeekends = selectedProgram.includeWeekends !== false;
    const daysPerWeek = includeWeekends ? 7 : 5;
    const weekNum = Math.ceil(selectedDayIndex / daysPerWeek);
    setExpandedWeeks(prev => {
      if (prev.has(weekNum)) return prev;
      const next = new Set(prev);
      next.add(weekNum);
      return next;
    });
  }, [selectedDayIndex, selectedProgram]);

  const handleOpenProgramModal = (program?: Program) => {
    // In demo mode, show signup modal instead of allowing edit for existing programs
    if (isDemoMode && program) {
      openSignupModal();
      return;
    }
    
    // Fetch coaches when modal opens
    fetchCoaches();
    // Clear any previous sync result
    setSyncResult(null);
    
    if (program) {
      setEditingProgram(program);
      setProgramFormData({
        name: program.name,
        type: program.type,
        description: program.description,
        coverImageUrl: program.coverImageUrl || '',
        lengthDays: program.lengthDays,
        priceInCents: program.priceInCents,
        currency: program.currency,
        subscriptionEnabled: program.durationType === 'evergreen' ? (program.subscriptionEnabled || false) : false,
        billingInterval: program.billingInterval || 'monthly',
        squadCapacity: program.squadCapacity || 10,
        coachInSquads: program.coachInSquads !== false,
        assignedCoachIds: program.assignedCoachIds || [],
        isActive: program.isActive,
        isPublished: program.isPublished,
        defaultHabits: program.defaultHabits || [],
        applyCoachesToExistingSquads: false, // Reset on each edit
        clientCommunityEnabled: program.clientCommunityEnabled || false,
        dailyFocusSlots: program.dailyFocusSlots ?? 2,
        includeWeekends: program.includeWeekends !== false,
        defaultStartDate: program.defaultStartDate || '',
        allowCustomStartDate: program.allowCustomStartDate !== false,
        completionConfig: {
          showConfetti: program.completionConfig?.showConfetti !== false,
          upsellProgramId: program.completionConfig?.upsellProgramId || undefined,
          upsellHeadline: program.completionConfig?.upsellHeadline || '',
          upsellDescription: program.completionConfig?.upsellDescription || '',
        },
        callCreditsPerMonth: program.callCreditsPerMonth ?? 0,
        taskDistribution: program.taskDistribution || program.weeklyTaskDistribution || 'spread',
      });
    } else {
      setEditingProgram(null);
      setProgramFormData({
        name: '',
        type: 'group',
        description: '',
        coverImageUrl: '',
        lengthDays: 30,
        priceInCents: 0,
        currency: 'usd',
        subscriptionEnabled: false,
        billingInterval: 'monthly',
        squadCapacity: 10,
        coachInSquads: true,
        assignedCoachIds: [],
        isActive: true,
        isPublished: false,
        defaultHabits: [],
        applyCoachesToExistingSquads: false,
        clientCommunityEnabled: false,
        dailyFocusSlots: 2,
        includeWeekends: true,
        defaultStartDate: '',
        allowCustomStartDate: true,
        completionConfig: {
          showConfetti: true,
          upsellProgramId: undefined,
          upsellHeadline: '',
          upsellDescription: '',
        },
        callCreditsPerMonth: 0,
        taskDistribution: 'spread',
      });
    }
    setSaveError(null);
    setIsProgramModalOpen(true);
  };

  const handleOpenCohortModal = (cohort?: ProgramCohort) => {
    // In demo mode, show signup modal instead of allowing edit for existing cohorts
    if (isDemoMode && cohort) {
      openSignupModal();
      return;
    }
    
    if (cohort) {
      setEditingCohort(cohort);
      setCohortFormData({
        name: cohort.name,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        enrollmentOpen: cohort.enrollmentOpen,
        maxEnrollment: cohort.maxEnrollment || null,
        convertSquadsToCommunity: cohort.convertSquadsToCommunity || false,
      });
    } else {
      setEditingCohort(null);
      // Default to next month
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      const endDate = new Date(nextMonth);
      endDate.setDate(endDate.getDate() + (selectedProgram?.lengthDays || 30) - 1);
      
      setCohortFormData({
        name: nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        startDate: nextMonth.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        enrollmentOpen: true,
        maxEnrollment: null,
        convertSquadsToCommunity: false,
      });
    }
    setSaveError(null);
    setIsCohortModalOpen(true);
  };

  const [duplicatingCohort, setDuplicatingCohort] = useState<string | null>(null);
  const [duplicatingProgram, setDuplicatingProgram] = useState<string | null>(null);

  const handleDuplicateProgram = async (program: ProgramWithStats) => {
    try {
      setDuplicatingProgram(program.id);
      
      const response = await fetch(
        `${apiBasePath}/${program.id}/duplicate`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to duplicate program');
      }
      
      // Refresh programs list
      await fetchPrograms();
    } catch (err) {
      console.error('Error duplicating program:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to duplicate program');
    } finally {
      setDuplicatingProgram(null);
    }
  };

  const handleDuplicateCohort = async (cohort: ProgramCohort) => {
    if (!selectedProgram) return;
    
    try {
      setDuplicatingCohort(cohort.id);
      
      const response = await fetch(
        `${apiBasePath}/${selectedProgram.id}/cohorts/${cohort.id}/duplicate`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to duplicate cohort');
      }
      
      // Refresh cohorts list
      await fetchProgramDetails(selectedProgram.id);
    } catch (err) {
      console.error('Error duplicating cohort:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to duplicate cohort');
    } finally {
      setDuplicatingCohort(null);
    }
  };

  const handleSaveProgram = async () => {
    try {
      setSaving(true);
      setSaveError(null);

      const url = editingProgram 
        ? `${apiBasePath}/${editingProgram.id}`
        : apiBasePath;
      
      const response = await fetch(url, {
        method: editingProgram ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(programFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save program');
      }

      const savedProgramId = data.program?.id || editingProgram?.id;

      // If subscription is enabled, create the Stripe price via the subscription endpoint
      // Only call subscription endpoint for evergreen programs (recurring billing not allowed for fixed-duration)
      const isEvergreenProgram = editingProgram?.durationType === 'evergreen';
      if (isEvergreenProgram && programFormData.subscriptionEnabled && programFormData.priceInCents > 0 && savedProgramId) {
        try {
          const subscriptionResponse = await fetch(`/api/coach/org-programs/${savedProgramId}/subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              priceInCents: programFormData.priceInCents,
              billingInterval: programFormData.billingInterval,
            }),
          });

          if (!subscriptionResponse.ok) {
            const subscriptionError = await subscriptionResponse.json();
            console.error('[CoachProgramsTab] Subscription setup error:', subscriptionError);
            // Don't fail the whole save - program was created, just subscription config failed
            setSaveError(`Program saved, but subscription pricing failed: ${subscriptionError.error || 'Unknown error'}. You can retry from program settings.`);
          } else {
            console.log(`[CoachProgramsTab] Subscription pricing configured for program ${savedProgramId}`);
          }
        } catch (subErr) {
          console.error('Error configuring subscription:', subErr);
          setSaveError(`Program saved, but subscription pricing failed: ${subErr instanceof Error ? subErr.message : 'Unknown error'}. You can retry from program settings.`);
        }
      }

      await fetchPrograms();
      setIsProgramModalOpen(false);
      
      if (data.program) {
        if (editingProgram) {
          // For edits: Update local state without triggering the useEffect that resets to Day 1
          // The useEffect checks prevProgramId, so same ID won't trigger re-fetch
          setSelectedProgram(prev => prev ? { ...prev, ...data.program } : data.program);
        } else {
          // For new programs: Select it normally and navigate to days view
          setSelectedProgram(data.program);
          handleViewModeChange('days');
        }
      }
    } catch (err) {
      console.error('Error saving program:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCohort = async () => {
    if (!selectedProgram) return;
    
    try {
      setSaving(true);
      setSaveError(null);

      const url = editingCohort 
        ? `${apiBasePath}/${selectedProgram.id}/cohorts/${editingCohort.id}`
        : `${apiBasePath}/${selectedProgram.id}/cohorts`;
      
      const response = await fetch(url, {
        method: editingCohort ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cohortFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save cohort');
      }

      await fetchProgramDetails(selectedProgram.id);
      setIsCohortModalOpen(false);
    } catch (err) {
      console.error('Error saving cohort:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save cohort');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDay = async () => {
    if (!selectedProgram) return;

    const isClientMode = clientViewContext.mode === 'client' && selectedProgram.type === 'individual';

    try {
      setSaving(true);
      setSaveError(null);

      if (isClientMode) {
        // Save to client-specific day
        const response = await fetch(`${apiBasePath}/${selectedProgram.id}/client-days`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enrollmentId: clientViewContext.enrollmentId,
            dayIndex: selectedDayIndex,
            ...dayFormData,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save day');
        }

        // Update local client days state
        if (data.clientDay) {
          setClientDays(prev => {
            const existing = prev.findIndex(d => d.dayIndex === selectedDayIndex);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = data.clientDay;
              return updated;
            }
            return [...prev, data.clientDay];
          });
        }
      } else {
        // Save to template day
        const response = await fetch(`${apiBasePath}/${selectedProgram.id}/days`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayIndex: selectedDayIndex,
            ...dayFormData,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save day');
        }

        await fetchProgramDetails(selectedProgram.id);
      }
    } catch (err) {
      console.error('Error saving day:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save day');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLandingPage = async (): Promise<boolean> => {
    if (!selectedProgram) return false;
    
    try {
      setSaving(true);
      setSaveError(null);

      const response = await fetch(`${apiBasePath}/${selectedProgram.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(landingPageFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save landing page');
      }

      // Refresh program data
      await fetchPrograms();
      if (data.program) {
        setSelectedProgram(data.program);
      }
      return true;
    } catch (err) {
      console.error('Error saving landing page:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save landing page');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Update program task distribution setting
  const handleTaskDistributionChange = async (distribution: TaskDistribution) => {
    if (!selectedProgram) return;

    try {
      setSaving(true);
      setSaveError(null);

      const response = await fetch(`${apiBasePath}/${selectedProgram.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskDistribution: distribution }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update task distribution');
      }

      // Update local state
      setSelectedProgram({ ...selectedProgram, taskDistribution: distribution });
      // Refresh programs list
      await fetchPrograms();
    } catch (err) {
      console.error('Error updating task distribution:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  // Apply AI-generated program content (all days at once)
  const handleApplyAIProgramContent = async (draft: ProgramContentDraft | LandingPageDraft) => {
    if (!selectedProgram) return;
    
    const programDraft = draft as ProgramContentDraft;
    
    try {
      setSaving(true);
      setSaveError(null);
      
      // Save each day/week from the draft
      for (const dayOrWeek of programDraft.daysOrWeeks) {
        // Map AI-generated tasks to program task format
        // Note: AI generates 'action' | 'reflection', we map to 'task' | 'learning'
        const tasks: ProgramTaskTemplate[] = dayOrWeek.tasks.map(task => ({
          label: task.title,
          type: task.type === 'reflection' ? 'learning' : 'task',
          isPrimary: true,
          estimatedMinutes: task.estimatedMinutes,
          notes: task.description,
        }));
        
        // Map AI-generated habits to program habit format
        const habits: ProgramHabitTemplate[] = dayOrWeek.defaultHabits.map(habit => ({
          title: habit.title,
          description: habit.notes || '',
          frequency: habit.frequency === '3x_week' ? 'custom' : habit.frequency === 'weekly' ? 'custom' : 'daily',
        }));
        
        const response = await fetch(`${apiBasePath}/${selectedProgram.id}/days`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayIndex: dayOrWeek.index,
            title: dayOrWeek.title,
            summary: dayOrWeek.focus,
            dailyPrompt: '',
            tasks,
            habits,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to save day ${dayOrWeek.index}`);
        }
      }
      
      // If there are global default habits, update the program
      if (programDraft.globalDefaultHabits.length > 0) {
        const globalHabits: ProgramHabitTemplate[] = programDraft.globalDefaultHabits.map(habit => ({
          title: habit.title,
          description: habit.notes || '',
          frequency: habit.frequency === '3x_week' ? 'custom' : habit.frequency === 'weekly' ? 'custom' : 'daily',
        }));
        
        await fetch(`${apiBasePath}/${selectedProgram.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defaultHabits: globalHabits,
          }),
        });
      }
      
      // Refresh program details
      await fetchProgramDetails(selectedProgram.id);
      setIsAIProgramContentModalOpen(false);
    } catch (err) {
      console.error('Error applying AI program content:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to apply AI content');
      throw err; // Re-throw to let modal handle the error
    } finally {
      setSaving(false);
    }
  };
  
  // Apply AI-generated landing page content
  const handleApplyAILandingPage = async (draft: ProgramContentDraft | LandingPageDraft) => {
    if (!selectedProgram) return;
    
    const lpDraft = draft as LandingPageDraft;
    
    try {
      setSaving(true);
      setSaveError(null);
      
      // Map AI-generated landing page to existing fields
      const updates = {
        // Hero section
        heroHeadline: lpDraft.hero.title,
        heroSubheadline: lpDraft.hero.subtitle,
        heroCtaText: lpDraft.hero.primaryCta,
        // Coach section
        coachBio: lpDraft.aboutCoach.bio,
        coachHeadline: lpDraft.aboutCoach.headline,
        coachBullets: lpDraft.aboutCoach.bullets || [],
        // Other content
        keyOutcomes: lpDraft.whatYoullLearn.items.map(item => `${item.title}: ${item.description}`),
        features: lpDraft.whatsIncluded.items.map(item => ({
          title: item.title,
          description: item.description,
          icon: '',
        })),
        testimonials: lpDraft.testimonials.map(t => ({
          text: t.quote,
          author: t.name,
          role: t.role || '',
          rating: 5,
        })),
        faqs: lpDraft.faq.map(f => ({
          question: f.question,
          answer: f.answer,
        })),
      };
      
      const response = await fetch(`${apiBasePath}/${selectedProgram.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save landing page');
      }
      
      // Refresh and update landing page form data
      const data = await response.json();
      if (data.program) {
        setSelectedProgram(data.program);
        setLandingPageFormData({
          // Hero section
          heroHeadline: data.program.heroHeadline || '',
          heroSubheadline: data.program.heroSubheadline || '',
          heroCtaText: data.program.heroCtaText || '',
          // Coach section
          coachBio: data.program.coachBio || '',
          coachHeadline: data.program.coachHeadline || '',
          coachBullets: data.program.coachBullets || [],
          // Other content
          keyOutcomes: data.program.keyOutcomes || [],
          features: data.program.features || [],
          testimonials: data.program.testimonials || [],
          faqs: data.program.faqs || [],
          showEnrollmentCount: data.program.showEnrollmentCount || false,
          showCurriculum: data.program.showCurriculum || false,
          // Order bumps - preserve existing config
          orderBumps: data.program.orderBumps,
        });
        setLandingPageSaved(true);
      }
      
      setIsAILandingPageModalOpen(false);
    } catch (err) {
      console.error('Error applying AI landing page:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to apply AI content');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProgram = async () => {
    if (!deleteConfirmProgram) return;
    
    // In demo mode, delete from session store
    if (isDemoMode) {
      demoSession.deleteProgram(deleteConfirmProgram.id);
      if (selectedProgram?.id === deleteConfirmProgram.id) {
        setSelectedProgram(null);
        handleViewModeChange('list');
      }
      setDeleteConfirmProgram(null);
      return;
    }

    try {
      setDeleting(true);

      const response = await fetch(`${apiBasePath}/${deleteConfirmProgram.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete program');
      }

      setPrograms(prev => prev.filter(p => p.id !== deleteConfirmProgram.id));

      if (selectedProgram?.id === deleteConfirmProgram.id) {
        setSelectedProgram(null);
        handleViewModeChange('list');
      }
      
      setDeleteConfirmProgram(null);
    } catch (err) {
      console.error('Error deleting program:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete program');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCohort = async () => {
    if (!deleteConfirmCohort || !selectedProgram) return;
    
    // In demo mode, delete from session store
    if (isDemoMode) {
      demoSession.deleteProgramCohort(selectedProgram.id, deleteConfirmCohort.id);
      // Refresh cohorts
      const updatedCohorts = demoSession.getProgramCohorts(selectedProgram.id);
      const nowIso = new Date().toISOString();
      setProgramCohorts(updatedCohorts.map(dc => ({
        id: dc.id,
        programId: dc.programId,
        organizationId: 'demo-org',
        name: dc.name,
        startDate: dc.startDate,
        endDate: dc.endDate,
        enrollmentOpen: dc.isActive ?? true,
        maxEnrollment: dc.maxParticipants ?? undefined,
        currentEnrollment: dc.enrolledCount ?? 0,
        status: dc.isActive ? 'active' as const : 'upcoming' as const,
        createdAt: nowIso,
        updatedAt: nowIso,
      })));
      setDeleteConfirmCohort(null);
      return;
    }
    
    try {
      setDeleting(true);
      
      const response = await fetch(`${apiBasePath}/${selectedProgram.id}/cohorts/${deleteConfirmCohort.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete cohort');
      }

      await fetchProgramDetails(selectedProgram.id);
      setDeleteConfirmCohort(null);
    } catch (err) {
      console.error('Error deleting cohort:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete cohort');
    } finally {
      setDeleting(false);
    }
  };

  // Task management
  const addTask = () => {
    setDayFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, { label: '', isPrimary: true }],
    }));
  };

  const updateTask = (index: number, updates: Partial<ProgramTaskTemplate>) => {
    setDayFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => i === index ? { ...task, ...updates } : task),
    }));
  };

  const removeTask = (index: number) => {
    setDayFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index),
    }));
  };

  // Habit management
  const addHabit = () => {
    setDayFormData(prev => ({
      ...prev,
      habits: [...prev.habits, { title: '', frequency: 'daily' }],
    }));
  };

  const updateHabit = (index: number, updates: Partial<ProgramHabitTemplate>) => {
    setDayFormData(prev => ({
      ...prev,
      habits: prev.habits.map((habit, i) => i === index ? { ...habit, ...updates } : habit),
    }));
  };

  const removeHabit = (index: number) => {
    setDayFormData(prev => ({
      ...prev,
      habits: prev.habits.filter((_, i) => i !== index),
    }));
  };

  // Program default habits
  const addProgramHabit = () => {
    setProgramFormData(prev => ({
      ...prev,
      defaultHabits: [...prev.defaultHabits, { title: '', frequency: 'daily' }],
    }));
  };

  const updateProgramHabit = (index: number, updates: Partial<ProgramHabitTemplate>) => {
    setProgramFormData(prev => ({
      ...prev,
      defaultHabits: prev.defaultHabits.map((habit, i) => i === index ? { ...habit, ...updates } : habit),
    }));
  };

  const removeProgramHabit = (index: number) => {
    setProgramFormData(prev => ({
      ...prev,
      defaultHabits: prev.defaultHabits.filter((_, i) => i !== index),
    }));
  };

  // Sync program habits to enrolled users
  const syncHabitsToUsers = async () => {
    if (!editingProgram) return;
    
    setSyncingHabits(true);
    setSyncResult(null);
    
    try {
      const response = await fetch(`${apiBasePath}/${editingProgram.id}/sync-habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setSyncResult({ success: false, message: data.error || 'Failed to sync habits' });
        return;
      }
      
      const { summary } = data;
      setSyncResult({
        success: true,
        message: `Synced to ${summary.usersProcessed} users: ${summary.habitsCreated} created, ${summary.habitsUpdated} updated`,
      });
    } catch (err) {
      console.error('Failed to sync habits:', err);
      setSyncResult({ success: false, message: 'Failed to sync habits' });
    } finally {
      setSyncingHabits(false);
    }
  };

  const formatPrice = (cents: number, subscriptionEnabled?: boolean, billingInterval?: 'monthly' | 'quarterly' | 'yearly') => {
    if (cents === 0) return 'Free';
    const price = `$${(cents / 100).toFixed(2)}`;
    if (subscriptionEnabled && billingInterval) {
      const intervalSuffix = billingInterval === 'monthly' ? '/mo' : billingInterval === 'quarterly' ? '/qtr' : '/yr';
      return `${price}${intervalSuffix}`;
    }
    return price;
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-6 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded mb-2" />
            <div className="h-4 w-40 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          </div>
          <div className="h-10 w-10 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
        </div>
        {/* Program cards skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
              <div className="w-16 h-16 rounded-lg bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded mb-2" />
                <div className="h-4 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-albert font-semibold mb-2">Error</p>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm">{error}</p>
        <Button 
          onClick={fetchPrograms} 
          className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-[600px]">
        {/* Demo Mode Banner */}
        {isDemoMode && viewMode === 'list' && (
          <div className="mb-4 px-4 py-3 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-3">
            <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-albert">
                Demo Mode Active
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-albert">
                Showing sample program data for demonstration purposes
              </p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {viewMode === 'list' ? (
            <>
              <div>
                <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Programs
                </h2>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                  Create and manage your coaching programs
                </p>
              </div>
              {!isDemoMode && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Check program limit before opening modal
                      if (checkLimit('max_programs', displayPrograms.length)) {
                        showLimitModal('max_programs', displayPrograms.length);
                        return;
                      }
                      setIsNewProgramModalOpen(true);
                    }}
                    className="text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white font-medium flex items-center transition-colors duration-200 text-[15px] !px-2.5"
                  >
                    <Plus className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">New Program</span>
                  </Button>
                  <button
                    onClick={() => setIsEnrollmentSettingsOpen(true)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-transparent hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] text-[#9c9791] dark:text-[#6b6f7b] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] transition-colors"
                    title="Program enrollment settings"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 w-full overflow-x-auto scrollbar-hide">
              {/* Back button */}
              <button
                onClick={() => handleViewModeChange('list')}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-[#f3f1ef] dark:bg-[#1e222a] hover:bg-[#e8e5e1] dark:hover:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent transition-colors"
                title="Back to Programs"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Program name and badge */}
              <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
                <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate max-w-[200px]">
                  {selectedProgram?.name}
                </h2>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  selectedProgram?.type === 'group'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                }`}>
                  {selectedProgram?.type === 'group' ? 'Group' : '1:1'}
                </span>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-[#e1ddd8] dark:bg-[#262b35] flex-shrink-0" />

              {/* Client/Cohort Selector - right after divider */}
              {viewMode === 'days' && (
                selectedProgram?.type === 'individual' ? (
                  <ClientSelector
                    enrollments={programEnrollments}
                    value={clientViewContext}
                    onChange={async (context) => {
                      setClientViewContext(context);
                      if (context.mode === 'client' && selectedProgram) {
                        const existingWeeks = await fetch(
                          `${apiBasePath}/${selectedProgram.id}/client-weeks?enrollmentId=${context.enrollmentId}`
                        ).then(r => r.ok ? r.json() : { clientWeeks: [] });

                        if (!existingWeeks.clientWeeks?.length && programWeeks.length > 0) {
                          await initializeClientWeeks(selectedProgram.id, context.enrollmentId);
                        }
                        await fetchClientWeeks(selectedProgram.id, context.enrollmentId!);
                        await fetchClientDays(selectedProgram.id, context.enrollmentId!);
                      } else {
                        setClientWeeks([]);
                        setClientDays([]);
                      }
                    }}
                    loading={loadingEnrollments}
                    className="max-w-[200px] flex-shrink-0"
                  />
                ) : selectedProgram?.type === 'group' ? (
                  <CohortSelector
                    cohorts={programCohorts}
                    value={cohortViewContext}
                    onChange={(context) => {
                      setCohortViewContext(context);
                      if (context.mode === 'template') {
                        setCohortWeekContent(null);
                      }
                    }}
                    onCreateCohort={() => handleOpenCohortModal()}
                    loading={loadingDetails}
                    className="max-w-[200px] flex-shrink-0"
                  />
                ) : null
              )}

              {/* Right side controls */}
              <div className="flex-shrink-0 ml-auto flex items-center gap-2">
                {/* Today / Enrollment Status - only for individual programs with client selected */}
                {viewMode === 'days' && selectedProgram?.type === 'individual' && clientViewContext.mode === 'client' && currentEnrollment && (
                  currentEnrollment.status === 'active' && currentEnrollment.currentDayIndex && currentEnrollment.currentDayIndex > 0 ? (
                    <button
                      type="button"
                      onClick={handleJumpToToday}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium font-albert text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors"
                    >
                      <CalendarDays className="w-4 h-4" />
                      Today
                    </button>
                  ) : (
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium font-albert rounded-lg ${
                      currentEnrollment.status === 'stopped' || currentEnrollment.status === 'completed'
                        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20'
                        : currentEnrollment.status === 'upcoming'
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20'
                        : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`}>
                      Enrollment: {currentEnrollment.status.charAt(0).toUpperCase() + currentEnrollment.status.slice(1)}
                    </span>
                  )
                )}

                {/* Page Dropdown */}
                <Popover open={isPageDropdownOpen} onOpenChange={setIsPageDropdownOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium font-albert text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] rounded-lg transition-colors"
                    >
                      {viewMode === 'days' && <><LayoutTemplate className="w-4 h-4" />Content</>}
                      {viewMode === 'cohorts' && <><Users className="w-4 h-4" />Cohorts</>}
                      {viewMode === 'enrollments' && <><Users className="w-4 h-4" />Enrollments</>}
                      {viewMode === 'landing' && <><FileText className="w-4 h-4" />Landing Page</>}
                      {viewMode === 'referrals' && <><Gift className="w-4 h-4" />Referrals</>}
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="end">
                    <button
                      type="button"
                      onClick={() => { handleViewModeChange('days'); setIsPageDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-albert rounded-md transition-colors ${
                        viewMode === 'days'
                          ? 'bg-brand-accent/10 text-brand-accent'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                      }`}
                    >
                      <LayoutTemplate className="w-4 h-4" />
                      Content
                      {viewMode === 'days' && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                    {selectedProgram?.type === 'group' && (
                      <button
                        type="button"
                        onClick={() => { handleViewModeChange('cohorts'); setIsPageDropdownOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-albert rounded-md transition-colors ${
                          viewMode === 'cohorts'
                            ? 'bg-brand-accent/10 text-brand-accent'
                            : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        Cohorts
                        {viewMode === 'cohorts' && <Check className="w-4 h-4 ml-auto" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { handleViewModeChange('enrollments'); setIsPageDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-albert rounded-md transition-colors ${
                        viewMode === 'enrollments'
                          ? 'bg-brand-accent/10 text-brand-accent'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Enrollments
                      {viewMode === 'enrollments' && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleViewModeChange('landing'); setIsPageDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-albert rounded-md transition-colors ${
                        viewMode === 'landing'
                          ? 'bg-brand-accent/10 text-brand-accent'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      Landing Page
                      {viewMode === 'landing' && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleViewModeChange('referrals'); setIsPageDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-albert rounded-md transition-colors ${
                        viewMode === 'referrals'
                          ? 'bg-brand-accent/10 text-brand-accent'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                      }`}
                    >
                      <Gift className="w-4 h-4" />
                      Referrals
                      {viewMode === 'referrals' && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  </PopoverContent>
                </Popover>

                {/* Row/Calendar Toggle - only show on Content view */}
                {viewMode === 'days' && (
                  <div className="flex items-center bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => { setContentDirection(-1); setContentDisplayMode('row'); }}
                      className={`p-1.5 rounded-md transition-colors ${
                        isRowMode
                          ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                      }`}
                      title="Row view"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setContentDirection(1);
                        setContentDisplayMode('calendar');
                        fetchOrganizationCourses();
                      }}
                      className={`p-1.5 rounded-md transition-colors ${
                        isCalendarMode
                          ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                      }`}
                      title="Calendar view"
                    >
                      <CalendarDays className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Settings */}
                <ProgramSettingsButton
                  onClick={() => setIsSettingsModalOpen(true)}
                  isSaving={saving}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tenant required state */}
        {tenantRequired && viewMode === 'list' && (
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Globe className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
              Access from Your Organization Domain
            </h3>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6 max-w-md mx-auto">
              To manage programs, please access this page from your organization&apos;s domain.
            </p>
            
            {tenantRequired.tenantUrl ? (
              <a
                href={`${tenantRequired.tenantUrl}/coach?tab=programs`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl hover:bg-brand-accent/90 transition-colors font-albert font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Go to {tenantRequired.subdomain}.coachful.co
              </a>
            ) : (
              <p className="text-[#a7a39e] dark:text-[#7d8190] font-albert text-sm">
                Your organization domain is not yet configured. Please contact support.
              </p>
            )}
          </div>
        )}

        {/* Program Type Filter - shown in list view */}
        {viewMode === 'list' && !tenantRequired && allPrograms.length > 0 && (
          <div className="flex items-center gap-1 mb-6 p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl w-fit">
            <button
              onClick={() => setProgramTypeFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium font-albert transition-all ${
                programTypeFilter === 'all'
                  ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
              }`}
            >
              All ({allPrograms.length})
            </button>
            <button
              onClick={() => setProgramTypeFilter('individual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium font-albert transition-all flex items-center gap-2 ${
                programTypeFilter === 'individual'
                  ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              1:1 ({individualCount})
            </button>
            <button
              onClick={() => setProgramTypeFilter('group')}
              className={`px-4 py-2 rounded-lg text-sm font-medium font-albert transition-all flex items-center gap-2 ${
                programTypeFilter === 'group'
                  ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Group ({groupCount})
            </button>
          </div>
        )}

        {/* Content */}
        {viewMode === 'list' && !tenantRequired ? (
          // Programs List - Separated by Active/Draft
          <div className="space-y-8">
            {/* Active Programs Section */}
            {displayPrograms.filter(p => p.isActive).length > 0 && (
              <div>
                <h3 className="font-albert font-semibold text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8] mb-4">Active Programs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {displayPrograms.filter(p => p.isActive).map((program) => (
                    <div
                      key={program.id}
                      className="glass-card overflow-hidden cursor-pointer group"
                      onClick={() => {
                        setSelectedProgram(program);
                        handleViewModeChange('days');
                      }}
                    >
                      {/* Cover Image */}
                      <div className="h-36 relative overflow-hidden">
                        {program.coverImageUrl ? (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10" />
                            <img
                              src={program.coverImageUrl}
                              alt={program.name}
                              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                            />
                          </>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-brand-accent/15 via-brand-accent/8 to-[#8c6245]/5 dark:from-brand-accent/10 dark:via-brand-accent/5 dark:to-[#8c6245]/3 flex items-center justify-center">
                            <div className="w-14 h-14 rounded-2xl bg-white/50 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
                              {program.type === 'group' ? (
                                <Users className="w-7 h-7 text-brand-accent/60" />
                              ) : (
                                <User className="w-7 h-7 text-brand-accent/60" />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Type badge - top left */}
                        <div className="absolute top-3 left-3 z-20">
                          <TypeBadge type={program.type} />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <h3 className="font-albert font-semibold text-[17px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.3px] leading-tight line-clamp-2 mb-2">
                          {program.name}
                        </h3>
                        <p className="text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed line-clamp-2 min-h-[2.625rem] mb-4">
                          {program.description || 'No description'}
                        </p>

                        {/* Meta pills */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          <span className="meta-pill text-[#5f5a55] dark:text-[#b2b6c2]">
                            <Clock className="w-3 h-3 text-brand-accent" />
                            {program.durationType === 'evergreen' ? 'Continuous' : `${program.lengthDays} days`}
                          </span>
                          <span className="meta-pill text-[#5f5a55] dark:text-[#b2b6c2]">
                            <DollarSign className="w-3 h-3 text-brand-accent" />
                            {formatPrice(program.priceInCents, program.subscriptionEnabled, program.billingInterval)}
                          </span>
                          {program.type === 'group' && (
                            <span className="meta-pill text-[#5f5a55] dark:text-[#b2b6c2]">
                              <Users className="w-3 h-3 text-brand-accent" />
                              {program.squadCapacity}/squad
                            </span>
                          )}
                        </div>

                        {/* Footer with stats and actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-[#e1ddd8]/40 dark:border-[#262b35]/40">
                          <div className="flex items-center gap-2 text-[12px] text-[#5f5a55] dark:text-[#b2b6c2]">
                            <StatusBadge isActive={true} size="sm" />
                            <VisibilityBadge isPublic={program.isPublished} size="sm" />
                            <span className="ml-1">
                              <span className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">{program.activeEnrollments}</span> active
                              {program.cohortCount !== undefined && (
                                <> · <span className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">{program.cohortCount}</span> cohorts</>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProgramModal(program);
                              }}
                              className="glass-action-btn text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent"
                              title="Program settings"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateProgram(program);
                              }}
                              disabled={duplicatingProgram === program.id}
                              className="glass-action-btn text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent disabled:opacity-50"
                              title="Duplicate program"
                            >
                              {duplicatingProgram === program.id ? (
                                <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmProgram(program);
                              }}
                              className="glass-action-btn text-[#5f5a55] dark:text-[#b2b6c2] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete program"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-[#5f5a55]/50 dark:text-[#b2b6c2]/50 ml-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Draft Programs Section */}
            {displayPrograms.filter(p => !p.isActive).length > 0 && (
              <div>
                {displayPrograms.filter(p => p.isActive).length > 0 && (
                  <div className="border-t border-[#e1ddd8]/60 dark:border-[#262b35]/60 my-6" />
                )}
                <h3 className="font-albert font-semibold text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mb-4">Draft Programs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {displayPrograms.filter(p => !p.isActive).map((program) => (
                    <div
                      key={program.id}
                      className="glass-card overflow-hidden cursor-pointer group opacity-80 hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setSelectedProgram(program);
                        handleViewModeChange('days');
                      }}
                    >
                      {/* Cover Image */}
                      <div className="h-36 relative overflow-hidden">
                        {program.coverImageUrl ? (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10" />
                            <img
                              src={program.coverImageUrl}
                              alt={program.name}
                              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                            />
                          </>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-brand-accent/15 via-brand-accent/8 to-[#8c6245]/5 dark:from-brand-accent/10 dark:via-brand-accent/5 dark:to-[#8c6245]/3 flex items-center justify-center">
                            <div className="w-14 h-14 rounded-2xl bg-white/50 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
                              {program.type === 'group' ? (
                                <Users className="w-7 h-7 text-brand-accent/60" />
                              ) : (
                                <User className="w-7 h-7 text-brand-accent/60" />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Type badge - top left */}
                        <div className="absolute top-3 left-3 z-20">
                          <TypeBadge type={program.type} />
                        </div>

                        {/* Draft badge - top right */}
                        <div className="absolute top-3 right-3 z-20">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/50 dark:border-white/20 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <PenLine className="w-3 h-3" />
                            Draft
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <h3 className="font-albert font-semibold text-[17px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.3px] leading-tight line-clamp-2 mb-2">
                          {program.name}
                        </h3>
                        <p className="text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed line-clamp-2 min-h-[2.625rem] mb-4">
                          {program.description || 'No description'}
                        </p>

                        {/* Meta pills */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          <span className="meta-pill text-[#5f5a55] dark:text-[#b2b6c2]">
                            <Clock className="w-3 h-3 text-brand-accent" />
                            {program.durationType === 'evergreen' ? 'Continuous' : `${program.lengthDays} days`}
                          </span>
                          <span className="meta-pill text-[#5f5a55] dark:text-[#b2b6c2]">
                            <DollarSign className="w-3 h-3 text-brand-accent" />
                            {formatPrice(program.priceInCents, program.subscriptionEnabled, program.billingInterval)}
                          </span>
                          {program.type === 'group' && (
                            <span className="meta-pill text-[#5f5a55] dark:text-[#b2b6c2]">
                              <Users className="w-3 h-3 text-brand-accent" />
                              {program.squadCapacity}/squad
                            </span>
                          )}
                        </div>

                        {/* Footer with stats and actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-[#e1ddd8]/40 dark:border-[#262b35]/40">
                          <div className="flex items-center gap-2 text-[12px] text-[#5f5a55] dark:text-[#b2b6c2]">
                            <StatusBadge isActive={false} size="sm" />
                            <VisibilityBadge isPublic={program.isPublished} size="sm" />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProgramModal(program);
                              }}
                              className="glass-action-btn text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent"
                              title="Program settings"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateProgram(program);
                              }}
                              disabled={duplicatingProgram === program.id}
                              className="glass-action-btn text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent disabled:opacity-50"
                              title="Duplicate program"
                            >
                              {duplicatingProgram === program.id ? (
                                <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmProgram(program);
                              }}
                              className="glass-action-btn text-[#5f5a55] dark:text-[#b2b6c2] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete program"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-[#5f5a55]/50 dark:text-[#b2b6c2]/50 ml-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {displayPrograms.length === 0 && !isDemoMode && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-brand-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LayoutTemplate className="w-8 h-8 text-brand-accent" />
                </div>
                <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  No programs yet
                </h3>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
                  Choose from templates or build from scratch
                </p>
                <Button
                  onClick={() => setIsNewProgramModalOpen(true)}
                  className="bg-brand-accent hover:bg-brand-accent/90 text-white"
                >
                  Create Program
                </Button>
              </div>
            )}
          </div>
        ) : viewMode === 'days' ? (
          // Content View - Row (sidebar + editor) or Calendar (full-width)
          <AnimatePresence mode="wait">
          {contentDisplayMode === 'calendar' ? (
            // Calendar View - Full width, no sidebar
            <motion.div
              key="calendar-view"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-3 sm:p-6"
            >
              <ProgramScheduleEditor
                program={selectedProgram!}
                days={daysToUse}
                courses={organizationCourses}
                modules={programModules}
                weeks={programWeeks}
                viewMode={clientViewContext.mode === 'client' ? 'client' : 'template'}
                enrollmentStartDate={currentEnrollment?.startedAt}
                currentDayIndex={currentEnrollment?.currentDayIndex}
                onDayClick={(dayIndex) => {
                  setSelectedDayIndex(dayIndex);
                  setSidebarSelection({ type: 'day', dayIndex });
                  setContentDirection(-1);
                  setContentDisplayMode('row');
                }}
                onAddCall={(dayIndex) => {
                  setSelectedDayIndex(dayIndex);
                  setSidebarSelection({ type: 'day', dayIndex });
                  setContentDirection(-1);
                  setContentDisplayMode('row');
                }}
              />
            </motion.div>
          ) : (
          // Row View - Sidebar + Editor
          <motion.div
            key="row-view"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex flex-col gap-4"
          >
            {/* Content area - Unified Sidebar + Editor Card */}
            <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-start">
                {/* Sidebar Navigation - glassmorphism style with constrained height */}
                <div className="lg:w-96 lg:flex-shrink-0 lg:sticky lg:top-4 bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border-b lg:border-b-0 lg:border-r border-[#e1ddd8]/40 dark:border-[#262b35]/40">
                  <ModuleWeeksSidebar
              key={clientViewContext.mode === 'client' ? `client-${clientViewContext.enrollmentId}` : 'template'}
              program={selectedProgram as Program}
              modules={programModules}
              weeks={clientViewContext.mode === 'client' ? clientWeeks.map(cw => ({
                id: cw.id,
                programId: cw.programId,
                weekNumber: cw.weekNumber,
                moduleId: cw.moduleId,
                order: cw.order,
                startDayIndex: cw.startDayIndex,
                endDayIndex: cw.endDayIndex,
                name: cw.name,
                theme: cw.theme,
                description: cw.description,
                weeklyPrompt: cw.weeklyPrompt,
                weeklyTasks: cw.weeklyTasks,
                weeklyHabits: cw.weeklyHabits,
                currentFocus: cw.currentFocus,
                notes: cw.notes,
                distribution: cw.distribution,
                createdAt: cw.createdAt,
                updatedAt: cw.updatedAt,
              } as ProgramWeek)) : programWeeks}
              days={daysToUse}
              selection={sidebarSelection || (selectedDayIndex ? { type: 'day', dayIndex: selectedDayIndex } : null)}
              viewContext={clientViewContext}
              onSelect={(selection) => {
                setSidebarSelection(selection);
                if (selection.type === 'day') {
                  setSelectedDayIndex(selection.dayIndex);
                  // Load day data into form - use daysToUse to respect client mode
                  const day = daysToUse.find(d => d.dayIndex === selection.dayIndex);
                  if (day) {
                    setDayFormData({
                      title: day.title || '',
                      summary: day.summary || '',
                      dailyPrompt: day.dailyPrompt || '',
                      tasks: day.tasks || [],
                      habits: day.habits || [],
                      courseAssignments: day.courseAssignments || [],
                    });
                  } else {
                    setDayFormData({ title: '', summary: '', dailyPrompt: '', tasks: [], habits: [], courseAssignments: [] });
                  }
                }
              }}
              onAddModule={async () => {
                if (!selectedProgram) return;
                const lastModule = programModules[programModules.length - 1];
                const startDay = lastModule ? lastModule.endDayIndex + 1 : 1;
                const endDay = Math.min(startDay + 6, selectedProgram.lengthDays);

                try {
                  console.log('[onAddModule] Creating module:', { startDay, endDay, programId: selectedProgram.id });
                  const res = await fetch(`${apiBasePath}/${selectedProgram.id}/modules`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: `Module ${programModules.length + 1}`,
                      startDayIndex: startDay,
                      endDayIndex: endDay,
                    }),
                  });

                  if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    console.error('[onAddModule] Failed:', res.status, errorData);
                    alert(`Failed to create module: ${errorData.error || res.statusText}`);
                    return;
                  }

                  const data = await res.json();
                  console.log('[onAddModule] Created module:', data);
                  setProgramModules([...programModules, data.module]);

                  // Update hasModules if first module (API already does this, but update local state)
                  if (programModules.length === 0) {
                    setSelectedProgram({ ...selectedProgram, hasModules: true });
                  }
                } catch (err) {
                  console.error('[onAddModule] Error:', err);
                  alert('Failed to create module. Check console for details.');
                }
              }}
              onFillWithAI={() => setIsAIProgramContentModalOpen(true)}
              onFillWeek={(weekNumber) => {
                // Find or create a week object for this week number
                const existingWeek = programWeeks.find(w => w.weekNumber === weekNumber);
                if (existingWeek) {
                  setWeekToFill(existingWeek);
                } else {
                  // Create a temporary week object for the fill modal
                  const daysPerWeek = selectedProgram?.includeWeekends !== false ? 7 : 5;
                  const startDay = (weekNumber - 1) * daysPerWeek + 1;
                  const endDay = Math.min(startDay + daysPerWeek - 1, selectedProgram?.lengthDays || 30);
                  setWeekToFill({
                    id: `temp-week-${weekNumber}`,
                    programId: selectedProgram?.id || '',
                    weekNumber,
                    order: weekNumber,
                    startDayIndex: startDay,
                    endDayIndex: endDay,
                    distribution: 'repeat-daily',
                  } as ProgramWeek);
                }
                setIsWeekFillModalOpen(true);
              }}
              onWeekDistributionChange={async (weekNumber, distribution) => {
                if (!selectedProgram) return;
                try {
                  // Find existing week record or create one
                  const existingWeek = programWeeks.find(w => w.weekNumber === weekNumber);
                  
                  if (existingWeek) {
                    // Update existing week and redistribute tasks
                    const res = await fetch(`${apiBasePath}/${selectedProgram.id}/weeks/${existingWeek.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        distribution,
                        distributeTasksNow: true,
                        overwriteExisting: true,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setProgramWeeks(prev => prev.map(w => w.id === existingWeek.id ? data.week : w));
                      // Refresh days after distribution
                      const daysRes = await fetch(`${apiBasePath}/${selectedProgram.id}/days`);
                      if (daysRes.ok) {
                        const daysData = await daysRes.json();
                        setProgramDays(daysData.days || []);
                      }
                    }
                  } else {
                    // Create new week record with this distribution
                    const daysPerWeek = selectedProgram.includeWeekends !== false ? 7 : 5;
                    const startDay = (weekNumber - 1) * daysPerWeek + 1;
                    const endDay = Math.min(startDay + daysPerWeek - 1, selectedProgram.lengthDays || 30);
                    
                    const res = await fetch(`${apiBasePath}/${selectedProgram.id}/weeks`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        weekNumber,
                        startDayIndex: startDay,
                        endDayIndex: endDay,
                        distribution,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setProgramWeeks(prev => [...prev, data.week]);
                    }
                  }
                } catch (err) {
                  console.error('Error updating week distribution:', err);
                }
              }}
              isLoading={loadingDetails}
              onModulesReorder={async (reorderedModules) => {
                if (!selectedProgram) return;
                // Optimistic update
                setProgramModules(reorderedModules.map((m, i) => ({ ...m, order: i + 1 })));
                try {
                  await fetch(`${apiBasePath}/${selectedProgram.id}/modules/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ moduleIds: reorderedModules.map(m => m.id) }),
                  });
                } catch (err) {
                  console.error('Error reordering modules:', err);
                  // Refetch on error
                  const res = await fetch(`${apiBasePath}/${selectedProgram.id}/modules`);
                  if (res.ok) {
                    const data = await res.json();
                    setProgramModules(data.modules || []);
                  }
                }
              }}
              onWeeksReorder={async (moduleId, reorderedWeeks) => {
                if (!selectedProgram) return;
                // Optimistic update
                setProgramWeeks(prev => {
                  const other = prev.filter(w => w.moduleId !== moduleId);
                  return [...other, ...reorderedWeeks.map((w, i) => ({ ...w, order: i + 1, moduleId }))];
                });
                try {
                  await fetch(`${apiBasePath}/${selectedProgram.id}/weeks/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ moduleId, weekIds: reorderedWeeks.map(w => w.id) }),
                  });
                  // Refetch to get recalculated day indices
                  const res = await fetch(`${apiBasePath}/${selectedProgram.id}/weeks`);
                  if (res.ok) {
                    const data = await res.json();
                    setProgramWeeks(data.weeks || []);
                  }
                } catch (err) {
                  console.error('Error reordering weeks:', err);
                }
              }}
              onCreateMissingWeeks={async (weeksToCreate) => {
                if (!selectedProgram) return new Map();
                const newWeekIds = new Map<number, string>();
                
                // Create each missing week
                for (const weekData of weeksToCreate) {
                  try {
                    const res = await fetch(`${apiBasePath}/${selectedProgram.id}/weeks`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        weekNumber: weekData.weekNumber,
                        moduleId: weekData.moduleId,
                        startDayIndex: weekData.startDayIndex,
                        endDayIndex: weekData.endDayIndex,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.week?.id) {
                        newWeekIds.set(weekData.weekNumber, data.week.id);
                        // Add to local state
                        setProgramWeeks(prev => [...prev, data.week]);
                      }
                    }
                  } catch (err) {
                    console.error('Error creating week:', err);
                  }
                }
                
                return newWeekIds;
              }}
              onWeekMoveToModule={async (weekId, targetModuleId) => {
                if (!selectedProgram) return;
                // Optimistic update
                setProgramWeeks(prev => prev.map(w =>
                  w.id === weekId ? { ...w, moduleId: targetModuleId } : w
                ));
                try {
                  await fetch(`${apiBasePath}/${selectedProgram.id}/weeks/${weekId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ moduleId: targetModuleId }),
                  });
                  // Refetch to get recalculated day indices
                  const res = await fetch(`${apiBasePath}/${selectedProgram.id}/weeks`);
                  if (res.ok) {
                    const data = await res.json();
                    setProgramWeeks(data.weeks || []);
                  }
                } catch (err) {
                  console.error('Error moving week to module:', err);
                }
              }}
              onDeleteModule={async (moduleId, action) => {
                if (!selectedProgram) return;
                const moduleToDelete = programModules.find(m => m.id === moduleId);
                if (!moduleToDelete) return;

                const sortedModules = [...programModules].sort((a, b) => a.order - b.order);
                const idx = sortedModules.findIndex(m => m.id === moduleId);
                const adjacentModuleId = idx > 0 ? sortedModules[idx - 1].id : (sortedModules[idx + 1]?.id || null);

                if (action === 'move' && adjacentModuleId) {
                  // Move weeks to adjacent module
                  const weeksToMove = programWeeks.filter(w => w.moduleId === moduleId);
                  for (const week of weeksToMove) {
                    if (week.id) {
                      await fetch(`${apiBasePath}/${selectedProgram.id}/weeks/${week.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ moduleId: adjacentModuleId }),
                      });
                    }
                  }
                }

                // Delete the module (and its weeks if action === 'delete')
                await fetch(`${apiBasePath}/${selectedProgram.id}/modules/${moduleId}`, {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ deleteWeeks: action === 'delete' }),
                });

                // Update local state
                setProgramModules(prev => prev.filter(m => m.id !== moduleId));

                if (action === 'delete') {
                  setProgramWeeks(prev => prev.filter(w => w.moduleId !== moduleId));
                } else if (adjacentModuleId) {
                  setProgramWeeks(prev => prev.map(w =>
                    w.moduleId === moduleId ? { ...w, moduleId: adjacentModuleId } : w
                  ));
                }

                // Clear selection if deleted module was selected
                if (sidebarSelection?.type === 'module' && sidebarSelection.id === moduleId) {
                  setSidebarSelection(null);
                }
              }}
              onAutoDistributeWeeks={async () => {
                if (!selectedProgram) return;
                try {
                  const res = await fetch(`${apiBasePath}/${selectedProgram.id}/weeks/auto-distribute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                  });
                  if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    console.error('Failed to auto-distribute weeks:', errorData);
                    alert(`Failed to auto-distribute weeks: ${errorData.error || res.statusText}`);
                    return;
                  }
                  // Refetch weeks to get updated module assignments
                  const weeksRes = await fetch(`${apiBasePath}/${selectedProgram.id}/weeks`);
                  if (weeksRes.ok) {
                    const weeksData = await weeksRes.json();
                    setProgramWeeks(weeksData.weeks || []);
                  }
                } catch (err) {
                  console.error('Error auto-distributing weeks:', err);
                  alert('Failed to auto-distribute weeks. Check console for details.');
                }
              }}
              currentDayIndex={currentEnrollment?.currentDayIndex || (cohortViewContext.mode === 'cohort' && cohortViewContext.cohortStartDate ? (() => {
                // Calculate current day index for cohort based on start date
                const startDate = new Date(cohortViewContext.cohortStartDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                startDate.setHours(0, 0, 0, 0);
                
                const diffTime = today.getTime() - startDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                // If cohort hasn't started yet or is in the past
                if (diffDays < 0) return undefined;
                if (diffDays >= (selectedProgram?.lengthDays || 30)) return undefined;
                
                // Convert to 1-based day index, accounting for weekends if not included
                const includeWeekends = selectedProgram?.includeWeekends !== false;
                if (includeWeekends) {
                  return diffDays + 1;
                } else {
                  // Calculate business days (weekdays only)
                  let businessDays = 0;
                  const currentDate = new Date(startDate);
                  while (currentDate <= today) {
                    const dayOfWeek = currentDate.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
                      businessDays++;
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                  }
                  return businessDays > 0 ? businessDays : undefined;
                }
              })() : undefined)}
              onJumpToToday={handleJumpToToday}
              cohortViewContext={cohortViewContext}
            />
                </div>

                {/* Content column */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Content Editor - conditionally render based on selection */}
                  <div className="flex-1 p-4 sm:p-6">
                {loadingDetails ? (
                <div className="space-y-6 animate-pulse">
                  <div className="h-6 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                    <div className="h-10 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-28 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                    <div className="h-24 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
                  </div>
                </div>
              ) : sidebarSelection?.type === 'module' ? (
                // Module Editor
                (() => {
                  const selectedModule = programModules.find(m => m.id === sidebarSelection.id);
                  if (!selectedModule) return <p>Module not found</p>;
                  const isClientMode = selectedProgram?.type === 'individual' && clientViewContext.mode === 'client';
                  return (
                    <ModuleEditor
                      module={selectedModule}
                      weeks={programWeeks.filter(w => w.moduleId === selectedModule.id)}
                      readOnly={isClientMode}
                      onSave={async (updates) => {
                        try {
                          const res = await fetch(`${apiBasePath}/${selectedProgram?.id}/modules/${selectedModule.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updates),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setProgramModules(prev => prev.map(m => m.id === selectedModule.id ? data.module : m));
                          }
                        } catch (err) {
                          console.error('Error saving module:', err);
                        }
                      }}
                      onDelete={async () => {
                        try {
                          const res = await fetch(`${apiBasePath}/${selectedProgram?.id}/modules/${selectedModule.id}`, {
                            method: 'DELETE',
                          });
                          if (res.ok) {
                            setProgramModules(prev => prev.filter(m => m.id !== selectedModule.id));
                            setSidebarSelection(null);
                          }
                        } catch (err) {
                          console.error('Error deleting module:', err);
                        }
                      }}
                      isSaving={saving}
                    />
                  );
                })()
              ) : sidebarSelection?.type === 'week' ? (
                // Week Editor (for weekly mode)
                (() => {
                  const weekNumber = sidebarSelection.weekNumber;
                  const templateWeek = programWeeks.find(w => w.weekNumber === weekNumber);

                  // For individual programs in client mode, use client week
                  const isClientMode = selectedProgram?.type === 'individual' && clientViewContext.mode === 'client';
                  // Only use client data if it matches the current context (prevents stale data)
                  const dataMatchesContext = clientViewContext.mode === 'client' && loadedEnrollmentId === clientViewContext.enrollmentId;
                  const clientWeek = isClientMode && dataMatchesContext
                    ? clientWeeks.find(cw => cw.weekNumber === weekNumber)
                    : null;

                  // Calculate week bounds from program settings
                  const daysPerWeek = selectedProgram?.includeWeekends !== false ? 7 : 5;
                  const startDay = (weekNumber - 1) * daysPerWeek + 1;
                  const endDay = Math.min(startDay + daysPerWeek - 1, selectedProgram?.lengthDays || 30);

                  // Determine which week data to use
                  const existingWeek = isClientMode ? clientWeek : templateWeek;

                  // Use existing week data or create a default
                  const selectedWeek: ProgramWeek = existingWeek ? {
                    // For client weeks, map to ProgramWeek structure
                    id: existingWeek.id,
                    programId: existingWeek.programId,
                    moduleId: existingWeek.moduleId || '',
                    organizationId: existingWeek.organizationId,
                    weekNumber: existingWeek.weekNumber,
                    order: existingWeek.order || existingWeek.weekNumber,
                    startDayIndex: existingWeek.startDayIndex || startDay,
                    endDayIndex: existingWeek.endDayIndex || endDay,
                    name: existingWeek.name,
                    description: existingWeek.description,
                    theme: existingWeek.theme,
                    weeklyPrompt: existingWeek.weeklyPrompt,
                    weeklyTasks: existingWeek.weeklyTasks,
                    weeklyHabits: existingWeek.weeklyHabits,
                    currentFocus: existingWeek.currentFocus,
                    notes: existingWeek.notes,
                    distribution: existingWeek.distribution || 'repeat-daily',
                    linkedSummaryIds: existingWeek.linkedSummaryIds,
                    linkedCallEventIds: existingWeek.linkedCallEventIds,
                    manualNotes: existingWeek.manualNotes,
                    coachRecordingUrl: existingWeek.coachRecordingUrl,
                    coachRecordingNotes: existingWeek.coachRecordingNotes,
                    fillSource: existingWeek.fillSource,
                    createdAt: existingWeek.createdAt,
                    updatedAt: existingWeek.updatedAt,
                  } : {
                    id: `temp-week-${weekNumber}`,
                    programId: selectedProgram?.id || '',
                    moduleId: '', // Temporary - will be assigned when saved
                    organizationId: selectedProgram?.organizationId || '',
                    weekNumber,
                    order: weekNumber,
                    startDayIndex: startDay,
                    endDayIndex: endDay,
                    distribution: 'repeat-daily' as const,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };

                  // Show loading indicator when switching between clients
                  if (isClientMode && !dataMatchesContext) {
                    return (
                      <div className="flex-1 p-8 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mx-auto mb-4" />
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                            Loading client content...
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <WeekEditor
                      week={selectedWeek}
                      days={programDays.filter(d =>
                        d.dayIndex >= startDay && d.dayIndex <= endDay
                      )}
                      onSave={async (updates) => {
                        try {
                          if (isClientMode && clientWeek) {
                            // Update existing client-specific week
                            const res = await fetch(`${apiBasePath}/${selectedProgram?.id}/client-weeks/${clientWeek.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(updates),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setClientWeeks(prev => prev.map(w => w.id === clientWeek.id ? data.clientWeek : w));
                            }
                          } else if (isClientMode && !clientWeek && clientViewContext.enrollmentId) {
                            // Create new client-specific week (client mode but week doesn't exist yet)
                            const res = await fetch(`${apiBasePath}/${selectedProgram?.id}/client-weeks`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                enrollmentId: clientViewContext.enrollmentId,
                                weekNumber,
                                startDayIndex: startDay,
                                endDayIndex: endDay,
                                moduleId: templateWeek?.moduleId || programModules[0]?.id,
                                ...updates,
                              }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              if (data.clientWeek) {
                                setClientWeeks(prev => {
                                  // Check if we need to add or update
                                  const existing = prev.find(w => w.weekNumber === weekNumber);
                                  if (existing) {
                                    return prev.map(w => w.weekNumber === weekNumber ? data.clientWeek : w);
                                  }
                                  return [...prev, data.clientWeek];
                                });
                              }
                            }
                          } else if (templateWeek) {
                            // Update template week and distribute tasks to days
                            const hasWeeklyTasks = updates.weeklyTasks && updates.weeklyTasks.length > 0;
                            const res = await fetch(`${apiBasePath}/${selectedProgram?.id}/weeks/${templateWeek.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                ...updates,
                                ...(hasWeeklyTasks && { distributeTasksNow: true }),
                              }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setProgramWeeks(prev => prev.map(w => w.id === templateWeek.id ? data.week : w));
                              // Refresh days if distribution happened
                              if (hasWeeklyTasks) {
                                const daysRes = await fetch(`${apiBasePath}/${selectedProgram?.id}/days`);
                                if (daysRes.ok) {
                                  const daysData = await daysRes.json();
                                  setProgramDays(daysData.days || []);
                                }
                              }
                            }
                          } else {
                            // Create new template week record
                            const res = await fetch(`${apiBasePath}/${selectedProgram?.id}/weeks`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                weekNumber,
                                startDayIndex: startDay,
                                endDayIndex: endDay,
                                ...updates,
                              }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setProgramWeeks(prev => [...prev, data.week]);
                            }
                          }
                        } catch (err) {
                          console.error('Error saving week:', err);
                        }
                      }}
                      onDaySelect={(dayIndex) => {
                        setSidebarSelection({ type: 'day', dayIndex });
                        setSelectedDayIndex(dayIndex);
                        const day = daysToUse.find(d => d.dayIndex === dayIndex);
                        if (day) {
                          setDayFormData({
                            title: day.title || '',
                            summary: day.summary || '',
                            dailyPrompt: day.dailyPrompt || '',
                            tasks: day.tasks || [],
                            habits: day.habits || [],
                            courseAssignments: day.courseAssignments || [],
                          });
                        } else {
                          setDayFormData({ title: '', summary: '', dailyPrompt: '', tasks: [], habits: [], courseAssignments: [] });
                        }
                      }}
                      onFillWithAI={() => {
                        setWeekToFill(selectedWeek);
                        setIsWeekFillModalOpen(true);
                      }}
                      isSaving={saving}
                      availableCallSummaries={availableCallSummaries}
                      availableEvents={availableEvents}
                      isClientView={isClientMode}
                      clientName={isClientMode ? clientViewContext.userName : undefined}
                      clientUserId={isClientMode ? clientViewContext.userId : undefined}
                      enrollmentId={isClientMode ? clientViewContext.enrollmentId : undefined}
                      programId={selectedProgram?.id}
                      programType={selectedProgram?.type}
                      enrollments={programEnrollments}
                      cohortId={cohortViewContext.mode === 'cohort' ? cohortViewContext.cohortId : undefined}
                      cohortName={cohortViewContext.mode === 'cohort' ? cohortViewContext.cohortName : undefined}
                    />
                  );
                })()
              ) : (
                // Day Editor (default)
                (() => {
                  // Check if we're in client mode and data is loading
                  const isClientMode = selectedProgram?.type === 'individual' && clientViewContext.mode === 'client';
                  const dataMatchesContext = clientViewContext.mode === 'client' && loadedEnrollmentId === clientViewContext.enrollmentId;

                  // Show loading indicator when switching between clients
                  if (isClientMode && !dataMatchesContext) {
                    return (
                      <div className="flex-1 p-8 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mx-auto mb-4" />
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                            Loading client content...
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Day {selectedDayIndex}
                    </h3>
                  </div>

                  {/* Day Title */}
                  <div>
                    <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                      Day Theme (optional)
                    </label>
                    <input
                      type="text"
                      value={dayFormData.title}
                      onChange={(e) => setDayFormData({ ...dayFormData, title: e.target.value })}
                      placeholder="e.g., Clarify your niche"
                      className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                    />
                  </div>

                  {/* Daily Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                      Daily Prompt
                    </label>
                    <textarea
                      value={dayFormData.dailyPrompt}
                      onChange={(e) => setDayFormData({ ...dayFormData, dailyPrompt: e.target.value })}
                      placeholder="Enter a motivational message or tip for this day..."
                      rows={3}
                      className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
                    />
                    <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mt-1">
                      This message will appear as a card on the user&apos;s home page for this day
                    </p>
                  </div>

                  {/* Tasks */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Tasks
                      </label>
                    </div>
                    {/* Warning if too many focus tasks */}
                    {(() => {
                      const focusCount = dayFormData.tasks.filter(t => t.isPrimary).length;
                      const programSlots = selectedProgram?.dailyFocusSlots ?? 2;
                      if (focusCount > programSlots) {
                        return (
                          <div className="mb-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                            <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800 dark:text-amber-300 font-albert">
                              This day has {focusCount} focus tasks, but your program contributes {programSlots}. Extra tasks will go to users&apos; backlog.
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div className="space-y-2">
                      {dayFormData.tasks.map((task, index) => (
                        <div 
                          key={index} 
                          className="group relative flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:shadow-sm hover:border-[#d4d0cb] dark:hover:border-[#313746] transition-all duration-200"
                        >
                          {/* Task Icon */}
                          <div className="w-5 h-5 rounded-full border-2 border-[#e1ddd8] dark:border-[#3d4351] flex-shrink-0" />
                          
                          {/* Input */}
                          <input
                            type="text"
                            value={task.label}
                            onChange={(e) => updateTask(index, { label: e.target.value })}
                            placeholder="What should they accomplish?"
                            className="flex-1 bg-transparent border-none outline-none font-albert text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]"
                          />
                          
                          {/* Focus Toggle */}
                          <button
                            type="button"
                            onClick={() => updateTask(index, { isPrimary: !task.isPrimary })}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                              task.isPrimary 
                                ? 'bg-brand-accent/15 text-brand-accent' 
                                : 'bg-[#f3f1ef] dark:bg-[#1d222b] text-[#5f5a55] dark:text-[#7d8190] hover:bg-[#eae7e3] dark:hover:bg-[#262b35]'
                            }`}
                          >
                            <Target className="w-3.5 h-3.5" />
                            Focus
                          </button>
                          
                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => removeTask(index)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      {/* Empty State */}
                      {dayFormData.tasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
                          <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#1d222b] flex items-center justify-center mb-3">
                            <ListTodo className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                          </div>
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">No tasks yet</p>
                          <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                            Add tasks to guide users through this day
                          </p>
                        </div>
                      )}
                      
                      {/* Add Task Button */}
                      <button
                        type="button"
                        onClick={addTask}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-brand-accent hover:border-brand-accent/50 hover:bg-brand-accent/5 dark:hover:bg-brand-accent/90/10 transition-all duration-200 font-albert font-medium text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Task
                      </button>
                    </div>
                  </div>

                  {/* Habits (Day 1) */}
                  {(selectedDayIndex === 1 || dayFormData.habits.length > 0) && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <label className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            Default Habits
                          </label>
                          {selectedDayIndex === 1 && (
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-0.5">
                              Day 1 sets program defaults
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {dayFormData.habits.map((habit, index) => (
                          <div 
                            key={index} 
                            className="group relative flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:shadow-sm hover:border-[#d4d0cb] dark:hover:border-[#313746] transition-all duration-200"
                          >
                            {/* Habit Icon - Dashed Ring */}
                            <div className="w-5 h-5 rounded-full border-2 border-dashed border-brand-accent/40 dark:border-brand-accent/40 flex-shrink-0" />
                            
                            {/* Input */}
                            <input
                              type="text"
                              value={habit.title}
                              onChange={(e) => updateHabit(index, { title: e.target.value })}
                              placeholder="What habit should they build?"
                              className="flex-1 bg-transparent border-none outline-none font-albert text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]"
                            />
                            
                            {/* Frequency Dropdown */}
                            <div className="relative">
                              <select
                                value={habit.frequency}
                                onChange={(e) => updateHabit(index, { frequency: e.target.value as 'daily' | 'weekday' | 'custom' })}
                                className="appearance-none pl-3 pr-8 py-1.5 bg-[#f3f1ef] dark:bg-[#1d222b] border-none rounded-lg text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30"
                              >
                                <option value="daily">Daily</option>
                                <option value="weekday">Weekday</option>
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a7a39e] dark:text-[#7d8190] pointer-events-none" />
                            </div>
                            
                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => removeHabit(index)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        
                        {/* Empty State */}
                        {dayFormData.habits.length === 0 && selectedDayIndex === 1 && (
                          <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
                            <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#1d222b] flex items-center justify-center mb-3">
                              <Repeat className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                            </div>
                            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">No habits yet</p>
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                              Add default habits for this program
                            </p>
                          </div>
                        )}
                        
                        {/* Add Habit Button */}
                        <button
                          type="button"
                          onClick={addHabit}
                          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-brand-accent hover:border-brand-accent/50 hover:bg-brand-accent/5 dark:hover:bg-brand-accent/90/10 transition-all duration-200 font-albert font-medium text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Habit
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Course Assignments */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Assigned Courses
                      </label>
                    </div>
                    <DayCourseSelector
                      currentAssignments={dayFormData.courseAssignments}
                      onChange={(assignments) => setDayFormData({ ...dayFormData, courseAssignments: assignments })}
                    />
                  </div>

                  {saveError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400 font-albert">{saveError}</p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveDay}
                      disabled={saving}
                      className="bg-brand-accent hover:bg-brand-accent/90 text-white"
                    >
                      {saving ? 'Saving...' : 'Save Day'}
                    </Button>
                  </div>
                </div>
                  );
                })()
              )}
              </div>
            </div>
          </div>
          </div>
          </motion.div>
          )}
          </AnimatePresence>
        ) : viewMode === 'cohorts' ? (
          // Cohorts View (Group programs only)
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Manage time-based cohorts for this program
              </p>
              <Button
                onClick={() => handleOpenCohortModal()}
                className="bg-brand-accent hover:bg-brand-accent/90 text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Cohort
              </Button>
            </div>

            <div className="space-y-3">
              {programCohorts.map((cohort) => (
                <div 
                  key={cohort.id}
                  className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {cohort.name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {cohort.startDate} → {cohort.endDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {cohort.currentEnrollment} enrolled
                          {cohort.maxEnrollment && ` / ${cohort.maxEnrollment} max`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        cohort.status === 'active' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : cohort.status === 'upcoming'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {cohort.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        cohort.enrollmentOpen
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {cohort.enrollmentOpen ? 'Open' : 'Closed'}
                      </span>
                      <button
                        onClick={() => handleDuplicateCohort(cohort)}
                        disabled={duplicatingCohort === cohort.id}
                        className="p-1.5 text-[#5f5a55] hover:text-brand-accent rounded disabled:opacity-50"
                        title="Duplicate cohort"
                      >
                        {duplicatingCohort === cohort.id ? (
                          <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenCohortModal(cohort)}
                        className="p-1.5 text-[#5f5a55] hover:text-brand-accent rounded"
                        title="Edit cohort"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmCohort(cohort)}
                        className="p-1.5 text-[#5f5a55] hover:text-red-500 rounded"
                        title="Delete cohort"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {programCohorts.length === 0 && (
                <div className="text-center py-8 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
                  <Calendar className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
                  <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                    No cohorts yet
                  </h3>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
                    Create a cohort to start enrolling users in timed sessions
                  </p>
                  <Button 
                    onClick={() => handleOpenCohortModal()}
                    className="bg-brand-accent hover:bg-brand-accent/90 text-white"
                  >
                    Add First Cohort
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : viewMode === 'enrollments' ? (
          // Enrollments View
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                View and manage enrolled users
              </p>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {programEnrollments.filter(e => e.status === 'active' || e.status === 'upcoming').length} active
              </span>
            </div>

            {loadingEnrollments ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                        <div className="h-3 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                      </div>
                      <div className="h-6 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : programEnrollments.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
                <Users className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
                <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                  No enrollments yet
                </h3>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Share your program invite link to start enrolling users
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {programEnrollments.map((enrollment) => {
                  // Format next call datetime
                  const formatNextCall = (nextCall: NextCallInfo | null | undefined) => {
                    if (!nextCall?.datetime) return null;
                    const date = new Date(nextCall.datetime);
                    return {
                      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                      isRecurring: nextCall.isRecurring,
                    };
                  };
                  
                  const nextCallFormatted = formatNextCall(enrollment.nextCall);
                  
                  return (
                  <div
                    key={enrollment.id}
                    onClick={() => setSelectedClient(enrollment)}
                    className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 cursor-pointer hover:border-brand-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* User Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {enrollment.user?.imageUrl ? (
                          <Image
                            src={enrollment.user.imageUrl}
                            alt={`${enrollment.user.firstName} ${enrollment.user.lastName}`}
                            width={40}
                            height={40}
                            className="rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-brand-accent/20 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-brand-accent" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                            {enrollment.user 
                              ? `${enrollment.user.firstName} ${enrollment.user.lastName}`.trim() || 'Unknown User'
                              : 'Unknown User'}
                          </h3>
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                            {enrollment.user?.email || enrollment.userId}
                          </p>
                        </div>
                      </div>
                      
                      {/* Credits & Next Call - Only for individual programs */}
                      {selectedProgram?.type === 'individual' && (
                        <div className="flex items-center gap-4 flex-shrink-0">
                          {/* Credits Badge */}
                          {enrollment.callCredits && enrollment.callCredits.monthlyAllowance > 0 && (
                            <div 
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-accent/10 border border-brand-accent/20"
                              title={`${enrollment.callCredits.creditsUsedThisMonth} used this month`}
                            >
                              <Phone className="w-3.5 h-3.5 text-brand-accent" />
                              <span className="text-xs font-medium text-brand-accent">
                                {enrollment.callCredits.creditsRemaining}/{enrollment.callCredits.monthlyAllowance}
                              </span>
                            </div>
                          )}
                          
                          {/* Next Call */}
                          <div className="text-right min-w-[100px]">
                            {nextCallFormatted ? (
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                                <div>
                                  <p className="text-xs font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                                    {nextCallFormatted.date}
                                  </p>
                                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] flex items-center gap-1">
                                    {nextCallFormatted.time}
                                    {nextCallFormatted.isRecurring && (
                                      <span title="Recurring"><Repeat className="w-3 h-3" /></span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190]">No call scheduled</p>
                            )}
                          </div>
                          
                          {/* Schedule Call Button */}
                          {(enrollment.status === 'active' || enrollment.status === 'upcoming') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setScheduleCallEnrollment(enrollment); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent text-white rounded-lg text-xs font-medium hover:bg-brand-accent/90 transition-colors"
                              title="Schedule a call"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              Schedule
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Community Badge & Toggle - Only for individual programs with community enabled */}
                        {selectedProgram?.type === 'individual' && selectedProgram?.clientCommunitySquadId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleCommunity(enrollment, !enrollment.joinedCommunity); }}
                            disabled={togglingCommunity === enrollment.id}
                            className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors ${
                              enrollment.joinedCommunity
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                            title={enrollment.joinedCommunity ? 'Remove from community' : 'Add to community'}
                          >
                            <Users className="w-3 h-3" />
                            {togglingCommunity === enrollment.id
                              ? '...'
                              : enrollment.joinedCommunity
                                ? 'Community'
                                : 'Add to community'
                            }
                          </button>
                        )}
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            enrollment.status === 'active' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : enrollment.status === 'upcoming'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : enrollment.status === 'completed'
                              ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {enrollment.status}
                          </span>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                            Enrolled {new Date(enrollment.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {(enrollment.status === 'active' || enrollment.status === 'upcoming') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setRemoveConfirmEnrollment(enrollment); }}
                            className="p-2 text-[#5f5a55] hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Remove from program"
                          >
                            <UserMinus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewMode === 'landing' ? (
          // Landing Page Editor
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Customize your program landing page with compelling content
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsAILandingPageModalOpen(true)}
                  className="border-brand-accent text-brand-accent hover:bg-brand-accent/10 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate with AI
                </Button>
                <Button 
                  onClick={async () => {
                    const success = await handleSaveLandingPage();
                    if (success) {
                      setLandingPageSaved(true);
                    }
                  }}
                  disabled={saving || landingPageSaved}
                  className={`flex items-center gap-2 ${landingPageSaved ? 'bg-[#d1ccc5] dark:bg-[#3d424d] cursor-not-allowed' : 'bg-brand-accent hover:bg-brand-accent/90'} text-white`}
                >
                  {saving ? 'Saving...' : landingPageSaved ? 'Saved' : 'Save'}
                </Button>
                <a
                  href={`/discover/programs/${selectedProgram?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-[#faf8f6] dark:hover:bg-white/5 rounded-lg transition-colors"
                  title="Preview landing page"
                >
                  <ExternalLink className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                </a>
              </div>
            </div>

            {saveError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-albert">{saveError}</p>
              </div>
            )}

            {loadingDetails ? (
              <div className="space-y-6 animate-pulse">
                {/* Landing page form skeleton */}
                <div className="space-y-4">
                  <div className="h-4 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                  <div className="h-10 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
                </div>
                <div className="space-y-4">
                  <div className="h-4 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                  <div className="h-32 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
                </div>
                <div className="space-y-4">
                  <div className="h-4 w-28 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                  <div className="h-48 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
                </div>
              </div>
            ) : (
              <ProgramLandingPageEditor
                formData={landingPageFormData}
                onChange={(data) => {
                  setLandingPageFormData(data);
                  setLandingPageSaved(false);
                }}
                coachTier={currentTier}
                currentProductId={selectedProgram?.id}
                currentProductType="program"
              />
            )}
          </div>
        ) : viewMode === 'referrals' ? (
          // Referrals Settings
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
            {selectedProgram && (
              <ReferralConfigForm
                targetType="program"
                targetId={selectedProgram.id}
                targetName={selectedProgram.name}
                initialConfig={selectedProgram.referralConfig}
                onSave={async (config: ReferralConfig | null) => {
                  const response = await fetch('/api/coach/referral-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      targetType: 'program',
                      targetId: selectedProgram.id,
                      referralConfig: config,
                    }),
                  });
                  
                  if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to save referral config');
                  }
                  
                  // Refresh programs to get updated config
                  await fetchPrograms();
                  // Update selected program with new config
                  if (selectedProgram) {
                    setSelectedProgram({
                      ...selectedProgram,
                      referralConfig: config || undefined,
                    });
                  }
                }}
              />
            )}
          </div>
        ) : null}
      </div>

      {/* Remove Enrollment Confirmation Modal */}
      <Transition appear show={removeConfirmEnrollment !== null} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setRemoveConfirmEnrollment(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 p-6 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all">
                  <Dialog.Title className="font-albert text-xl text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                    Remove from Program?
                  </Dialog.Title>
                  
                  <p className="text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-4">
                    Are you sure you want to remove{' '}
                    <strong>
                      {removeConfirmEnrollment?.user 
                        ? `${removeConfirmEnrollment.user.firstName} ${removeConfirmEnrollment.user.lastName}`.trim()
                        : 'this user'}
                    </strong>{' '}
                    from <strong>{selectedProgram?.name}</strong>?
                  </p>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-4">
                    This will remove them from the program, squad, and chat. This action cannot be undone.
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setRemoveConfirmEnrollment(null)}
                      disabled={removingEnrollment}
                      className="flex-1 border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRemoveEnrollment}
                      disabled={removingEnrollment}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {removingEnrollment ? 'Removing...' : 'Remove'}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Program Create/Edit Modal */}
      <Transition appear show={isProgramModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !saving && setIsProgramModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 p-6 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all max-h-[90vh] overflow-y-auto">
                  <Dialog.Title className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    {editingProgram ? 'Edit Program' : 'Create Program'}
                  </Dialog.Title>
                  {!editingProgram && (
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
                      Programs are time-limited journeys with structured content — perfect for courses, bootcamps, challenges, or coaching cohorts.
                    </p>
                  )}

                  <div className="space-y-4">
                    {/* Type */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                        Program Type
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => !editingProgram && setProgramFormData({ ...programFormData, type: 'group' })}
                          disabled={!!editingProgram}
                          className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                            programFormData.type === 'group'
                              ? 'border-brand-accent bg-brand-accent/5'
                              : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                          } ${editingProgram ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Users className="w-5 h-5 mx-auto mb-1 text-brand-accent" />
                          <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">Group</span>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Cohorts & Squads</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => !editingProgram && setProgramFormData({ ...programFormData, type: 'individual' })}
                          disabled={!!editingProgram}
                          className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                            programFormData.type === 'individual'
                              ? 'border-brand-accent bg-brand-accent/5'
                              : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                          } ${editingProgram ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <User className="w-5 h-5 mx-auto mb-1 text-brand-accent" />
                          <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">1:1</span>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Individual coaching</p>
                        </button>
                      </div>
                      {editingProgram && (
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                          Type cannot be changed after creation
                        </p>
                      )}
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={programFormData.name}
                        onChange={(e) => setProgramFormData({ ...programFormData, name: e.target.value })}
                        placeholder="e.g., Jazz Mastery Program"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Description *
                      </label>
                      <textarea
                        value={programFormData.description}
                        onChange={(e) => setProgramFormData({ ...programFormData, description: e.target.value })}
                        placeholder="What will participants learn and achieve?"
                        rows={3}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
                      />
                    </div>

                    {/* Cover Image - Collapsible */}
                    <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsCoverImageExpanded(!isCoverImageExpanded)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-[#faf8f6] dark:bg-[#1d222b] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            Cover Image *
                          </span>
                          <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                            1200 x 675px
                          </span>
                          {programFormData.coverImageUrl && !isCoverImageExpanded && (
                            <div className="w-10 h-6 rounded overflow-hidden border border-[#e1ddd8] dark:border-[#262b35]">
                              <img src={programFormData.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                        {isCoverImageExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                        )}
                      </button>
                      {isCoverImageExpanded && (
                        <div className="p-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
                          <MediaUpload
                            value={programFormData.coverImageUrl}
                            onChange={(url) => setProgramFormData({ ...programFormData, coverImageUrl: url })}
                            folder="programs"
                            type="image"
                            uploadEndpoint="/api/coach/org-upload-media"
                            hideLabel
                            aspectRatio="16:9"
                          />
                        </div>
                      )}
                    </div>

                    {/* Duration & Price */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Duration (days) *
                        </label>
                        <input
                          type="number"
                          value={programFormData.lengthDays}
                          onChange={(e) => setProgramFormData({ ...programFormData, lengthDays: parseInt(e.target.value) || 30 })}
                          min={1}
                          max={365}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Price ($)
                        </label>
                        <input
                          type="number"
                          value={programFormData.priceInCents / 100}
                          onChange={(e) => setProgramFormData({ ...programFormData, priceInCents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                          min={0}
                          step={0.01}
                          placeholder="0 = Free"
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        />
                      </div>
                    </div>

                    {/* Subscription Settings */}
                    {programFormData.priceInCents > 0 && (() => {
                      // Recurring billing is only allowed for evergreen programs
                      const isEvergreen = editingProgram?.durationType === 'evergreen';
                      const canEnableRecurring = isEvergreen;
                      
                      return (
                      <div className={`space-y-3 p-4 rounded-lg border ${
                        canEnableRecurring 
                          ? 'bg-[#faf8f6] dark:bg-[#1d222b] border-[#e1ddd8] dark:border-[#262b35]'
                          : 'bg-[#faf8f6]/50 dark:bg-[#1d222b]/50 border-[#e1ddd8]/50 dark:border-[#262b35]/50'
                      }`}>
                        <div className="flex items-center gap-2">
                          <BrandedCheckbox
                            checked={programFormData.subscriptionEnabled && canEnableRecurring}
                            onChange={(checked) => {
                              if (canEnableRecurring) {
                                setProgramFormData({ ...programFormData, subscriptionEnabled: checked });
                              }
                            }}
                            disabled={!canEnableRecurring}
                          />
                          <div 
                            className={canEnableRecurring ? "cursor-pointer" : "cursor-not-allowed opacity-60"}
                            onClick={() => {
                              if (canEnableRecurring) {
                                setProgramFormData({ ...programFormData, subscriptionEnabled: !programFormData.subscriptionEnabled });
                              }
                            }}
                          >
                            <span className={`text-sm font-medium font-albert ${
                              canEnableRecurring ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' : 'text-[#a7a39e] dark:text-[#7d8190]'
                            }`}>
                              Enable recurring subscription
                            </span>
                            {!isEvergreen ? (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                Recurring billing is only available for Evergreen programs
                              </p>
                            ) : (
                              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                                Users will be charged automatically each billing period
                              </p>
                            )}
                          </div>
                        </div>

                        {programFormData.subscriptionEnabled && canEnableRecurring && (
                          <div className="mt-3">
                            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                              Billing Interval
                            </label>
                            <div className="flex gap-2">
                              {(['monthly', 'quarterly', 'yearly'] as const).map((interval) => (
                                <button
                                  key={interval}
                                  type="button"
                                  onClick={() => setProgramFormData({ ...programFormData, billingInterval: interval })}
                                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-albert transition-colors ${
                                    programFormData.billingInterval === interval
                                      ? 'bg-brand-accent text-white'
                                      : 'bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:border-brand-accent dark:hover:border-brand-accent'
                                  }`}
                                >
                                  {interval.charAt(0).toUpperCase() + interval.slice(1)}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-2">
                              ${(programFormData.priceInCents / 100).toFixed(2)}/{programFormData.billingInterval === 'monthly' ? 'month' : programFormData.billingInterval === 'quarterly' ? 'quarter' : 'year'}
                            </p>
                          </div>
                        )}
                      </div>
                      );
                    })()}

                    {/* Daily Focus Settings */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Daily Focus Tasks
                      </label>
                      <input
                        type="number"
                        value={programFormData.dailyFocusSlots}
                        onChange={(e) => setProgramFormData({ ...programFormData, dailyFocusSlots: Math.max(1, Math.min(4, parseInt(e.target.value) || 2)) })}
                        min={1}
                        max={4}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                      <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1">
                        How many focus tasks this program contributes per day (1-4). Extra tasks go to users&apos; backlog.
                      </p>
                    </div>

                    {/* Weekend Settings */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        <BrandedCheckbox
                          checked={programFormData.includeWeekends}
                          onChange={(checked) => setProgramFormData({ ...programFormData, includeWeekends: checked })}
                        />
                        <span 
                          className="cursor-pointer" 
                          onClick={() => setProgramFormData({ ...programFormData, includeWeekends: !programFormData.includeWeekends })}
                        >
                          Include weekends
                        </span>
                      </div>
                      {!programFormData.includeWeekends && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-800 dark:text-amber-300 font-albert">
                            <p className="font-medium">Weekends excluded</p>
                            <p className="text-xs mt-1">
                              Tasks will only be assigned on weekdays (Mon-Fri). If a cohort starts on a weekend, Day 1 will begin on Monday.
                              A {programFormData.lengthDays}-day program will have approximately {Math.ceil(programFormData.lengthDays * 5 / 7)} task days.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Group-specific settings */}
                    {programFormData.type === 'group' && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                          Squad Settings
                        </h4>
                        <div>
                          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                            Max members per squad
                          </label>
                          <input
                            type="number"
                            value={programFormData.squadCapacity}
                            onChange={(e) => setProgramFormData({ ...programFormData, squadCapacity: parseInt(e.target.value) || 10 })}
                            min={2}
                            max={100}
                            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                          />
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                            New squads auto-created when this limit is reached
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          <BrandedCheckbox
                            checked={programFormData.coachInSquads}
                            onChange={(checked) => setProgramFormData({ 
                              ...programFormData, 
                              coachInSquads: checked,
                              // Clear assigned coaches when switching to "join as coach"
                              assignedCoachIds: checked ? [] : programFormData.assignedCoachIds,
                            })}
                          />
                          <span className="cursor-pointer" onClick={() => setProgramFormData({ 
                              ...programFormData, 
                              coachInSquads: !programFormData.coachInSquads,
                              assignedCoachIds: !programFormData.coachInSquads ? [] : programFormData.assignedCoachIds,
                            })}>Join squads as coach</span>
                        </div>
                        
                        {/* Coach Selection (when not joining as coach) */}
                        {!programFormData.coachInSquads && (
                          <div className="mt-4 space-y-2">
                            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                              Assign coaches to squads
                            </label>
                            <CoachSelector
                              coaches={availableCoaches}
                              value={programFormData.assignedCoachIds}
                              onChange={(coachIds) => setProgramFormData({
                                ...programFormData,
                                assignedCoachIds: coachIds,
                              })}
                              loading={loadingCoaches}
                              placeholder="Select coaches to assign..."
                            />
                            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                              Coaches are assigned in round-robin order (Coach A → Squad 1, Coach B → Squad 2, etc.)
                            </p>
                          </div>
                        )}
                        
                        {/* Apply to existing squads (only when editing) */}
                        {editingProgram && (
                          <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-4">
                            <BrandedCheckbox
                              checked={programFormData.applyCoachesToExistingSquads}
                              onChange={(checked) => setProgramFormData({ ...programFormData, applyCoachesToExistingSquads: checked })}
                            />
                            <span className="cursor-pointer" onClick={() => setProgramFormData({ ...programFormData, applyCoachesToExistingSquads: !programFormData.applyCoachesToExistingSquads })}>Apply coach changes to existing squads</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Individual program settings */}
                    {programFormData.type === 'individual' && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                          Start Date Settings
                        </h4>
                        <div>
                          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                            Default Start Date
                          </label>
                          <input
                            type="date"
                            value={programFormData.defaultStartDate}
                            onChange={(e) => setProgramFormData({ ...programFormData, defaultStartDate: e.target.value })}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                          />
                          <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1">
                            Leave empty for immediate start (users begin when they enroll)
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <BrandedCheckbox
                            checked={programFormData.allowCustomStartDate}
                            onChange={(checked) => setProgramFormData({ 
                              ...programFormData, 
                              allowCustomStartDate: checked 
                            })}
                          />
                          <div 
                            className="cursor-pointer" 
                            onClick={() => setProgramFormData({ 
                              ...programFormData, 
                              allowCustomStartDate: !programFormData.allowCustomStartDate 
                            })}
                          >
                            <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                              Allow users to select their own start date
                            </span>
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                              When enabled, users can choose when to start the program during enrollment
                            </p>
                          </div>
                        </div>

                        <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert pt-2">
                          Community Settings
                        </h4>
                        <div className="flex items-start gap-2">
                          <BrandedCheckbox
                            checked={programFormData.clientCommunityEnabled}
                            onChange={(checked) => setProgramFormData({ 
                              ...programFormData, 
                              clientCommunityEnabled: checked 
                            })}
                          />
                          <div 
                            className="cursor-pointer" 
                            onClick={() => setProgramFormData({ 
                              ...programFormData, 
                              clientCommunityEnabled: !programFormData.clientCommunityEnabled 
                            })}
                          >
                            <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                              Enable Client Community
                            </span>
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                              Create a shared group chat for all clients in this program. Clients can opt in during enrollment.
                            </p>
                          </div>
                        </div>

                      {/* Coaching Call Credits */}
                      <div>
                        <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-brand-accent" />
                          Monthly Call Credits
                        </h4>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={programFormData.callCreditsPerMonth}
                            onChange={(e) => setProgramFormData({ 
                              ...programFormData, 
                              callCreditsPerMonth: Math.max(0, parseInt(e.target.value) || 0)
                            })}
                            className="w-20 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-center"
                          />
                          <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                            calls per month
                          </span>
                        </div>
                        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1.5">
                          Set to 0 for unlimited or pay-per-call pricing. Clients will see their remaining credits.
                        </p>
                      </div>
                    </div>
                    )}

                    {/* Default Habits */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          Default Habits
                        </label>
                        <div className="flex items-center gap-2">
                          {editingProgram && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={syncHabitsToUsers}
                              disabled={syncingHabits || programFormData.defaultHabits.length === 0}
                              className="text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] text-xs"
                            >
                              {syncingHabits ? 'Syncing...' : 'Sync to Users'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={addProgramHabit}
                            className="text-brand-accent hover:text-brand-accent/90"
                          >
                            + Add
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {programFormData.defaultHabits.map((habit, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={habit.title}
                              onChange={(e) => updateProgramHabit(index, { title: e.target.value })}
                              placeholder="Habit title..."
                              className="flex-1 px-3 py-1.5 border border-[#e1ddd8] dark:border-[#262b35] rounded bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                            />
                            <button
                              onClick={() => removeProgramHabit(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      {syncResult && (
                        <div className={`mt-2 p-2 rounded text-xs font-albert ${
                          syncResult.success 
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        }`}>
                          {syncResult.message}
                        </div>
                      )}
                    </div>

                    {/* Completion Settings */}
                    <div className="space-y-4 border-t border-[#e1ddd8] dark:border-[#262b35] pt-4">
                      <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-brand-accent" />
                        Completion Settings
                      </h4>
                      <p className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                        Configure what happens when a user completes this program
                      </p>
                      
                      {/* Confetti toggle */}
                      <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        <BrandedCheckbox
                          checked={programFormData.completionConfig.showConfetti !== false}
                          onChange={(checked) => setProgramFormData({ 
                            ...programFormData, 
                            completionConfig: { ...programFormData.completionConfig, showConfetti: checked } 
                          })}
                        />
                        <span 
                          className="cursor-pointer" 
                          onClick={() => setProgramFormData({ 
                            ...programFormData, 
                            completionConfig: { ...programFormData.completionConfig, showConfetti: !programFormData.completionConfig.showConfetti } 
                          })}
                        >
                          Show confetti celebration
                        </span>
                      </div>
                      
                      {/* Upsell program selector */}
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Upsell Program (optional)
                        </label>
                        <select
                          value={programFormData.completionConfig.upsellProgramId || ''}
                          onChange={(e) => setProgramFormData({ 
                            ...programFormData, 
                            completionConfig: { 
                              ...programFormData.completionConfig, 
                              upsellProgramId: e.target.value || undefined 
                            } 
                          })}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        >
                          <option value="">No upsell</option>
                          {programs
                            .filter(p => p.id !== editingProgram?.id && p.isActive)
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.priceInCents === 0 ? 'Free' : `$${(p.priceInCents / 100).toFixed(2)}`})
                              </option>
                            ))
                          }
                        </select>
                        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1">
                          Offer another program when users complete this one
                        </p>
                      </div>
                      
                      {/* Custom headline & description (only show if upsell selected) */}
                      {programFormData.completionConfig.upsellProgramId && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                              Upsell Headline
                            </label>
                            <input
                              type="text"
                              value={programFormData.completionConfig.upsellHeadline || ''}
                              onChange={(e) => setProgramFormData({ 
                                ...programFormData, 
                                completionConfig: { ...programFormData.completionConfig, upsellHeadline: e.target.value } 
                              })}
                              placeholder="Keep the momentum going!"
                              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                              Upsell Description
                            </label>
                            <textarea
                              value={programFormData.completionConfig.upsellDescription || ''}
                              onChange={(e) => setProgramFormData({ 
                                ...programFormData, 
                                completionConfig: { ...programFormData.completionConfig, upsellDescription: e.target.value } 
                              })}
                              placeholder="Continue your journey with our advanced program..."
                              rows={2}
                              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Status checkboxes */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        <BrandedCheckbox
                          checked={programFormData.isActive}
                          onChange={(checked) => setProgramFormData({ ...programFormData, isActive: checked })}
                        />
                        <span className="cursor-pointer" onClick={() => setProgramFormData({ ...programFormData, isActive: !programFormData.isActive })}>Active</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        <BrandedCheckbox
                          checked={programFormData.isPublished}
                          onChange={(checked) => setProgramFormData({ ...programFormData, isPublished: checked })}
                        />
                        <span className="cursor-pointer" onClick={() => setProgramFormData({ ...programFormData, isPublished: !programFormData.isPublished })}>Public (visible in Discover)</span>
                      </div>
                    </div>

                    {saveError && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-600 dark:text-red-400 font-albert">{saveError}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setIsProgramModalOpen(false)}
                      disabled={saving}
                      className="border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveProgram}
                      disabled={saving || !programFormData.name || !programFormData.description || !programFormData.coverImageUrl}
                      className="bg-brand-accent hover:bg-brand-accent/90 text-white"
                    >
                      {saving ? 'Saving...' : (editingProgram ? 'Update' : 'Create')}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Cohort Create/Edit Modal */}
      <Transition appear show={isCohortModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !saving && setIsCohortModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 p-6 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all">
                  <Dialog.Title className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
                    {editingCohort ? 'Edit Cohort' : 'Add Cohort'}
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={cohortFormData.name}
                        onChange={(e) => setCohortFormData({ ...cohortFormData, name: e.target.value })}
                        placeholder="e.g., March 2025"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Start Date *
                        </label>
                        <input
                          type="date"
                          value={cohortFormData.startDate}
                          onChange={(e) => {
                            const startDate = new Date(e.target.value);
                            const endDate = new Date(startDate);
                            endDate.setDate(endDate.getDate() + (selectedProgram?.lengthDays || 30) - 1);
                            setCohortFormData({ 
                              ...cohortFormData, 
                              startDate: e.target.value,
                              endDate: endDate.toISOString().split('T')[0],
                            });
                          }}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={cohortFormData.endDate}
                          onChange={(e) => setCohortFormData({ ...cohortFormData, endDate: e.target.value })}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Max Enrollment (optional)
                      </label>
                      <input
                        type="number"
                        value={cohortFormData.maxEnrollment || ''}
                        onChange={(e) => setCohortFormData({ ...cohortFormData, maxEnrollment: parseInt(e.target.value) || null })}
                        min={1}
                        placeholder="No limit"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      <input
                        type="checkbox"
                        checked={cohortFormData.enrollmentOpen}
                        onChange={(e) => setCohortFormData({ ...cohortFormData, enrollmentOpen: e.target.checked })}
                        className="rounded"
                      />
                      Enrollment open
                    </label>

                    {/* After Program Ends Setting */}
                    <div className="pt-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                        After program ends
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert cursor-pointer">
                          <input
                            type="radio"
                            name="afterProgramEnds"
                            checked={!cohortFormData.convertSquadsToCommunity}
                            onChange={() => setCohortFormData({ ...cohortFormData, convertSquadsToCommunity: false })}
                            className="text-brand-accent"
                          />
                          Close squad after grace period
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert cursor-pointer">
                          <input
                            type="radio"
                            name="afterProgramEnds"
                            checked={cohortFormData.convertSquadsToCommunity}
                            onChange={() => setCohortFormData({ ...cohortFormData, convertSquadsToCommunity: true })}
                            className="text-brand-accent"
                          />
                          Convert to squad
                        </label>
                      </div>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
                        Squads remain active for alumni to stay connected
                      </p>
                    </div>

                    {saveError && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-600 dark:text-red-400 font-albert">{saveError}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setIsCohortModalOpen(false)}
                      disabled={saving}
                      className="border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveCohort}
                      disabled={saving || !cohortFormData.name || !cohortFormData.startDate}
                      className="bg-brand-accent hover:bg-brand-accent/90 text-white"
                    >
                      {saving ? 'Saving...' : (editingCohort ? 'Update' : 'Create')}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Program Confirmation Modal */}
      <Transition appear show={deleteConfirmProgram !== null} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setDeleteConfirmProgram(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 p-6 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all">
                  <Dialog.Title className="font-albert text-xl text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                    Delete Program?
                  </Dialog.Title>
                  
                  <p className="text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-4">
                    Are you sure you want to delete <strong>{deleteConfirmProgram?.name}</strong>? 
                    This will delete all cohorts, days, and content. This action cannot be undone.
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteConfirmProgram(null)}
                      disabled={deleting}
                      className="flex-1 border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDeleteProgram}
                      disabled={deleting}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Cohort Confirmation Modal */}
      <Transition appear show={deleteConfirmCohort !== null} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setDeleteConfirmCohort(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 p-6 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all">
                  <Dialog.Title className="font-albert text-xl text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                    Delete Cohort?
                  </Dialog.Title>
                  
                  <p className="text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-4">
                    Are you sure you want to delete <strong>{deleteConfirmCohort?.name}</strong>? 
                    This will delete all associated squads and enrollments. This action cannot be undone.
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteConfirmCohort(null)}
                      disabled={deleting}
                      className="flex-1 border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDeleteCohort}
                      disabled={deleting}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* New Program Modal (Template Selection) */}
      <NewProgramModal
        isOpen={isNewProgramModalOpen}
        onClose={() => setIsNewProgramModalOpen(false)}
        onCreateFromScratch={(options) => {
          setIsNewProgramModalOpen(false);
          setEditingProgram(null);
          pendingNumModulesRef.current = options?.numModules || 1;
          if (!isDemoMode) fetchCoaches();
          setProgramFormData({
            name: '',
            type: 'group',
            description: '',
            coverImageUrl: '',
            lengthDays: 30,
            priceInCents: 0,
            currency: 'usd',
            subscriptionEnabled: false,
            billingInterval: 'monthly',
            squadCapacity: 10,
            coachInSquads: true,
            assignedCoachIds: [],
            isActive: true,
            isPublished: false,
            defaultHabits: [],
            applyCoachesToExistingSquads: false,
            clientCommunityEnabled: false,
            dailyFocusSlots: 2,
            includeWeekends: true,
            defaultStartDate: '',
            allowCustomStartDate: true,
            completionConfig: {
              showConfetti: true,
              upsellProgramId: undefined,
              upsellHeadline: '',
              upsellDescription: '',
            },
            callCreditsPerMonth: 0,
            taskDistribution: 'spread',
          });
          setIsProgramModalOpen(true);
        }}
        onProgramCreated={(programId) => {
          if (isDemoMode) return; // Demo mode creates handled by onDemoCreate
          fetchPrograms();
          // Select the new program
          const selectProgram = async () => {
            const response = await fetch(`${apiBasePath}/${programId}`);
            if (response.ok) {
              const data = await response.json();
              setSelectedProgram(data.program);
              setProgramDays(data.days || []);
              setProgramCohorts(data.cohorts || []);
              handleViewModeChange('days');
            }
          };
          selectProgram();
        }}
        demoMode={isDemoMode}
        onDemoCreate={(programData) => {
          // Create program in demo session
          const programId = demoSession.addProgram({
            name: programData.name,
            slug: programData.name.toLowerCase().replace(/\s+/g, '-'),
            description: '',
            type: programData.type,
            durationDays: programData.duration,
            priceInCents: 0,
            isPublished: false,
            enrolledCount: 0,
            activeEnrollments: 0,
            completedEnrollments: 0,
            totalRevenue: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          // Select the new program
          const newProgram = demoSession.programs.find(p => p.id === programId);
          if (newProgram) {
            setSelectedProgram({
              id: newProgram.id,
              name: newProgram.name,
              slug: newProgram.slug,
              description: newProgram.description,
              type: newProgram.type,
              lengthDays: newProgram.durationDays,
              priceInCents: newProgram.priceInCents,
              currency: 'USD',
              isActive: true,
              isPublished: newProgram.isPublished,
              organizationId: 'demo-org',
              createdAt: newProgram.createdAt,
              updatedAt: newProgram.updatedAt,
              totalEnrollments: newProgram.enrolledCount ?? 0,
              activeEnrollments: newProgram.activeEnrollments ?? 0,
            });
            const sessionDays = demoSession.getProgramDays(programId);
            const nowIso = new Date().toISOString();
            setProgramDays(sessionDays.map(dd => ({
              id: dd.id,
              programId: dd.programId,
              dayIndex: dd.dayIndex,
              title: dd.title,
              summary: dd.summary,
              dailyPrompt: dd.dailyPrompt,
              tasks: dd.tasks.map(t => ({ label: t.label, type: t.type, isPrimary: t.isPrimary, estimatedMinutes: t.estimatedMinutes, notes: t.notes })),
              habits: dd.habits.map(h => ({ 
                title: h.title, 
                description: h.description, 
                frequency: (h.frequency === 'weekly' ? 'weekday' : h.frequency) as 'daily' | 'weekday' | 'custom',
              })),
              createdAt: nowIso,
              updatedAt: nowIso,
            })));
            setProgramCohorts([]);
            handleViewModeChange('days');
          }
          setIsNewProgramModalOpen(false);
        }}
      />

      {/* Enrollment Settings Modal */}
      <EnrollmentSettingsModal
        open={isEnrollmentSettingsOpen}
        onOpenChange={setIsEnrollmentSettingsOpen}
        organizationId=""
        currentRules={enrollmentRules}
        onSave={(rules) => setEnrollmentRules(rules)}
      />
      
      {/* AI Program Content Modal */}
      <AIHelperModal
        isOpen={isAIProgramContentModalOpen}
        onClose={() => setIsAIProgramContentModalOpen(false)}
        title="Fill Program with AI"
        description="Generate tasks and habits for all program days"
        useCase="PROGRAM_CONTENT"
        context={{
          programName: selectedProgram?.name,
          duration: selectedProgram?.lengthDays,
          structure: 'days',
          programType: selectedProgram?.type,
          niche: selectedProgram?.description?.slice(0, 100),
        } as AIGenerationContext}
        onApply={handleApplyAIProgramContent}
        hasExistingContent={programDays.length > 0}
        overwriteWarning="This will replace all existing program days, tasks, and habits."
      />
      
      {/* AI Landing Page Modal */}
      <AIHelperModal
        isOpen={isAILandingPageModalOpen}
        onClose={() => setIsAILandingPageModalOpen(false)}
        title="Generate Landing Page"
        description="Create compelling landing page copy"
        useCase="LANDING_PAGE_PROGRAM"
        context={{
          programName: selectedProgram?.name,
          duration: selectedProgram?.lengthDays,
          programType: selectedProgram?.type,
          niche: selectedProgram?.description?.slice(0, 100),
          price: selectedProgram?.priceInCents,
          currency: selectedProgram?.currency,
        } as AIGenerationContext}
        onApply={handleApplyAILandingPage}
        hasExistingContent={!!(landingPageFormData.coachBio || landingPageFormData.keyOutcomes.length > 0)}
        overwriteWarning="This will replace your existing landing page content."
      />

      {/* Week Fill Modal */}
      {weekToFill && selectedProgram && (
        <WeekFillModal
          isOpen={isWeekFillModalOpen}
          onClose={() => {
            setIsWeekFillModalOpen(false);
            setWeekToFill(null);
          }}
          programId={selectedProgram.id}
          week={weekToFill}
          // Pass client context when in client mode for 1:1 programs
          enrollmentId={clientViewContext.mode === 'client' ? clientViewContext.enrollmentId : undefined}
          clientUserId={clientViewContext.mode === 'client' ? clientViewContext.userId : undefined}
          onApply={async (updates) => {
            // Determine if we're updating a client week or template week
            const isClientMode = clientViewContext.mode === 'client' && selectedProgram.type === 'individual';
            const endpoint = isClientMode
              ? `${apiBasePath}/${selectedProgram.id}/client-weeks/${weekToFill.id}`
              : `${apiBasePath}/${selectedProgram.id}/weeks/${weekToFill.id}`;
            
            const res = await fetch(endpoint, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            });
            if (res.ok) {
              const data = await res.json();
              if (isClientMode) {
                // Update client weeks state
                setClientWeeks(prev => prev.map(w => w.id === weekToFill.id ? data.clientWeek || data.week : w));
              } else {
                // Update template weeks state
                setProgramWeeks(prev => prev.map(w => w.id === weekToFill.id ? data.week : w));
              }
            }
          }}
        />
      )}

      {/* Limit Reached Modal */}
      <LimitReachedModal {...modalProps} />

      {/* Schedule Call Modal for Enrollments */}
      {scheduleCallEnrollment && (
        <ScheduleCallModal
          isOpen={scheduleCallEnrollment !== null}
          onClose={() => setScheduleCallEnrollment(null)}
          clientId={scheduleCallEnrollment.userId}
          clientName={
            scheduleCallEnrollment.user 
              ? `${scheduleCallEnrollment.user.firstName} ${scheduleCallEnrollment.user.lastName}`.trim() || 'Client'
              : 'Client'
          }
          onSuccess={() => {
            setScheduleCallEnrollment(null);
            // Refresh enrollments to update next call data
            if (selectedProgram) {
              fetchProgramEnrollments(selectedProgram.id);
            }
          }}
        />
      )}

      {/* Client Detail Slide-over */}
      {selectedClient && (
        <ClientDetailSlideOver
          isOpen={selectedClient !== null}
          onClose={() => setSelectedClient(null)}
          clientId={selectedClient.userId}
          clientName={
            selectedClient.user
              ? `${selectedClient.user.firstName} ${selectedClient.user.lastName}`.trim() || 'Client'
              : 'Client'
          }
        />
      )}

      {/* Program Settings Modal */}
      <ProgramSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        taskDistribution={selectedProgram?.taskDistribution || 'spread'}
        onTaskDistributionChange={handleTaskDistributionChange}
        isSaving={saving}
      />

    </>
  );
}

