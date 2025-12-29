'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import type { Program, ProgramDay, ProgramCohort, ProgramTaskTemplate, ProgramHabitTemplate, ProgramWithStats, ProgramEnrollment, ProgramFeature, ProgramTestimonial, ProgramFAQ, ReferralConfig } from '@/types';
import { ProgramLandingPageEditor } from './ProgramLandingPageEditor';
import { Button } from '@/components/ui/button';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Plus, Users, User, Calendar, DollarSign, Clock, Eye, EyeOff, Trash2, Settings, ChevronRight, UserMinus, FileText, LayoutTemplate, Globe, ExternalLink, Copy, Target, X, ListTodo, Repeat, ChevronDown, ChevronUp, Gift, Sparkles, AlertTriangle, Edit2 } from 'lucide-react';
import { AIHelperModal } from '@/components/ai';
import type { ProgramContentDraft, LandingPageDraft, AIGenerationContext } from '@/lib/ai/types';
import { ReferralConfigForm } from '@/components/coach/referrals';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { NewProgramModal } from './NewProgramModal';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { CoachSelector } from '@/components/coach/CoachSelector';

// Enrollment with user info
interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    imageUrl: string;
  };
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
  const [programs, setPrograms] = useState<ProgramWithStats[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithStats | null>(null);
  const [programDays, setProgramDays] = useState<ProgramDay[]>([]);
  const [programCohorts, setProgramCohorts] = useState<ProgramCohort[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1])); // Week 1 expanded by default
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Tenant required state - shown when accessing from platform domain
  const [tenantRequired, setTenantRequired] = useState<{
    tenantUrl: string | null;
    subdomain: string | null;
  } | null>(null);
  
  // View mode: 'list' | 'days' | 'cohorts' | 'enrollments' | 'landing' | 'referrals'
  const [viewMode, setViewMode] = useState<'list' | 'days' | 'cohorts' | 'enrollments' | 'landing' | 'referrals'>('list');
  
  // Enrollments state
  const [programEnrollments, setProgramEnrollments] = useState<EnrollmentWithUser[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [removeConfirmEnrollment, setRemoveConfirmEnrollment] = useState<EnrollmentWithUser | null>(null);
  const [removingEnrollment, setRemovingEnrollment] = useState(false);
  const [togglingCommunity, setTogglingCommunity] = useState<string | null>(null); // enrollment ID being toggled
  
  // Modal states
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isNewProgramModalOpen, setIsNewProgramModalOpen] = useState(false);
  const [isCohortModalOpen, setIsCohortModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editingCohort, setEditingCohort] = useState<ProgramCohort | null>(null);
  
  // AI Helper modals
  const [isAIProgramContentModalOpen, setIsAIProgramContentModalOpen] = useState(false);
  const [isAILandingPageModalOpen, setIsAILandingPageModalOpen] = useState(false);
  
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
  }>({
    name: '',
    type: 'group',
    description: '',
    coverImageUrl: '',
    lengthDays: 30,
    priceInCents: 0,
    currency: 'usd',
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
  }>({
    title: '',
    summary: '',
    dailyPrompt: '',
    tasks: [],
    habits: [],
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

  const fetchPrograms = useCallback(async () => {
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
  }, [apiBasePath]);

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

  const fetchProgramDetails = useCallback(async (programId: string) => {
    try {
      setLoadingDetails(true);

      const response = await fetch(`${apiBasePath}/${programId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch program details');
      }

      const data = await response.json();
      setProgramDays(data.days || []);
      setProgramCohorts(data.cohorts || []);
      
      // Load first day data
      const day1 = data.days?.find((d: ProgramDay) => d.dayIndex === 1);
      if (day1) {
        setDayFormData({
          title: day1.title || '',
          summary: day1.summary || '',
          dailyPrompt: day1.dailyPrompt || '',
          tasks: day1.tasks || [],
          habits: day1.habits || [],
        });
      } else {
        setDayFormData({ title: '', summary: '', dailyPrompt: '', tasks: [], habits: [] });
      }
      
      // Load landing page data from program
      const program = data.program as Program;
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

  useEffect(() => {
    if (selectedProgram) {
      // Only reset to day 1 if selecting a DIFFERENT program, not when updating same program
      const isNewSelection = prevProgramId.current !== selectedProgram.id;
      
      if (isNewSelection) {
        fetchProgramDetails(selectedProgram.id);
        setSelectedDayIndex(1);
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

  // Load day data when day index changes
  useEffect(() => {
    if (!selectedProgram || !programDays.length) return;
    
    const day = programDays.find(d => d.dayIndex === selectedDayIndex);
    if (day) {
      setDayFormData({
        title: day.title || '',
        summary: day.summary || '',
        dailyPrompt: day.dailyPrompt || '',
        tasks: day.tasks || [],
        habits: day.habits || [],
      });
    } else {
      setDayFormData({ title: '', summary: '', dailyPrompt: '', tasks: [], habits: [] });
    }
  }, [selectedDayIndex, programDays, selectedProgram]);

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
      });
    }
    setSaveError(null);
    setIsProgramModalOpen(true);
  };

  const handleOpenCohortModal = (cohort?: ProgramCohort) => {
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
          setViewMode('days');
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
    
    try {
      setSaving(true);
      setSaveError(null);

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
        setViewMode('list');
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

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
            <div className="h-4 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          </div>
          <div className="h-10 w-36 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
        </div>
        {/* Program cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
              <div className="h-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                  <div className="h-5 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                </div>
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
          className="mt-4 bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-[600px]">
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
              <Button 
                onClick={() => setIsNewProgramModalOpen(true)}
                className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Program
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode('list')}
                  className="text-[#a07855] dark:text-[#b8896a] hover:text-[#8c6245] font-albert text-sm"
                >
                  ← Back to Programs
                </button>
                <span className="text-[#e1ddd8] dark:text-[#262b35]">|</span>
                <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {selectedProgram?.name}
                </h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedProgram?.type === 'group' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                }`}>
                  {selectedProgram?.type === 'group' ? 'Group' : '1:1'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('days')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-albert ${
                    viewMode === 'days'
                      ? 'bg-[#a07855]/10 text-[#a07855] dark:text-[#b8896a]'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                  }`}
                >
                  Content
                </button>
                {selectedProgram?.type === 'group' && (
                  <button
                    onClick={() => setViewMode('cohorts')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-albert ${
                      viewMode === 'cohorts'
                        ? 'bg-[#a07855]/10 text-[#a07855] dark:text-[#b8896a]'
                        : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                    }`}
                  >
                    Cohorts
                  </button>
                )}
                <button
                  onClick={() => setViewMode('enrollments')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-albert ${
                    viewMode === 'enrollments'
                      ? 'bg-[#a07855]/10 text-[#a07855] dark:text-[#b8896a]'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                  }`}
                >
                  Enrollments
                </button>
                <button
                  onClick={() => setViewMode('landing')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-albert flex items-center gap-1.5 ${
                    viewMode === 'landing'
                      ? 'bg-[#a07855]/10 text-[#a07855] dark:text-[#b8896a]'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Landing Page
                </button>
                <button
                  onClick={() => setViewMode('referrals')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-albert flex items-center gap-1.5 ${
                    viewMode === 'referrals'
                      ? 'bg-[#a07855]/10 text-[#a07855] dark:text-[#b8896a]'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  Referrals
                </button>
              </div>
            </>
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#a07855] dark:bg-[#b8896a] text-white rounded-xl hover:bg-[#8c6245] dark:hover:bg-[#a07855] transition-colors font-albert font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Go to {tenantRequired.subdomain}.growthaddicts.com
              </a>
            ) : (
              <p className="text-[#a7a39e] dark:text-[#7d8190] font-albert text-sm">
                Your organization domain is not yet configured. Please contact support.
              </p>
            )}
          </div>
        )}

        {/* Content */}
        {viewMode === 'list' && !tenantRequired ? (
          // Programs List
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((program) => (
              <div
                key={program.id}
                className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                onClick={() => {
                  setSelectedProgram(program);
                  setViewMode('days');
                }}
              >
                {/* Cover Image */}
                <div className="h-32 bg-gradient-to-br from-[#a07855]/20 to-[#8c6245]/10 relative">
                  {program.coverImageUrl && (
                    <img 
                      src={program.coverImageUrl} 
                      alt={program.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {program.isPublished ? (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Live
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-500 text-white text-xs rounded-full flex items-center gap-1">
                        <EyeOff className="w-3 h-3" /> Draft
                      </span>
                    )}
                  </div>
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      program.type === 'group' 
                        ? 'bg-blue-500 text-white'
                        : 'bg-purple-500 text-white'
                    }`}>
                      {program.type === 'group' ? <Users className="w-3 h-3 inline mr-1" /> : <User className="w-3 h-3 inline mr-1" />}
                      {program.type === 'group' ? 'Group' : '1:1'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                    {program.name}
                  </h3>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert line-clamp-2 mb-3">
                    {program.description || 'No description'}
                  </p>
                  
                  <div className="flex items-center gap-3 text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {program.lengthDays} days
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {formatPrice(program.priceInCents)}
                    </span>
                    {program.type === 'group' && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {program.squadCapacity}/squad
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{program.activeEnrollments}</span> active
                      {program.cohortCount !== undefined && (
                        <> · <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{program.cohortCount}</span> cohorts</>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProgramModal(program);
                        }}
                        className="p-1.5 text-[#5f5a55] hover:text-[#a07855] dark:text-[#b8896a] rounded"
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
                        className="p-1.5 text-[#5f5a55] hover:text-[#a07855] dark:text-[#b8896a] rounded disabled:opacity-50"
                        title="Duplicate program"
                      >
                        {duplicatingProgram === program.id ? (
                          <div className="w-4 h-4 border-2 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmProgram(program);
                        }}
                        className="p-1.5 text-[#5f5a55] hover:text-red-500 rounded"
                        title="Delete program"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-[#5f5a55]" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {programs.length === 0 && (
              <div className="col-span-full text-center py-12">
                <div className="w-16 h-16 bg-[#a07855]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LayoutTemplate className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]" />
                </div>
                <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  No programs yet
                </h3>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
                  Choose from templates or build from scratch
                </p>
                <Button 
                  onClick={() => setIsNewProgramModalOpen(true)}
                  className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
                >
                  Create Program
                </Button>
              </div>
            )}
          </div>
        ) : viewMode === 'days' ? (
          // Day Editor
          <div className="flex gap-6">
            {/* Day Selector */}
            <div className="w-48 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Program Days
                </h3>
              </div>
              
              {/* Fill with AI Button */}
              <button
                onClick={() => setIsAIProgramContentModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-3 bg-gradient-to-r from-[#a07855] to-[#8c6245] dark:from-[#b8896a] dark:to-[#a07855] text-white text-sm font-medium rounded-lg hover:from-[#8c6245] hover:to-[#7a5639] dark:hover:from-[#a07855] dark:hover:to-[#8c6245] transition-all shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                Fill with AI
              </button>
              
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {(() => {
                  const totalDays = selectedProgram?.lengthDays || 30;
                  const includeWeekends = selectedProgram?.includeWeekends !== false;
                  const daysPerWeek = includeWeekends ? 7 : 5;
                  const numWeeks = Math.ceil(totalDays / daysPerWeek);
                  
                  return Array.from({ length: numWeeks }, (_, weekIdx) => {
                    const weekNum = weekIdx + 1;
                    const startDay = weekIdx * daysPerWeek + 1;
                    const endDay = Math.min(startDay + daysPerWeek - 1, totalDays);
                    const isExpanded = expandedWeeks.has(weekNum);
                    
                    // Check if any day in this week has content
                    const weekHasContent = programDays.some(d => 
                      d.dayIndex >= startDay && d.dayIndex <= endDay && (d.tasks?.length > 0 || d.title)
                    );
                    // Count days with content in this week
                    const daysWithContent = Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i)
                      .filter(day => programDays.some(d => d.dayIndex === day && (d.tasks?.length > 0 || d.title)))
                      .length;
                    const totalDaysInWeek = endDay - startDay + 1;
                    
                    return (
                      <div key={weekNum} className="mb-1">
                        {/* Week Header */}
                        <button
                          onClick={() => {
                            setExpandedWeeks(prev => {
                              const next = new Set(prev);
                              if (next.has(weekNum)) {
                                next.delete(weekNum);
                              } else {
                                next.add(weekNum);
                              }
                              return next;
                            });
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium font-albert bg-[#faf8f6] dark:bg-[#1e222a] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                            )}
                            <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">Week {weekNum}</span>
                          </div>
                          <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                            {daysWithContent}/{totalDaysInWeek}
                            {weekHasContent && <span className="text-green-500 ml-1">✓</span>}
                          </span>
                        </button>
                        
                        {/* Days in Week */}
                        {isExpanded && (
                          <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-[#e1ddd8] dark:border-[#262b35] pl-2">
                            {Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i).map((day) => {
                              const hasContent = programDays.some(d => d.dayIndex === day && (d.tasks?.length > 0 || d.title));
                              return (
                                <button
                                  key={day}
                                  onClick={() => setSelectedDayIndex(day)}
                                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-albert transition-colors ${
                                    selectedDayIndex === day
                                      ? 'bg-[#a07855]/10 text-[#a07855] dark:text-[#b8896a]'
                                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                                  }`}
                                >
                                  Day {day} {hasContent && <span className="text-green-500">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Day Content */}
            <div className="flex-1 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
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
              ) : (
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
                                ? 'bg-[#a07855]/15 text-[#a07855] dark:bg-[#b8896a]/20 dark:text-[#b8896a]' 
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
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#a07855] dark:text-[#b8896a] hover:border-[#a07855] dark:border-[#b8896a]/50 hover:bg-[#a07855]/5 dark:hover:bg-[#a07855]/10 transition-all duration-200 font-albert font-medium text-sm"
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
                            <div className="w-5 h-5 rounded-full border-2 border-dashed border-[#a07855] dark:border-[#b8896a]/40 dark:border-[#b8896a]/40 flex-shrink-0" />
                            
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
                                className="appearance-none pl-3 pr-8 py-1.5 bg-[#f3f1ef] dark:bg-[#1d222b] border-none rounded-lg text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30"
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
                          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#a07855] dark:text-[#b8896a] hover:border-[#a07855] dark:border-[#b8896a]/50 hover:bg-[#a07855]/5 dark:hover:bg-[#a07855]/10 transition-all duration-200 font-albert font-medium text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Habit
                        </button>
                      </div>
                    </div>
                  )}

                  {saveError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400 font-albert">{saveError}</p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveDay}
                      disabled={saving}
                      className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
                    >
                      {saving ? 'Saving...' : 'Save Day'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : viewMode === 'cohorts' ? (
          // Cohorts View (Group programs only)
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Manage time-based cohorts for this program
              </p>
              <Button 
                onClick={() => handleOpenCohortModal()}
                className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white flex items-center gap-2"
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
                        className="p-1.5 text-[#5f5a55] hover:text-[#a07855] dark:text-[#b8896a] rounded disabled:opacity-50"
                        title="Duplicate cohort"
                      >
                        {duplicatingCohort === cohort.id ? (
                          <div className="w-4 h-4 border-2 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenCohortModal(cohort)}
                        className="p-1.5 text-[#5f5a55] hover:text-[#a07855] dark:text-[#b8896a] rounded"
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
                    className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
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
                {programEnrollments.map((enrollment) => (
                  <div 
                    key={enrollment.id}
                    className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {enrollment.user?.imageUrl ? (
                          <Image
                            src={enrollment.user.imageUrl}
                            alt={`${enrollment.user.firstName} ${enrollment.user.lastName}`}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#a07855]/20 flex items-center justify-center">
                            <User className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            {enrollment.user 
                              ? `${enrollment.user.firstName} ${enrollment.user.lastName}`.trim() || 'Unknown User'
                              : 'Unknown User'}
                          </h3>
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                            {enrollment.user?.email || enrollment.userId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Community Badge & Toggle - Only for individual programs with community enabled */}
                        {selectedProgram?.type === 'individual' && selectedProgram?.clientCommunitySquadId && (
                          <button
                            onClick={() => handleToggleCommunity(enrollment, !enrollment.joinedCommunity)}
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
                            onClick={() => setRemoveConfirmEnrollment(enrollment)}
                            className="p-2 text-[#5f5a55] hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Remove from program"
                          >
                            <UserMinus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
                  className="border-[#a07855] dark:border-[#b8896a] text-[#a07855] dark:text-[#b8896a] hover:bg-[#a07855]/10 flex items-center gap-2"
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
                  className={`flex items-center gap-2 ${landingPageSaved ? 'bg-[#d1ccc5] dark:bg-[#3d424d] cursor-not-allowed' : 'bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855]'} text-white`}
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
                              ? 'border-[#a07855] dark:border-[#b8896a] bg-[#a07855]/5'
                              : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855] dark:border-[#b8896a]/50'
                          } ${editingProgram ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Users className="w-5 h-5 mx-auto mb-1 text-[#a07855] dark:text-[#b8896a]" />
                          <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">Group</span>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Cohorts & Squads</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => !editingProgram && setProgramFormData({ ...programFormData, type: 'individual' })}
                          disabled={!!editingProgram}
                          className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                            programFormData.type === 'individual'
                              ? 'border-[#a07855] dark:border-[#b8896a] bg-[#a07855]/5'
                              : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855] dark:border-[#b8896a]/50'
                          } ${editingProgram ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <User className="w-5 h-5 mx-auto mb-1 text-[#a07855] dark:text-[#b8896a]" />
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
                        Description
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
                            Cover Image
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
                            className="text-[#a07855] dark:text-[#b8896a] hover:text-[#8c6245]"
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
                        <span className="cursor-pointer" onClick={() => setProgramFormData({ ...programFormData, isPublished: !programFormData.isPublished })}>Published (visible in Discover)</span>
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
                      disabled={saving || !programFormData.name}
                      className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
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
                            className="text-[#a07855] dark:text-[#b8896a]"
                          />
                          Close squad after grace period
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert cursor-pointer">
                          <input
                            type="radio"
                            name="afterProgramEnds"
                            checked={cohortFormData.convertSquadsToCommunity}
                            onChange={() => setCohortFormData({ ...cohortFormData, convertSquadsToCommunity: true })}
                            className="text-[#a07855] dark:text-[#b8896a]"
                          />
                          Convert to mastermind
                        </label>
                      </div>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
                        Masterminds remain active for alumni to stay connected
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
                      className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
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
        onCreateFromScratch={() => {
          setIsNewProgramModalOpen(false);
          setEditingProgram(null);
          fetchCoaches();
          setProgramFormData({
            name: '',
            type: 'group',
            description: '',
            coverImageUrl: '',
            lengthDays: 30,
            priceInCents: 0,
            currency: 'usd',
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
          });
          setIsProgramModalOpen(true);
        }}
        onProgramCreated={(programId) => {
          fetchPrograms();
          // Select the new program
          const selectProgram = async () => {
            const response = await fetch(`${apiBasePath}/${programId}`);
            if (response.ok) {
              const data = await response.json();
              setSelectedProgram(data.program);
              setProgramDays(data.days || []);
              setProgramCohorts(data.cohorts || []);
              setViewMode('days');
            }
          };
          selectProgram();
        }}
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
    </>
  );
}

