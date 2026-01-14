'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ProgramDay, ProgramTaskTemplate, ProgramHabitTemplate, DayCourseAssignment, ClientViewContext, CohortViewContext, DiscoverArticle, DiscoverDownload, DiscoverLink, Questionnaire } from '@/types';
import { Plus, X, ListTodo, Repeat, Target, Trash2, ArrowLeftRight, ChevronDown, ChevronRight, Pencil, Loader2, BookOpen, Download, Link2, FileQuestion, FileText } from 'lucide-react';
import { useProgramEditorOptional } from '@/contexts/ProgramEditorContext';
import { useInstanceIdLookup } from '@/hooks/useProgramInstanceBridge';
import { Button } from '@/components/ui/button';
import { DayCourseSelector } from './DayCourseSelector';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Extended completion data for cohort tasks
interface CohortTaskCompletionData {
  completionRate: number;
  completed: boolean;
  completedCount: number;
  totalMembers: number;
}

// Member info for task breakdown
interface TaskMemberInfo {
  userId: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  status: 'pending' | 'completed';
  completedAt?: string;
}

// Client task completion data (for 1:1 programs)
interface ClientTaskCompletionData {
  completed: boolean;
  completedAt?: string;
}

interface DayEditorProps {
  dayIndex: number;
  day: ProgramDay | null;
  programId?: string;
  programType?: 'individual' | 'group';
  dailyFocusSlots?: number;
  // View context (template vs client vs cohort)
  clientViewContext?: ClientViewContext;
  cohortViewContext?: CohortViewContext;
  // Task completion tracking for cohorts (extended with member counts)
  cohortTaskCompletion?: Map<string, CohortTaskCompletionData>;
  // Task completion tracking for individual clients
  clientTaskCompletion?: Map<string, ClientTaskCompletionData>;
  // Completion threshold (default 50%)
  completionThreshold?: number;
  // Current date for task queries
  currentDate?: string;
  // API base path
  apiBasePath: string;
  // Callbacks
  onSave?: () => void;
  saving?: boolean;
  saveError?: string | null;
  // NEW: Instance ID for migrated data (uses new unified API when present)
  instanceId?: string | null;
  // Available content for linking (passed from parent)
  availableArticles?: DiscoverArticle[];
  availableDownloads?: DiscoverDownload[];
  availableLinks?: DiscoverLink[];
  availableQuestionnaires?: Questionnaire[];
}

// Form data type
export interface DayFormData {
  title: string;
  summary: string;
  dailyPrompt: string;
  tasks: ProgramTaskTemplate[];
  habits: ProgramHabitTemplate[];
  courseAssignments: DayCourseAssignment[];
  // Linked content
  linkedArticleIds: string[];
  linkedDownloadIds: string[];
  linkedLinkIds: string[];
  linkedQuestionnaireIds: string[];
}

/**
 * Editor for program day content
 * Manages tasks, habits, and course assignments with centralized save
 */
export function DayEditor({
  dayIndex,
  day,
  programId,
  programType,
  dailyFocusSlots = 2,
  clientViewContext,
  cohortViewContext,
  cohortTaskCompletion = new Map(),
  clientTaskCompletion = new Map(),
  completionThreshold = 50,
  currentDate,
  apiBasePath,
  onSave,
  saving = false,
  saveError,
  instanceId,
  availableArticles = [],
  availableDownloads = [],
  availableLinks = [],
  availableQuestionnaires = [],
}: DayEditorProps) {
  // Program editor context for centralized save
  const editorContext = useProgramEditorOptional();

  // State for expanded tasks (to show member breakdown)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [taskMemberData, setTaskMemberData] = useState<Map<string, TaskMemberInfo[]>>(new Map());
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());

  // Toggle task expansion
  const toggleTaskExpanded = (taskKey: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskKey)) {
        next.delete(taskKey);
      } else {
        next.add(taskKey);
      }
      return next;
    });
  };

  // Determine view context with proper type narrowing
  const isClientMode = programType === 'individual' && clientViewContext?.mode === 'client';
  const isCohortMode = programType === 'group' && cohortViewContext?.mode === 'cohort';
  const viewContext = isClientMode ? 'client' : isCohortMode ? 'cohort' : 'template';

  // Get the context ID with proper type narrowing
  const clientEnrollmentId = isClientMode && clientViewContext?.mode === 'client' ? clientViewContext.enrollmentId : undefined;
  const cohortIdValue = isCohortMode && cohortViewContext?.mode === 'cohort' ? cohortViewContext.cohortId : undefined;
  const clientContextId = clientEnrollmentId || cohortIdValue;

  // Lookup instanceId if not provided (for migration support)
  const { instanceId: lookedUpInstanceId, isLoading: instanceLookupLoading } = useInstanceIdLookup({
    programId: programId || '',
    enrollmentId: clientEnrollmentId,
    cohortId: cohortIdValue,
  });
  
  const effectiveInstanceId = instanceId || lookedUpInstanceId;
  
  // Determine if we're in a client/cohort context (not template mode)
  const isInstanceContext = !!(cohortIdValue || clientEnrollmentId);

  // Fetch member breakdown for a task (lazy load)
  const fetchTaskMembers = useCallback(async (taskId: string, taskLabel: string) => {
    if (!isCohortMode || !cohortIdValue) return;

    setLoadingTasks(prev => new Set(prev).add(taskLabel));

    try {
      const params = new URLSearchParams();
      if (currentDate) {
        params.set('date', currentDate);
      }

      const response = await fetch(
        `/api/coach/cohort-tasks/${cohortIdValue}/task/${encodeURIComponent(taskId || taskLabel)}?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setTaskMemberData(prev => new Map(prev).set(taskLabel, data.memberBreakdown || []));
      }
    } catch (err) {
      console.error('Error fetching task members:', err);
    } finally {
      setLoadingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskLabel);
        return next;
      });
    }
  }, [isCohortMode, cohortIdValue, currentDate]);

  // Helper to get progress bar color
  const getProgressColor = (rate: number, threshold: number): string => {
    if (rate >= threshold) return 'bg-green-500';
    if (rate >= threshold - 15) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  // Build API endpoint based on view context
  const getApiEndpoint = useCallback(() => {
    if (!programId) return '';
    // Use instance-based API when available (migrated or looked up)
    if (effectiveInstanceId) {
      return `/api/instances/${effectiveInstanceId}/days/${dayIndex}`;
    }
    const base = `${apiBasePath}/${programId}`;
    if (isClientMode && clientEnrollmentId) {
      return `${base}/client-days`;
    } else if (isCohortMode && cohortIdValue) {
      return `${base}/cohort-days`;
    }
    return `${base}/days`;
  }, [apiBasePath, programId, effectiveInstanceId, dayIndex, isClientMode, isCohortMode, clientEnrollmentId, cohortIdValue]);

  // Track last reset version to detect discard/save
  const lastResetVersion = useRef(editorContext?.resetVersion ?? 0);
  const lastDayIndex = useRef(dayIndex);

  // Memoize day data as primitives to prevent infinite loops from object reference changes
  const dayTitle = day?.title || '';
  const daySummary = day?.summary || '';
  const dayDailyPrompt = day?.dailyPrompt || '';
  const dayTasks = day?.tasks || [];
  const dayHabits = day?.habits || [];
  const dayCourseAssignments = day?.courseAssignments || [];
  const dayLinkedArticleIds = day?.linkedArticleIds || [];
  const dayLinkedDownloadIds = day?.linkedDownloadIds || [];
  const dayLinkedLinkIds = day?.linkedLinkIds || [];
  const dayLinkedQuestionnaireIds = day?.linkedQuestionnaireIds || [];

  // Get default form data from day
  const getDefaultFormData = useCallback((): DayFormData => ({
    title: dayTitle,
    summary: daySummary,
    dailyPrompt: dayDailyPrompt,
    tasks: dayTasks,
    habits: dayHabits,
    courseAssignments: dayCourseAssignments,
    linkedArticleIds: dayLinkedArticleIds,
    linkedDownloadIds: dayLinkedDownloadIds,
    linkedLinkIds: dayLinkedLinkIds,
    linkedQuestionnaireIds: dayLinkedQuestionnaireIds,
  }), [dayTitle, daySummary, dayDailyPrompt, dayTasks, dayHabits, dayCourseAssignments, dayLinkedArticleIds, dayLinkedDownloadIds, dayLinkedLinkIds, dayLinkedQuestionnaireIds]);

  // Check for pending data from context
  const entityId = `day-${dayIndex}`;
  const pendingData = editorContext?.getPendingData('day', entityId, clientContextId);

  const [formData, setFormData] = useState<DayFormData>(() => {
    if (pendingData) {
      return pendingData as unknown as DayFormData;
    }
    return getDefaultFormData();
  });
  const [hasChanges, setHasChanges] = useState(!!pendingData);

  // Fetch members when task is expanded
  useEffect(() => {
    expandedTasks.forEach(taskLabel => {
      const task = formData.tasks.find(t => t.label === taskLabel);
      if (task && !taskMemberData.has(taskLabel) && !loadingTasks.has(taskLabel)) {
        fetchTaskMembers(task.id || taskLabel, taskLabel);
      }
    });
  }, [expandedTasks, formData.tasks, taskMemberData, loadingTasks, fetchTaskMembers]);

  // Track previous view context to detect changes
  const lastViewContext = useRef(viewContext);
  const lastClientContextId = useRef(clientContextId);

  // Reset when day index changes
  useEffect(() => {
    if (dayIndex !== lastDayIndex.current) {
      lastDayIndex.current = dayIndex;
      // Check for pending data for the new day
      const newEntityId = `day-${dayIndex}`;
      const contextPendingData = editorContext?.getPendingData('day', newEntityId, clientContextId);
      if (contextPendingData) {
        setFormData(contextPendingData as unknown as DayFormData);
        setHasChanges(true);
      } else {
        // Inline form data to avoid callback dependency issues
        setFormData({
          title: day?.title || '',
          summary: day?.summary || '',
          dailyPrompt: day?.dailyPrompt || '',
          tasks: day?.tasks || [],
          habits: day?.habits || [],
          courseAssignments: day?.courseAssignments || [],
          linkedArticleIds: day?.linkedArticleIds || [],
          linkedDownloadIds: day?.linkedDownloadIds || [],
          linkedLinkIds: day?.linkedLinkIds || [],
          linkedQuestionnaireIds: day?.linkedQuestionnaireIds || [],
        });
        setHasChanges(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIndex, editorContext, clientContextId]);

  // CRITICAL: Reset form when view context changes (template ↔ client ↔ cohort)
  // This ensures template changes don't persist when switching to client/cohort mode
  useEffect(() => {
    const viewContextChanged = viewContext !== lastViewContext.current;
    const contextIdChanged = clientContextId !== lastClientContextId.current;

    if (viewContextChanged || contextIdChanged) {
      console.log('[DayEditor] View context changed, resetting form:', {
        prevView: lastViewContext.current,
        newView: viewContext,
        prevContextId: lastClientContextId.current,
        newContextId: clientContextId,
        dayIndex,
      });

      lastViewContext.current = viewContext;
      lastClientContextId.current = clientContextId;

      // Check for pending data in the NEW context
      const contextPendingData = editorContext?.getPendingData('day', entityId, clientContextId);
      if (contextPendingData) {
        setFormData(contextPendingData as unknown as DayFormData);
        setHasChanges(true);
      } else {
        // Reset to the day data for the new context - inline to avoid callback dependency
        setFormData({
          title: day?.title || '',
          summary: day?.summary || '',
          dailyPrompt: day?.dailyPrompt || '',
          tasks: day?.tasks || [],
          habits: day?.habits || [],
          courseAssignments: day?.courseAssignments || [],
          linkedArticleIds: day?.linkedArticleIds || [],
          linkedDownloadIds: day?.linkedDownloadIds || [],
          linkedLinkIds: day?.linkedLinkIds || [],
          linkedQuestionnaireIds: day?.linkedQuestionnaireIds || [],
        });
        setHasChanges(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewContext, clientContextId, editorContext, entityId, dayIndex]);

  // Stable serialized versions of arrays for dependency comparison
  const tasksJson = useMemo(() => JSON.stringify(day?.tasks), [day?.tasks]);
  const habitsJson = useMemo(() => JSON.stringify(day?.habits), [day?.habits]);

  // Reset when the day data changes (from props) and there's no pending data
  // CRITICAL: Include clientContextId in deps so we check the correct context's pending data
  useEffect(() => {
    // Only check pending data for the CURRENT context (not stale template context)
    const contextPendingData = editorContext?.getPendingData('day', entityId, clientContextId);
    if (!contextPendingData && dayIndex === lastDayIndex.current) {
      console.log('[DayEditor] Day data changed, resetting form:', {
        dayIndex,
        viewContext,
        clientContextId,
        hasPendingData: !!contextPendingData,
        newTasks: day?.tasks?.length ?? 0,
      });
      // Inline the form data to avoid dependency on getDefaultFormData callback
      setFormData({
        title: day?.title || '',
        summary: day?.summary || '',
        dailyPrompt: day?.dailyPrompt || '',
        tasks: day?.tasks || [],
        habits: day?.habits || [],
        courseAssignments: day?.courseAssignments || [],
        linkedArticleIds: day?.linkedArticleIds || [],
        linkedDownloadIds: day?.linkedDownloadIds || [],
        linkedLinkIds: day?.linkedLinkIds || [],
        linkedQuestionnaireIds: day?.linkedQuestionnaireIds || [],
      });
      setHasChanges(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.title, day?.summary, day?.dailyPrompt, tasksJson, habitsJson, clientContextId, entityId, dayIndex, viewContext]);

  // Watch for reset version changes (discard/save from global buttons)
  useEffect(() => {
    if (editorContext && editorContext.resetVersion !== lastResetVersion.current) {
      lastResetVersion.current = editorContext.resetVersion;
      // Reset to original day data - inline to avoid callback dependency
      setFormData({
        title: day?.title || '',
        summary: day?.summary || '',
        dailyPrompt: day?.dailyPrompt || '',
        tasks: day?.tasks || [],
        habits: day?.habits || [],
        courseAssignments: day?.courseAssignments || [],
        linkedArticleIds: day?.linkedArticleIds || [],
        linkedDownloadIds: day?.linkedDownloadIds || [],
        linkedLinkIds: day?.linkedLinkIds || [],
        linkedQuestionnaireIds: day?.linkedQuestionnaireIds || [],
      });
      setHasChanges(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorContext?.resetVersion]);

  // Check for changes and register with context
  useEffect(() => {
    // Inline default data to avoid dependency on getDefaultFormData callback
    const defaultData: DayFormData = {
      title: dayTitle,
      summary: daySummary,
      dailyPrompt: dayDailyPrompt,
      tasks: dayTasks,
      habits: dayHabits,
      courseAssignments: dayCourseAssignments,
      linkedArticleIds: dayLinkedArticleIds,
      linkedDownloadIds: dayLinkedDownloadIds,
      linkedLinkIds: dayLinkedLinkIds,
      linkedQuestionnaireIds: dayLinkedQuestionnaireIds,
    };
    const changed =
      formData.title !== defaultData.title ||
      formData.summary !== defaultData.summary ||
      formData.dailyPrompt !== defaultData.dailyPrompt ||
      JSON.stringify(formData.tasks) !== JSON.stringify(defaultData.tasks) ||
      JSON.stringify(formData.habits) !== JSON.stringify(defaultData.habits) ||
      JSON.stringify(formData.courseAssignments) !== JSON.stringify(defaultData.courseAssignments) ||
      JSON.stringify(formData.linkedArticleIds) !== JSON.stringify(defaultData.linkedArticleIds) ||
      JSON.stringify(formData.linkedDownloadIds) !== JSON.stringify(defaultData.linkedDownloadIds) ||
      JSON.stringify(formData.linkedLinkIds) !== JSON.stringify(defaultData.linkedLinkIds) ||
      JSON.stringify(formData.linkedQuestionnaireIds) !== JSON.stringify(defaultData.linkedQuestionnaireIds);
    setHasChanges(changed);

    // Register changes with context if available
    if (editorContext && changed && programId) {
      // GUARD: In client/cohort mode, we MUST have an instanceId before registering changes
      // Otherwise, the save would incorrectly go to the deprecated cohort-days/client-days API
      if (isInstanceContext && !effectiveInstanceId) {
        if (instanceLookupLoading) {
          // Still loading - wait for instance to be found/created
          console.log('[DAY_EDITOR] Waiting for instance lookup before registering change...');
          return;
        }
        // Not loading but no instanceId - this shouldn't happen, but log it
        console.warn('[DAY_EDITOR] In client/cohort mode but no instanceId available after lookup');
        return;
      }
      
      // Build request body based on context
      let requestBody: Record<string, unknown> = {
        dayIndex,
        ...formData,
      };
      if (isClientMode && clientEnrollmentId) {
        requestBody.enrollmentId = clientEnrollmentId;
      } else if (isCohortMode && cohortIdValue) {
        requestBody.cohortId = cohortIdValue;
      }

      // CRITICAL: When registering a client/cohort change, discard any template change
      // for the same day to prevent dual saves (template + cohort both being saved)
      if (viewContext !== 'template' && clientContextId) {
        const templateKey = editorContext.getChangeKey('day', entityId, undefined);
        editorContext.discardChange(templateKey);
      }

      // Use PATCH for instance-based endpoints, POST for legacy endpoints
      const apiEndpoint = getApiEndpoint();
      const isInstanceEndpoint = apiEndpoint.includes('/api/instances/');
      editorContext.registerChange({
        entityType: 'day',
        entityId,
        dayIndex,
        viewContext: viewContext as 'template' | 'client' | 'cohort',
        clientContextId,
        originalData: defaultData as unknown as Record<string, unknown>,
        pendingData: requestBody,
        apiEndpoint,
        httpMethod: isInstanceEndpoint ? 'PATCH' : 'POST',
      });
    } else if (editorContext && !changed) {
      // Remove from pending changes if no longer changed
      const changeKey = editorContext.getChangeKey('day', entityId, clientContextId);
      editorContext.discardChange(changeKey);
    }
  // Use stable primitive values instead of `day` object and `getDefaultFormData` callback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, tasksJson, habitsJson, dayTitle, daySummary, dayDailyPrompt, dayTasks, dayHabits, dayCourseAssignments, editorContext, programId, viewContext, clientContextId, getApiEndpoint, dayIndex, entityId, isClientMode, isCohortMode, clientEnrollmentId, cohortIdValue, isInstanceContext, effectiveInstanceId, instanceLookupLoading]);

  // Pre-fetch member data for all tasks in cohort mode to show accurate badge counts
  // This runs only when cohort mode is active and tasks change
  useEffect(() => {
    if (!isCohortMode || formData.tasks.length === 0) return;

    // Fetch member data for each task that we don't already have
    formData.tasks.forEach(task => {
      const taskLabel = task.label;
      if (taskLabel && !taskMemberData.has(taskLabel) && !loadingTasks.has(taskLabel)) {
        fetchTaskMembers(task.id || taskLabel, taskLabel);
      }
    });
    // Note: taskMemberData and loadingTasks are checked inside the loop guards to prevent re-fetching
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCohortMode, cohortIdValue, formData.tasks.length, fetchTaskMembers]);

  // Task management
  const addTask = () => {
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, { id: crypto.randomUUID(), label: '', isPrimary: true }],
    }));
  };

  const updateTask = (index: number, updates: Partial<ProgramTaskTemplate>) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => i === index ? { ...task, ...updates } : task),
    }));
  };

  const removeTask = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index),
    }));
  };

  // Habit management
  const addHabit = () => {
    setFormData(prev => ({
      ...prev,
      habits: [...prev.habits, { title: '', frequency: 'daily' }],
    }));
  };

  const updateHabit = (index: number, updates: Partial<ProgramHabitTemplate>) => {
    setFormData(prev => ({
      ...prev,
      habits: prev.habits.map((habit, i) => i === index ? { ...habit, ...updates } : habit),
    }));
  };

  const removeHabit = (index: number) => {
    setFormData(prev => ({
      ...prev,
      habits: prev.habits.filter((_, i) => i !== index),
    }));
  };

  // Link management functions for articles
  const addArticleLink = (articleId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedArticleIds: [...prev.linkedArticleIds, articleId],
    }));
  };

  const removeArticleLink = (articleId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedArticleIds: prev.linkedArticleIds.filter(id => id !== articleId),
    }));
  };

  // Link management functions for downloads
  const addDownloadLink = (downloadId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedDownloadIds: [...prev.linkedDownloadIds, downloadId],
    }));
  };

  const removeDownloadLink = (downloadId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedDownloadIds: prev.linkedDownloadIds.filter(id => id !== downloadId),
    }));
  };

  // Link management functions for links
  const addLinkLink = (linkId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedLinkIds: [...prev.linkedLinkIds, linkId],
    }));
  };

  const removeLinkLink = (linkId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedLinkIds: prev.linkedLinkIds.filter(id => id !== linkId),
    }));
  };

  // Link management functions for questionnaires
  const addQuestionnaireLink = (questionnaireId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedQuestionnaireIds: [...prev.linkedQuestionnaireIds, questionnaireId],
    }));
  };

  const removeQuestionnaireLink = (questionnaireId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedQuestionnaireIds: prev.linkedQuestionnaireIds.filter(id => id !== questionnaireId),
    }));
  };

  // Filter available items to exclude already linked ones
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
  // Note: Questionnaires don't have programIds - they're always platform-level

  // Focus count warning check
  const focusCount = formData.tasks.filter(t => t.isPrimary).length;
  const showFocusWarning = focusCount > dailyFocusSlots;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Day {dayIndex}
        </h3>
        {hasChanges && !editorContext && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
        )}
      </div>

      {/* Day Title */}
      <div>
        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
          Day Theme (optional)
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
          value={formData.dailyPrompt}
          onChange={(e) => setFormData({ ...formData, dailyPrompt: e.target.value })}
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
        {showFocusWarning && (
          <div className="mb-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl">
            <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300 font-albert">
              This day has {focusCount} focus tasks, but your program contributes {dailyFocusSlots}. Extra tasks will go to users&apos; backlog.
            </p>
          </div>
        )}
        
        <div className="space-y-2">
          {formData.tasks.map((task, index) => {
            // Check for cohort completion data - try matching by task ID first, then fall back to label
            const cohortCompletion = isCohortMode
              ? (task.id && cohortTaskCompletion.get(task.id)) || cohortTaskCompletion.get(task.label)
              : undefined;
            const isTaskExpanded = expandedTasks.has(task.label);
            const isLoading = loadingTasks.has(task.label);
            const members = taskMemberData.get(task.label) || [];
            // Derive completion data from members array if cohortCompletion not available
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
            const hasCompletionData = isCohortMode && (cohortCompletion || hasMemberData);

            // Check for 1:1 client completion - use clientTaskCompletion map from API
            // Keys can be: "dayIndex:taskLabel" (precise), "taskLabel" (fallback), or task.id
            const clientCompletion = isClientMode
              ? clientTaskCompletion.get(`${dayIndex}:${task.label}`) ||
                (task.id && clientTaskCompletion.get(task.id)) ||
                clientTaskCompletion.get(task.label)
              : undefined;
            const isClientCompleted = isClientMode && (clientCompletion?.completed ?? task.completed);
            const isCohortCompleted = cohortCompletion?.completed ?? (completionRate >= completionThreshold);

            return (
              <div
                key={index}
                className={cn(
                  "group relative bg-white dark:bg-[#171b22] border rounded-xl transition-all duration-200",
                  isCohortCompleted || isClientCompleted
                    ? "border-brand-accent/30 bg-brand-accent/5"
                    : "border-[#e1ddd8] dark:border-[#262b35] hover:shadow-sm hover:border-[#d4d0cb] dark:hover:border-[#313746]"
                )}
              >
                {/* Main task row */}
                <div className="flex items-center gap-3 p-4">
                  {/* Expand/collapse button for cohort mode (show even without completion data) */}
                  {isCohortMode ? (
                    <button
                      type="button"
                      onClick={() => toggleTaskExpanded(task.label)}
                      className="shrink-0 flex items-center gap-1"
                    >
                      {isTaskExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      {/* Status icon - matches client Daily Focus style */}
                      <div
                        className={cn(
                          'w-6 h-6 rounded-lg border flex items-center justify-center transition-all duration-300 bg-white dark:bg-[#181d26]',
                          isCohortCompleted
                            ? 'border-brand-accent'
                            : completionRate > 0
                            ? 'border-brand-accent/50'
                            : 'border-[#d4d0cb] dark:border-[#3d4351]'
                        )}
                        title={isCohortCompleted ? `${completionRate}% completed (threshold met)` : completionRate > 0 ? `${completionRate}% completed` : 'No completions'}
                      >
                        {isCohortCompleted ? (
                          <div className="w-4 h-4 bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300" />
                        ) : completionRate > 0 ? (
                          <span className="text-[9px] font-bold text-brand-accent">{completionRate}</span>
                        ) : null}
                      </div>
                    </button>
                  ) : (
                    /* Non-cohort completion indicator - matches client Daily Focus style */
                    <div
                      className={cn(
                        'w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all duration-300 bg-white dark:bg-[#181d26]',
                        isClientCompleted
                          ? 'border-brand-accent'
                          : 'border-[#d4d0cb] dark:border-[#3d4351]'
                      )}
                      title={isClientCompleted ? 'Completed' : ''}
                    >
                      {isClientCompleted && (
                        <div className="w-4 h-4 bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300" />
                      )}
                    </div>
                  )}

                  {/* Input */}
                  <input
                    type="text"
                    value={task.label}
                    onChange={(e) => updateTask(index, { label: e.target.value })}
                    placeholder="What should they accomplish?"
                    className={cn(
                      "flex-1 bg-transparent border-none outline-none font-albert text-[15px] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]",
                      (isClientCompleted || isCohortCompleted)
                        ? "text-[#a7a39e] dark:text-[#7d8190] line-through"
                        : "text-[#1a1a1a] dark:text-[#f5f5f8]"
                    )}
                  />

                  {/* Task Actions Group - badges and Focus toggle */}
                  <div className="flex items-center gap-1">
                    {/* Cohort completion badge */}
                    {isCohortMode && (
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
                          isCohortCompleted
                            ? "text-brand-accent bg-brand-accent/10"
                            : "text-muted-foreground bg-muted"
                        )}
                      >
                        {completedCount}/{totalMembers}
                      </span>
                    )}

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
                      onClick={() => updateTask(index, { isPrimary: !task.isPrimary })}
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
                    onClick={() => removeTask(index)}
                    className="p-1.5 rounded-lg text-[#a7a39e] dark:text-[#7d8190] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Expanded member breakdown (cohort mode only) */}
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    isCohortMode && isTaskExpanded
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
          })}
          
          {/* Empty State */}
          {formData.tasks.length === 0 && (
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

      {/* Habits (Day 1 or if already has habits) */}
      {(dayIndex === 1 || formData.habits.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Default Habits
              </label>
              {dayIndex === 1 && (
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-0.5">
                  Day 1 sets program defaults
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {formData.habits.map((habit, index) => (
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
            {formData.habits.length === 0 && dayIndex === 1 && (
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
          currentAssignments={formData.courseAssignments}
          onChange={(assignments) => setFormData({ ...formData, courseAssignments: assignments })}
        />
      </div>

      {/* Resources Section - Articles, Downloads, Links, Questionnaires */}
      <CollapsibleSection
        title="Resources"
        icon={BookOpen}
        description="Content to share with clients for this day"
        defaultOpen={false}
      >
        {/* Linked Articles */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <FileText className="w-4 h-4 inline mr-1.5" />
            Articles
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Reading materials and guides for this day
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between px-3 py-2.5 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors">
                <span className="text-[#8c8c8c] dark:text-[#7d8190]">Add an article...</span>
                <ChevronDown className="w-4 h-4 text-[#8c8c8c]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto">
              {programArticles.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-semibold uppercase tracking-wider">
                    Program Content
                  </DropdownMenuLabel>
                  {programArticles.map((article) => (
                    <DropdownMenuItem
                      key={article.id}
                      onClick={() => addArticleLink(article.id)}
                      className="cursor-pointer"
                    >
                      <FileText className="w-4 h-4 mr-2 text-brand-accent" />
                      {article.title}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {platformArticles.length > 0 && (
                <>
                  {programArticles.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-semibold uppercase tracking-wider">
                    Platform Content
                  </DropdownMenuLabel>
                  {platformArticles.map((article) => (
                    <DropdownMenuItem
                      key={article.id}
                      onClick={() => addArticleLink(article.id)}
                      className="cursor-pointer"
                    >
                      <FileText className="w-4 h-4 mr-2 text-[#8c8c8c]" />
                      {article.title}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => window.location.href = '/coach?tab=discover'}
                className="cursor-pointer text-brand-accent"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create new article
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between px-3 py-2.5 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors">
                <span className="text-[#8c8c8c] dark:text-[#7d8190]">Add a download...</span>
                <ChevronDown className="w-4 h-4 text-[#8c8c8c]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto">
              {programDownloads.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-semibold uppercase tracking-wider">
                    Program Content
                  </DropdownMenuLabel>
                  {programDownloads.map((download) => (
                    <DropdownMenuItem
                      key={download.id}
                      onClick={() => addDownloadLink(download.id)}
                      className="cursor-pointer"
                    >
                      <Download className="w-4 h-4 mr-2 text-brand-accent" />
                      {download.title}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {platformDownloads.length > 0 && (
                <>
                  {programDownloads.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-semibold uppercase tracking-wider">
                    Platform Content
                  </DropdownMenuLabel>
                  {platformDownloads.map((download) => (
                    <DropdownMenuItem
                      key={download.id}
                      onClick={() => addDownloadLink(download.id)}
                      className="cursor-pointer"
                    >
                      <Download className="w-4 h-4 mr-2 text-[#8c8c8c]" />
                      {download.title}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => window.location.href = '/coach?tab=discover'}
                className="cursor-pointer text-brand-accent"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create new download
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between px-3 py-2.5 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors">
                <span className="text-[#8c8c8c] dark:text-[#7d8190]">Add a link...</span>
                <ChevronDown className="w-4 h-4 text-[#8c8c8c]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto">
              {programLinks.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-semibold uppercase tracking-wider">
                    Program Content
                  </DropdownMenuLabel>
                  {programLinks.map((link) => (
                    <DropdownMenuItem
                      key={link.id}
                      onClick={() => addLinkLink(link.id)}
                      className="cursor-pointer"
                    >
                      <Link2 className="w-4 h-4 mr-2 text-brand-accent" />
                      {link.title}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {platformLinks.length > 0 && (
                <>
                  {programLinks.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-semibold uppercase tracking-wider">
                    Platform Content
                  </DropdownMenuLabel>
                  {platformLinks.map((link) => (
                    <DropdownMenuItem
                      key={link.id}
                      onClick={() => addLinkLink(link.id)}
                      className="cursor-pointer"
                    >
                      <Link2 className="w-4 h-4 mr-2 text-[#8c8c8c]" />
                      {link.title}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => window.location.href = '/coach?tab=discover'}
                className="cursor-pointer text-brand-accent"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create new link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between px-3 py-2.5 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors">
                <span className="text-[#8c8c8c] dark:text-[#7d8190]">Add a questionnaire...</span>
                <ChevronDown className="w-4 h-4 text-[#8c8c8c]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto">
              {availableQuestionnairesToLink.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-semibold uppercase tracking-wider">
                    Platform Content
                  </DropdownMenuLabel>
                  {availableQuestionnairesToLink.map((questionnaire) => (
                    <DropdownMenuItem
                      key={questionnaire.id}
                      onClick={() => addQuestionnaireLink(questionnaire.id)}
                      className="cursor-pointer"
                    >
                      <FileQuestion className="w-4 h-4 mr-2 text-[#8c8c8c]" />
                      {questionnaire.title}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => window.location.href = '/coach?tab=discover'}
                className="cursor-pointer text-brand-accent"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create new questionnaire
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {formData.linkedQuestionnaireIds.length === 0 && availableQuestionnairesToLink.length === 0 && (
            <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-2">
              No questionnaires available
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* Error display */}
      {saveError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400 font-albert">{saveError}</p>
        </div>
      )}

      {/* Legacy save button - only show if NOT using context (for backwards compatibility) */}
      {!editorContext && onSave && (
        <div className="flex justify-end">
          <Button
            onClick={onSave}
            disabled={saving || !hasChanges}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white"
          >
            {saving ? 'Saving...' : 'Save Day'}
          </Button>
        </div>
      )}
    </div>
  );
}
