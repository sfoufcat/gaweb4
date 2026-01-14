'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ProgramWeek, ProgramDay, ProgramTaskTemplate, CallSummary, TaskDistribution, UnifiedEvent, ProgramEnrollment, ProgramCohort, DiscoverArticle, DiscoverDownload, DiscoverLink, Questionnaire } from '@/types';
import type { DiscoverCourse } from '@/types/discover';
import { Plus, X, Sparkles, GripVertical, Target, FileText, MessageSquare, StickyNote, Upload, Mic, Phone, Calendar, Check, Loader2, Users, EyeOff, Info, ListTodo, ClipboardList, ArrowLeftRight, Trash2, Pencil, ChevronDown, ChevronRight, BookOpen, Download, Link2, FileQuestion, GraduationCap, Video, AlertCircle } from 'lucide-react';
import { useProgramEditorOptional } from '@/contexts/ProgramEditorContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { SyncToClientsDialog } from './SyncToClientsDialog';
import { SyncToCohortsDialog } from './SyncToCohortsDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useInstanceIdLookup } from '@/hooks/useProgramInstanceBridge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ResourceLinkDropdown } from './ResourceLinkDropdown';
// Audio utilities for duration detection
import { getAudioDuration } from '@/lib/audio-compression';

interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    imageUrl?: string;
  };
}

// Extended completion data for cohort weekly tasks (aggregate across week)
interface CohortWeeklyTaskCompletionData {
  completionRate: number;
  completed: boolean;
  completedCount: number;
  totalMembers: number;
}

interface WeekEditorProps {
  week: ProgramWeek;
  days: ProgramDay[];
  /** @deprecated Use ProgramEditorContext instead. Only needed for sync dialog. */
  onSave?: (updates: Partial<ProgramWeek>) => Promise<void>;
  onDaySelect?: (dayIndex: number) => void;
  onFillWithAI?: () => void;
  isSaving?: boolean;
  // Available items for manual linking
  availableCallSummaries?: CallSummary[];
  availableEvents?: UnifiedEvent[];
  // Resources - articles, downloads, links, questionnaires, courses
  availableArticles?: DiscoverArticle[];
  availableDownloads?: DiscoverDownload[];
  availableLinks?: DiscoverLink[];
  availableQuestionnaires?: Questionnaire[];
  availableCourses?: DiscoverCourse[];
  // Client view mode (for 1:1 programs)
  isClientView?: boolean;
  clientName?: string;
  clientUserId?: string;
  enrollmentId?: string;
  // Cohort view mode (for group programs)
  cohortId?: string;
  cohortName?: string;
  // For sync functionality (1:1 programs)
  programId?: string;
  programType?: 'individual' | 'group';
  enrollments?: EnrollmentWithUser[];
  // For sync functionality (group programs)
  cohorts?: ProgramCohort[];
  // Callback when a new summary is generated
  onSummaryGenerated?: (summaryId: string) => void;
  // Cohort task completion for weekly tasks (aggregate)
  cohortWeeklyTaskCompletion?: Map<string, CohortWeeklyTaskCompletionData>;
  // Completion threshold
  completionThreshold?: number;
  // NEW: Instance ID for migrated data (uses new unified API when present)
  instanceId?: string | null;
}

// Member info for task completion breakdown
interface TaskMemberInfo {
  userId: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  status: 'pending' | 'completed';
  completedAt?: string;
}

// Sortable task component for drag-and-drop weekly tasks
interface SortableWeeklyTaskProps {
  task: ProgramTaskTemplate;
  index: number;
  id: string;
  showCompletionStatus: boolean;
  onTogglePrimary: (index: number) => void;
  onRemove: (index: number) => void;
  // Cohort completion data (optional)
  cohortCompletion?: CohortWeeklyTaskCompletionData;
  // Expand functionality for cohort mode
  isCohortMode: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  members: TaskMemberInfo[];
  onToggleExpanded: () => void;
  completionThreshold: number;
}

function SortableWeeklyTask({
  task,
  index,
  id,
  showCompletionStatus,
  onTogglePrimary,
  onRemove,
  cohortCompletion,
  isCohortMode,
  isExpanded,
  isLoading,
  members,
  onToggleExpanded,
  completionThreshold
}: SortableWeeklyTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isCompleted = task.completed || false;

  // Derive completion data from members array if cohortCompletion not provided
  // This ensures we show accurate counts even when lazy-loading member data
  const hasMemberData = members.length > 0;
  const derivedTotalMembers = members.length;
  const derivedCompletedCount = members.filter(m => m.status === 'completed').length;
  const derivedCompletionRate = derivedTotalMembers > 0
    ? Math.round((derivedCompletedCount / derivedTotalMembers) * 100)
    : 0;

  // Use cohortCompletion if available, otherwise use derived values from members
  const completedCount = cohortCompletion?.completedCount ?? (hasMemberData ? derivedCompletedCount : 0);
  const totalMembers = cohortCompletion?.totalMembers ?? (hasMemberData ? derivedTotalMembers : 0);
  const completionRate = cohortCompletion?.completionRate ?? (hasMemberData ? derivedCompletionRate : 0);
  const isCohortCompleted = cohortCompletion?.completed ?? (completionRate >= completionThreshold);
  const hasCohortData = !!cohortCompletion || hasMemberData;

  // Helper to get progress bar color
  const getProgressColor = (rate: number, threshold: number) => {
    if (rate >= threshold) return 'bg-brand-accent';
    if (rate >= threshold * 0.7) return 'bg-brand-accent/60';
    return 'bg-gray-300 dark:bg-gray-600';
  };

  return (
    <div className="space-y-0">
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] border rounded-xl hover:shadow-sm transition-all duration-200 ${
          isCohortCompleted
            ? 'border-brand-accent/30 bg-brand-accent/5 hover:border-brand-accent/50'
            : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d4d0cb] dark:hover:border-[#313746]'
        } ${isExpanded ? 'rounded-b-none border-b-0' : ''}`}
      >
        {/* Cohort Mode: Expand Chevron */}
        {isCohortMode ? (
          <button
            type="button"
            onClick={onToggleExpanded}
            className="shrink-0 flex items-center gap-1"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#7d8190]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#7d8190]" />
            )}
            {/* Completion indicator - matches client Daily Focus style */}
            <div
              className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all duration-300 bg-white dark:bg-[#181d26] ${
                hasCohortData && isCohortCompleted
                  ? 'border-brand-accent'
                  : hasCohortData && completionRate > 0
                  ? 'border-brand-accent/50'
                  : 'border-[#d4d0cb] dark:border-[#3d4351]'
              }`}
              title={isCohortCompleted ? `${completionRate}% completed (threshold met)` : completionRate > 0 ? `${completionRate}% completed` : 'No completions'}
            >
              {hasCohortData && isCohortCompleted ? (
                <div className="w-4 h-4 bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300" />
              ) : hasCohortData && completionRate > 0 ? (
                <span className="text-[9px] font-bold text-brand-accent">{completionRate}</span>
              ) : null}
            </div>
          </button>
        ) : (
          <>
            {/* Drag Handle */}
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-[#a7a39e] dark:text-[#7d8190]" />
            </div>

            {/* Completion Checkbox - matches client Daily Focus style */}
            <div
              className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all duration-300 bg-white dark:bg-[#181d26] ${
                (hasCohortData && isCohortCompleted) || (showCompletionStatus && isCompleted)
                  ? 'border-brand-accent'
                  : hasCohortData && completionRate > 0
                  ? 'border-brand-accent/50'
                  : 'border-[#d4d0cb] dark:border-[#3d4351]'
              }`}
              title={hasCohortData ? (isCohortCompleted ? `${completionRate}% completed (threshold met)` : completionRate > 0 ? `${completionRate}% completed` : 'No completions') : ''}
            >
              {(hasCohortData && isCohortCompleted) || (showCompletionStatus && isCompleted) ? (
                <div className="w-4 h-4 bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300" />
              ) : hasCohortData && completionRate > 0 ? (
                <span className="text-[9px] font-bold text-brand-accent">{completionRate}</span>
              ) : null}
            </div>
          </>
        )}

        {/* Task Label */}
        <span className={`flex-1 font-albert text-[15px] transition-all duration-300 ${
          (isCohortCompleted || (showCompletionStatus && isCompleted))
            ? 'text-[#a7a39e] dark:text-[#7d8190] line-through'
            : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
        }`}>
          {task.label}
        </span>

        {/* Cohort completion badge */}
        {isCohortMode && (
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
              isCohortCompleted
                ? 'text-brand-accent bg-brand-accent/10'
                : 'text-muted-foreground bg-muted'
            }`}
          >
            {completedCount}/{totalMembers}
          </span>
        )}

        {/* Task Actions Group - badges and Focus toggle */}
        <div className="flex items-center gap-1">
          {/* Deleted by Client Indicator */}
          {task.deletedByClient && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-full border border-red-200 dark:border-red-800">
              <Trash2 className="w-3 h-3" />
              Deleted
            </span>
          )}

          {/* Edited by Client Indicator */}
          {task.editedByClient && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-full border border-amber-200 dark:border-amber-800">
              <Pencil className="w-3 h-3" />
              Edited
            </span>
          )}

          {/* Focus/Backlog Toggle */}
          <button
            type="button"
            onClick={() => onTogglePrimary(index)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#5f5a55] dark:text-[#7d8190] hover:text-[#3d3a37] dark:hover:text-[#b2b6c2] transition-all duration-200 group"
          >
            <ArrowLeftRight className={`w-3.5 h-3.5 transition-transform duration-300 ease-out ${task.isPrimary ? 'rotate-0' : 'rotate-180'}`} />
            <span className="relative w-[52px] h-4 overflow-hidden">
              <span
                className={`absolute inset-0 flex items-center transition-all duration-300 ease-out ${
                  task.isPrimary
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-full'
                }`}
              >
                Focus
              </span>
              <span
                className={`absolute inset-0 flex items-center transition-all duration-300 ease-out ${
                  !task.isPrimary
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-full'
                }`}
              >
                Backlog
              </span>
            </span>
          </button>
        </div>

        {/* Delete Button */}
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 rounded-lg text-[#a7a39e] dark:text-[#7d8190] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded member breakdown (cohort mode only) */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          isCohortMode && isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[#e1ddd8] dark:border-[#262b35] px-4 pb-4">
            {/* Progress bar with label */}
            <div className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Completion Progress</span>
                <span className={cn(
                  "text-xs font-semibold",
                  isCohortCompleted ? "text-brand-accent" : "text-muted-foreground"
                )}>
                  {completionRate}%
                </span>
              </div>
              <Progress
                value={completionRate}
                className="h-2"
                indicatorClassName={cn(
                  "transition-all duration-500",
                  isCohortCompleted ? "bg-brand-accent" : "bg-brand-accent/60"
                )}
              />
            </div>

            {/* Member list */}
            <div className="space-y-1">
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isLoading && members.length === 0 && (
                <div className="text-sm text-muted-foreground py-3 text-center">
                  No member data available
                </div>
              )}

              {!isLoading && members.map((member, memberIndex) => (
                <div
                  key={member.userId}
                  className={cn(
                    "flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-200",
                    member.status === 'completed'
                      ? "bg-brand-accent/5"
                      : "hover:bg-muted/50"
                  )}
                  style={{
                    animationDelay: `${memberIndex * 50}ms`,
                  }}
                >
                  <Avatar className="h-7 w-7 ring-2 ring-background">
                    <AvatarImage src={member.imageUrl} />
                    <AvatarFallback className="text-xs bg-muted">
                      {member.firstName?.[0]}
                      {member.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn(
                    "flex-1 text-sm font-medium truncate",
                    member.status === 'completed'
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}>
                    {member.firstName} {member.lastName}
                  </span>
                  <div
                    className={cn(
                      'shrink-0 h-6 w-6 rounded-lg border flex items-center justify-center transition-all duration-300 bg-white dark:bg-[#181d26]',
                      member.status === 'completed'
                        ? 'border-brand-accent'
                        : 'border-[#d4d0cb] dark:border-[#3d4351]'
                    )}
                  >
                    {member.status === 'completed' && (
                      <div className="w-4 h-4 bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Editor for program week content
 * Manages tasks, focus areas, notes, recordings, and AI content
 */
export function WeekEditor({
  week,
  days,
  onSave,
  onDaySelect,
  onFillWithAI,
  isSaving = false,
  availableCallSummaries = [],
  availableEvents = [],
  availableArticles = [],
  availableDownloads = [],
  availableLinks = [],
  availableQuestionnaires = [],
  availableCourses = [],
  isClientView = false,
  clientName,
  clientUserId,
  enrollmentId,
  cohortId,
  cohortName,
  programId,
  programType,
  enrollments = [],
  cohorts = [],
  onSummaryGenerated,
  cohortWeeklyTaskCompletion = new Map(),
  completionThreshold = 50,
  instanceId,
}: WeekEditorProps) {
  // Program editor context for centralized save
  const editorContext = useProgramEditorOptional();

  // Lookup instanceId if not provided (for migration support)
  const { instanceId: lookedUpInstanceId, isLoading: instanceLookupLoading } = useInstanceIdLookup({
    programId: programId || '',
    enrollmentId,
    cohortId,
  });
  
  const effectiveInstanceId = instanceId || lookedUpInstanceId;
  
  // Determine if we're in a client/cohort context (not template mode)
  const isInstanceContext = !!(cohortId || enrollmentId);

  // Determine view context for the editor
  const viewContext = isClientView ? 'client' : cohortId ? 'cohort' : 'template';
  const clientContextId = isClientView ? enrollmentId : cohortId;

  // Build API endpoint based on view context
  const getApiEndpoint = useCallback(() => {
    // Instance API is the single source of truth for client/cohort views
    // Instances are auto-created when looking up enrollmentId or cohortId
    if (effectiveInstanceId) {
      return `/api/instances/${effectiveInstanceId}/weeks/${week.weekNumber}`;
    }

    if (!programId) return '';
    // Template path - use week.id (for template editing mode only)
    return `/api/coach/org-programs/${programId}/weeks/${week.id}`;
  }, [programId, week.id, week.weekNumber, effectiveInstanceId]);

  // Check for pending data from context
  const pendingData = editorContext?.getPendingData('week', week.id, clientContextId);

  // Track if we've initialized from pending data
  const initializedFromPending = useRef(false);
  // Track last reset version to detect discard/save
  const lastResetVersion = useRef(editorContext?.resetVersion ?? 0);
  // Track skip cycles remaining after reset (to skip re-registration during save->refresh cycle)
  // Using a counter instead of boolean to allow multiple cycles for instance to refresh
  const skipCyclesRemaining = useRef(0);
  // Track last registered data fingerprint to prevent infinite re-registration loops
  const lastRegisteredFingerprint = useRef<string | null>(null);
  // Track what formData looked like when we last saved (to detect "clean" state)
  const lastSavedFormDataRef = useRef<string | null>(null);
  // Track last processed fingerprint to prevent infinite reset loops
  const lastProcessedFingerprint = useRef<string | null>(null);

  // Form data type
  type WeekFormData = {
    name: string;
    theme: string;
    description: string;
    weeklyPrompt: string;
    weeklyTasks: ProgramTaskTemplate[];
    currentFocus: string[];
    notes: string[];
    manualNotes: string;
    distribution: TaskDistribution;
    coachRecordingUrl: string;
    coachRecordingNotes: string;
    linkedSummaryIds: string[];
    linkedCallEventIds: string[];
    // Resources - linked content
    linkedArticleIds: string[];
    linkedDownloadIds: string[];
    linkedLinkIds: string[];
    linkedQuestionnaireIds: string[];
    linkedCourseIds: string[];
  };

  // Memoize week data as primitives to prevent infinite loops from object reference changes
  const weekName = week.name || '';
  const weekTheme = week.theme || '';
  const weekDescription = week.description || '';
  const weekWeeklyPrompt = week.weeklyPrompt || '';
  const weekWeeklyTasks = week.weeklyTasks || [];
  const weekCurrentFocus = week.currentFocus || [];
  const weekNotes = week.notes || [];
  const weekManualNotes = week.manualNotes || '';
  const weekDistribution = (week.distribution || 'spread') as TaskDistribution;
  const weekCoachRecordingUrl = week.coachRecordingUrl || '';
  const weekCoachRecordingNotes = week.coachRecordingNotes || '';
  const weekLinkedSummaryIds = week.linkedSummaryIds || [];
  const weekLinkedCallEventIds = week.linkedCallEventIds || [];
  const weekLinkedArticleIds = week.linkedArticleIds || [];
  const weekLinkedDownloadIds = week.linkedDownloadIds || [];
  const weekLinkedLinkIds = week.linkedLinkIds || [];
  const weekLinkedQuestionnaireIds = week.linkedQuestionnaireIds || [];
  const weekLinkedCourseIds = week.linkedCourseIds || [];

  const getDefaultFormData = useCallback((): WeekFormData => ({
    name: weekName,
    theme: weekTheme,
    description: weekDescription,
    weeklyPrompt: weekWeeklyPrompt,
    weeklyTasks: weekWeeklyTasks,
    currentFocus: weekCurrentFocus,
    notes: weekNotes,
    manualNotes: weekManualNotes,
    distribution: weekDistribution,
    coachRecordingUrl: weekCoachRecordingUrl,
    coachRecordingNotes: weekCoachRecordingNotes,
    linkedSummaryIds: weekLinkedSummaryIds,
    linkedCallEventIds: weekLinkedCallEventIds,
    linkedArticleIds: weekLinkedArticleIds,
    linkedDownloadIds: weekLinkedDownloadIds,
    linkedLinkIds: weekLinkedLinkIds,
    linkedQuestionnaireIds: weekLinkedQuestionnaireIds,
    linkedCourseIds: weekLinkedCourseIds,
  }), [weekName, weekTheme, weekDescription, weekWeeklyPrompt, weekWeeklyTasks, weekCurrentFocus, weekNotes, weekManualNotes, weekDistribution, weekCoachRecordingUrl, weekCoachRecordingNotes, weekLinkedSummaryIds, weekLinkedCallEventIds, weekLinkedArticleIds, weekLinkedDownloadIds, weekLinkedLinkIds, weekLinkedQuestionnaireIds]);

  // Merge pending data with defaults to ensure all fields exist
  // Uses memoized primitive values instead of getDefaultFormData to avoid dependency loops
  const mergePendingWithDefaults = useCallback((pending: Record<string, unknown>): WeekFormData => {
    const defaults: WeekFormData = {
      name: weekName,
      theme: weekTheme,
      description: weekDescription,
      weeklyPrompt: weekWeeklyPrompt,
      weeklyTasks: weekWeeklyTasks,
      currentFocus: weekCurrentFocus,
      notes: weekNotes,
      manualNotes: weekManualNotes,
      distribution: weekDistribution,
      coachRecordingUrl: weekCoachRecordingUrl,
      coachRecordingNotes: weekCoachRecordingNotes,
      linkedSummaryIds: weekLinkedSummaryIds,
      linkedCallEventIds: weekLinkedCallEventIds,
      linkedArticleIds: weekLinkedArticleIds,
      linkedDownloadIds: weekLinkedDownloadIds,
      linkedLinkIds: weekLinkedLinkIds,
      linkedQuestionnaireIds: weekLinkedQuestionnaireIds,
    linkedCourseIds: weekLinkedCourseIds,
    };
    return {
      ...defaults,
      ...pending,
      // Ensure arrays are never undefined
      weeklyTasks: (pending.weeklyTasks as ProgramTaskTemplate[]) || defaults.weeklyTasks,
      currentFocus: (pending.currentFocus as string[]) || defaults.currentFocus,
      notes: (pending.notes as string[]) || defaults.notes,
      linkedSummaryIds: (pending.linkedSummaryIds as string[]) || defaults.linkedSummaryIds,
      linkedCallEventIds: (pending.linkedCallEventIds as string[]) || defaults.linkedCallEventIds,
      linkedArticleIds: (pending.linkedArticleIds as string[]) || defaults.linkedArticleIds,
      linkedDownloadIds: (pending.linkedDownloadIds as string[]) || defaults.linkedDownloadIds,
      linkedLinkIds: (pending.linkedLinkIds as string[]) || defaults.linkedLinkIds,
      linkedQuestionnaireIds: (pending.linkedQuestionnaireIds as string[]) || defaults.linkedQuestionnaireIds,
      linkedCourseIds: (pending.linkedCourseIds as string[]) || defaults.linkedCourseIds,
    };
  }, [weekName, weekTheme, weekDescription, weekWeeklyPrompt, weekWeeklyTasks, weekCurrentFocus, weekNotes, weekManualNotes, weekDistribution, weekCoachRecordingUrl, weekCoachRecordingNotes, weekLinkedSummaryIds, weekLinkedCallEventIds, weekLinkedArticleIds, weekLinkedDownloadIds, weekLinkedLinkIds, weekLinkedQuestionnaireIds]);


  // Create a fingerprint of week data that changes when content changes from API refresh
  // This allows the reset effect to detect when fresh data arrives after a save
  const weekDataFingerprint = useMemo(() => {
    return JSON.stringify({
      name: week.name,
      theme: week.theme,
      description: week.description,
      weeklyTasks: week.weeklyTasks,
      currentFocus: week.currentFocus,
      notes: week.notes,
      manualNotes: week.manualNotes,
      weeklyPrompt: week.weeklyPrompt,
      distribution: week.distribution,
      coachRecordingUrl: week.coachRecordingUrl,
      coachRecordingNotes: week.coachRecordingNotes,
      linkedSummaryIds: week.linkedSummaryIds,
      linkedCallEventIds: week.linkedCallEventIds,
      linkedArticleIds: week.linkedArticleIds,
      linkedDownloadIds: week.linkedDownloadIds,
      linkedLinkIds: week.linkedLinkIds,
      linkedQuestionnaireIds: week.linkedQuestionnaireIds,
      linkedCourseIds: week.linkedCourseIds,
    });
  }, [week.name, week.theme, week.description, week.weeklyTasks, week.currentFocus, week.notes, week.manualNotes, week.weeklyPrompt, week.distribution, week.coachRecordingUrl, week.coachRecordingNotes, week.linkedSummaryIds, week.linkedCallEventIds, week.linkedArticleIds, week.linkedDownloadIds, week.linkedLinkIds, week.linkedQuestionnaireIds, week.linkedCourseIds]);

  const [formData, setFormData] = useState<WeekFormData>(() => {
    // Initialize from pending data if available
    if (pendingData && !initializedFromPending.current) {
      initializedFromPending.current = true;
      return mergePendingWithDefaults(pendingData);
    }
    return getDefaultFormData();
  });
  const [hasChanges, setHasChanges] = useState(!!pendingData);
  const [newTask, setNewTask] = useState('');
  const [newFocus, setNewFocus] = useState('');
  const [newNote, setNewNote] = useState('');

  // Save animation and sync state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSyncButton, setShowSyncButton] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [cohortSyncDialogOpen, setCohortSyncDialogOpen] = useState(false);

  // Track which fields have been edited (for smart sync pre-selection)
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  // Recording upload and summary generation state
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'uploading' | 'processing' | 'background' | 'completed' | 'error'>('idle');
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [pendingRecordingId, setPendingRecordingId] = useState<string | null>(null);

  // Check for in-progress recordings on mount and poll until complete
  // Supports both cohort mode (group programs) and 1:1 mode (individual programs)
  useEffect(() => {
    // Need either cohort context or client context
    const hasCohortContext = cohortId && week.id;
    const hasClientContext = clientUserId;

    if (!hasCohortContext && !hasClientContext) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let cancelled = false;

    const checkPendingRecordings = async () => {
      try {
        // Build query params based on context
        const params = new URLSearchParams();
        if (cohortId && week.id) {
          params.set('cohortId', cohortId);
          params.set('weekId', week.id);
        } else if (clientUserId) {
          params.set('clientUserId', clientUserId);
          if (enrollmentId) {
            params.set('enrollmentId', enrollmentId);
          }
        }

        const response = await fetch(`/api/coach/recordings/pending?${params.toString()}`);
        if (!response.ok || cancelled) return;

        const data = await response.json();
        if (data.pendingRecording && !cancelled) {
          const recording = data.pendingRecording;
          setPendingRecordingId(recording.id);

          // If already failed, show error immediately
          if (recording.status === 'failed') {
            setRecordingStatus('error');
            setRecordingError(recording.error || 'Processing failed');
            return;
          }

          // Show background processing state
          setRecordingStatus('background');

          // Start polling for completion
          pollInterval = setInterval(async () => {
            if (cancelled) return;
            try {
              const statusRes = await fetch(`/api/coach/recordings/${recording.id}/status`);
              if (!statusRes.ok) return;
              const statusData = await statusRes.json();

              if (statusData.status === 'completed') {
                setRecordingStatus('completed');
                setPendingRecordingId(null);
                if (pollInterval) clearInterval(pollInterval);
                // Refetch call summaries to show the new summary
                if (statusData.callSummaryId) {
                  onSummaryGenerated?.(statusData.callSummaryId);
                }
                // Reset to idle after showing success
                setTimeout(() => {
                  if (!cancelled) setRecordingStatus('idle');
                }, 3000);
              } else if (statusData.status === 'failed') {
                setRecordingStatus('error');
                setRecordingError(statusData.error || 'Processing failed');
                setPendingRecordingId(null);
                if (pollInterval) clearInterval(pollInterval);
              }
            } catch (err) {
              console.error('Error polling recording status:', err);
            }
          }, 5000);
        }
      } catch (err) {
        console.error('Error checking pending recordings:', err);
      }
    };

    checkPendingRecordings();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [cohortId, week.id, clientUserId, enrollmentId, onSummaryGenerated]);

  // State for expanded tasks (to show member breakdown) - for cohort mode
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [taskMemberData, setTaskMemberData] = useState<Map<string, TaskMemberInfo[]>>(new Map());
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());

  // Toggle task expansion
  const toggleTaskExpanded = useCallback((taskKey: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskKey)) {
        next.delete(taskKey);
      } else {
        next.add(taskKey);
      }
      return next;
    });
  }, []);

  // Fetch member breakdown for a task (lazy load)
  const fetchTaskMembers = useCallback(async (taskId: string, taskLabel: string) => {
    if (taskMemberData.has(taskLabel) || !cohortId) return;

    setLoadingTasks(prev => new Set(prev).add(taskLabel));

    try {
      // For weekly tasks, fetch without date filter to get aggregated data across all dates
      const response = await fetch(`/api/coach/cohort-tasks/${cohortId}/task/${encodeURIComponent(taskId)}`);

      if (response.ok) {
        const data = await response.json();
        setTaskMemberData(prev => new Map(prev).set(taskLabel, data.memberBreakdown || []));
      }
    } catch (error) {
      console.error('[WeekEditor] Failed to fetch task members:', error);
    } finally {
      setLoadingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskLabel);
        return next;
      });
    }
  }, [cohortId, taskMemberData]);

  // Fetch members when task is expanded
  useEffect(() => {
    expandedTasks.forEach(taskLabel => {
      const task = formData.weeklyTasks.find(t => t.label === taskLabel);
      if (task && !taskMemberData.has(taskLabel) && !loadingTasks.has(taskLabel)) {
        fetchTaskMembers(task.id || taskLabel, taskLabel);
      }
    });
  }, [expandedTasks, formData.weeklyTasks, taskMemberData, loadingTasks, fetchTaskMembers]);

  // Pre-fetch member data for all tasks in cohort mode to show accurate badge counts
  useEffect(() => {
    if (!cohortId || formData.weeklyTasks.length === 0) return;

    // Fetch member data for each task that we don't already have
    formData.weeklyTasks.forEach(task => {
      const taskLabel = task.label;
      if (!taskMemberData.has(taskLabel) && !loadingTasks.has(taskLabel)) {
        fetchTaskMembers(task.id || taskLabel, taskLabel);
      }
    });
  }, [cohortId, formData.weeklyTasks, taskMemberData, loadingTasks, fetchTaskMembers]);

  // Helper to track field edits
  const trackFieldEdit = useCallback((syncFieldKey: string) => {
    setEditedFields(prev => new Set(prev).add(syncFieldKey));
  }, []);

  // DnD sensors for weekly tasks
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering weekly tasks
  const handleTaskDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = formData.weeklyTasks.findIndex((_, i) => `task-${i}` === active.id);
      const newIndex = formData.weeklyTasks.findIndex((_, i) => `task-${i}` === over.id);
      const newTasks = arrayMove(formData.weeklyTasks, oldIndex, newIndex);
      setFormData(prev => ({ ...prev, weeklyTasks: newTasks }));
      trackFieldEdit('syncTasks');
    }
  }, [formData.weeklyTasks, trackFieldEdit]);

  // Get days in this week
  const weekDays = days.filter(
    d => d.dayIndex >= week.startDayIndex && d.dayIndex <= week.endDayIndex
  ).sort((a, b) => a.dayIndex - b.dayIndex);

  // Reset form when week changes - but check for pending data first
  // CRITICAL: Include clientContextId in deps so we check the correct context's pending data
  useEffect(() => {
    // Create a unique key for this state to prevent infinite loops
    const stateKey = `${week.id}:${weekDataFingerprint}:${clientContextId}:${viewContext}`;

    // Skip if we've already processed this exact state
    if (lastProcessedFingerprint.current === stateKey) {
      return;
    }
    lastProcessedFingerprint.current = stateKey;

    // Check if there's pending data in context for this week
    // Uses current clientContextId to avoid finding stale template pending data
    const contextPendingData = editorContext?.getPendingData('week', week.id, clientContextId);

    console.log('[WeekEditor:resetEffect] Triggered:', {
      weekId: week.id,
      weekNumber: week.weekNumber,
      hasPendingData: !!contextPendingData,
      clientContextId,
      viewContext,
      weekWeeklyTasksCount: week.weeklyTasks?.length ?? 0,
      weekWeeklyTasks: week.weeklyTasks?.map(t => t.label),
    });

    if (contextPendingData) {
      // Restore from pending data, merged with defaults to ensure all fields exist
      // INLINE merge logic to avoid callback dependency issues
      console.log('[WeekEditor:resetEffect] Restoring from pending data');
      const defaults: WeekFormData = {
        name: week.name || '',
        theme: week.theme || '',
        description: week.description || '',
        weeklyPrompt: week.weeklyPrompt || '',
        weeklyTasks: week.weeklyTasks || [],
        currentFocus: week.currentFocus || [],
        notes: week.notes || [],
        manualNotes: week.manualNotes || '',
        distribution: (week.distribution || 'spread') as TaskDistribution,
        coachRecordingUrl: week.coachRecordingUrl || '',
        coachRecordingNotes: week.coachRecordingNotes || '',
        linkedSummaryIds: week.linkedSummaryIds || [],
        linkedCallEventIds: week.linkedCallEventIds || [],
        linkedArticleIds: weekLinkedArticleIds,
        linkedDownloadIds: weekLinkedDownloadIds,
        linkedLinkIds: weekLinkedLinkIds,
        linkedQuestionnaireIds: weekLinkedQuestionnaireIds,
    linkedCourseIds: weekLinkedCourseIds,
      };
      const merged: WeekFormData = {
        ...defaults,
        ...contextPendingData,
        // Ensure arrays are never undefined
        weeklyTasks: (contextPendingData.weeklyTasks as ProgramTaskTemplate[]) || defaults.weeklyTasks,
        currentFocus: (contextPendingData.currentFocus as string[]) || defaults.currentFocus,
        notes: (contextPendingData.notes as string[]) || defaults.notes,
        linkedSummaryIds: (contextPendingData.linkedSummaryIds as string[]) || defaults.linkedSummaryIds,
        linkedCallEventIds: (contextPendingData.linkedCallEventIds as string[]) || defaults.linkedCallEventIds,
        linkedArticleIds: (contextPendingData.linkedArticleIds as string[]) || defaults.linkedArticleIds,
        linkedDownloadIds: (contextPendingData.linkedDownloadIds as string[]) || defaults.linkedDownloadIds,
        linkedLinkIds: (contextPendingData.linkedLinkIds as string[]) || defaults.linkedLinkIds,
        linkedQuestionnaireIds: (contextPendingData.linkedQuestionnaireIds as string[]) || defaults.linkedQuestionnaireIds,
          linkedCourseIds: (contextPendingData.linkedCourseIds as string[]) || defaults.linkedCourseIds,
      };
      setFormData(merged);
      setHasChanges(true);
    } else {
      // Reset to week data - inline to avoid callback dependency issues
      const newFormData: WeekFormData = {
        name: week.name || '',
        theme: week.theme || '',
        description: week.description || '',
        weeklyPrompt: week.weeklyPrompt || '',
        weeklyTasks: week.weeklyTasks || [],
        currentFocus: week.currentFocus || [],
        notes: week.notes || [],
        manualNotes: week.manualNotes || '',
        distribution: (week.distribution || 'spread') as TaskDistribution,
        coachRecordingUrl: week.coachRecordingUrl || '',
        coachRecordingNotes: week.coachRecordingNotes || '',
        linkedSummaryIds: week.linkedSummaryIds || [],
        linkedCallEventIds: week.linkedCallEventIds || [],
        linkedArticleIds: weekLinkedArticleIds,
        linkedDownloadIds: weekLinkedDownloadIds,
        linkedLinkIds: weekLinkedLinkIds,
        linkedQuestionnaireIds: weekLinkedQuestionnaireIds,
    linkedCourseIds: weekLinkedCourseIds,
      };
      console.log('[WeekEditor:resetEffect] Resetting to week data:', {
        newFormDataTasksCount: newFormData.weeklyTasks?.length ?? 0,
        newFormDataTasks: newFormData.weeklyTasks?.map(t => t.label),
      });
      setFormData(newFormData);
      setHasChanges(false);
      // NOTE: Don't set skipCyclesRemaining here - this effect fires on initial load too.
      // Skip cycles should only be set after a save (via resetVersion effect).
    }
    setShowSyncButton(false);
    setSaveStatus('idle');
    setEditedFields(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.id, weekDataFingerprint, clientContextId, viewContext]);

  // Track previous view context to detect changes
  const lastViewContext = useRef(viewContext);
  const lastClientContextId = useRef(clientContextId);

  // CRITICAL: Reset form when view context changes (template ↔ client ↔ cohort)
  // This ensures template changes don't persist when switching to client/cohort mode
  useEffect(() => {
    const viewContextChanged = viewContext !== lastViewContext.current;
    const contextIdChanged = clientContextId !== lastClientContextId.current;

    if (viewContextChanged || contextIdChanged) {
      console.log('[WeekEditor] View context changed, resetting form:', {
        prevView: lastViewContext.current,
        newView: viewContext,
        prevContextId: lastClientContextId.current,
        newContextId: clientContextId,
        weekNumber: week.weekNumber,
      });

      lastViewContext.current = viewContext;
      lastClientContextId.current = clientContextId;

      // Check for pending data in the NEW context
      const contextPendingData = editorContext?.getPendingData('week', week.id, clientContextId);
      if (contextPendingData) {
        // Inline merge logic to avoid callback dependency issues
        const defaults: WeekFormData = {
          name: week.name || '',
          theme: week.theme || '',
          description: week.description || '',
          weeklyPrompt: week.weeklyPrompt || '',
          weeklyTasks: week.weeklyTasks || [],
          currentFocus: week.currentFocus || [],
          notes: week.notes || [],
          manualNotes: week.manualNotes || '',
          distribution: (week.distribution || 'spread') as TaskDistribution,
          coachRecordingUrl: week.coachRecordingUrl || '',
          coachRecordingNotes: week.coachRecordingNotes || '',
          linkedSummaryIds: week.linkedSummaryIds || [],
          linkedCallEventIds: week.linkedCallEventIds || [],
          linkedArticleIds: weekLinkedArticleIds,
          linkedDownloadIds: weekLinkedDownloadIds,
          linkedLinkIds: weekLinkedLinkIds,
          linkedQuestionnaireIds: weekLinkedQuestionnaireIds,
    linkedCourseIds: weekLinkedCourseIds,
        };
        const merged: WeekFormData = {
          ...defaults,
          ...contextPendingData,
          weeklyTasks: (contextPendingData.weeklyTasks as ProgramTaskTemplate[]) || defaults.weeklyTasks,
          currentFocus: (contextPendingData.currentFocus as string[]) || defaults.currentFocus,
          notes: (contextPendingData.notes as string[]) || defaults.notes,
          linkedSummaryIds: (contextPendingData.linkedSummaryIds as string[]) || defaults.linkedSummaryIds,
          linkedCallEventIds: (contextPendingData.linkedCallEventIds as string[]) || defaults.linkedCallEventIds,
          linkedArticleIds: (contextPendingData.linkedArticleIds as string[]) || defaults.linkedArticleIds,
          linkedDownloadIds: (contextPendingData.linkedDownloadIds as string[]) || defaults.linkedDownloadIds,
          linkedLinkIds: (contextPendingData.linkedLinkIds as string[]) || defaults.linkedLinkIds,
          linkedQuestionnaireIds: (contextPendingData.linkedQuestionnaireIds as string[]) || defaults.linkedQuestionnaireIds,
          linkedCourseIds: (contextPendingData.linkedCourseIds as string[]) || defaults.linkedCourseIds,
        };
        setFormData(merged);
        setHasChanges(true);
      } else {
        // Reset to the week data for the new context - inline to avoid callback dependency
        setFormData({
          name: week.name || '',
          theme: week.theme || '',
          description: week.description || '',
          weeklyPrompt: week.weeklyPrompt || '',
          weeklyTasks: week.weeklyTasks || [],
          currentFocus: week.currentFocus || [],
          notes: week.notes || [],
          manualNotes: week.manualNotes || '',
          distribution: (week.distribution || 'spread') as TaskDistribution,
          coachRecordingUrl: week.coachRecordingUrl || '',
          coachRecordingNotes: week.coachRecordingNotes || '',
          linkedSummaryIds: week.linkedSummaryIds || [],
          linkedCallEventIds: week.linkedCallEventIds || [],
          linkedArticleIds: weekLinkedArticleIds,
          linkedDownloadIds: weekLinkedDownloadIds,
          linkedLinkIds: weekLinkedLinkIds,
          linkedQuestionnaireIds: weekLinkedQuestionnaireIds,
    linkedCourseIds: weekLinkedCourseIds,
        });
        setHasChanges(false);
      }
      setShowSyncButton(false);
      setSaveStatus('idle');
      setEditedFields(new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewContext, clientContextId, week.id, week.weekNumber]);

  // Watch for reset version changes (discard/save from global buttons)
  useEffect(() => {
    if (editorContext && editorContext.resetVersion !== lastResetVersion.current) {
      console.log('[WeekEditor:resetVersion] Reset version changed:', {
        oldVersion: lastResetVersion.current,
        newVersion: editorContext.resetVersion,
        weekNumber: week.weekNumber,
        weekId: week.id,
      });
      lastResetVersion.current = editorContext.resetVersion;
      // Set skip cycles to prevent re-registration during save->refresh cycle
      // Use a few cycles (3) to give SWR time to fetch and React to re-render
      skipCyclesRemaining.current = 3;
      // Track current formData as "saved" state
      lastSavedFormDataRef.current = JSON.stringify({
        weeklyTasks: formData.weeklyTasks?.map(t => ({ id: t.id, label: t.label })),
      });
      // Clear UI state
      setHasChanges(false);
      setShowSyncButton(false);
      setSaveStatus('idle');
      setEditedFields(new Set());
    }
  }, [editorContext?.resetVersion, week.weekNumber, week.id]);

  // Check for changes and register with context
  useEffect(() => {
    // Skip registration while context is currently saving
    if (editorContext?.isSaving) {
      console.log('[WeekEditor:changeDetection] Skipping - context is saving');
      return;
    }

    // Skip if we have remaining skip cycles (waiting for instance to refresh after save)
    if (skipCyclesRemaining.current > 0) {
      skipCyclesRemaining.current--;
      console.log('[WeekEditor:changeDetection] Skipping - cycles remaining:', skipCyclesRemaining.current + 1, 'week:', week.weekNumber);
      setHasChanges(false);
      return;
    }

    // Check if formData matches what we last saved - if so, we're in a "clean" state
    // even if week prop hasn't caught up yet
    const currentFormFingerprint = JSON.stringify({
      weeklyTasks: formData.weeklyTasks?.map(t => ({ id: t.id, label: t.label })),
    });
    const weekFingerprint = JSON.stringify({
      weeklyTasks: week.weeklyTasks?.map(t => ({ id: t.id, label: t.label })),
    });

    // If week prop has caught up to match formData, clear the saved state
    // This allows future edits to be detected normally
    if (lastSavedFormDataRef.current && weekFingerprint === currentFormFingerprint) {
      console.log('[WeekEditor:changeDetection] Week prop caught up, clearing saved state');
      lastSavedFormDataRef.current = null;
      setHasChanges(false);
      return;
    }

    if (lastSavedFormDataRef.current && currentFormFingerprint === lastSavedFormDataRef.current) {
      // formData matches what was saved, so we're clean - don't register changes
      // even if week prop is stale
      setHasChanges(false);
      return;
    }

    // EARLY EXIT: Check if we've already processed this exact form data + week combination
    // This prevents infinite loops when week prop doesn't update after save
    const stateFingerprint = JSON.stringify({
      formTasks: formData.weeklyTasks?.map(t => ({ id: t.id, label: t.label })),
      weekTasks: week.weeklyTasks?.map(t => ({ id: t.id, label: t.label })),
      weekId: week.id,
    });
    if (stateFingerprint === lastRegisteredFingerprint.current) {
      // Already processed this exact state, skip to prevent infinite loop
      return;
    }

    const tasksMatch = JSON.stringify(formData.weeklyTasks) === JSON.stringify(week.weeklyTasks || []);
    const changed =
      formData.name !== (week.name || '') ||
      formData.theme !== (week.theme || '') ||
      formData.description !== (week.description || '') ||
      formData.weeklyPrompt !== (week.weeklyPrompt || '') ||
      formData.manualNotes !== (week.manualNotes || '') ||
      formData.distribution !== (week.distribution || 'spread') ||
      formData.coachRecordingUrl !== (week.coachRecordingUrl || '') ||
      formData.coachRecordingNotes !== (week.coachRecordingNotes || '') ||
      !tasksMatch ||
      JSON.stringify(formData.currentFocus) !== JSON.stringify(week.currentFocus || []) ||
      JSON.stringify(formData.notes) !== JSON.stringify(week.notes || []) ||
      JSON.stringify(formData.linkedSummaryIds) !== JSON.stringify(week.linkedSummaryIds || []) ||
      JSON.stringify(formData.linkedCallEventIds) !== JSON.stringify(week.linkedCallEventIds || []);
    
    // Debug logging for change detection
    if (changed) {
      console.log('[WeekEditor:changeDetection] Changes detected for week', week.weekNumber, {
        tasksMatch,
        formDataTasksCount: formData.weeklyTasks?.length ?? 0,
        weekTasksCount: week.weeklyTasks?.length ?? 0,
        formDataTasks: formData.weeklyTasks?.map(t => ({ id: t.id, label: t.label })),
        weekTasks: week.weeklyTasks?.map(t => ({ id: t.id, label: t.label })),
        // Show which fields differ
        nameMatch: formData.name === (week.name || ''),
        themeMatch: formData.theme === (week.theme || ''),
        promptMatch: formData.weeklyPrompt === (week.weeklyPrompt || ''),
        distributionMatch: formData.distribution === (week.distribution || 'spread'),
      });
    }
    
    setHasChanges(changed);

    // Register changes with context if available
    if (editorContext && changed && programId) {
      // GUARD: In client/cohort mode, we MUST have an instanceId before registering changes
      // Otherwise, the save would incorrectly go to the template endpoint
      if (isInstanceContext && !effectiveInstanceId) {
        if (instanceLookupLoading) {
          // Still loading - wait for instance to be found/created
          console.log('[WEEK_EDITOR] Waiting for instance lookup before registering change...');
          return;
        }
        // Not loading but no instanceId - this shouldn't happen, but log it
        console.warn('[WEEK_EDITOR] In client/cohort mode but no instanceId available after lookup');
        return;
      }
      
      // Check if this is a temp week (doesn't exist in DB yet)
      const isTempWeek = week.id.startsWith('temp-');
      
      // Build the pending data with context-specific fields
      let pendingDataForContext: Record<string, unknown> = { ...formData };
      let httpMethod: 'PATCH' | 'POST' | 'PUT' = 'PATCH';
      let endpoint = getApiEndpoint();

      if ((viewContext === 'client' || viewContext === 'cohort') && effectiveInstanceId) {
        // Client/Cohort view: Use instance API (instances are auto-created)
        endpoint = `/api/instances/${effectiveInstanceId}/weeks/${week.weekNumber}`;
        pendingDataForContext = {
          ...formData,
          distributeTasksNow: true,
        };
        httpMethod = 'PATCH';
      } else if (isTempWeek) {
        // Template mode with temp week - needs POST to create
        endpoint = `/api/coach/org-programs/${programId}/weeks`;
        pendingDataForContext = {
          ...formData,
          weekNumber: week.weekNumber,
          startDayIndex: week.startDayIndex,
          endDayIndex: week.endDayIndex,
          moduleId: week.moduleId || undefined, // Will be assigned by API if not set
        };
        httpMethod = 'POST';
      } else {
        // Template week - add day indices for distribution
        pendingDataForContext = {
          ...formData,
          startDayIndex: week.startDayIndex,
          endDayIndex: week.endDayIndex,
        };
      }

      // CRITICAL: When registering a client/cohort change, discard any template change
      // for the same week to prevent dual saves (template + cohort both being saved)
      if (viewContext !== 'template' && clientContextId) {
        const templateKey = editorContext.getChangeKey('week', week.id, undefined);
        editorContext.discardChange(templateKey);
      }

      // Update fingerprint to track that we've processed this state
      // (Uses same format as early exit check above)
      lastRegisteredFingerprint.current = stateFingerprint;

      editorContext.registerChange({
        entityType: 'week',
        entityId: week.id,
        weekNumber: week.weekNumber,
        viewContext: viewContext as 'template' | 'client' | 'cohort',
        clientContextId,
        originalData: {
          name: week.name,
          theme: week.theme,
          description: week.description,
          weeklyPrompt: week.weeklyPrompt,
          weeklyTasks: week.weeklyTasks,
          currentFocus: week.currentFocus,
          notes: week.notes,
          manualNotes: week.manualNotes,
          distribution: week.distribution,
          coachRecordingUrl: week.coachRecordingUrl,
          coachRecordingNotes: week.coachRecordingNotes,
          linkedSummaryIds: week.linkedSummaryIds,
          linkedCallEventIds: week.linkedCallEventIds,
        },
        pendingData: pendingDataForContext,
        apiEndpoint: endpoint,
        httpMethod,
        editedFields: Array.from(editedFields),
      });
    } else if (editorContext && !changed) {
      // Remove from pending changes if no longer changed
      const changeKey = editorContext.getChangeKey('week', week.id, clientContextId);
      editorContext.discardChange(changeKey);
    }
  // Note: Removed getDefaultFormData from deps as it's not used in this effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, week.id, week.weekNumber, week.name, week.theme, week.description, week.weeklyPrompt, week.manualNotes, week.distribution, week.coachRecordingUrl, week.coachRecordingNotes, week.weeklyTasks, week.currentFocus, week.notes, week.linkedSummaryIds, week.linkedCallEventIds, editorContext, programId, viewContext, clientContextId, getApiEndpoint, editedFields, isInstanceContext, effectiveInstanceId, instanceLookupLoading]);

  // handleSave is only used by the SyncToClientsDialog now
  const handleSave = async () => {
    if (!onSave) {
      console.warn('WeekEditor: onSave prop not provided');
      return;
    }
    setSaveStatus('saving');
    try {
      await onSave({
        name: formData.name || undefined,
        theme: formData.theme || undefined,
        description: formData.description || undefined,
        weeklyPrompt: formData.weeklyPrompt || undefined,
        weeklyTasks: formData.weeklyTasks,
        currentFocus: formData.currentFocus.length > 0 ? formData.currentFocus : undefined,
        notes: formData.notes.length > 0 ? formData.notes : undefined,
        manualNotes: formData.manualNotes || undefined,
        distribution: formData.distribution,
        coachRecordingUrl: formData.coachRecordingUrl || undefined,
        coachRecordingNotes: formData.coachRecordingNotes || undefined,
        linkedSummaryIds: formData.linkedSummaryIds.length > 0 ? formData.linkedSummaryIds : undefined,
        linkedCallEventIds: formData.linkedCallEventIds.length > 0 ? formData.linkedCallEventIds : undefined,
        linkedArticleIds: formData.linkedArticleIds.length > 0 ? formData.linkedArticleIds : undefined,
        linkedDownloadIds: formData.linkedDownloadIds.length > 0 ? formData.linkedDownloadIds : undefined,
        linkedLinkIds: formData.linkedLinkIds.length > 0 ? formData.linkedLinkIds : undefined,
        linkedQuestionnaireIds: formData.linkedQuestionnaireIds.length > 0 ? formData.linkedQuestionnaireIds : undefined,
        linkedCourseIds: formData.linkedCourseIds.length > 0 ? formData.linkedCourseIds : undefined,
      });
      setHasChanges(false);
      setSaveStatus('saved');

      // Clear from context after successful save
      if (editorContext) {
        const changeKey = editorContext.getChangeKey('week', week.id, clientContextId);
        editorContext.discardChange(changeKey);
      }

      setTimeout(() => {
        setSaveStatus('idle');
      }, 1500);
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('idle');
    }
  };

  // Link management for call summaries
  const addSummaryLink = (summaryId: string) => {
    if (!formData.linkedSummaryIds.includes(summaryId)) {
      setFormData({
        ...formData,
        linkedSummaryIds: [...formData.linkedSummaryIds, summaryId],
      });
    }
  };

  const removeSummaryLink = (summaryId: string) => {
    setFormData({
      ...formData,
      linkedSummaryIds: formData.linkedSummaryIds.filter(id => id !== summaryId),
    });
  };

  // Link management for call events
  const addEventLink = (eventId: string) => {
    if (!formData.linkedCallEventIds.includes(eventId)) {
      setFormData({
        ...formData,
        linkedCallEventIds: [...formData.linkedCallEventIds, eventId],
      });
    }
  };

  const removeEventLink = (eventId: string) => {
    setFormData({
      ...formData,
      linkedCallEventIds: formData.linkedCallEventIds.filter(id => id !== eventId),
    });
  };

  // Link management for articles
  const addArticleLink = (articleId: string) => {
    if (!formData.linkedArticleIds.includes(articleId)) {
      setFormData({
        ...formData,
        linkedArticleIds: [...formData.linkedArticleIds, articleId],
      });
    }
  };

  const removeArticleLink = (articleId: string) => {
    setFormData({
      ...formData,
      linkedArticleIds: formData.linkedArticleIds.filter(id => id !== articleId),
    });
  };

  // Link management for downloads
  const addDownloadLink = (downloadId: string) => {
    if (!formData.linkedDownloadIds.includes(downloadId)) {
      setFormData({
        ...formData,
        linkedDownloadIds: [...formData.linkedDownloadIds, downloadId],
      });
    }
  };

  const removeDownloadLink = (downloadId: string) => {
    setFormData({
      ...formData,
      linkedDownloadIds: formData.linkedDownloadIds.filter(id => id !== downloadId),
    });
  };

  // Link management for links
  const addLinkLink = (linkId: string) => {
    if (!formData.linkedLinkIds.includes(linkId)) {
      setFormData({
        ...formData,
        linkedLinkIds: [...formData.linkedLinkIds, linkId],
      });
    }
  };

  const removeLinkLink = (linkId: string) => {
    setFormData({
      ...formData,
      linkedLinkIds: formData.linkedLinkIds.filter(id => id !== linkId),
    });
  };

  // Link management for questionnaires
  const addQuestionnaireLink = (questionnaireId: string) => {
    if (!formData.linkedQuestionnaireIds.includes(questionnaireId)) {
      setFormData({
        ...formData,
        linkedQuestionnaireIds: [...formData.linkedQuestionnaireIds, questionnaireId],
      });
    }
  };

  const removeQuestionnaireLink = (questionnaireId: string) => {
    setFormData({
      ...formData,
      linkedQuestionnaireIds: formData.linkedQuestionnaireIds.filter(id => id !== questionnaireId),
    });
  };

  // Link management for courses
  const addCourseLink = (courseId: string) => {
    if (!formData.linkedCourseIds.includes(courseId)) {
      setFormData({
        ...formData,
        linkedCourseIds: [...formData.linkedCourseIds, courseId],
      });
    }
  };

  const removeCourseLink = (courseId: string) => {
    setFormData({
      ...formData,
      linkedCourseIds: formData.linkedCourseIds.filter(id => id !== courseId),
    });
  };

  // Filter available items to exclude already linked ones
  const availableSummariesToLink = availableCallSummaries.filter(
    s => !formData.linkedSummaryIds.includes(s.id)
  );
  const availableEventsToLink = availableEvents.filter(
    e => !formData.linkedCallEventIds.includes(e.id)
  );
  const availableArticlesToLink = availableArticles.filter(
    a => !formData.linkedArticleIds.includes(a.id)
  );
  const availableDownloadsToLink = availableDownloads.filter(
    d => !formData.linkedDownloadIds.includes(d.id)
  );
  const availableLinksToLink = availableLinks.filter(
    l => !formData.linkedLinkIds.includes(l.id)
  );
  const availableQuestionnairesToLink = availableQuestionnaires.filter(
    q => !formData.linkedQuestionnaireIds.includes(q.id)
  );
  const availableCoursesToLink = availableCourses.filter(
    c => !formData.linkedCourseIds.includes(c.id)
  );

  // Categorize resources by program attachment
  const programArticles = availableArticlesToLink.filter(
    a => a.programIds?.includes(programId || '')
  );
  const platformArticles = availableArticlesToLink.filter(
    a => !a.programIds?.includes(programId || '')
  );
  const programDownloads = availableDownloadsToLink.filter(
    d => d.programIds?.includes(programId || '')
  );
  const platformDownloads = availableDownloadsToLink.filter(
    d => !d.programIds?.includes(programId || '')
  );
  const programLinks = availableLinksToLink.filter(
    l => l.programIds?.includes(programId || '')
  );
  const platformLinks = availableLinksToLink.filter(
    l => !l.programIds?.includes(programId || '')
  );
  const programCourses = availableCoursesToLink.filter(
    c => c.programIds?.includes(programId || '')
  );
  const platformCourses = availableCoursesToLink.filter(
    c => !c.programIds?.includes(programId || '')
  );
  // Note: Questionnaires don't have programIds - they're always platform-level

  // Task management
  const addTask = () => {
    if (!newTask.trim()) return;
    const task: ProgramTaskTemplate = {
      id: crypto.randomUUID(),
      label: newTask.trim(),
      isPrimary: true,
      type: 'task',
    };
    setFormData({ ...formData, weeklyTasks: [...formData.weeklyTasks, task] });
    setNewTask('');
    trackFieldEdit('syncTasks');
  };

  const removeTask = (index: number) => {
    setFormData({
      ...formData,
      weeklyTasks: formData.weeklyTasks.filter((_, i) => i !== index),
    });
    trackFieldEdit('syncTasks');
  };

  const toggleTaskPrimary = (index: number) => {
    const updated = [...formData.weeklyTasks];
    updated[index] = { ...updated[index], isPrimary: !updated[index].isPrimary };
    setFormData({ ...formData, weeklyTasks: updated });
    trackFieldEdit('syncTasks');
  };

  // Focus management (max 3)
  const addFocus = () => {
    if (!newFocus.trim() || formData.currentFocus.length >= 3) return;
    setFormData({ ...formData, currentFocus: [...formData.currentFocus, newFocus.trim()] });
    setNewFocus('');
    trackFieldEdit('syncFocus');
  };

  const removeFocus = (index: number) => {
    setFormData({
      ...formData,
      currentFocus: formData.currentFocus.filter((_, i) => i !== index),
    });
    trackFieldEdit('syncFocus');
  };

  // Notes management (max 3)
  const addNote = () => {
    if (!newNote.trim() || formData.notes.length >= 3) return;
    setFormData({ ...formData, notes: [...formData.notes, newNote.trim()] });
    setNewNote('');
    trackFieldEdit('syncNotes');
  };

  const removeNote = (index: number) => {
    setFormData({
      ...formData,
      notes: formData.notes.filter((_, i) => i !== index),
    });
    trackFieldEdit('syncNotes');
  };

  // Handle recording file selection
  const handleRecordingSelect = (file: File) => {
    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm'];
    if (!validTypes.some(t => file.type.includes(t.split('/')[1]))) {
      setRecordingError('Invalid file type. Please upload an audio or video file.');
      return;
    }
    // Validate file size (100MB max - Groq limit on paid tier)
    if (file.size > 100 * 1024 * 1024) {
      setRecordingError('File too large. Maximum size is 100MB.');
      return;
    }
    setRecordingFile(file);
    setRecordingError(null);
    setRecordingStatus('idle');
  };

  // Check if we're in cohort mode (group program with cohort selected)
  const isCohortMode = programType === 'group' && !!cohortId;

  // Upload recording and optionally generate summary
  const handleUploadAndGenerateSummary = async () => {
    if (!recordingFile) return;

    // For summary generation, we need either a client context (individual) or cohort context (group)
    if (!clientUserId && !cohortId) {
      setRecordingError(programType === 'group'
        ? 'Please select a cohort to upload recordings'
        : 'Please select a client view to generate summaries');
      return;
    }

    try {
      setRecordingError(null);

      // Check file size limit (Groq supports up to 100MB via URL)
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      if (recordingFile.size > MAX_FILE_SIZE) {
        throw new Error(`File is too large (${(recordingFile.size / (1024 * 1024)).toFixed(1)}MB). Maximum file size is 100MB.`);
      }

      // Get duration for accurate credit calculation
      let durationSeconds: number | undefined;
      try {
        durationSeconds = await getAudioDuration(recordingFile);
        console.log(`[UPLOAD] File: ${recordingFile.name}, Size: ${(recordingFile.size / (1024 * 1024)).toFixed(1)}MB, Duration: ${Math.round(durationSeconds)}s`);
      } catch (durationError) {
        console.warn('Could not get duration, will estimate from file size:', durationError);
      }

      // File info for upload
      const fileName = recordingFile.name;
      const fileType = recordingFile.type || 'audio/mpeg';
      const fileSize = recordingFile.size;

      setRecordingStatus('uploading');
      setUploadProgress(0);

      // Step 1: Get signed URL for direct upload
      const signedUrlResponse = await fetch('/api/coach/recordings/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          fileType,
          fileSize,
        }),
      });

      if (!signedUrlResponse.ok) {
        const errorData = await signedUrlResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to get upload URL (${signedUrlResponse.status})`);
      }

      const { uploadUrl, storagePath } = await signedUrlResponse.json();

      // Step 2: Upload directly to Firebase Storage with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Direct upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error - please check your connection'));
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', fileType);
      xhr.send(recordingFile);

      await uploadPromise;

      setRecordingStatus('processing');

      // Step 3: Trigger processing (pass duration for accurate credit calculation)
      const processResponse = await fetch('/api/coach/recordings/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath,
          fileName,
          fileSize,
          durationSeconds, // Pass actual duration for accurate credit calculation
          clientUserId: clientUserId || undefined,
          cohortId: cohortId || undefined,
          programEnrollmentId: enrollmentId || undefined,
          programId: cohortId && programId ? programId : undefined,
          weekId: cohortId && programId ? week.id : undefined,
        }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Processing failed (${processResponse.status})`);
      }

      const result = await processResponse.json();

      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      // Processing happens in background - coach can navigate away
      // Backend will auto-link summary to cohort_week_content when complete
      setRecordingStatus('background');
      setRecordingFile(null);

      // Call callback if provided (for any additional handling)
      if (result.recordingId) {
        onSummaryGenerated?.(result.recordingId);
      }
    } catch (err) {
      console.error('Error uploading recording:', err);
      setRecordingError(err instanceof Error ? err.message : 'Upload failed');
      setRecordingStatus('error');
    }
  };

  // Simple upload without summary (for template mode)
  const handleSimpleUpload = async (file: File) => {
    try {
      setRecordingStatus('uploading');
      setUploadProgress(0);

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setFormData(prev => ({ ...prev, coachRecordingUrl: data.url }));
      setRecordingStatus('completed');
      setRecordingFile(null);

      setTimeout(() => {
        setRecordingStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Error uploading:', err);
      setRecordingError(err instanceof Error ? err.message : 'Upload failed');
      setRecordingStatus('error');
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <h3 className="text-lg sm:text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {week.name || `Week ${week.weekNumber}`}
          </h3>
          {/* Client/Cohort/Template mode badge */}
          {isClientView ? (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              {clientName || 'Client'}
            </span>
          ) : isCohortMode ? (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <Users className="w-3 h-3" />
              {cohortName || 'Cohort'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-[#f3f1ef] text-[#5f5a55] dark:bg-[#262b35] dark:text-[#b2b6c2]">
              <FileText className="w-3 h-3" />
              Template
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {onFillWithAI && (
            <Button
              variant="outline"
              onClick={onFillWithAI}
              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Fill with</span> AI
            </Button>
          )}

          {/* Sync Button - only for individual programs in template mode */}
          {programType === 'individual' && !isClientView && !isCohortMode && (
            <Button
              variant="outline"
              onClick={() => setSyncDialogOpen(true)}
              className="flex items-center gap-1.5 border-brand-accent text-brand-accent hover:bg-brand-accent/10 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Sync to Clients</span>
              <span className="sm:hidden">Sync</span>
            </Button>
          )}

          {/* Sync to Cohorts Button - only for group programs in template mode */}
          {programType === 'group' && !isClientView && !cohortId && (
            <Button
              variant="outline"
              onClick={() => setCohortSyncDialogOpen(true)}
              className="flex items-center gap-1.5 border-brand-accent text-brand-accent hover:bg-brand-accent/10 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Sync to Cohorts</span>
              <span className="sm:hidden">Sync</span>
            </Button>
          )}
        </div>
      </div>

      {/* Fill source indicator */}
      {week.fillSource && (
        <div className="flex items-center gap-2 p-2 bg-brand-accent/10 rounded-lg">
          <Sparkles className="w-4 h-4 text-brand-accent" />
          <span className="text-sm text-brand-accent font-albert">
            Generated from {week.fillSource.type === 'call_summary' ? 'call summary' : week.fillSource.type}
            {week.fillSource.sourceName && `: ${week.fillSource.sourceName}`}
          </span>
        </div>
      )}

      {/* Basic Info Section - collapsed by default */}
      <CollapsibleSection
        title="Basic Info"
        icon={Info}
        defaultOpen={false}
      >
        {/* Week Theme */}
        <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Theme
          </label>
          <input
            type="text"
            value={formData.theme}
            onChange={(e) => { setFormData({ ...formData, theme: e.target.value }); trackFieldEdit('syncTheme'); }}
            placeholder="e.g., Building Foundations"
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
          />
        </div>

        {/* Week Description */}
        <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => { setFormData({ ...formData, description: e.target.value }); trackFieldEdit('syncName'); }}
            placeholder="What clients will accomplish this week..."
            rows={2}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
          />
        </div>

        {/* Weekly Prompt */}
        <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Weekly Prompt
          </label>
          <textarea
            value={formData.weeklyPrompt}
            onChange={(e) => { setFormData({ ...formData, weeklyPrompt: e.target.value }); trackFieldEdit('syncPrompt'); }}
            placeholder="Motivational message or guidance for this week..."
            rows={2}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
          />
        </div>
      </CollapsibleSection>

      {/* Tasks & Focus Section */}
      <CollapsibleSection
          title="Tasks & Focus"
          icon={ListTodo}
          defaultOpen={true}
        >
          {/* Weekly Tasks */}
          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
              Weekly Tasks
            </label>
            <div className="space-y-2 mb-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleTaskDragEnd}
              >
                <SortableContext
                  items={formData.weeklyTasks.map((_, i) => `task-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {formData.weeklyTasks.map((task, index) => {
                    const taskKey = task.label;
                    const cohortCompletion = cohortId
                      ? (task.id && cohortWeeklyTaskCompletion.get(task.id)) || cohortWeeklyTaskCompletion.get(task.label)
                      : undefined;
                    return (
                      <SortableWeeklyTask
                        key={`task-${index}`}
                        id={`task-${index}`}
                        task={task}
                        index={index}
                        showCompletionStatus={isClientView || !!cohortId}
                        onTogglePrimary={toggleTaskPrimary}
                        onRemove={removeTask}
                        cohortCompletion={cohortCompletion}
                        isCohortMode={isCohortMode}
                        isExpanded={expandedTasks.has(taskKey)}
                        isLoading={loadingTasks.has(taskKey)}
                        members={taskMemberData.get(taskKey) || []}
                        onToggleExpanded={() => toggleTaskExpanded(taskKey)}
                        completionThreshold={completionThreshold}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a task..."
                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]"
              />
              <Button onClick={addTask} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Weekly Outcomes (max 3) */}
          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              <Target className="w-4 h-4 inline mr-1.5" />
              Weekly Outcomes <span className="text-xs text-[#a7a39e] font-normal">(max 3)</span>
            </label>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
              Key outcomes for the client to achieve this week
            </p>
            <div className="space-y-2 mb-3">
              {formData.currentFocus.map((focus, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                >
                  <span className="w-2 h-2 rounded-full bg-brand-accent" />
                  <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {focus}
                  </span>
                  <button
                    onClick={() => removeFocus(index)}
                    className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            {formData.currentFocus.length < 3 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFocus}
                  onChange={(e) => setNewFocus(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addFocus()}
                  placeholder="Add outcome..."
                  className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                />
                <Button onClick={addFocus} variant="outline" size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CollapsibleSection>

      {/* Sessions Section - Linked Calls, Call Summaries, Recordings */}
      <CollapsibleSection
        title="Sessions"
        icon={Video}
        description="Calls, recordings, and summaries"
        defaultOpen={false}
      >
        {/* Linked Call Events - Now at the top */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <Phone className="w-4 h-4 inline mr-1.5" />
            Linked Calls
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Scheduled or completed calls associated with this week
          </p>

          {/* Currently linked events */}
          {formData.linkedCallEventIds.length > 0 && (
            <div className="space-y-2 mb-3">
              {formData.linkedCallEventIds.map((eventId) => {
                const event = availableEvents.find(e => e.id === eventId);
                return (
                  <div
                    key={eventId}
                    className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                  >
                    <Calendar className="w-4 h-4 text-brand-accent" />
                    <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {event?.title || `Event ${eventId.slice(0, 8)}...`}
                    </span>
                    {event?.startDateTime && (
                      <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                        {new Date(event.startDateTime).toLocaleDateString()}
                      </span>
                    )}
                    <button
                      onClick={() => removeEventLink(eventId)}
                      className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add event dropdown */}
          {availableEventsToLink.length > 0 && (
            <select
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addEventLink(e.target.value);
                }
              }}
            >
              <option value="">Add a call event...</option>
              {availableEventsToLink.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title || 'Call'} - {event.startDateTime ? new Date(event.startDateTime).toLocaleDateString() : 'No date'}
                </option>
              ))}
            </select>
          )}

          {formData.linkedCallEventIds.length === 0 && availableEventsToLink.length === 0 && (
            <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic">
              No call events available to link
            </p>
          )}
        </div>

        {/* Linked Call Summaries */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <MessageSquare className="w-4 h-4 inline mr-1.5" />
            Linked Call Summaries
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Call summaries linked to this week for context and action items
          </p>

          {/* Currently linked summaries */}
          {formData.linkedSummaryIds.length > 0 && (
            <div className="space-y-2 mb-3">
              {formData.linkedSummaryIds.map((summaryId) => {
                const summary = availableCallSummaries.find(s => s.id === summaryId);
                const summaryLabel = summary?.summary?.executive
                  ? summary.summary.executive.slice(0, 50) + (summary.summary.executive.length > 50 ? '...' : '')
                  : `Summary ${summaryId.slice(0, 8)}...`;
                return (
                  <div
                    key={summaryId}
                    className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                  >
                    <MessageSquare className="w-4 h-4 text-brand-accent" />
                    <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {summaryLabel}
                    </span>
                    {summary?.createdAt && (
                      <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                        {new Date(summary.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    <button
                      onClick={() => removeSummaryLink(summaryId)}
                      className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add summary dropdown */}
          {availableSummariesToLink.length > 0 && (
            <select
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addSummaryLink(e.target.value);
                }
              }}
            >
              <option value="">Add a call summary...</option>
              {availableSummariesToLink.map((summary) => {
                const label = summary.summary?.executive
                  ? summary.summary.executive.slice(0, 40) + (summary.summary.executive.length > 40 ? '...' : '')
                  : `Summary from ${new Date(summary.createdAt).toLocaleDateString()}`;
                return (
                  <option key={summary.id} value={summary.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          )}

          {formData.linkedSummaryIds.length === 0 && availableSummariesToLink.length === 0 && (
            <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic">
              No call summaries available to link
            </p>
          )}
        </div>

        {/* Coach Recording Upload */}
        <div>
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <Mic className="w-4 h-4 inline mr-1.5" />
            Coach Recording
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Upload a recording to generate an AI summary
            {(isClientView && clientUserId) || isCohortMode ? (
              <span className="text-brand-accent ml-1">(Summary will be linked to this week)</span>
            ) : null}
          </p>

          {/* Already has a recording URL */}
          {formData.coachRecordingUrl && !recordingFile && recordingStatus === 'idle' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg">
                <Mic className="w-4 h-4 text-brand-accent" />
                <a
                  href={formData.coachRecordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-accent hover:underline truncate flex-1"
                >
                  {formData.coachRecordingUrl.split('/').pop() || 'Recording'}
                </a>
                <button
                  onClick={() => setFormData({ ...formData, coachRecordingUrl: '', coachRecordingNotes: '' })}
                  className="p-1 text-[#a7a39e] hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={formData.coachRecordingNotes}
                onChange={(e) => setFormData({ ...formData, coachRecordingNotes: e.target.value })}
                placeholder="Add notes or transcript from this recording..."
                rows={3}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none text-sm"
              />
            </div>
          ) : recordingFile && recordingStatus === 'idle' ? (
            /* File selected, ready to upload */
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg">
                <Mic className="w-4 h-4 text-brand-accent" />
                <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate flex-1">
                  {recordingFile.name}
                </span>
                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                  {(recordingFile.size / (1024 * 1024)).toFixed(1)} MB
                </span>
                <button
                  onClick={() => { setRecordingFile(null); setRecordingError(null); }}
                  className="p-1 text-[#a7a39e] hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                {(isClientView && clientUserId) || isCohortMode ? (
                  <Button
                    onClick={handleUploadAndGenerateSummary}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Summary
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSimpleUpload(recordingFile)}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Recording
                  </Button>
                )}
              </div>
              {/* Guidance message for template mode */}
              {!isClientView && !isCohortMode && (
                <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] italic">
                  {programType === 'group'
                    ? 'Select a cohort to upload recordings and generate AI summaries'
                    : 'Switch to a client view to generate AI summaries'}
                </p>
              )}
            </div>
          ) : recordingStatus === 'uploading' ? (
            /* Uploading state */
            <div className="p-4 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Uploading... {uploadProgress}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-accent transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : recordingStatus === 'processing' || recordingStatus === 'background' ? (
            /* Processing/Background state - keep spinner, show "you can leave" message */
            <div className="p-4 border border-brand-accent/30 bg-brand-accent/5 rounded-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                <div>
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Generating AI summary...
                  </p>
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                    You can leave this page. The summary will appear in Linked Call Summaries when ready.
                  </p>
                </div>
              </div>
            </div>
          ) : recordingStatus === 'completed' ? (
            /* Completed state */
            <div className="p-4 border border-green-500/30 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    Summary generated successfully!
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Linked to this week&apos;s call summaries
                  </p>
                </div>
              </div>
            </div>
          ) : recordingStatus === 'error' ? (
            /* Error state with dismiss X */
            <div className="p-4 border border-red-500/30 bg-red-50 dark:bg-red-900/20 rounded-lg relative">
              <button
                onClick={() => { setRecordingStatus('idle'); setRecordingError(null); setPendingRecordingId(null); }}
                className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-3 pr-6">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    {recordingError?.includes('Insufficient credits') ? 'Insufficient credits' : 'Processing failed'}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {recordingError?.includes('Insufficient credits') ? (
                      <a href="/coach/plan" className="underline hover:text-red-700 dark:hover:text-red-300">
                        Upgrade your plan or buy extra credits
                      </a>
                    ) : (
                      recordingError || 'An error occurred while processing the recording'
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : !isClientView && !isCohortMode ? (
            /* Template mode: Show disabled overlay */
            <div className="relative border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-6 text-center bg-[#faf8f6] dark:bg-[#1e222a]/50">
              <Upload className="w-8 h-8 text-[#c9c5c0] dark:text-[#4a4f5c] mx-auto mb-2" />
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-1">
                Recording uploads are not available for templates
              </p>
              <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] font-albert">
                {programType === 'group'
                  ? 'Select a cohort above to upload recordings and generate AI summaries'
                  : 'Select a client above to upload recordings and generate AI summaries'}
              </p>
            </div>
          ) : (
            /* Default: File selector */
            <div className="relative border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-6 text-center hover:border-brand-accent/50 transition-colors">
              <Upload className="w-8 h-8 text-[#a7a39e] dark:text-[#7d8190] mx-auto mb-2" />
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                Drag & drop or click to upload
              </p>
              <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                MP3, MP4, WAV, M4A, or WebM up to 100MB
              </p>
              <input
                type="file"
                accept="audio/*,video/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleRecordingSelect(file);
                  }
                }}
              />
            </div>
          )}

          {/* Error message */}
          {recordingError && recordingStatus === 'idle' && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{recordingError}</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Resources Section - Articles, Downloads, Links, Questionnaires */}
      <CollapsibleSection
        title="Resources"
        icon={BookOpen}
        description="Content to share with clients during this week"
        defaultOpen={false}
      >
        {/* Linked Articles */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <FileText className="w-4 h-4 inline mr-1.5" />
            Articles
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Reading materials and guides for this week
          </p>

          {/* Currently linked articles */}
          {formData.linkedArticleIds.length > 0 && (
            <div className="space-y-2 mb-3">
              {formData.linkedArticleIds.map((articleId) => {
                const article = availableArticles.find(a => a.id === articleId);
                return (
                  <div
                    key={articleId}
                    className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                  >
                    <FileText className="w-4 h-4 text-brand-accent" />
                    <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {article?.title || `Article ${articleId.slice(0, 8)}...`}
                    </span>
                    <button
                      onClick={() => removeArticleLink(articleId)}
                      className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add article dropdown */}
          <ResourceLinkDropdown
            placeholder="Add an article..."
            icon={FileText}
            groups={[
              {
                label: 'Program Content',
                items: programArticles.map(a => ({ id: a.id, title: a.title })),
                iconClassName: 'text-brand-accent',
              },
              {
                label: 'Platform Content',
                items: platformArticles.map(a => ({ id: a.id, title: a.title })),
                iconClassName: 'text-[#8c8c8c]',
              },
            ]}
            onSelect={addArticleLink}
            onCreateNew={() => { window.location.href = '/coach?tab=discover'; }}
            createNewLabel="Create new article"
          />

          {formData.linkedArticleIds.length === 0 && availableArticlesToLink.length === 0 && (
            <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-2">
              No articles available to link
            </p>
          )}
        </div>

        {/* Linked Downloads */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <Download className="w-4 h-4 inline mr-1.5" />
            Downloads
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Files and templates clients can download
          </p>

          {/* Currently linked downloads */}
          {formData.linkedDownloadIds.length > 0 && (
            <div className="space-y-2 mb-3">
              {formData.linkedDownloadIds.map((downloadId) => {
                const download = availableDownloads.find(d => d.id === downloadId);
                return (
                  <div
                    key={downloadId}
                    className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                  >
                    <Download className="w-4 h-4 text-brand-accent" />
                    <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {download?.title || `Download ${downloadId.slice(0, 8)}...`}
                    </span>
                    <button
                      onClick={() => removeDownloadLink(downloadId)}
                      className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add download dropdown */}
          <ResourceLinkDropdown
            placeholder="Add a download..."
            icon={Download}
            groups={[
              {
                label: 'Program Content',
                items: programDownloads.map(d => ({ id: d.id, title: d.title })),
                iconClassName: 'text-brand-accent',
              },
              {
                label: 'Platform Content',
                items: platformDownloads.map(d => ({ id: d.id, title: d.title })),
                iconClassName: 'text-[#8c8c8c]',
              },
            ]}
            onSelect={addDownloadLink}
            onCreateNew={() => { window.location.href = '/coach?tab=discover'; }}
            createNewLabel="Create new download"
          />

          {formData.linkedDownloadIds.length === 0 && availableDownloadsToLink.length === 0 && (
            <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-2">
              No downloads available to link
            </p>
          )}
        </div>

        {/* Linked Links */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <Link2 className="w-4 h-4 inline mr-1.5" />
            External Links
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Helpful websites and external resources
          </p>

          {/* Currently linked links */}
          {formData.linkedLinkIds.length > 0 && (
            <div className="space-y-2 mb-3">
              {formData.linkedLinkIds.map((linkId) => {
                const link = availableLinks.find(l => l.id === linkId);
                return (
                  <div
                    key={linkId}
                    className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                  >
                    <Link2 className="w-4 h-4 text-brand-accent" />
                    <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {link?.title || `Link ${linkId.slice(0, 8)}...`}
                    </span>
                    <button
                      onClick={() => removeLinkLink(linkId)}
                      className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add link dropdown */}
          <ResourceLinkDropdown
            placeholder="Add a link..."
            icon={Link2}
            groups={[
              {
                label: 'Program Content',
                items: programLinks.map(l => ({ id: l.id, title: l.title })),
                iconClassName: 'text-brand-accent',
              },
              {
                label: 'Platform Content',
                items: platformLinks.map(l => ({ id: l.id, title: l.title })),
                iconClassName: 'text-[#8c8c8c]',
              },
            ]}
            onSelect={addLinkLink}
            onCreateNew={() => { window.location.href = '/coach?tab=discover'; }}
            createNewLabel="Create new link"
          />

          {formData.linkedLinkIds.length === 0 && availableLinksToLink.length === 0 && (
            <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-2">
              No links available
            </p>
          )}
        </div>

        {/* Linked Questionnaires */}
        <div>
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <FileQuestion className="w-4 h-4 inline mr-1.5" />
            Questionnaires
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Forms and surveys for clients to complete
          </p>

          {/* Currently linked questionnaires */}
          {formData.linkedQuestionnaireIds.length > 0 && (
            <div className="space-y-2 mb-3">
              {formData.linkedQuestionnaireIds.map((questionnaireId) => {
                const questionnaire = availableQuestionnaires.find(q => q.id === questionnaireId);
                return (
                  <div
                    key={questionnaireId}
                    className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                  >
                    <FileQuestion className="w-4 h-4 text-brand-accent" />
                    <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {questionnaire?.title || `Questionnaire ${questionnaireId.slice(0, 8)}...`}
                    </span>
                    <button
                      onClick={() => removeQuestionnaireLink(questionnaireId)}
                      className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add questionnaire dropdown */}
          <ResourceLinkDropdown
            placeholder="Add a questionnaire..."
            icon={FileQuestion}
            groups={[
              {
                label: 'Platform Content',
                items: availableQuestionnairesToLink.map(q => ({ id: q.id, title: q.title })),
                iconClassName: 'text-[#8c8c8c]',
              },
            ]}
            onSelect={addQuestionnaireLink}
            onCreateNew={() => { window.location.href = '/coach?tab=discover'; }}
            createNewLabel="Create new questionnaire"
          />

          {formData.linkedQuestionnaireIds.length === 0 && availableQuestionnairesToLink.length === 0 && (
            <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-2">
              No questionnaires available
            </p>
          )}
        </div>

        {/* Linked Courses */}
        <div>
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <GraduationCap className="w-4 h-4 inline mr-1.5" />
            Courses
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Learning courses for clients to complete this week
          </p>

          {/* Currently linked courses */}
          {formData.linkedCourseIds.length > 0 && (
            <div className="space-y-2 mb-3">
              {formData.linkedCourseIds.map((courseId) => {
                const course = availableCourses.find(c => c.id === courseId);
                return (
                  <div
                    key={courseId}
                    className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                  >
                    <GraduationCap className="w-4 h-4 text-brand-accent" />
                    <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {course?.title || `Course ${courseId.slice(0, 8)}...`}
                    </span>
                    <button
                      onClick={() => removeCourseLink(courseId)}
                      className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add course dropdown */}
          <ResourceLinkDropdown
            placeholder="Add a course..."
            icon={GraduationCap}
            groups={[
              {
                label: 'Program Content',
                items: programCourses.map(c => ({ id: c.id, title: c.title })),
                iconClassName: 'text-brand-accent',
              },
              {
                label: 'Platform Content',
                items: platformCourses.map(c => ({ id: c.id, title: c.title })),
                iconClassName: 'text-[#8c8c8c]',
              },
            ]}
            onSelect={addCourseLink}
            onCreateNew={() => { window.location.href = '/coach?tab=discover'; }}
            createNewLabel="Create new course"
          />

          {formData.linkedCourseIds.length === 0 && availableCoursesToLink.length === 0 && (
            <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-2">
              No courses available
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* Notes Section - collapsed by default */}
      <CollapsibleSection
        title="Notes"
        icon={ClipboardList}
        defaultOpen={false}
      >
        {/* Client Notes (max 3) */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <FileText className="w-4 h-4 inline mr-1.5" />
            Client Notes <span className="text-xs text-[#a7a39e] font-normal">(max 3)</span>
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Reminders or context for the client
          </p>
          <div className="space-y-2 mb-3">
            {formData.notes.map((note, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
              >
                <span className="w-2 h-2 rounded-full bg-[#a7a39e]" />
                <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {note}
                </span>
                <button
                  onClick={() => removeNote(index)}
                  className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {formData.notes.length < 3 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Add note..."
                className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
              />
              <Button onClick={addNote} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Private Notes - Coach only */}
        <div>
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            <StickyNote className="w-4 h-4 inline mr-1.5" />
            Private Notes
            <span className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-normal ml-2">Not visible to clients</span>
          </label>
          <textarea
            value={formData.manualNotes}
            onChange={(e) => setFormData({ ...formData, manualNotes: e.target.value })}
            placeholder="Add your notes from calls, observations, or planning..."
            rows={4}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
          />
        </div>
      </CollapsibleSection>

      {/* Sync to Clients Dialog */}
      {programId && (
        <SyncToClientsDialog
          open={syncDialogOpen}
          onOpenChange={setSyncDialogOpen}
          programId={programId}
          weekNumber={week.weekNumber}
          enrollments={enrollments}
          editedFields={editedFields}
          onSyncComplete={() => {
            setShowSyncButton(false);
            setEditedFields(new Set());
          }}
        />
      )}

      {/* Sync to Cohorts Dialog */}
      {programId && programType === 'group' && (
        <SyncToCohortsDialog
          open={cohortSyncDialogOpen}
          onOpenChange={setCohortSyncDialogOpen}
          programId={programId}
          weekNumber={week.weekNumber}
          cohorts={cohorts}
          editedFields={editedFields}
          onSyncComplete={() => {
            setShowSyncButton(false);
            setEditedFields(new Set());
          }}
        />
      )}
    </div>
  );
}
