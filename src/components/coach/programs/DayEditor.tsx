'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ProgramDay, ProgramTaskTemplate, ProgramHabitTemplate, DayCourseAssignment, ClientViewContext, CohortViewContext } from '@/types';
import { Plus, X, ListTodo, Repeat, Target, Trash2, ArrowLeftRight, Check, ChevronDown, ChevronRight, Pencil, Clock, Loader2 } from 'lucide-react';
import { useProgramEditorOptional } from '@/contexts/ProgramEditorContext';
import { Button } from '@/components/ui/button';
import { DayCourseSelector } from './DayCourseSelector';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
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
}

// Form data type
export interface DayFormData {
  title: string;
  summary: string;
  dailyPrompt: string;
  tasks: ProgramTaskTemplate[];
  habits: ProgramHabitTemplate[];
  courseAssignments: DayCourseAssignment[];
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
  completionThreshold = 50,
  currentDate,
  apiBasePath,
  onSave,
  saving = false,
  saveError,
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

  // Fetch member breakdown for a task (lazy load)
  const fetchTaskMembers = async (taskId: string, taskLabel: string) => {
    if (taskMemberData.has(taskLabel) || cohortViewContext?.mode !== 'cohort') return;

    setLoadingTasks(prev => new Set(prev).add(taskLabel));

    try {
      const params = new URLSearchParams();
      if (currentDate) {
        params.set('date', currentDate);
      }

      const response = await fetch(
        `/api/coach/cohort-tasks/${cohortViewContext.cohortId}/task/${encodeURIComponent(taskId || taskLabel)}?${params.toString()}`
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
  };

  // Fetch members when task is expanded
  useEffect(() => {
    expandedTasks.forEach(taskLabel => {
      const task = formData.tasks.find(t => t.label === taskLabel);
      if (task && !taskMemberData.has(taskLabel) && !loadingTasks.has(taskLabel)) {
        fetchTaskMembers(task.id || taskLabel, taskLabel);
      }
    });
  }, [expandedTasks]);

  // Helper to get progress bar color
  const getProgressColor = (rate: number, threshold: number): string => {
    if (rate >= threshold) return 'bg-green-500';
    if (rate >= threshold - 15) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  // Determine view context with proper type narrowing
  const isClientMode = programType === 'individual' && clientViewContext?.mode === 'client';
  const isCohortMode = programType === 'group' && cohortViewContext?.mode === 'cohort';
  const viewContext = isClientMode ? 'client' : isCohortMode ? 'cohort' : 'template';
  
  // Get the context ID with proper type narrowing
  const clientEnrollmentId = isClientMode && clientViewContext?.mode === 'client' ? clientViewContext.enrollmentId : undefined;
  const cohortIdValue = isCohortMode && cohortViewContext?.mode === 'cohort' ? cohortViewContext.cohortId : undefined;
  const clientContextId = clientEnrollmentId || cohortIdValue;

  // Build API endpoint based on view context
  const getApiEndpoint = useCallback(() => {
    if (!programId) return '';
    const base = `${apiBasePath}/${programId}`;
    if (isClientMode && clientEnrollmentId) {
      return `${base}/client-days`;
    } else if (isCohortMode && cohortIdValue) {
      return `${base}/cohort-days`;
    }
    return `${base}/days`;
  }, [apiBasePath, programId, isClientMode, isCohortMode, clientEnrollmentId, cohortIdValue]);

  // Track last reset version to detect discard/save
  const lastResetVersion = useRef(editorContext?.resetVersion ?? 0);
  const lastDayIndex = useRef(dayIndex);

  // Get default form data from day
  const getDefaultFormData = useCallback((): DayFormData => ({
    title: day?.title || '',
    summary: day?.summary || '',
    dailyPrompt: day?.dailyPrompt || '',
    tasks: day?.tasks || [],
    habits: day?.habits || [],
    courseAssignments: day?.courseAssignments || [],
  }), [day]);

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
        setFormData(getDefaultFormData());
        setHasChanges(false);
      }
    }
  }, [dayIndex, getDefaultFormData, editorContext, clientContextId]);

  // Reset when the day data changes (from props) and there's no pending data
  useEffect(() => {
    const contextPendingData = editorContext?.getPendingData('day', entityId, clientContextId);
    if (!contextPendingData && dayIndex === lastDayIndex.current) {
      setFormData(getDefaultFormData());
      setHasChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.title, day?.summary, day?.dailyPrompt, JSON.stringify(day?.tasks), JSON.stringify(day?.habits)]);

  // Watch for reset version changes (discard/save from global buttons)
  useEffect(() => {
    if (editorContext && editorContext.resetVersion !== lastResetVersion.current) {
      lastResetVersion.current = editorContext.resetVersion;
      // Reset to original day data
      setFormData(getDefaultFormData());
      setHasChanges(false);
    }
  }, [editorContext?.resetVersion, getDefaultFormData]);

  // Check for changes and register with context
  useEffect(() => {
    const defaultData = getDefaultFormData();
    const changed =
      formData.title !== defaultData.title ||
      formData.summary !== defaultData.summary ||
      formData.dailyPrompt !== defaultData.dailyPrompt ||
      JSON.stringify(formData.tasks) !== JSON.stringify(defaultData.tasks) ||
      JSON.stringify(formData.habits) !== JSON.stringify(defaultData.habits) ||
      JSON.stringify(formData.courseAssignments) !== JSON.stringify(defaultData.courseAssignments);
    setHasChanges(changed);

    // Register changes with context if available
    if (editorContext && changed && programId) {
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

      editorContext.registerChange({
        entityType: 'day',
        entityId,
        dayIndex,
        viewContext: viewContext as 'template' | 'client' | 'cohort',
        clientContextId,
        originalData: defaultData as unknown as Record<string, unknown>,
        pendingData: requestBody,
        apiEndpoint: getApiEndpoint(),
        httpMethod: 'POST',
      });
    } else if (editorContext && !changed) {
      // Remove from pending changes if no longer changed
      const changeKey = editorContext.getChangeKey('day', entityId, clientContextId);
      editorContext.discardChange(changeKey);
    }
  }, [formData, day, editorContext, programId, viewContext, clientContextId, getApiEndpoint, dayIndex, entityId, getDefaultFormData, isClientMode, isCohortMode, clientEnrollmentId, cohortIdValue]);

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
            // Debug logging
            if (index === 0) {
              console.log('[DAYEDITOR] Debug:', {
                isCohortMode,
                programType,
                cohortViewContextMode: cohortViewContext?.mode,
                taskCount: formData.tasks.length,
                completionMapSize: cohortTaskCompletion.size,
                completionMapKeys: Array.from(cohortTaskCompletion.keys()),
                taskLabels: formData.tasks.map(t => t.label),
                taskIds: formData.tasks.map(t => t.id),
              });
            }
            // Check for cohort completion data - try matching by task ID first, then fall back to label
            const cohortCompletion = isCohortMode
              ? (task.id && cohortTaskCompletion.get(task.id)) || cohortTaskCompletion.get(task.label)
              : undefined;
            const isTaskExpanded = expandedTasks.has(task.label);
            const isLoading = loadingTasks.has(task.label);
            const members = taskMemberData.get(task.label) || [];
            const hasCompletionData = isCohortMode && cohortCompletion;

            // Check for 1:1 client completion
            const isClientCompleted = isClientMode && task.completed;
            const isCohortCompleted = cohortCompletion?.completed;
            const completionRate = cohortCompletion?.completionRate || 0;
            const completedCount = cohortCompletion?.completedCount || 0;
            const totalMembers = cohortCompletion?.totalMembers || 0;

            return (
              <div
                key={index}
                className={cn(
                  "group relative bg-white dark:bg-[#171b22] border rounded-xl transition-all duration-200",
                  isCohortCompleted
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-[#e1ddd8] dark:border-[#262b35] hover:shadow-sm hover:border-[#d4d0cb] dark:hover:border-[#313746]"
                )}
              >
                {/* Main task row */}
                <div className="flex items-center gap-3 p-4">
                  {/* Expand/collapse button for cohort mode with completion data */}
                  {hasCompletionData ? (
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
                      {/* Status icon */}
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center',
                          isCohortCompleted
                            ? 'bg-green-500 text-white'
                            : completionRate > 0
                            ? 'border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                            : 'border-2 border-[#e1ddd8] dark:border-[#3d4351]'
                        )}
                        title={isCohortCompleted ? `${completionRate}% completed (threshold met)` : completionRate > 0 ? `${completionRate}% completed` : 'No completions'}
                      >
                        {isCohortCompleted ? (
                          <Check className="w-3 h-3" />
                        ) : completionRate > 0 ? (
                          <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400">{completionRate}</span>
                        ) : null}
                      </div>
                    </button>
                  ) : (
                    /* Non-cohort completion indicator */
                    (() => {
                      if (isClientCompleted) {
                        return (
                          <div
                            className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                            title="Completed"
                          >
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        );
                      }
                      return (
                        <div className="w-5 h-5 rounded-full border-2 border-[#e1ddd8] dark:border-[#3d4351] flex-shrink-0" />
                      );
                    })()
                  )}

                  {/* Input */}
                  <input
                    type="text"
                    value={task.label}
                    onChange={(e) => updateTask(index, { label: e.target.value })}
                    placeholder="What should they accomplish?"
                    className="flex-1 bg-transparent border-none outline-none font-albert text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]"
                  />

                  {/* Task Actions Group - badges and Focus toggle */}
                  <div className="flex items-center gap-1">
                    {/* Cohort completion badge */}
                    {hasCompletionData && (
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
                          isCohortCompleted
                            ? "text-green-600 bg-green-50 dark:bg-green-900/20"
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
                {hasCompletionData && isTaskExpanded && (
                  <div className="border-t border-[#e1ddd8] dark:border-[#262b35] px-4 pb-4">
                    {/* Progress bar */}
                    <div className="pt-3 pb-2">
                      <Progress
                        value={completionRate}
                        className="h-1.5"
                        indicatorClassName={getProgressColor(completionRate, completionThreshold)}
                      />
                    </div>

                    {/* Member list */}
                    <div className="space-y-2 pt-2">
                      {isLoading && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}

                      {!isLoading && members.length === 0 && (
                        <div className="text-sm text-muted-foreground py-2">
                          No member data available
                        </div>
                      )}

                      {!isLoading && members.map((member) => (
                        <div
                          key={member.userId}
                          className="flex items-center gap-3 text-sm"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.imageUrl} />
                            <AvatarFallback className="text-xs">
                              {member.firstName?.[0]}
                              {member.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate">
                            {member.firstName} {member.lastName}
                          </span>
                          <div
                            className={cn(
                              'shrink-0 h-5 w-5 rounded-full flex items-center justify-center',
                              member.status === 'completed'
                                ? 'bg-green-500 text-white'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {member.status === 'completed' ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
