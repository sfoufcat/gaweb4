'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ProgramWeek, ProgramDay, ProgramTaskTemplate, CallSummary, TaskDistribution, UnifiedEvent, ProgramEnrollment, ProgramCohort, DiscoverArticle, DiscoverDownload, DiscoverLink, Questionnaire, DayCourseAssignment, WeekResourceAssignment } from '@/types';
import type { DiscoverCourse, DiscoverVideo } from '@/types/discover';
import { Plus, X, Sparkles, GripVertical, Target, FileText, MessageSquare, StickyNote, Upload, Mic, Phone, Calendar, CalendarPlus, Check, Loader2, Users, EyeOff, Info, ListTodo, ClipboardList, ArrowLeftRight, Trash2, Pencil, ChevronDown, ChevronRight, BookOpen, Download, Link2, FileQuestion, GraduationCap, Video, AlertCircle, Save, MoreVertical, RefreshCw } from 'lucide-react';
import { useProgramEditorOptional } from '@/contexts/ProgramEditorContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { SyncTemplateDialog } from './SyncTemplateDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useInstanceIdLookup } from '@/hooks/useProgramInstanceBridge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ResourceLinkDropdown } from './ResourceLinkDropdown';
import { CallSummaryViewModal } from './CallSummaryViewModal';
import { DayCourseSelector } from './DayCourseSelector';
import { UnifiedResourcesTabs, type ContentCompletionData } from './UnifiedResourcesTabs';
import { CreditPurchaseModal } from '@/components/coach/CreditPurchaseModal';
import { DayPreviewPopup } from './DayPreviewPopup';
import { ScheduleCallModal } from '@/components/scheduling';
import { CreateEventModal } from '@/components/scheduling/CreateEventModal';
import { GenerateSummaryButton } from '@/components/scheduling/GenerateSummaryButton';
import { InlineRecordingUpload } from '@/components/scheduling/InlineRecordingUpload';
import { MediaPlayer } from '@/components/video/MediaPlayer';
// Audio utilities for duration detection
import { getAudioDuration } from '@/lib/audio-compression';
import { generateTasksFromResources, mergeResourceTasks } from '@/lib/resource-tasks';

/**
 * Small component to fetch recording from video call providers
 */
function FetchRecordingButton({
  eventId,
  onSuccess,
  variant = 'link'
}: {
  eventId: string;
  onSuccess?: () => void;
  variant?: 'link' | 'button';
}) {
  const [isFetching, setIsFetching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFetch = async () => {
    if (isFetching) return;
    setIsFetching(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/events/${eventId}/fetch-recording`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success && data.recordingUrl) {
        setMessage('Recording found!');
        onSuccess?.();
      } else {
        setMessage(data.message || 'No recording found yet');
      }
    } catch {
      setMessage('Failed to fetch recording');
    } finally {
      setIsFetching(false);
    }
  };

  if (variant === 'button') {
    return (
      <div className="space-y-1">
        <button
          onClick={handleFetch}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
        >
          {isFetching ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {isFetching ? 'Checking...' : 'Check Now'}
        </button>
        {message && (
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">{message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleFetch}
        disabled={isFetching}
        className="flex items-center gap-1.5 text-xs text-brand-accent hover:underline disabled:opacity-50"
      >
        {isFetching ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
        {isFetching ? 'Checking...' : 'Check for recording'}
      </button>
      {message && (
        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">{message}</p>
      )}
    </div>
  );
}

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
  // Resources - articles, downloads, links, questionnaires, courses, videos
  availableArticles?: DiscoverArticle[];
  availableDownloads?: DiscoverDownload[];
  availableLinks?: DiscoverLink[];
  availableQuestionnaires?: Questionnaire[];
  availableCourses?: DiscoverCourse[];
  availableVideos?: DiscoverVideo[];
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
  // Callback when a summary is regenerated/updated
  onSummaryUpdated?: (summary: CallSummary) => void;
  // Callback when a summary is deleted
  onSummaryDeleted?: (summaryId: string) => void;
  // Cohort task completion for weekly tasks (aggregate)
  cohortWeeklyTaskCompletion?: Map<string, CohortWeeklyTaskCompletionData>;
  // Completion threshold
  completionThreshold?: number;
  // NEW: Instance ID for migrated data (uses new unified API when present)
  instanceId?: string | null;
  // Program settings
  includeWeekends?: boolean;
  // Callback when days are modified (for dayTag changes)
  onDaysChange?: (days: ProgramDay[]) => void;
  // Callback when a call is scheduled (to refresh events list)
  onCallScheduled?: () => void;
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
// Day tag type for task assignment
type DayTagValue = 'auto' | 'spread' | 'daily' | number | number[]; // number = specific day 1-7, number[] = multiple days

// Stable default values to prevent infinite loops from new object references on each render
const EMPTY_ARRAY: never[] = [];
const EMPTY_MAP = new Map<string, CohortWeeklyTaskCompletionData>();

interface SortableWeeklyTaskProps {
  task: ProgramTaskTemplate;
  index: number;
  id: string;
  showCompletionStatus: boolean;
  onTogglePrimary: (index: number) => void;
  onRemove: (index: number) => void;
  // Day assignment
  dayTag: DayTagValue;
  onDayTagChange: (index: number, dayTag: DayTagValue) => void;
  includeWeekends: boolean;
  daysInWeek: number;
  // Calendar date for weekday name display
  calendarStartDate?: string;
  // For partial weeks: offset from visual position to program dayIndex
  actualStartDayOfWeek?: number;
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
  dayTag,
  onDayTagChange,
  includeWeekends,
  daysInWeek,
  calendarStartDate,
  actualStartDayOfWeek,
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
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    opacity: isDragging ? 0.5 : 1,
  };

  const isCompleted = task.completed || false;
  const [cadenceModalOpen, setCadenceModalOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

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
        {/* Drag Handle - always visible */}
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-[#a7a39e] dark:text-[#7d8190]" />
        </div>

        {/* Cohort Mode: Expand Chevron with Completion indicator */}
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
          /* Non-Cohort Mode: Completion Checkbox - matches client Daily Focus style */
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
          isLoading && !hasCohortData ? (
            <span className="shrink-0 w-10 h-5 rounded-full bg-[#f5f2ef] dark:bg-[#262b35] animate-pulse" />
          ) : (
            <span
              className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                isCohortCompleted
                  ? 'text-brand-accent bg-brand-accent/10'
                  : 'text-[#8c8780] dark:text-[#9ca3af] bg-[#f5f2ef] dark:bg-[#262b35]'
              }`}
            >
              {completedCount}/{totalMembers}
            </span>
          )
        )}

        {/* Task Actions Group - badges and Focus toggle */}
        <div className="flex items-center gap-2">
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

          {/* Desktop: Show all action buttons */}
          {isDesktop ? (
            <>
              {/* Focus/Backlog Toggle */}
              <button
                type="button"
                onClick={() => onTogglePrimary(index)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#5f5a55] dark:text-[#7d8190] hover:text-[#3d3a37] dark:hover:text-[#b2b6c2] transition-all duration-200 rounded-lg hover:bg-[#faf8f6] dark:hover:bg-[#1e222a]"
              >
                <ArrowLeftRight className={`w-3.5 h-3.5 transition-transform duration-300 ease-out ${task.isPrimary ? 'rotate-0' : 'rotate-180'}`} />
                <span>{task.isPrimary ? 'Focus' : 'Backlog'}</span>
              </button>

              {/* Cadence Icon Button with Label */}
              <button
                type="button"
                onClick={() => setCadenceModalOpen(true)}
                className={cn(
                  "flex items-center gap-1 rounded-lg transition-all px-2 py-1",
                  dayTag === 'auto'
                    ? "text-[#a7a39e] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-[#1e222a]"
                    : "text-brand-accent bg-brand-accent/10 hover:bg-brand-accent/20"
                )}
                title="Task cadence"
              >
                <Calendar className="w-4 h-4" />
                {dayTag !== 'auto' && (
                  <span className="text-xs font-medium">
                    {dayTag === 'spread' ? 'Spread' : dayTag === 'daily' ? 'Daily' : (() => {
                      if (typeof dayTag === 'number' && calendarStartDate) {
                        const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        const [year, month, dayOfMonth] = calendarStartDate.split('-').map(Number);
                        // Add offset for partial weeks - dayTag is programDayIndex, need to convert to calendar position
                        const offset = (actualStartDayOfWeek || 1) - 1;
                        const dayDate = new Date(year, month - 1, dayOfMonth + offset + dayTag - 1);
                        return WEEKDAYS[dayDate.getDay()];
                      }
                      return `Day ${dayTag}`;
                    })()}
                  </span>
                )}
              </button>

              {/* Delete Button - Desktop */}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-1.5 rounded-lg text-[#a7a39e] dark:text-[#7d8190] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            /* Mobile: 3-dot menu */
            <DropdownMenu open={mobileActionsOpen} onOpenChange={setMobileActionsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-[#5f5a55] dark:text-[#7d8190] hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-all"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    onTogglePrimary(index);
                    setMobileActionsOpen(false);
                  }}
                  className="gap-2"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Switch to {task.isPrimary ? 'Backlog' : 'Focus'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setMobileActionsOpen(false);
                    setCadenceModalOpen(true);
                  }}
                  className="gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>
                    Cadence
                    {dayTag !== 'auto' && (
                      <span className="ml-1 text-brand-accent">
                        ({dayTag === 'spread' ? 'Spread' : dayTag === 'daily' ? 'Daily' : (() => {
                          if (typeof dayTag === 'number' && calendarStartDate) {
                            const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                            const [year, month, dayOfMonth] = calendarStartDate.split('-').map(Number);
                            // Add offset for partial weeks - dayTag is programDayIndex, need to convert to calendar position
                            const offset = (actualStartDayOfWeek || 1) - 1;
                            const dayDate = new Date(year, month - 1, dayOfMonth + offset + dayTag - 1);
                            return WEEKDAYS[dayDate.getDay()];
                          }
                          return `Day ${dayTag}`;
                        })()})
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    onRemove(index);
                    setMobileActionsOpen(false);
                  }}
                  className="gap-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete task</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Cadence Modal - Dialog on desktop, Drawer on mobile */}
          {isDesktop ? (
            <Dialog open={cadenceModalOpen} onOpenChange={setCadenceModalOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Task Cadence</DialogTitle>
                  <DialogDescription>Choose when this task should appear</DialogDescription>
                </DialogHeader>

                <div className="space-y-3 pt-2">
                  {/* Default option */}
                  <button
                    type="button"
                    onClick={() => { onDayTagChange(index, 'auto'); setCadenceModalOpen(false); }}
                    className={cn(
                      "w-full p-4 text-left rounded-xl transition-all flex items-center gap-4 border",
                      dayTag === 'auto'
                        ? "bg-brand-accent/10 border-brand-accent"
                        : "bg-white dark:bg-[#1e222a] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc6] dark:hover:border-[#3a4150]"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      dayTag === 'auto' ? "bg-brand-accent/15" : "bg-[#f5f3f0] dark:bg-[#262b35]"
                    )}>
                      <ArrowLeftRight className={cn("w-5 h-5", dayTag === 'auto' ? "text-brand-accent" : "text-[#5f5a55] dark:text-[#9ca3af]")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-semibold block", dayTag === 'auto' ? "text-brand-accent" : "text-[#1a1a1a] dark:text-[#f5f5f8]")}>
                        Default
                      </span>
                      <p className="text-xs text-[#6b6560] dark:text-[#9ca3af] mt-0.5">Uses the week&apos;s distribution setting</p>
                    </div>
                    {dayTag === 'auto' && <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />}
                  </button>

                  {/* Spread option */}
                  <button
                    type="button"
                    onClick={() => { onDayTagChange(index, 'spread'); setCadenceModalOpen(false); }}
                    className={cn(
                      "w-full p-4 text-left rounded-xl transition-all flex items-center gap-4 border",
                      dayTag === 'spread'
                        ? "bg-brand-accent/10 border-brand-accent"
                        : "bg-white dark:bg-[#1e222a] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc6] dark:hover:border-[#3a4150]"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      dayTag === 'spread' ? "bg-brand-accent/15" : "bg-[#f5f3f0] dark:bg-[#262b35]"
                    )}>
                      <Target className={cn("w-5 h-5", dayTag === 'spread' ? "text-brand-accent" : "text-[#5f5a55] dark:text-[#9ca3af]")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-semibold block", dayTag === 'spread' ? "text-brand-accent" : "text-[#1a1a1a] dark:text-[#f5f5f8]")}>
                        Spread across week
                      </span>
                      <p className="text-xs text-[#6b6560] dark:text-[#9ca3af] mt-0.5">Distribute evenly across all days</p>
                    </div>
                    {dayTag === 'spread' && <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />}
                  </button>

                  {/* Daily option */}
                  <button
                    type="button"
                    onClick={() => { onDayTagChange(index, 'daily'); setCadenceModalOpen(false); }}
                    className={cn(
                      "w-full p-4 text-left rounded-xl transition-all flex items-center gap-4 border",
                      dayTag === 'daily'
                        ? "bg-brand-accent/10 border-brand-accent"
                        : "bg-white dark:bg-[#1e222a] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc6] dark:hover:border-[#3a4150]"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      dayTag === 'daily' ? "bg-brand-accent/15" : "bg-[#f5f3f0] dark:bg-[#262b35]"
                    )}>
                      <CalendarPlus className={cn("w-5 h-5", dayTag === 'daily' ? "text-brand-accent" : "text-[#5f5a55] dark:text-[#9ca3af]")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-semibold block", dayTag === 'daily' ? "text-brand-accent" : "text-[#1a1a1a] dark:text-[#f5f5f8]")}>
                        Every day
                      </span>
                      <p className="text-xs text-[#6b6560] dark:text-[#9ca3af] mt-0.5">Repeats on all days of the week</p>
                    </div>
                    {dayTag === 'daily' && <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />}
                  </button>

                  {/* Specific day section - multi-select toggle */}
                  <div className="pt-3 mt-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    <p className="text-xs font-semibold text-[#3d3a36] dark:text-[#d1d5db] mb-3">Or pick specific days</p>
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: daysInWeek }, (_, i) => {
                        const dayNum = i + 1;
                        // Convert visual position to program dayIndex for partial weeks
                        const dayOffset = (actualStartDayOfWeek && actualStartDayOfWeek > 1) ? actualStartDayOfWeek - 1 : 0;
                        const programDayIndex = dayNum - dayOffset;
                        const isInactiveDaySlot = programDayIndex < 1;

                        let dayLabel = `${dayNum}`;
                        let fullDayLabel = `Day ${dayNum}`;
                        if (calendarStartDate) {
                          const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                          const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                          const [year, month, dayOfMonth] = calendarStartDate.split('-').map(Number);
                          const dayDate = new Date(year, month - 1, dayOfMonth + i);
                          dayLabel = WEEKDAYS_SHORT[dayDate.getDay()];
                          fullDayLabel = WEEKDAYS_FULL[dayDate.getDay()];
                        }
                        // Support both single number and array of numbers - compare against programDayIndex
                        const isSelected = !isInactiveDaySlot && (Array.isArray(dayTag)
                          ? dayTag.includes(programDayIndex)
                          : dayTag === programDayIndex);
                        return (
                          <button
                            key={dayNum}
                            type="button"
                            disabled={isInactiveDaySlot}
                            onClick={() => {
                              if (isInactiveDaySlot) return;
                              // Toggle day in/out of selection (multi-select mode)
                              // Use programDayIndex (not visual dayNum) for storage
                              let newDayTag: number | number[] | 'auto';
                              if (Array.isArray(dayTag)) {
                                if (dayTag.includes(programDayIndex)) {
                                  // Remove day from array
                                  const filtered = dayTag.filter(d => d !== programDayIndex);
                                  newDayTag = filtered.length === 1 ? filtered[0] : filtered.length === 0 ? 'auto' : filtered;
                                } else {
                                  // Add day to array
                                  newDayTag = [...dayTag, programDayIndex].sort((a, b) => a - b);
                                }
                              } else if (typeof dayTag === 'number') {
                                if (dayTag === programDayIndex) {
                                  // Deselect single day → back to auto
                                  newDayTag = 'auto';
                                } else {
                                  // Add second day → create array
                                  newDayTag = [dayTag, programDayIndex].sort((a, b) => a - b);
                                }
                              } else {
                                // Was auto/spread/daily, select single day
                                newDayTag = programDayIndex;
                              }
                              onDayTagChange(index, newDayTag as number | number[]);
                              // Don't close modal - allow multiple selections
                            }}
                            className={cn(
                              "aspect-square rounded-xl text-sm font-medium transition-all flex flex-col items-center justify-center border",
                              isInactiveDaySlot
                                ? "opacity-30 cursor-not-allowed bg-gray-100 dark:bg-[#15181f] border-gray-200 dark:border-[#262b35]"
                                : isSelected
                                  ? "bg-brand-accent text-white shadow-md border-brand-accent"
                                  : "bg-white dark:bg-[#1e222a] text-[#3d3a36] dark:text-[#d1d5db] border-[#e1ddd8] dark:border-[#262b35] hover:bg-brand-accent/10 hover:text-brand-accent hover:border-brand-accent/30"
                            )}
                            title={fullDayLabel}
                          >
                            <span className="text-lg font-semibold">{dayLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Drawer open={cadenceModalOpen} onOpenChange={setCadenceModalOpen}>
              <DrawerContent className="max-h-[85vh]">
                <DrawerHeader className="border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 pb-4">
                  <DrawerTitle>Task Cadence</DrawerTitle>
                  <DrawerDescription>Choose when this task should appear</DrawerDescription>
                </DrawerHeader>

                <div className="p-4 space-y-3">
                  {/* Default option */}
                  <button
                    type="button"
                    onClick={() => { onDayTagChange(index, 'auto'); setCadenceModalOpen(false); }}
                    className={cn(
                      "w-full p-4 text-left rounded-xl transition-all flex items-center gap-4 border",
                      dayTag === 'auto'
                        ? "bg-brand-accent/10 border-brand-accent"
                        : "bg-white dark:bg-[#1e222a] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc6] dark:hover:border-[#3a4150]"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      dayTag === 'auto' ? "bg-brand-accent/15" : "bg-[#f5f3f0] dark:bg-[#262b35]"
                    )}>
                      <ArrowLeftRight className={cn("w-5 h-5", dayTag === 'auto' ? "text-brand-accent" : "text-[#5f5a55] dark:text-[#9ca3af]")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-semibold block", dayTag === 'auto' ? "text-brand-accent" : "text-[#1a1a1a] dark:text-[#f5f5f8]")}>
                        Default
                      </span>
                      <p className="text-xs text-[#6b6560] dark:text-[#9ca3af] mt-0.5">Uses the week&apos;s distribution setting</p>
                    </div>
                    {dayTag === 'auto' && <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />}
                  </button>

                  {/* Spread option */}
                  <button
                    type="button"
                    onClick={() => { onDayTagChange(index, 'spread'); setCadenceModalOpen(false); }}
                    className={cn(
                      "w-full p-4 text-left rounded-xl transition-all flex items-center gap-4 border",
                      dayTag === 'spread'
                        ? "bg-brand-accent/10 border-brand-accent"
                        : "bg-white dark:bg-[#1e222a] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc6] dark:hover:border-[#3a4150]"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      dayTag === 'spread' ? "bg-brand-accent/15" : "bg-[#f5f3f0] dark:bg-[#262b35]"
                    )}>
                      <Target className={cn("w-5 h-5", dayTag === 'spread' ? "text-brand-accent" : "text-[#5f5a55] dark:text-[#9ca3af]")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-semibold block", dayTag === 'spread' ? "text-brand-accent" : "text-[#1a1a1a] dark:text-[#f5f5f8]")}>
                        Spread across week
                      </span>
                      <p className="text-xs text-[#6b6560] dark:text-[#9ca3af] mt-0.5">Distribute evenly across all days</p>
                    </div>
                    {dayTag === 'spread' && <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />}
                  </button>

                  {/* Daily option */}
                  <button
                    type="button"
                    onClick={() => { onDayTagChange(index, 'daily'); setCadenceModalOpen(false); }}
                    className={cn(
                      "w-full p-4 text-left rounded-xl transition-all flex items-center gap-4 border",
                      dayTag === 'daily'
                        ? "bg-brand-accent/10 border-brand-accent"
                        : "bg-white dark:bg-[#1e222a] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc6] dark:hover:border-[#3a4150]"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      dayTag === 'daily' ? "bg-brand-accent/15" : "bg-[#f5f3f0] dark:bg-[#262b35]"
                    )}>
                      <CalendarPlus className={cn("w-5 h-5", dayTag === 'daily' ? "text-brand-accent" : "text-[#5f5a55] dark:text-[#9ca3af]")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-semibold block", dayTag === 'daily' ? "text-brand-accent" : "text-[#1a1a1a] dark:text-[#f5f5f8]")}>
                        Every day
                      </span>
                      <p className="text-xs text-[#6b6560] dark:text-[#9ca3af] mt-0.5">Repeats on all days of the week</p>
                    </div>
                    {dayTag === 'daily' && <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />}
                  </button>

                  {/* Specific day section - multi-select toggle */}
                  <div className="pt-3 mt-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    <p className="text-xs font-semibold text-[#3d3a36] dark:text-[#d1d5db] mb-3">Or pick specific days</p>
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: daysInWeek }, (_, i) => {
                        const dayNum = i + 1;
                        // Convert visual position to program dayIndex for partial weeks
                        const dayOffset = (actualStartDayOfWeek && actualStartDayOfWeek > 1) ? actualStartDayOfWeek - 1 : 0;
                        const programDayIndex = dayNum - dayOffset;
                        const isInactiveDaySlot = programDayIndex < 1;

                        let dayLabel = `${dayNum}`;
                        let fullDayLabel = `Day ${dayNum}`;
                        if (calendarStartDate) {
                          const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                          const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                          const [year, month, dayOfMonth] = calendarStartDate.split('-').map(Number);
                          const dayDate = new Date(year, month - 1, dayOfMonth + i);
                          dayLabel = WEEKDAYS_SHORT[dayDate.getDay()];
                          fullDayLabel = WEEKDAYS_FULL[dayDate.getDay()];
                        }
                        // Support both single number and array of numbers - compare against programDayIndex
                        const isSelected = !isInactiveDaySlot && (Array.isArray(dayTag)
                          ? dayTag.includes(programDayIndex)
                          : dayTag === programDayIndex);
                        return (
                          <button
                            key={dayNum}
                            type="button"
                            disabled={isInactiveDaySlot}
                            onClick={() => {
                              if (isInactiveDaySlot) return;
                              // Toggle day in/out of selection (multi-select mode)
                              // Use programDayIndex (not visual dayNum) for storage
                              let newDayTag: number | number[] | 'auto';
                              if (Array.isArray(dayTag)) {
                                if (dayTag.includes(programDayIndex)) {
                                  // Remove day from array
                                  const filtered = dayTag.filter(d => d !== programDayIndex);
                                  newDayTag = filtered.length === 1 ? filtered[0] : filtered.length === 0 ? 'auto' : filtered;
                                } else {
                                  // Add day to array
                                  newDayTag = [...dayTag, programDayIndex].sort((a, b) => a - b);
                                }
                              } else if (typeof dayTag === 'number') {
                                if (dayTag === programDayIndex) {
                                  // Deselect single day → back to auto
                                  newDayTag = 'auto';
                                } else {
                                  // Add second day → create array
                                  newDayTag = [dayTag, programDayIndex].sort((a, b) => a - b);
                                }
                              } else {
                                // Was auto/spread/daily, select single day
                                newDayTag = programDayIndex;
                              }
                              onDayTagChange(index, newDayTag as number | number[]);
                              // Don't close modal - allow multiple selections
                            }}
                            className={cn(
                              "aspect-square rounded-xl text-sm font-medium transition-all flex flex-col items-center justify-center border",
                              isInactiveDaySlot
                                ? "opacity-30 cursor-not-allowed bg-gray-100 dark:bg-[#15181f] border-gray-200 dark:border-[#262b35]"
                                : isSelected
                                  ? "bg-brand-accent text-white shadow-md border-brand-accent"
                                  : "bg-white dark:bg-[#1e222a] text-[#3d3a36] dark:text-[#d1d5db] border-[#e1ddd8] dark:border-[#262b35] hover:bg-brand-accent/10 hover:text-brand-accent hover:border-brand-accent/30"
                            )}
                            title={fullDayLabel}
                          >
                            <span className="text-lg font-semibold">{dayLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Safe area padding for mobile */}
                <div className="h-safe-area-inset-bottom" />
              </DrawerContent>
            </Drawer>
          )}
        </div>
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
  availableCallSummaries = EMPTY_ARRAY,
  availableEvents = EMPTY_ARRAY,
  availableArticles = EMPTY_ARRAY,
  availableDownloads = EMPTY_ARRAY,
  availableLinks = EMPTY_ARRAY,
  availableQuestionnaires = EMPTY_ARRAY,
  availableCourses = EMPTY_ARRAY,
  availableVideos = EMPTY_ARRAY,
  isClientView = false,
  clientName,
  clientUserId,
  enrollmentId,
  cohortId,
  cohortName,
  programId,
  programType,
  enrollments = EMPTY_ARRAY,
  cohorts = EMPTY_ARRAY,
  onSummaryGenerated,
  onSummaryUpdated,
  onSummaryDeleted,
  cohortWeeklyTaskCompletion = EMPTY_MAP,
  completionThreshold = 50,
  instanceId,
  includeWeekends = true,
  onDaysChange,
  onCallScheduled,
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

  // Debug: Log instance lookup values
  console.log('[WeekEditor] Instance values:', { instanceId, lookedUpInstanceId, effectiveInstanceId, cohortId, programId, weekNumber: week?.weekNumber });

  // Determine if we're in a client/cohort context (not template mode)
  const isInstanceContext = !!(cohortId || enrollmentId);

  // Detect missing instance condition - this prevents changes from being saved
  const isMissingInstance = isInstanceContext && !instanceLookupLoading && !effectiveInstanceId;

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
  // Track if we were saving when resetVersion last changed (to distinguish save from discard)
  const wasSavingWhenResetVersionChanged = useRef(false);
  // STABLE FIX: Store the saved formData snapshot. When this is set, we don't reset
  // formData until week prop matches this snapshot (meaning SWR refreshed)
  const savedFormDataSnapshot = useRef<{
    weeklyTasks: { id: string | undefined; label: string; isPrimary?: boolean; dayTag?: string | number }[];
    currentFocus?: string[];
    description?: string;
    theme?: string;
    weeklyPrompt?: string;
    notes?: string[];
    manualNotes?: string;
    resourceAssignments?: WeekResourceAssignment[];
  } | null>(null);
  // Track last registered data fingerprint to prevent infinite re-registration loops
  const lastRegisteredFingerprint = useRef<string | null>(null);
  // Track last processed fingerprint to prevent infinite reset loops
  const lastProcessedFingerprint = useRef<string | null>(null);
  // Ref for editorContext to avoid dependency changes when pendingChanges updates
  const editorContextRef = useRef(editorContext);
  editorContextRef.current = editorContext;

  // Track isSaving changes to know if we WERE saving when resetVersion changes
  // This runs synchronously before the main effect
  if (editorContext?.isSaving && !wasSavingWhenResetVersionChanged.current) {
    wasSavingWhenResetVersionChanged.current = true;
  }

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
    courseAssignments: DayCourseAssignment[];
    resourceAssignments: WeekResourceAssignment[];
  };

  // Memoize week data as primitives to prevent infinite loops from object reference changes
  const weekName = week.name || '';
  const weekTheme = week.theme || '';
  const weekDescription = week.description || '';
  const weekWeeklyPrompt = week.weeklyPrompt || '';
  // Memoize arrays to prevent new references on each render when week properties are undefined
  const weekWeeklyTasks = useMemo(() => week.weeklyTasks || [], [week.weeklyTasks]);
  const weekCurrentFocus = useMemo(() => week.currentFocus || [], [week.currentFocus]);
  const weekNotes = useMemo(() => week.notes || [], [week.notes]);
  const weekManualNotes = week.manualNotes || '';
  const weekDistribution = (week.distribution || 'spread') as TaskDistribution;
  // Calendar date for weekday display (may be on extended week type)
  const weekCalendarStartDate = (week as { calendarStartDate?: string }).calendarStartDate;
  const weekCoachRecordingUrl = week.coachRecordingUrl || '';
  const weekCoachRecordingNotes = week.coachRecordingNotes || '';
  // Memoize array fallbacks to prevent new references on each render
  // This prevents infinite re-render loops in change detection effects
  const weekLinkedSummaryIds = useMemo(() => week.linkedSummaryIds || [], [week.linkedSummaryIds]);
  const weekLinkedCallEventIds = useMemo(() => week.linkedCallEventIds || [], [week.linkedCallEventIds]);
  const weekLinkedArticleIds = useMemo(() => week.linkedArticleIds || [], [week.linkedArticleIds]);
  const weekLinkedDownloadIds = useMemo(() => week.linkedDownloadIds || [], [week.linkedDownloadIds]);
  const weekLinkedLinkIds = useMemo(() => week.linkedLinkIds || [], [week.linkedLinkIds]);
  const weekLinkedQuestionnaireIds = useMemo(() => week.linkedQuestionnaireIds || [], [week.linkedQuestionnaireIds]);
  const weekCourseAssignments = useMemo<DayCourseAssignment[]>(() => week.courseAssignments || [], [week.courseAssignments]);
  const weekResourceAssignments = useMemo<WeekResourceAssignment[]>(() => week.resourceAssignments || [], [week.resourceAssignments]);

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
    courseAssignments: weekCourseAssignments,
    resourceAssignments: weekResourceAssignments,
  }), [weekName, weekTheme, weekDescription, weekWeeklyPrompt, weekWeeklyTasks, weekCurrentFocus, weekNotes, weekManualNotes, weekDistribution, weekCoachRecordingUrl, weekCoachRecordingNotes, weekLinkedSummaryIds, weekLinkedCallEventIds, weekLinkedArticleIds, weekLinkedDownloadIds, weekLinkedLinkIds, weekLinkedQuestionnaireIds, weekCourseAssignments, weekResourceAssignments]);

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
      courseAssignments: weekCourseAssignments,
      resourceAssignments: weekResourceAssignments,
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
      courseAssignments: (pending.courseAssignments as DayCourseAssignment[]) || defaults.courseAssignments,
      resourceAssignments: (pending.resourceAssignments as WeekResourceAssignment[]) || defaults.resourceAssignments,
    };
  }, [weekName, weekTheme, weekDescription, weekWeeklyPrompt, weekWeeklyTasks, weekCurrentFocus, weekNotes, weekManualNotes, weekDistribution, weekCoachRecordingUrl, weekCoachRecordingNotes, weekLinkedSummaryIds, weekLinkedCallEventIds, weekLinkedArticleIds, weekLinkedDownloadIds, weekLinkedLinkIds, weekLinkedQuestionnaireIds, weekCourseAssignments, weekResourceAssignments]);


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
      courseAssignments: week.courseAssignments,
      resourceAssignments: week.resourceAssignments,
    });
  }, [week.name, week.theme, week.description, week.weeklyTasks, week.currentFocus, week.notes, week.manualNotes, week.weeklyPrompt, week.distribution, week.coachRecordingUrl, week.coachRecordingNotes, week.linkedSummaryIds, week.linkedCallEventIds, week.linkedArticleIds, week.linkedDownloadIds, week.linkedLinkIds, week.linkedQuestionnaireIds, week.courseAssignments, week.resourceAssignments]);

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
  
  // Inline editing state for outcomes and notes
  const [editingFocusIndex, setEditingFocusIndex] = useState<number | null>(null);
  const [editingFocusText, setEditingFocusText] = useState('');
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Save animation and sync state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSyncButton, setShowSyncButton] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  // Recording upload and summary generation state
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'uploading' | 'processing' | 'background' | 'completed' | 'error'>('idle');
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [pendingRecordingId, setPendingRecordingId] = useState<string | null>(null);
  // Detailed status from backend: 'uploaded' | 'transcribing' | 'summarizing' | 'completed' | 'failed'
  const [detailedStatus, setDetailedStatus] = useState<string | null>(null);

  // Summary view modal state - separate open state from data to prevent re-render loops
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSummary, setViewingSummary] = useState<CallSummary | null>(null);

  // Credit purchase modal state (for insufficient credits error)
  const [showCreditModal, setShowCreditModal] = useState(false);

  // Schedule call modal state (for 1:1 programs)
  const [showScheduleCallModal, setShowScheduleCallModal] = useState(false);

  // Schedule cohort event modal state (for group programs)
  const [showScheduleCohortModal, setShowScheduleCohortModal] = useState(false);

  // Day Preview popup state
  const [previewDayNumber, setPreviewDayNumber] = useState<number | null>(null);

  // Content completion data for courses/articles (for showing "X/Y completed" badges)
  const [contentCompletion, setContentCompletion] = useState<Map<string, ContentCompletionData>>(new Map());

  // Fetch content completion data when viewing cohort/client instance
  useEffect(() => {
    if (!programId) return;

    // Only fetch completion data when in cohort or client mode
    const shouldFetch = cohortId || clientUserId;
    if (!shouldFetch) return;

    const fetchContentCompletion = async () => {
      try {
        // Use the dashboard API to get content completion data
        const url = clientUserId
          ? `/api/coach/org-programs/${programId}/dashboard/client/${clientUserId}`
          : `/api/coach/org-programs/${programId}/dashboard${cohortId ? `?cohortId=${cohortId}` : ''}`;

        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();

        console.log('[WeekEditor] Content completion API response:', {
          url,
          clientUserId,
          cohortId,
          hasCurrentWeekContent: !!data.currentWeekContent,
          currentWeekContentModules: data.currentWeekContent?.modules?.length || 0,
          currentWeekContentArticles: data.currentWeekContent?.articles?.length || 0,
          hasContentCompletion: !!data.contentCompletion,
          contentCompletionCount: data.contentCompletion?.length || 0,
          contentCompletion: data.contentCompletion,
          currentWeekContent: data.currentWeekContent,
        });

        // Build completion map from the response
        const completionMap = new Map<string, ContentCompletionData>();

        if (clientUserId && data.currentWeekContent) {
          // Client mode: use currentWeekContent data
          const modules = data.currentWeekContent?.modules || [];
          modules.forEach((module: { moduleId: string; lessons?: { completed: boolean }[] }) => {
            const totalLessons = module.lessons?.length || 0;
            const completedLessons = module.lessons?.filter((l: { completed: boolean }) => l.completed).length || 0;
            completionMap.set(module.moduleId, {
              completedCount: completedLessons,
              totalCount: totalLessons,
            });
          });

          const articles = data.currentWeekContent?.articles || [];
          articles.forEach((article: { articleId: string; completed: boolean }) => {
            completionMap.set(article.articleId, {
              completedCount: article.completed ? 1 : 0,
              totalCount: 1,
            });
          });
        } else if (data.contentCompletion) {
          // Cohort/program mode: use contentCompletion array
          const contentItems = data.contentCompletion || [];
          contentItems.forEach((item: { contentId: string; completedCount: number; totalCount: number }) => {
            completionMap.set(item.contentId, {
              completedCount: item.completedCount,
              totalCount: item.totalCount,
            });
          });
        }

        console.log('[WeekEditor] Built completion map:', {
          mapSize: completionMap.size,
          entries: Array.from(completionMap.entries()),
        });

        setContentCompletion(completionMap);
      } catch (err) {
        console.error('[WeekEditor] Error fetching content completion:', err);
      }
    };

    fetchContentCompletion();
  }, [programId, cohortId, clientUserId]);

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

          // Show background processing state with detailed status
          setRecordingStatus('background');
          setDetailedStatus(recording.status);

          // Start polling for completion
          pollInterval = setInterval(async () => {
            if (cancelled) return;
            try {
              const statusRes = await fetch(`/api/coach/recordings/${recording.id}/status`);
              if (!statusRes.ok) return;
              const statusData = await statusRes.json();

              // Update detailed status for UI
              setDetailedStatus(statusData.status);

              if (statusData.status === 'completed') {
                setRecordingStatus('completed');
                setPendingRecordingId(null);
                setDetailedStatus(null);
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
                setDetailedStatus(null);
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

  // When recording fails with insufficient credits, bypass beforeunload warning
  // User can't proceed anyway - no reason to show "unsaved changes" warning
  useEffect(() => {
    if (recordingError?.includes('Insufficient credits') && editorContext) {
      editorContext.setBypassBeforeUnload(true);
    }
  }, [recordingError, editorContext]);

  // State for expanded tasks (to show member breakdown) - for cohort mode
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [taskMemberData, setTaskMemberData] = useState<Map<string, TaskMemberInfo[]>>(new Map());
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());
  
  

  // Refs for stable access in effects (prevents infinite loops)
  const taskMemberDataRef = useRef(taskMemberData);
  const loadingTasksRef = useRef(loadingTasks);
  taskMemberDataRef.current = taskMemberData;
  loadingTasksRef.current = loadingTasks;

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
  // Uses refs for taskMemberData/loadingTasks to avoid infinite loops
  // IMPORTANT: cacheKey should match what's used to read from the Map (task.id || task.label)
  const fetchTaskMembers = useCallback(async (taskId: string, cacheKey: string) => {
    // Check via refs to avoid dependency on state that changes during fetch
    if (taskMemberDataRef.current.has(cacheKey) || loadingTasksRef.current.has(cacheKey) || !cohortId) return;

    setLoadingTasks(prev => new Set(prev).add(cacheKey));

    try {
      // For weekly tasks, fetch without date filter to get aggregated data across all dates
      const response = await fetch(`/api/coach/cohort-tasks/${cohortId}/task/${encodeURIComponent(taskId)}`);

      if (response.ok) {
        const data = await response.json();
        setTaskMemberData(prev => new Map(prev).set(cacheKey, data.memberBreakdown || []));
      }
    } catch (error) {
      console.error('[WeekEditor] Failed to fetch task members:', error);
    } finally {
      setLoadingTasks(prev => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  }, [cohortId]);


  // DnD sensors for weekly tasks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering weekly tasks
  const handleTaskDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFormData(prev => {
      const oldIndex = prev.weeklyTasks.findIndex(t => (t.id || t.label) === active.id);
      const newIndex = prev.weeklyTasks.findIndex(t => (t.id || t.label) === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return {
        ...prev,
        weeklyTasks: arrayMove(prev.weeklyTasks, oldIndex, newIndex),
      };
    });
  }, []);

  // Get days in this week
  const weekDays = days.filter(
    d => d.dayIndex >= week.startDayIndex && d.dayIndex <= week.endDayIndex
  ).sort((a, b) => a.dayIndex - b.dayIndex);

  // Reset form when week changes - but check for pending data first
  // STABLE: Uses savedFormDataSnapshot to prevent resetting to stale week data after save
  useEffect(() => {
    // Helper to normalize tasks for comparison
    const normalizeTasks = (tasks: ProgramTaskTemplate[] | undefined) =>
      (tasks || []).map(t => ({
        id: t.id,
        label: t.label,
        isPrimary: t.isPrimary,
        // Coerce dayTag for comparison - arrays become strings
        dayTag: Array.isArray(t.dayTag) ? t.dayTag.join(',') : t.dayTag
      }));

    const weekTasksNormalized = normalizeTasks(week.weeklyTasks);

    // FIRST: Check if resetVersion changed (save/discard from global buttons)
    // Use wasSavingWhenResetVersionChanged ref to know if this was a save or discard
    // (by the time effect runs, isSaving is already false due to React batching)
    if (editorContext && editorContext.resetVersion !== lastResetVersion.current) {
      const wasSave = wasSavingWhenResetVersionChanged.current;

      console.log('[WeekEditor:resetEffect] Reset version changed:', {
        oldVersion: lastResetVersion.current,
        newVersion: editorContext.resetVersion,
        weekNumber: week.weekNumber,
        wasSave,
      });

      lastResetVersion.current = editorContext.resetVersion;
      wasSavingWhenResetVersionChanged.current = false; // Reset for next time

      if (wasSave) {
        // SAVE: Store snapshot of what we saved - formData has the correct values
        // Include ALL editable fields, not just tasks
        savedFormDataSnapshot.current = {
          weeklyTasks: normalizeTasks(formData.weeklyTasks),
          currentFocus: formData.currentFocus,
          description: formData.description,
          theme: formData.theme,
          weeklyPrompt: formData.weeklyPrompt,
          notes: formData.notes,
          manualNotes: formData.manualNotes,
          resourceAssignments: formData.resourceAssignments,
        };
        console.log('[WeekEditor:resetEffect] SAVE - stored snapshot:',
          { tasks: savedFormDataSnapshot.current.weeklyTasks.length, goals: savedFormDataSnapshot.current.currentFocus?.length });
      } else {
        // DISCARD: Reset to saved state from context (has full data) or week prop
        const savedState = editorContext?.getSavedState?.('week', week.id, clientContextId);
        if (savedState) {
          console.log('[WeekEditor:resetEffect] DISCARD - resetting to saved state from context');
          // Use saved state values with week defaults for missing fields
          setFormData({
            name: week.name || '',
            theme: (savedState.theme as string) || '',
            description: (savedState.description as string) || '',
            weeklyPrompt: (savedState.weeklyPrompt as string) || '',
            weeklyTasks: (savedState.weeklyTasks as ProgramTaskTemplate[]) || [],
            currentFocus: (savedState.currentFocus as string[]) || [],
            notes: (savedState.notes as string[]) || [],
            manualNotes: (savedState.manualNotes as string) || '',
            distribution: ((savedState.distribution as string) || week.distribution || 'spread') as TaskDistribution,
            coachRecordingUrl: (savedState.coachRecordingUrl as string) || week.coachRecordingUrl || '',
            coachRecordingNotes: (savedState.coachRecordingNotes as string) || week.coachRecordingNotes || '',
            linkedSummaryIds: (savedState.linkedSummaryIds as string[]) || week.linkedSummaryIds || [],
            linkedCallEventIds: (savedState.linkedCallEventIds as string[]) || week.linkedCallEventIds || [],
            linkedArticleIds: (savedState.linkedArticleIds as string[]) || week.linkedArticleIds || [],
            linkedDownloadIds: (savedState.linkedDownloadIds as string[]) || week.linkedDownloadIds || [],
            linkedLinkIds: (savedState.linkedLinkIds as string[]) || week.linkedLinkIds || [],
            linkedQuestionnaireIds: (savedState.linkedQuestionnaireIds as string[]) || week.linkedQuestionnaireIds || [],
            courseAssignments: (savedState.courseAssignments as DayCourseAssignment[]) || week.courseAssignments || [],
            resourceAssignments: (savedState.resourceAssignments as WeekResourceAssignment[]) || week.resourceAssignments || [],
          });
        } else {
          console.log('[WeekEditor:resetEffect] DISCARD - resetting to week prop (no snapshot)');
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
            linkedArticleIds: week.linkedArticleIds || [],
            linkedDownloadIds: week.linkedDownloadIds || [],
            linkedLinkIds: week.linkedLinkIds || [],
            linkedQuestionnaireIds: week.linkedQuestionnaireIds || [],
            courseAssignments: week.courseAssignments || [],
            resourceAssignments: week.resourceAssignments || [],
          });
        }
        savedFormDataSnapshot.current = null;
      }
      setHasChanges(false);
      setShowSyncButton(false);
      setSaveStatus('idle');
      return; // Don't process further this cycle
    }

    // SECOND: If we have a saved snapshot, compare week prop against it
    if (savedFormDataSnapshot.current) {
      // Compare ALL snapshot fields, not just tasks
      const snapshotFingerprint = JSON.stringify({
        tasks: savedFormDataSnapshot.current.weeklyTasks,
        currentFocus: savedFormDataSnapshot.current.currentFocus || [],
        description: savedFormDataSnapshot.current.description || '',
        theme: savedFormDataSnapshot.current.theme || '',
        weeklyPrompt: savedFormDataSnapshot.current.weeklyPrompt || '',
        notes: savedFormDataSnapshot.current.notes || [],
        manualNotes: savedFormDataSnapshot.current.manualNotes || '',
        resourceAssignments: savedFormDataSnapshot.current.resourceAssignments || [],
      });
      const weekFingerprint = JSON.stringify({
        tasks: weekTasksNormalized,
        currentFocus: week.currentFocus || [],
        description: week.description || '',
        theme: week.theme || '',
        weeklyPrompt: week.weeklyPrompt || '',
        notes: week.notes || [],
        manualNotes: week.manualNotes || '',
        resourceAssignments: week.resourceAssignments || [],
      });

      if (weekFingerprint === snapshotFingerprint) {
        // Week caught up to saved state - sync formData to week and clear snapshot
        console.log('[WeekEditor:resetEffect] Week caught up to saved state - syncing formData');
        savedFormDataSnapshot.current = null;
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
          linkedArticleIds: week.linkedArticleIds || [],
          linkedDownloadIds: week.linkedDownloadIds || [],
          linkedLinkIds: week.linkedLinkIds || [],
          linkedQuestionnaireIds: week.linkedQuestionnaireIds || [],
          courseAssignments: week.courseAssignments || [],
          resourceAssignments: week.resourceAssignments || [],
        });
        setHasChanges(false);
        // Clear pending change and saved state from context since week is now in sync
        if (editorContext) {
          const changeKey = editorContext.getChangeKey('week', week.id, clientContextId);
          editorContext.discardChange(changeKey);
          editorContext.clearSavedState?.('week', week.id, clientContextId);
        }
        return;
      } else {
        // Week is still stale - DON'T reset formData, it has the saved values
        console.log('[WeekEditor:resetEffect] Week is stale, keeping formData');
        return;
      }
    }

    // THIRD: Normal reset logic - create a unique key for this state to prevent infinite loops
    const stateKey = `${week.id}:${weekDataFingerprint}:${clientContextId}:${viewContext}`;

    // Skip if we've already processed this exact state
    if (lastProcessedFingerprint.current === stateKey) {
      return;
    }
    lastProcessedFingerprint.current = stateKey;

    // Check if there's pending data or saved state in context for this week
    const contextPendingData = editorContext?.getPendingData('week', week.id, clientContextId);
    const contextSavedState = editorContext?.getSavedState?.('week', week.id, clientContextId);

    console.log('[WeekEditor:resetEffect] Processing:', {
      weekId: week.id,
      weekNumber: week.weekNumber,
      hasPendingData: !!contextPendingData,
      hasSavedState: !!contextSavedState,
    });

    // Restore from pending data (unsaved edits) or saved state (just saved, awaiting API refresh)
    const dataToRestore = contextPendingData || contextSavedState;
    if (dataToRestore) {
      // Restore from pending data or saved state
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
        courseAssignments: weekCourseAssignments,
        resourceAssignments: weekResourceAssignments,
      };
      const merged: WeekFormData = {
        ...defaults,
        ...dataToRestore,
        weeklyTasks: (dataToRestore.weeklyTasks as ProgramTaskTemplate[]) || defaults.weeklyTasks,
        currentFocus: (dataToRestore.currentFocus as string[]) || defaults.currentFocus,
        notes: (dataToRestore.notes as string[]) || defaults.notes,
        linkedSummaryIds: (dataToRestore.linkedSummaryIds as string[]) || defaults.linkedSummaryIds,
        linkedCallEventIds: (dataToRestore.linkedCallEventIds as string[]) || defaults.linkedCallEventIds,
        linkedArticleIds: (dataToRestore.linkedArticleIds as string[]) || defaults.linkedArticleIds,
        linkedDownloadIds: (dataToRestore.linkedDownloadIds as string[]) || defaults.linkedDownloadIds,
        linkedLinkIds: (dataToRestore.linkedLinkIds as string[]) || defaults.linkedLinkIds,
        linkedQuestionnaireIds: (dataToRestore.linkedQuestionnaireIds as string[]) || defaults.linkedQuestionnaireIds,
        courseAssignments: (dataToRestore.courseAssignments as DayCourseAssignment[]) || defaults.courseAssignments,
        resourceAssignments: (dataToRestore.resourceAssignments as WeekResourceAssignment[]) || defaults.resourceAssignments,
      };
      setFormData(merged);
      // Only mark as having changes if it's pending data (unsaved), not saved state
      setHasChanges(!!contextPendingData);
    } else {
      // Sync formData to week data - compare ALL fields, not just tasks
      const formFingerprint = JSON.stringify({
        tasks: normalizeTasks(formData.weeklyTasks),
        currentFocus: formData.currentFocus,
        description: formData.description,
        theme: formData.theme,
        weeklyPrompt: formData.weeklyPrompt,
        notes: formData.notes,
        manualNotes: formData.manualNotes,
      });
      const weekFingerprint = JSON.stringify({
        tasks: weekTasksNormalized,
        currentFocus: week.currentFocus || [],
        description: week.description || '',
        theme: week.theme || '',
        weeklyPrompt: week.weeklyPrompt || '',
        notes: week.notes || [],
        manualNotes: week.manualNotes || '',
      });

      if (formFingerprint !== weekFingerprint) {
        console.log('[WeekEditor:resetEffect] Syncing formData to week (fields differ)');
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
          courseAssignments: weekCourseAssignments,
          resourceAssignments: weekResourceAssignments,
        });
      }
      setHasChanges(false);
    }
    setShowSyncButton(false);
    setSaveStatus('idle');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.id, weekDataFingerprint, clientContextId, viewContext, editorContext?.resetVersion, editorContext?.isSaving]);

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
          courseAssignments: weekCourseAssignments,
          resourceAssignments: weekResourceAssignments,
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
          courseAssignments: (contextPendingData.courseAssignments as DayCourseAssignment[]) || defaults.courseAssignments,
          resourceAssignments: (contextPendingData.resourceAssignments as WeekResourceAssignment[]) || defaults.resourceAssignments,
        };
        setFormData(merged);
        setHasChanges(true);
        // Clear snapshot since we're switching contexts
        savedFormDataSnapshot.current = null;
      } else {
        // Reset to the week data for the new context
        // Clear snapshot since we're switching contexts
        savedFormDataSnapshot.current = null;
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
          courseAssignments: weekCourseAssignments,
          resourceAssignments: weekResourceAssignments,
        });
        setHasChanges(false);
      }
      setShowSyncButton(false);
      setSaveStatus('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewContext, clientContextId, week.id, week.weekNumber]);

  // Check for changes and register with context
  useEffect(() => {
    // Use ref to get current editorContext without adding it to dependencies
    // This prevents infinite loops when registerChange updates pendingChanges
    const currentEditorContext = editorContextRef.current;

    // Skip registration while context is currently saving
    if (currentEditorContext?.isSaving) {
      console.log('[WeekEditor:changeDetection] Skipping - context is saving');
      return;
    }

    // Helper to normalize tasks for comparison
    const normalizeTasks = (tasks: ProgramTaskTemplate[] | undefined) =>
      (tasks || []).map(t => ({
        id: t.id,
        label: t.label,
        isPrimary: t.isPrimary,
        // Coerce dayTag for comparison - arrays become strings
        dayTag: Array.isArray(t.dayTag) ? t.dayTag.join(',') : t.dayTag
      }));

    const weekTasksNormalized = normalizeTasks(week.weeklyTasks);
    const formTasksNormalized = normalizeTasks(formData.weeklyTasks);

    // Check for saved state in context (persists across unmounts)
    const contextSavedState = currentEditorContext?.getSavedState?.('week', week.id, clientContextId);

    // If we have a saved snapshot (local ref) or saved state (context), we're in post-save state
    // Compare ALL fields stored in snapshot, not just tasks
    if (savedFormDataSnapshot.current || contextSavedState) {
      // Use local snapshot if available, otherwise build from context saved state
      const snapshotData = savedFormDataSnapshot.current || (contextSavedState ? {
        weeklyTasks: normalizeTasks(contextSavedState.weeklyTasks as ProgramTaskTemplate[]),
        currentFocus: contextSavedState.currentFocus || [],
        description: contextSavedState.description || '',
        theme: contextSavedState.theme || '',
        weeklyPrompt: contextSavedState.weeklyPrompt || '',
        notes: contextSavedState.notes || [],
        manualNotes: contextSavedState.manualNotes || '',
        resourceAssignments: contextSavedState.resourceAssignments || [],
      } : null);

      if (!snapshotData) {
        // Shouldn't happen, but fallback to normal detection
        console.log('[WeekEditor:changeDetection] No snapshot data available');
      } else {
        const snapshotStr = JSON.stringify({
          weeklyTasks: snapshotData.weeklyTasks,
          currentFocus: snapshotData.currentFocus || [],
          description: snapshotData.description || '',
          theme: snapshotData.theme || '',
          weeklyPrompt: snapshotData.weeklyPrompt || '',
          notes: snapshotData.notes || [],
          manualNotes: snapshotData.manualNotes || '',
          resourceAssignments: snapshotData.resourceAssignments || [],
        });
        const weekStr = JSON.stringify({
          weeklyTasks: weekTasksNormalized,
          currentFocus: week.currentFocus || [],
          description: week.description || '',
          theme: week.theme || '',
          weeklyPrompt: week.weeklyPrompt || '',
          notes: week.notes || [],
          manualNotes: week.manualNotes || '',
          resourceAssignments: week.resourceAssignments || [],
        });
        const formStr = JSON.stringify({
          weeklyTasks: formTasksNormalized,
          currentFocus: formData.currentFocus,
          description: formData.description,
          theme: formData.theme,
          weeklyPrompt: formData.weeklyPrompt,
          notes: formData.notes,
          manualNotes: formData.manualNotes,
          resourceAssignments: formData.resourceAssignments || [],
        });

        if (weekStr === snapshotStr) {
          // Week caught up to saved state - clear snapshot and saved state
          console.log('[WeekEditor:changeDetection] Week caught up to saved state - clearing snapshot');
          savedFormDataSnapshot.current = null;
          setHasChanges(false);
          // Also clear saved state from context
          if (currentEditorContext?.clearSavedState) {
            currentEditorContext.clearSavedState('week', week.id, clientContextId);
          }
          return;
        }

        // Week is stale. Check if formData still matches snapshot (no new edits)
        if (formStr === snapshotStr) {
          // formData has saved values, week is stale - no changes to report
          setHasChanges(false);
          return;
        }

        // formData differs from snapshot - user has unsaved edits
        // Keep snapshot as baseline (don't clear it) so undo can detect match
        // Fall through to normal change detection to register with context
        console.log('[WeekEditor:changeDetection] New edits after save - falling through to register change');
      }
    }

    // EARLY EXIT: Check if we've already processed this exact form data + week combination
    // This prevents infinite loops when week prop doesn't update after save
    // IMPORTANT: Include ALL fields that can change to ensure changes are detected
    const stateFingerprint = JSON.stringify({
      weekId: week.id,
      // Basic info fields
      formName: formData.name,
      weekName: week.name,
      formTheme: formData.theme,
      weekTheme: week.theme,
      formDescription: formData.description,
      weekDescription: week.description,
      formWeeklyPrompt: formData.weeklyPrompt,
      weekWeeklyPrompt: week.weeklyPrompt,
      // Tasks
      formTasks: formData.weeklyTasks?.map(t => ({ id: t.id, label: t.label, isPrimary: t.isPrimary, dayTag: t.dayTag })),
      weekTasks: week.weeklyTasks?.map(t => ({ id: t.id, label: t.label, isPrimary: t.isPrimary, dayTag: t.dayTag })),
      // Weekly outcomes
      formCurrentFocus: formData.currentFocus,
      weekCurrentFocus: week.currentFocus,
      // Client notes (visible to client)
      formNotes: formData.notes,
      weekNotes: week.notes,
      // Private notes (coach only)
      formManualNotes: formData.manualNotes,
      weekManualNotes: week.manualNotes,
      // Linked content IDs
      formLinkedSummaryIds: formData.linkedSummaryIds,
      weekLinkedSummaryIds: week.linkedSummaryIds,
      formLinkedCallEventIds: formData.linkedCallEventIds,
      weekLinkedCallEventIds: week.linkedCallEventIds,
      // Resource assignments
      formResourceAssignments: formData.resourceAssignments,
      weekResourceAssignments: week.resourceAssignments,
    });
    if (stateFingerprint === lastRegisteredFingerprint.current) {
      // Already processed this exact state, skip to prevent infinite loop
      console.log('[WeekEditor:changeDetection] EARLY EXIT - fingerprint match, skipping');
      return;
    }

    // Log fingerprint comparison for debugging
    console.log('[WeekEditor:changeDetection] Fingerprint check:', {
      weekNumber: week.weekNumber,
      formTasksPrimary: formData.weeklyTasks?.map(t => t.isPrimary),
      weekTasksPrimary: week.weeklyTasks?.map(t => t.isPrimary),
      fingerprintsDiffer: stateFingerprint !== lastRegisteredFingerprint.current,
    });

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
      JSON.stringify(formData.linkedCallEventIds) !== JSON.stringify(week.linkedCallEventIds || []) ||
      JSON.stringify(formData.linkedArticleIds) !== JSON.stringify(week.linkedArticleIds || []) ||
      JSON.stringify(formData.linkedDownloadIds) !== JSON.stringify(week.linkedDownloadIds || []) ||
      JSON.stringify(formData.linkedLinkIds) !== JSON.stringify(week.linkedLinkIds || []) ||
      JSON.stringify(formData.linkedQuestionnaireIds) !== JSON.stringify(week.linkedQuestionnaireIds || []) ||
      JSON.stringify(formData.courseAssignments) !== JSON.stringify(week.courseAssignments || []) ||
      JSON.stringify(formData.resourceAssignments) !== JSON.stringify(week.resourceAssignments || []);
    
    // Debug logging for change detection
    const resourceAssignmentsMatch = JSON.stringify(formData.resourceAssignments) === JSON.stringify(week.resourceAssignments || []);
    if (changed) {
      console.log('[WeekEditor:changeDetection] Changes detected for week', week.weekNumber, {
        tasksMatch,
        resourceAssignmentsMatch,
        formDataTasksCount: formData.weeklyTasks?.length ?? 0,
        weekTasksCount: week.weeklyTasks?.length ?? 0,
        formDataTasks: formData.weeklyTasks?.map(t => ({ id: t.id, label: t.label, isPrimary: t.isPrimary, dayTag: t.dayTag })),
        weekTasks: week.weeklyTasks?.map(t => ({ id: t.id, label: t.label, isPrimary: t.isPrimary, dayTag: t.dayTag })),
        // Show which fields differ
        nameMatch: formData.name === (week.name || ''),
        themeMatch: formData.theme === (week.theme || ''),
        promptMatch: formData.weeklyPrompt === (week.weeklyPrompt || ''),
        distributionMatch: formData.distribution === (week.distribution || 'spread'),
        formResourceAssignments: formData.resourceAssignments?.map(r => ({ id: r.id, alsoCreateTask: r.alsoCreateTask })),
        weekResourceAssignments: (week.resourceAssignments || []).map(r => ({ id: r.id, alsoCreateTask: r.alsoCreateTask })),
      });
    }

    // Log the change detection result
    console.log('[WeekEditor:changeDetection] Result:', {
      weekNumber: week.weekNumber,
      changed,
      hasChangesWillBe: changed,
      formTasksCount: formData.weeklyTasks?.length || 0,
      weekTasksCount: week.weeklyTasks?.length || 0,
    });

    setHasChanges(changed);

    // Register changes with context if available
    // Use currentEditorContext (from ref) to avoid dependency on editorContext object
    if (currentEditorContext && changed && programId) {
      // GUARD: In client/cohort mode, we MUST have an instanceId before registering changes
      // Otherwise, the save would incorrectly go to the template endpoint
      if (isInstanceContext && !effectiveInstanceId) {
        if (instanceLookupLoading) {
          // Still loading - wait for instance to be found/created
          console.log('[WEEK_EDITOR] Waiting for instance lookup before registering change...');
          return;
        }
        // Not loading but no instanceId - this is a problem!
        // Either the instance doesn't exist or auto-creation failed
        console.error('[WEEK_EDITOR] MISSING INSTANCE - Changes cannot be saved!', {
          isInstanceContext,
          cohortId,
          enrollmentId,
          programId,
          effectiveInstanceId,
          instanceLookupLoading,
          viewContext,
        });
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
        const templateKey = currentEditorContext.getChangeKey('week', week.id, undefined);
        currentEditorContext.discardChange(templateKey);
      }

      // Update fingerprint to track that we've processed this state
      // (Uses same format as early exit check above)
      lastRegisteredFingerprint.current = stateFingerprint;


      currentEditorContext.registerChange({
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
          linkedArticleIds: week.linkedArticleIds,
          linkedDownloadIds: week.linkedDownloadIds,
          linkedLinkIds: week.linkedLinkIds,
          linkedQuestionnaireIds: week.linkedQuestionnaireIds,
          courseAssignments: week.courseAssignments,
          resourceAssignments: week.resourceAssignments,
        },
        pendingData: pendingDataForContext,
        apiEndpoint: endpoint,
        httpMethod,
      });
    } else if (currentEditorContext && !changed) {
      // Remove from pending changes if no longer changed
      const changeKey = currentEditorContext.getChangeKey('week', week.id, clientContextId);
      currentEditorContext.discardChange(changeKey);
      // CRITICAL: Update lastRegisteredFingerprint to the clean state
      // so that subsequent edits create a DIFFERENT fingerprint
      lastRegisteredFingerprint.current = stateFingerprint;
      console.log('[WeekEditor:changeDetection] No changes - updated fingerprint to clean state');
    }
  // Note: editorContext is accessed via ref (editorContextRef.current) to prevent infinite loops
  // when registerChange updates pendingChanges and causes context reference to change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, week.id, week.weekNumber, week.name, week.theme, week.description, week.weeklyPrompt, week.manualNotes, week.distribution, week.coachRecordingUrl, week.coachRecordingNotes, week.weeklyTasks, week.currentFocus, week.notes, week.linkedSummaryIds, week.linkedCallEventIds, week.linkedArticleIds, week.linkedDownloadIds, week.linkedLinkIds, week.linkedQuestionnaireIds, week.courseAssignments, week.resourceAssignments, programId, viewContext, clientContextId, getApiEndpoint, isInstanceContext, effectiveInstanceId, instanceLookupLoading]);

  // handleSave is only used by the SyncTemplateDialog now
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
        linkedSummaryIds: formData.linkedSummaryIds, // Send empty array to clear, not undefined
        linkedCallEventIds: formData.linkedCallEventIds, // Send empty array to clear, not undefined
        linkedArticleIds: formData.linkedArticleIds.length > 0 ? formData.linkedArticleIds : undefined,
        linkedDownloadIds: formData.linkedDownloadIds.length > 0 ? formData.linkedDownloadIds : undefined,
        linkedLinkIds: formData.linkedLinkIds.length > 0 ? formData.linkedLinkIds : undefined,
        linkedQuestionnaireIds: formData.linkedQuestionnaireIds.length > 0 ? formData.linkedQuestionnaireIds : undefined,
        courseAssignments: formData.courseAssignments.length > 0 ? formData.courseAssignments : undefined,
        resourceAssignments: formData.resourceAssignments.length > 0 ? formData.resourceAssignments : undefined,
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

  // Delete a call summary entirely (from database)
  const deleteSummary = async (summaryId: string) => {
    try {
      const response = await fetch(`/api/coach/call-summaries/${summaryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete summary');
      }

      // Remove from linked summaries if it was linked
      if (formData.linkedSummaryIds.includes(summaryId)) {
        setFormData({
          ...formData,
          linkedSummaryIds: formData.linkedSummaryIds.filter(id => id !== summaryId),
        });
      }

      // Notify parent to refresh the available summaries list
      onSummaryDeleted?.(summaryId);
    } catch (error) {
      console.error('Error deleting summary:', error);
      // Could add toast notification here
    }
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

  // Unified resource assignments handler (using UnifiedResourcesTabs)
  // Also generates/removes tasks for resources with alsoCreateTask enabled
  const handleResourceAssignmentsChange = (assignments: WeekResourceAssignment[]) => {
    console.log('[WeekEditor:handleResourceAssignmentsChange] Called with:', {
      assignmentsCount: assignments.length,
      alsoCreateTaskValues: assignments.map(a => ({ id: a.id, alsoCreateTask: a.alsoCreateTask })),
      currentFormDataResourceAssignments: formData.resourceAssignments?.map(a => ({ id: a.id, alsoCreateTask: a.alsoCreateTask })),
    });
    // Build resource titles map from available resources
    const resourceTitles = new Map<string, string>();
    availableCourses.forEach(c => resourceTitles.set(c.id, c.title));
    availableVideos.forEach(v => resourceTitles.set(v.id, v.title));
    availableArticles.forEach(a => resourceTitles.set(a.id, a.title));
    availableDownloads.forEach(d => resourceTitles.set(d.id, d.title));
    availableLinks.forEach(l => resourceTitles.set(l.id, l.title));
    availableQuestionnaires.forEach(q => resourceTitles.set(q.id, q.title));

    // Build course data for per-lesson task generation
    const courseData = new Map<string, { modules?: { id: string; title: string; lessons?: { id: string; title: string }[] }[] }>();
    availableCourses.forEach(c => {
      courseData.set(c.id, {
        modules: c.modules?.map(m => ({
          id: m.id,
          title: m.title,
          lessons: m.lessons?.map(l => ({ id: l.id, title: l.title })),
        })),
      });
    });

    // Generate tasks from resources that have alsoCreateTask enabled
    const generatedTasks = generateTasksFromResources(assignments, resourceTitles, courseData);

    // Merge with existing tasks (removes tasks for disabled resources, adds new ones)
    const mergedTasks = mergeResourceTasks(formData.weeklyTasks, generatedTasks, assignments);

    setFormData({
      ...formData,
      resourceAssignments: assignments,
      weeklyTasks: mergedTasks,
    });
  };

  // Filter available items to exclude already linked ones
  // Helper to get timestamp from various date formats for sorting
  const getTimestamp = (dateValue: unknown): number => {
    if (!dateValue) return 0;
    if (typeof dateValue === 'string') {
      return new Date(dateValue).getTime();
    } else if (dateValue instanceof Date) {
      return dateValue.getTime();
    } else if (typeof dateValue === 'object' && dateValue !== null && 'seconds' in dateValue) {
      return (dateValue as { seconds: number }).seconds * 1000;
    }
    return 0;
  };

  // Filter and sort summaries by date (most recent first)
  const availableSummariesToLink = availableCallSummaries
    .filter(s => !formData.linkedSummaryIds.includes(s.id))
    .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
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
    c => !formData.courseAssignments.some(a => a.courseId === c.id)
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

  // Helper to format date from various formats (ISO string, Firestore Timestamp, Date)
  // Format: "Jan 14th at 14:30"
  const formatSummaryDate = useCallback((dateValue: unknown): string => {
    if (!dateValue) return '';

    let date: Date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'object' && dateValue !== null) {
      // Handle various Firestore Timestamp formats
      const obj = dateValue as Record<string, unknown>;
      if ('seconds' in obj && typeof obj.seconds === 'number') {
        // Standard Firestore Timestamp: { seconds: number, nanoseconds: number }
        date = new Date(obj.seconds * 1000);
      } else if ('_seconds' in obj && typeof obj._seconds === 'number') {
        // Serialized Firestore Timestamp: { _seconds: number, _nanoseconds: number }
        date = new Date(obj._seconds * 1000);
      } else if ('toDate' in obj && typeof obj.toDate === 'function') {
        // Firestore Timestamp with toDate method
        date = (obj.toDate as () => Date)();
      } else {
        return '';
      }
    } else {
      return '';
    }

    if (isNaN(date.getTime())) return '';

    // Format date part: "Jan 14th"
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const daySuffix = (d: number) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    // Format time part: "14:30"
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${month} ${day}${daySuffix(day)} at ${hours}:${minutes}`;
  }, []);

  // Helper to generate summary label with entity name and date
  const getSummaryLabel = useCallback((summary: CallSummary) => {
    const entityName = clientName || cohortName;
    const dateStr = formatSummaryDate(summary.createdAt);

    if (entityName && dateStr) {
      return `${entityName} - ${dateStr}`;
    } else if (entityName) {
      return entityName;
    } else if (dateStr) {
      return `Summary from ${dateStr}`;
    } else {
      return `Summary ${summary.id.slice(0, 8)}...`;
    }
  }, [clientName, cohortName, formatSummaryDate]);

  // Task management
  const addTask = () => {
    if (!newTask.trim()) return;
    const task: ProgramTaskTemplate = {
      id: crypto.randomUUID(),
      label: newTask.trim(),
      isPrimary: true,
      type: 'task',
      dayTag: 'auto',
    };
    setFormData({ ...formData, weeklyTasks: [...formData.weeklyTasks, task] });
    setNewTask('');
  };

  // Add multiple tasks at once (from summary action items)
  const addTasksFromSummary = (tasks: ProgramTaskTemplate[]) => {
    if (tasks.length === 0) return;
    setFormData({ ...formData, weeklyTasks: [...formData.weeklyTasks, ...tasks] });
  };

  // Calculate days in week for UI display
  // For partial weeks (onboarding/closing), use displayDaysCount to show full week
  const actualDayCount = week.endDayIndex && week.startDayIndex
    ? week.endDayIndex - week.startDayIndex + 1
    : (includeWeekends ? 7 : 5);
  const displayDaysCount = (week as { displayDaysCount?: number }).displayDaysCount;
  const daysInWeek = displayDaysCount || actualDayCount;

  // Get partial week boundaries for task distribution
  const actualStartDayOfWeek = (week as { actualStartDayOfWeek?: number }).actualStartDayOfWeek;
  const actualEndDayOfWeek = (week as { actualEndDayOfWeek?: number }).actualEndDayOfWeek;

  // Compute preview days with distributed weekly tasks for Day Preview section
  // This mirrors the server-side distribution logic so the preview updates in real-time
  const previewDays = useMemo(() => {
    const numDays = daysInWeek;
    const distribution = formData.distribution || 'spread';

    // Calculate active range (0-indexed) for partial weeks
    // For onboarding: actualStartDayOfWeek=3 (Wed) → activeStartIdx=2, activeEndIdx=4
    // For closing ending Wed: actualEndDayOfWeek=3 → activeEndIdx=2
    const activeStartIdx = Math.max(0, (actualStartDayOfWeek || 1) - 1);
    const activeEndIdx = Math.min(numDays - 1, (actualEndDayOfWeek || numDays) - 1);
    const activeRange = activeEndIdx - activeStartIdx + 1;

    // Initialize days with existing tasks from props (day-level tasks)
    // and clear any previous week-sourced tasks
    // Build a set of weekly task labels for faster lookup
    const weeklyTaskLabels = new Set(formData.weeklyTasks.map(t => t.label));

    const computedDays = Array.from({ length: numDays }, (_, i) => {
      const existingDay = days[i];
      // Filter out week-sourced tasks from existing days to avoid double-counting
      // Also filter out tasks whose labels match weekly tasks (for backwards compat with old data)
      const dayLevelTasks = (existingDay?.tasks || []).filter(t =>
        t.source !== 'week' && !weeklyTaskLabels.has(t.label)
      );
      return {
        ...existingDay,
        dayIndex: i + 1,
        tasks: [...dayLevelTasks],
      };
    });

    // Categorize weekly tasks by their dayTag
    const dailyTasks: ProgramTaskTemplate[] = [];
    const spreadTasks: ProgramTaskTemplate[] = [];
    const specificDayTasks: Map<number, ProgramTaskTemplate[]> = new Map();
    const autoTasks: ProgramTaskTemplate[] = [];

    for (const task of formData.weeklyTasks) {
      const dayTag = task.dayTag;
      if (dayTag === 'daily') {
        dailyTasks.push(task);
      } else if (dayTag === 'spread') {
        spreadTasks.push(task);
      } else if (Array.isArray(dayTag)) {
        // Multiple specific days - add task to each specified day
        // dayNum is programDayIndex (1-based, relative to active days in week)
        for (const dayNum of dayTag) {
          if (dayNum >= 1 && dayNum <= activeRange) {
            const existing = specificDayTasks.get(dayNum) || [];
            existing.push(task);
            specificDayTasks.set(dayNum, existing);
          }
        }
      } else if (typeof dayTag === 'number' && dayTag >= 1 && dayTag <= activeRange) {
        // dayTag is programDayIndex (1-based, relative to active days in week)
        const existing = specificDayTasks.get(dayTag) || [];
        existing.push(task);
        specificDayTasks.set(dayTag, existing);
      } else {
        // dayTag: undefined, 'auto', or invalid → use distribution setting
        autoTasks.push(task);
      }
    }

    // Add daily tasks to ACTIVE days only (for partial weeks)
    for (const task of dailyTasks) {
      for (let dayIdx = activeStartIdx; dayIdx <= activeEndIdx; dayIdx++) {
        computedDays[dayIdx].tasks.push({ ...task, source: 'week' as const });
      }
    }

    // Add specific-day tasks to their designated day (only if within active range)
    // Note: dayNum from specificDayTasks is now programDayIndex (1-based, relative to active days)
    // We need to convert to computedDays index by adding the activeStartIdx offset
    for (const [programDayNum, tasks] of specificDayTasks) {
      // programDayIndex 1 → first active day → computedDays[activeStartIdx]
      const dayIdx = activeStartIdx + (programDayNum - 1);
      if (dayIdx >= activeStartIdx && dayIdx <= activeEndIdx) {
        for (const task of tasks) {
          computedDays[dayIdx].tasks.push({ ...task, source: 'week' as const });
        }
      }
    }

    // Combine spread tasks with auto tasks when distribution is 'spread'
    // This ensures they're distributed together as one pool for even spacing
    // When distribution is 'repeat-daily', spread tasks are still spread, auto tasks repeat
    const tasksToSpread: ProgramTaskTemplate[] = [...spreadTasks];
    const tasksToRepeat: ProgramTaskTemplate[] = [];

    if (distribution === 'spread') {
      // Auto tasks join the spread pool
      tasksToSpread.push(...autoTasks);
    } else if (distribution === 'repeat-daily') {
      // Auto tasks go to repeat pool, spread tasks stay in spread pool
      tasksToRepeat.push(...autoTasks);
    }

    // Spread tasks evenly across ACTIVE days only
    // IMPORTANT: This must match program-instances.ts distributeTasksToDays() calculation exactly.
    // The formula: offset = round(taskIdx * (activeRange - 1) / (numTasks - 1))
    // Maps task indices 0..N-1 to day indices 0..R-1, where multiple tasks can land on same day.
    if (tasksToSpread.length > 0 && activeRange > 0) {
      const numTasks = tasksToSpread.length;
      for (let taskIdx = 0; taskIdx < numTasks; taskIdx++) {
        let activeIdx: number;
        if (numTasks === 1) {
          activeIdx = 0;
        } else {
          // Spread within active range - same formula as distributeTasksToDays
          activeIdx = Math.round(taskIdx * (activeRange - 1) / (numTasks - 1));
        }
        const calendarIdx = activeStartIdx + activeIdx;
        computedDays[calendarIdx].tasks.push({ ...tasksToSpread[taskIdx], source: 'week' as const });
      }
    }

    // Add repeat tasks to ACTIVE days only
    for (const task of tasksToRepeat) {
      for (let dayIdx = activeStartIdx; dayIdx <= activeEndIdx; dayIdx++) {
        computedDays[dayIdx].tasks.push({ ...task, source: 'week' as const });
      }
    }

    return computedDays;
  }, [days, daysInWeek, formData.weeklyTasks, formData.distribution, actualStartDayOfWeek, actualEndDayOfWeek]);

  // Fetch members when task is expanded
  // Uses refs for taskMemberData/loadingTasks checks to avoid infinite loops
  useEffect(() => {
    expandedTasks.forEach(taskKey => {
      const task = formData.weeklyTasks.find(t => (t.id || t.label) === taskKey);
      if (task) {
        const cacheKey = task.id || task.label;
        fetchTaskMembers(task.id || task.label, cacheKey);
      }
    });
    // Note: fetchTaskMembers uses refs internally to check if already loaded/loading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedTasks, formData.weeklyTasks, fetchTaskMembers]);

  // Pre-fetch member data for all tasks in cohort mode
  // Uses refs for taskMemberData/loadingTasks checks to avoid infinite loops
  useEffect(() => {
    if (!cohortId || formData.weeklyTasks.length === 0) return;
    formData.weeklyTasks.forEach(task => {
      const cacheKey = task.id || task.label;
      fetchTaskMembers(task.id || task.label, cacheKey);
    });
    // Note: fetchTaskMembers uses refs internally to check if already loaded/loading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId, formData.weeklyTasks, fetchTaskMembers]);

  // Toggle primary/backlog for a task
  const toggleTaskPrimary = (index: number) => {
    const updated = [...formData.weeklyTasks];
    const oldValue = updated[index].isPrimary;
    updated[index] = { ...updated[index], isPrimary: !oldValue };
    console.log('[WeekEditor] toggleTaskPrimary:', { index, oldValue, newValue: !oldValue, taskLabel: updated[index].label });
    setFormData({ ...formData, weeklyTasks: updated });
  };

  // Remove a task
  const removeTask = (index: number) => {
    setFormData({
      ...formData,
      weeklyTasks: formData.weeklyTasks.filter((_, i) => i !== index),
    });
  };

  // Handle dayTag change - just update the metadata, distribution handles the rest
  const handleDayTagChange = (index: number, newDayTag: DayTagValue) => {
    const updated = [...formData.weeklyTasks];
    updated[index] = { ...updated[index], dayTag: newDayTag };
    setFormData({ ...formData, weeklyTasks: updated });
  };

  // Focus management (max 3)
  const addFocus = () => {
    if (!newFocus.trim() || formData.currentFocus.length >= 3) return;
    setFormData({ ...formData, currentFocus: [...formData.currentFocus, newFocus.trim()] });
    setNewFocus('');
  };

  const removeFocus = (index: number) => {
    setFormData({
      ...formData,
      currentFocus: formData.currentFocus.filter((_, i) => i !== index),
    });
  };

  const startEditingFocus = (index: number) => {
    setEditingFocusIndex(index);
    setEditingFocusText(formData.currentFocus[index]);
  };

  const saveEditingFocus = () => {
    if (editingFocusIndex === null) return;
    const trimmed = editingFocusText.trim();
    if (!trimmed) {
      // If empty, cancel edit (don't delete - user can use X button for that)
      setEditingFocusIndex(null);
      setEditingFocusText('');
      return;
    }
    setFormData({
      ...formData,
      currentFocus: formData.currentFocus.map((f, i) => i === editingFocusIndex ? trimmed : f),
    });
    setEditingFocusIndex(null);
    setEditingFocusText('');
  };

  const cancelEditingFocus = () => {
    setEditingFocusIndex(null);
    setEditingFocusText('');
  };

  // Notes management (max 3)
  const addNote = () => {
    if (!newNote.trim() || formData.notes.length >= 3) return;
    setFormData({ ...formData, notes: [...formData.notes, newNote.trim()] });
    setNewNote('');
  };

  const removeNote = (index: number) => {
    setFormData({
      ...formData,
      notes: formData.notes.filter((_, i) => i !== index),
    });
  };

  const startEditingNote = (index: number) => {
    setEditingNoteIndex(index);
    setEditingNoteText(formData.notes[index]);
  };

  const saveEditingNote = () => {
    if (editingNoteIndex === null) return;
    const trimmed = editingNoteText.trim();
    if (!trimmed) {
      setEditingNoteIndex(null);
      setEditingNoteText('');
      return;
    }
    setFormData({
      ...formData,
      notes: formData.notes.map((n, i) => i === editingNoteIndex ? trimmed : n),
    });
    setEditingNoteIndex(null);
    setEditingNoteText('');
  };

  const cancelEditingNote = () => {
    setEditingNoteIndex(null);
    setEditingNoteText('');
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

  // Cancel a stuck recording
  const handleCancelRecording = async () => {
    if (!pendingRecordingId) return;

    try {
      const response = await fetch(`/api/coach/recordings/${pendingRecordingId}/cancel`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to cancel recording');
      }

      // Reset all recording state
      setRecordingStatus('idle');
      setRecordingError(null);
      setPendingRecordingId(null);
      setDetailedStatus(null);
      setRecordingFile(null);
    } catch (err) {
      console.error('Error cancelling recording:', err);
      setRecordingError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

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
      setDetailedStatus('uploaded');
      setRecordingFile(null);

      // Step 3: Trigger processing - server runs for up to 5 minutes
      // Client waits for response, but if they refresh, pending check picks it up
      const processBody = {
        storagePath,
        fileName,
        fileSize,
        durationSeconds,
        clientUserId: clientUserId || undefined,
        cohortId: cohortId || undefined,
        programEnrollmentId: enrollmentId || undefined,
        programId: cohortId && programId ? programId : undefined,
        weekId: cohortId && programId ? week.id : undefined,
      };

      // Start polling for status updates in parallel (to show transcribing/summarizing)
      let statusPollInterval: NodeJS.Timeout | null = null;
      let currentRecordingId: string | null = null;

      // Build query params for pending check
      const pendingParams = new URLSearchParams();
      if (cohortId && week.id) {
        pendingParams.set('cohortId', cohortId);
        pendingParams.set('weekId', week.id);
      } else if (clientUserId) {
        pendingParams.set('clientUserId', clientUserId);
        if (enrollmentId) pendingParams.set('enrollmentId', enrollmentId);
      }

      // Start polling after a short delay (to let server create the doc)
      const pollTimeout = setTimeout(async () => {
        // Get the recording ID first
        try {
          const pendingRes = await fetch(`/api/coach/recordings/pending?${pendingParams.toString()}`);
          if (pendingRes.ok) {
            const pendingData = await pendingRes.json();
            if (pendingData.pendingRecording) {
              currentRecordingId = pendingData.pendingRecording.id;
              setDetailedStatus(pendingData.pendingRecording.status);
            }
          }
        } catch (e) {
          console.error('Error getting pending recording:', e);
        }

        // Poll for status updates every 3 seconds
        statusPollInterval = setInterval(async () => {
          if (!currentRecordingId) return;
          try {
            const statusRes = await fetch(`/api/coach/recordings/${currentRecordingId}/status`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setDetailedStatus(statusData.status);
            }
          } catch (e) {
            // Ignore polling errors
          }
        }, 3000);
      }, 1500);

      // Wait for the process response (runs in parallel with polling)
      const processResponse = await fetch('/api/coach/recordings/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processBody),
      });

      // Stop polling
      clearTimeout(pollTimeout);
      if (statusPollInterval) clearInterval(statusPollInterval);

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Processing failed (${processResponse.status})`);
      }

      const result = await processResponse.json();

      if (result.status === 'failed' || !result.success) {
        throw new Error(result.message || 'Processing failed');
      }

      // Processing complete!
      setRecordingStatus('completed');
      setDetailedStatus(null);

      // Refetch call summaries to show the new summary
      if (result.callSummaryId) {
        onSummaryGenerated?.(result.callSummaryId);
      }

      // Reset to idle after showing success
      setTimeout(() => setRecordingStatus('idle'), 3000);
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <h3 className="text-lg sm:text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {week.name || (week.weekNumber === 0 ? 'Onboarding' : week.weekNumber === -1 ? 'Closing' : `Week ${week.weekNumber}`)}
          </h3>
          {/* Client/Cohort/Template mode badge */}
          {isClientView ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              {clientName || 'Client'}
            </span>
          ) : isCohortMode ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <Users className="w-3 h-3" />
              {cohortName || 'Cohort'}
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#f3f1ef] text-[#5f5a55] dark:bg-[#262b35] dark:text-[#b2b6c2]">
              <FileText className="w-3 h-3" />
              Template
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Save/Discard buttons - show when there are unsaved changes */}
          <AnimatePresence>
            {editorContext?.hasUnsavedChanges && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <button
                  onClick={() => editorContext.discardAllChanges()}
                  disabled={editorContext.isSaving}
                  className="flex items-center justify-center h-8 sm:h-9 w-8 sm:w-auto sm:px-3 text-xs sm:text-sm text-[#5f5a55] hover:text-red-500 dark:text-[#b2b6c2] dark:hover:text-red-400 transition-colors disabled:opacity-50 rounded-xl bg-[#f3f1ef] hover:bg-red-50 dark:bg-[#262b35] dark:hover:bg-red-900/20"
                  title="Discard all changes"
                >
                  <X className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Discard</span>
                </button>
                <Button
                  onClick={() => editorContext.saveAllChanges()}
                  disabled={editorContext.isSaving}
                  className="flex items-center gap-1.5 h-8 sm:h-9 px-4 sm:px-6 bg-brand-accent hover:bg-brand-accent/90 text-white text-xs sm:text-sm font-medium"
                >
                  {editorContext.isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

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
              onClick={() => setSyncDialogOpen(true)}
              className="flex items-center gap-1.5 border-brand-accent text-brand-accent hover:bg-brand-accent/10 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Sync to Cohorts</span>
              <span className="sm:hidden">Sync</span>
            </Button>
          )}
        </div>
      </div>

      {/* Warning banner for missing instance - changes cannot be saved */}
      {isMissingInstance && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Program instance not found
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Changes cannot be saved. Please try refreshing the page. If the issue persists, the cohort may need to be re-configured.
            </p>
          </div>
        </div>
      )}

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
        hasContent={!!formData.theme || !!formData.description || formData.currentFocus.length > 0}
      >
        {/* Week Theme */}
        <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Weekly Theme
          </label>
          <input
            type="text"
            value={formData.theme}
            onChange={(e) => { setFormData({ ...formData, theme: e.target.value }); }}
            placeholder="e.g., Building Foundations"
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
          />
        </div>

        {/* Weekly Goal */}
        <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Weekly Goal
            <span className="ml-2 text-xs font-normal text-[#a7a39e] dark:text-[#6b7280]">
              {formData.currentFocus.length}/3
            </span>
          </label>
          {formData.currentFocus.length < 3 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newFocus}
                onChange={(e) => setNewFocus(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFocus.trim()) {
                    // Handle comma-separated entry
                    const goals = newFocus.split(',').map(g => g.trim()).filter(g => g);
                    const remaining = 3 - formData.currentFocus.length;
                    const toAdd = goals.slice(0, remaining);
                    if (toAdd.length > 0) {
                      setFormData({ ...formData, currentFocus: [...formData.currentFocus, ...toAdd] });
                      setNewFocus('');
                    }
                  }
                }}
                placeholder={formData.currentFocus.length === 0 ? "Type goals separated by comma..." : "Add another goal..."}
                className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newFocus.trim()) return;
                  const goals = newFocus.split(',').map(g => g.trim()).filter(g => g);
                  const remaining = 3 - formData.currentFocus.length;
                  const toAdd = goals.slice(0, remaining);
                  if (toAdd.length > 0) {
                    setFormData({ ...formData, currentFocus: [...formData.currentFocus, ...toAdd] });
                    setNewFocus('');
                  }
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-[#faf8f6] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent hover:text-brand-accent transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
          {formData.currentFocus.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.currentFocus.map((focus, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#faf8f6] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-full text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                >
                  {focus}
                  <button
                    type="button"
                    onClick={() => removeFocus(index)}
                    className="p-0.5 text-[#a7a39e] hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Week Description */}
        <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => { setFormData({ ...formData, description: e.target.value }); }}
            placeholder="What clients will accomplish this week..."
            rows={2}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
          />
        </div>

        {/* Weekly Prompt - DEPRECATED: Hidden from UI but data preserved */}
        {/* <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Weekly Prompt
          </label>
          <textarea
            value={formData.weeklyPrompt}
            onChange={(e) => { setFormData({ ...formData, weeklyPrompt: e.target.value }); }}
            placeholder="Motivational message or guidance for this week..."
            rows={2}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
          />
        </div> */}
      </CollapsibleSection>

      {/* Tasks & Focus Section */}
      <CollapsibleSection
          title="Tasks & Focus"
          icon={ListTodo}
          defaultOpen={true}
          hasContent={formData.weeklyTasks.filter(t => !t.sourceResourceId).length > 0}
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
                  items={formData.weeklyTasks.filter(t => !t.sourceResourceId).map(t => t.id || t.label)}
                  strategy={verticalListSortingStrategy}
                >
                  {formData.weeklyTasks
                    .map((task, realIndex) => ({ task, realIndex }))
                    .filter(({ task }) => !task.sourceResourceId)
                    .map(({ task, realIndex }) => {
                    const taskKey = task.id || task.label;
                    const cohortCompletion = cohortId
                      ? (task.id && cohortWeeklyTaskCompletion.get(task.id)) || cohortWeeklyTaskCompletion.get(task.label)
                      : undefined;
                    return (
                      <SortableWeeklyTask
                        key={taskKey}
                        id={taskKey}
                        task={task}
                        index={realIndex}
                        showCompletionStatus={isClientView || !!cohortId}
                        onTogglePrimary={toggleTaskPrimary}
                        onRemove={removeTask}
                        dayTag={(task.dayTag as DayTagValue) || 'auto'}
                        onDayTagChange={handleDayTagChange}
                        includeWeekends={includeWeekends}
                        daysInWeek={daysInWeek}
                        calendarStartDate={weekCalendarStartDate}
                        actualStartDayOfWeek={actualStartDayOfWeek}
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
                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
              />
              <Button onClick={addTask} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Day Preview Bar */}
            <div className="mt-4 pt-4 border-t border-[#e1ddd8]/40 dark:border-[#262b35]/40">
              <div className="mb-2">
                <span className="text-xs font-medium text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                  Day Preview
                </span>
              </div>
              <div className="flex gap-2">
                {Array.from({ length: daysInWeek }, (_, i) => {
                  const dayNum = i + 1;
                  // Use previewDays for task counts (includes distributed weekly tasks)
                  const previewDay = previewDays[i];
                  const taskCount = previewDay?.tasks?.filter(t => t.isPrimary !== false)?.length || 0;
                  const dotCount = Math.min(taskCount, 3);
                  const isEmpty = taskCount === 0;

                  // Get day label and date info
                  const calendarStartDate = (week as { calendarStartDate?: string }).calendarStartDate;
                  const actualStartDayOfWeek = (week as { actualStartDayOfWeek?: number }).actualStartDayOfWeek;
                  let dayLabel = `Day ${dayNum}`;
                  let dateLabel = '';
                  let dayStatus: 'past' | 'active' | 'future' = 'future';

                  if (calendarStartDate) {
                    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    // Parse as local date to avoid UTC timezone issues
                    const [year, month, dayOfMonth] = calendarStartDate.split('-').map(Number);
                    const dayDate = new Date(year, month - 1, dayOfMonth + i);
                    const weekdayName = WEEKDAYS[dayDate.getDay()];
                    const monthDay = dayDate.getDate();
                    const monthName = dayDate.toLocaleDateString('en-US', { month: 'short' });
                    dayLabel = weekdayName;
                    dateLabel = `${monthName} ${monthDay}`;

                    // Calculate day status (past/active/future)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dayDate.setHours(0, 0, 0, 0);
                    if (dayDate.getTime() < today.getTime()) {
                      dayStatus = 'past';
                    } else if (dayDate.getTime() === today.getTime()) {
                      dayStatus = 'active';
                    } else {
                      dayStatus = 'future';
                    }
                  }

                  // Check if this day is outside the active range (pre-enrollment or post-program blur)
                  const isPreEnrollment = week.weekNumber === 0 && !!actualStartDayOfWeek && dayNum < actualStartDayOfWeek;
                  const isPostProgram = week.weekNumber === -1 && !!actualEndDayOfWeek && dayNum > actualEndDayOfWeek;
                  const isInactive = isPreEnrollment || isPostProgram;

                  // Convert visual position to program dayIndex for partial weeks
                  const dayOffset = (actualStartDayOfWeek && actualStartDayOfWeek > 1) ? actualStartDayOfWeek - 1 : 0;
                  const programDayIndex = dayNum - dayOffset;

                  // Status-based styles
                  const statusBgClass = isInactive
                    ? 'bg-gray-100 dark:bg-[#15181f]'
                    : dayStatus === 'past'
                      ? 'bg-yellow-50/60 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/40'
                      : dayStatus === 'active'
                        ? 'bg-green-50/60 dark:bg-green-950/20 border-green-300 dark:border-green-700/50'
                        : 'bg-white dark:bg-[#1a1e28] border-[#e8e4df] dark:border-[#2a2f3a]';

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => !isInactive && setPreviewDayNumber(programDayIndex)}
                      disabled={isInactive}
                      className={cn(
                        'relative flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all border',
                        statusBgClass,
                        isInactive
                          ? 'opacity-30 cursor-not-allowed'
                          : 'hover:shadow-sm hover:border-brand-accent/40',
                        isEmpty && !isInactive && 'opacity-60'
                      )}
                    >
                      <span className={cn(
                        'text-xs font-medium font-albert text-center',
                        isInactive
                          ? 'text-[#a7a39e] dark:text-[#5a5e6a]'
                          : dayStatus === 'active'
                            ? 'text-green-700 dark:text-green-400'
                            : dayStatus === 'past'
                              ? 'text-yellow-700 dark:text-yellow-400'
                              : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                      )}>
                        {dayLabel}
                      </span>
                      {dateLabel && (
                        <span className={cn(
                          'text-[10px] font-albert text-center',
                          isInactive
                            ? 'text-[#c4c0bb] dark:text-[#4a4f5c]'
                            : dayStatus === 'active'
                              ? 'text-green-600 dark:text-green-500'
                              : dayStatus === 'past'
                                ? 'text-yellow-600 dark:text-yellow-500'
                                : 'text-[#a7a39e] dark:text-[#7d8190]'
                        )}>
                          {dateLabel}
                        </span>
                      )}
                      {taskCount > 0 && !isInactive && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 text-[10px] font-medium bg-brand-accent text-white rounded-full flex items-center justify-center">
                          {taskCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </CollapsibleSection>

      {/* Sessions Section - Calls, Summaries, Recordings */}
      {/* Always visible - shows info message in template mode, full UI in cohort/client mode */}
      <CollapsibleSection
        title="Sessions"
        icon={Video}
        description="Calls, recordings, and summaries"
        defaultOpen={false}
        hasContent={formData.linkedCallEventIds?.length > 0}
      >
        {/* Template mode message */}
        {!isClientView && !isCohortMode ? (
          <div className="p-4 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-[#8c8c8c] dark:text-[#7d8190] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                  Schedule sessions when viewing {programType === 'group' ? 'a cohort' : 'a client'}
                </p>
                <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                  {programType === 'group'
                    ? 'Select a cohort from the dropdown above to schedule sessions.'
                    : 'Select a client from the dropdown above to schedule sessions.'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Sessions list */}
            <div>

              {/* Currently linked events */}
              {formData.linkedCallEventIds.length > 0 && (
                <div className="space-y-2 mb-3">
                  {formData.linkedCallEventIds.map((eventId) => {
                    const event = availableEvents.find(e => e.id === eventId);
                    // Skip canceled/deleted events (they're soft-deleted with status='canceled')
                    if (!event || event.status === 'canceled') return null;
                    const isRecurringInstance = event?.parentEventId;
                    const eventDate = event?.startDateTime ? new Date(event.startDateTime) : null;
                    const isPast = eventDate ? eventDate < new Date() : false;
                    const isToday = eventDate ? eventDate.toDateString() === new Date().toDateString() : false;
                    // Check if this call has a linked summary
                    const hasSummary = availableCallSummaries.some(s => s.eventId === eventId);
                    // Check recording status
                    const hasRecording = event?.recordingUrl || event?.hasCallRecording;
                    const recordingStatus = event?.recordingStatus;
                    const isProcessing = recordingStatus === 'processing';
                    // Check if this is a video call (zoom/google_meet/stream) that could have automatic recording
                    const isVideoCall = event?.meetingProvider === 'zoom' ||
                                        event?.meetingProvider === 'google_meet' ||
                                        event?.meetingProvider === 'stream' ||
                                        event?.locationType === 'chat';
                    // Check if call ended recently (within 10 minutes) - recording may still be processing
                    const endTime = event?.endDateTime ? new Date(event.endDateTime) : eventDate ? new Date(eventDate.getTime() + (event?.durationMinutes || 60) * 60000) : null;
                    const minutesSinceEnd = endTime ? (Date.now() - endTime.getTime()) / 60000 : Infinity;
                    const isRecentlyEnded = isPast && isVideoCall && minutesSinceEnd < 10;
                    // Can generate summary if: past, has recording, no summary yet, not processing
                    const canGenerateSummary = isPast && hasRecording && !hasSummary && !isProcessing;

                    return (
                      <div
                        key={eventId}
                        className={cn(
                          "p-3 rounded-xl group border",
                          hasSummary
                            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                            : isToday
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                            : isPast && isRecentlyEnded
                            ? "bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700"
                            : "bg-[#faf8f6] dark:bg-[#1e222a] border-[#e8e4df] dark:border-[#2a2f3a]"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {hasSummary ? (
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : isProcessing || (isRecentlyEnded && !hasRecording) ? (
                            <Loader2 className="w-4 h-4 text-slate-500 animate-spin flex-shrink-0" />
                          ) : isToday ? (
                            <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          ) : isPast && hasRecording ? (
                            <Video className="w-4 h-4 text-brand-accent flex-shrink-0" />
                          ) : isPast ? (
                            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          ) : (
                            <Calendar className="w-4 h-4 text-brand-accent flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="block text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                              {event?.title || `Call ${eventId.slice(0, 8)}...`}
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                              {eventDate && (
                                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                                  {eventDate.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                              {isRecurringInstance && (
                                <span className="text-xs text-brand-accent">• Recurring</span>
                              )}
                              {hasSummary && (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                  • Summary ready
                                </span>
                              )}
                              {isProcessing && (
                                <span className="text-xs text-brand-accent font-medium">
                                  • Generating...
                                </span>
                              )}
                              {isPast && !hasSummary && !isProcessing && hasRecording && (
                                <span className="text-xs text-brand-accent">
                                  • Recording ready
                                </span>
                              )}
                              {isPast && !hasSummary && !isProcessing && !hasRecording && isRecentlyEnded && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  • Fetching recording...
                                </span>
                              )}
                              {isToday && (
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                  • Today
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeEventLink(eventId)}
                            className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Unlink call"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Media Player for past sessions with recording (audio or video) */}
                        {isPast && hasRecording && event?.recordingUrl && (
                          <div className="mt-3">
                            <MediaPlayer
                              src={event.recordingUrl}
                              poster={event.coverImageUrl}
                              className="rounded-lg overflow-hidden"
                              aspectRatio="16:9"
                            />
                            <a
                              href={event.recordingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mt-2 text-xs text-brand-accent hover:underline font-medium"
                            >
                              <Video className="w-3.5 h-3.5" />
                              View Full Recording
                            </a>
                          </div>
                        )}

                        {/* Recording actions for past sessions without recording */}
                        {isPast && !hasRecording && !isProcessing && (
                          <div className="mt-3">
                            {/* Processing state card for video calls that recently ended */}
                            {isRecentlyEnded ? (
                              <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                                  <div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                      Recording processing...
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      Usually ready within a few minutes
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 mt-3">
                                  <FetchRecordingButton
                                    eventId={eventId}
                                    onSuccess={() => onCallScheduled?.()}
                                    variant="button"
                                  />
                                  <InlineRecordingUpload
                                    eventId={eventId}
                                    onUploadComplete={() => onCallScheduled?.()}
                                    variant="link"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {/* Fetch recording button for video calls */}
                                {isVideoCall && (
                                  <FetchRecordingButton
                                    eventId={eventId}
                                    onSuccess={() => onCallScheduled?.()}
                                  />
                                )}
                                <InlineRecordingUpload
                                  eventId={eventId}
                                  onUploadComplete={() => onCallScheduled?.()}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Generate Summary Button */}
                        {canGenerateSummary && (
                          <div className="mt-2 pl-6">
                            <GenerateSummaryButton
                              eventId={eventId}
                              durationMinutes={event?.durationMinutes || 60}
                              onGenerated={(summaryId) => {
                                // Add the new summary to linked summaries
                                if (!formData.linkedSummaryIds.includes(summaryId)) {
                                  addSummaryLink(summaryId);
                                }
                                // Notify parent if callback provided
                                onSummaryGenerated?.(summaryId);
                              }}
                              className="w-full"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action buttons - only show when there are sessions */}
              {formData.linkedCallEventIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {/* Schedule Call button (1:1 programs) */}
                  {isClientView && clientUserId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowScheduleCallModal(true)}
                      className="flex items-center gap-1.5"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      Schedule Call
                    </Button>
                  )}

                  {/* Schedule Session button (cohort/group programs) */}
                  {isCohortMode && cohortId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowScheduleCohortModal(true)}
                      className="flex items-center gap-1.5"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      Schedule Session
                    </Button>
                  )}

                  {/* Link existing call dropdown */}
                  {availableEventsToLink.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                          Link existing call...
                          <ChevronDown className="w-4 h-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[220px]">
                        {availableEventsToLink.map((event) => (
                          <DropdownMenuItem
                            key={event.id}
                            onClick={() => addEventLink(event.id)}
                            className="flex flex-col items-start gap-0.5"
                          >
                            <span className="font-medium">{event.title || 'Call'}</span>
                            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                              {event.startDateTime
                                ? new Date(event.startDateTime).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })
                                : 'No date'}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}

              {/* Empty state - beautiful centered design */}
              {formData.linkedCallEventIds.length === 0 && (
                <div className="py-8 text-center">
                  <div className="w-14 h-14 bg-[#f3f1ef] dark:bg-[#272d38] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Video className="w-7 h-7 text-[#a7a39e] dark:text-[#7d8190]" />
                  </div>
                  <p className="text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                    No sessions yet
                  </p>
                  <p className="text-[13px] text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-4">
                    {isClientView
                      ? 'Schedule a call to meet with your client'
                      : isCohortMode
                      ? 'Schedule a session for your cohort'
                      : 'Select a cohort or client to schedule sessions'}
                  </p>
                  {/* CTA buttons */}
                  {isClientView && clientUserId && (
                    <Button
                      onClick={() => setShowScheduleCallModal(true)}
                      className="gap-1.5"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      Schedule Call
                    </Button>
                  )}
                  {isCohortMode && cohortId && (
                    <Button
                      onClick={() => {
                        console.log('[WeekEditor] Schedule Session button clicked! Setting showScheduleCohortModal=true', { effectiveInstanceId, weekNumber: week.weekNumber });
                        setShowScheduleCohortModal(true);
                      }}
                      className="gap-1.5"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      Schedule Session
                    </Button>
                  )}
                </div>
              )}
            </div>

        {/* Summary View Modal */}
        <CallSummaryViewModal
          summary={viewingSummary}
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setViewingSummary(null);
          }}
          onFetchTasks={addTasksFromSummary}
          onSummaryUpdated={(updatedSummary) => {
            // Only update the summary data, not the open state
            // This prevents re-render loops when summary is regenerated
            setViewingSummary(updatedSummary);
            // Notify parent to refresh the available summaries list
            onSummaryUpdated?.(updatedSummary);
          }}
          entityName={clientName || cohortName}
        />

        {/* Credit Purchase Modal */}
        <CreditPurchaseModal
          open={showCreditModal}
          onOpenChange={setShowCreditModal}
          onPurchaseComplete={() => {
            // Clear the error state so user can retry
            setRecordingError(null);
            setRecordingStatus('idle');
            // Reset bypass flag since credits were purchased
            editorContext?.setBypassBeforeUnload(false);
          }}
        />
          </>
        )}
      </CollapsibleSection>

      {/* Resources Section - Tabbed UI for Courses, Articles, Downloads, Links, Questionnaires */}
      <CollapsibleSection
        title="Resources"
        icon={BookOpen}
        description="Content to share with clients during this week"
        defaultOpen={false}
        hasContent={formData.resourceAssignments?.length > 0}
      >
        <UnifiedResourcesTabs
          resourceAssignments={formData.resourceAssignments}
          onResourceAssignmentsChange={handleResourceAssignmentsChange}
          availableCourses={availableCourses}
          availableVideos={availableVideos}
          availableArticles={availableArticles}
          availableDownloads={availableDownloads}
          availableLinks={availableLinks}
          availableQuestionnaires={availableQuestionnaires}
          programId={programId}
          includeWeekends={includeWeekends}
          contentCompletion={contentCompletion}
          calendarStartDate={weekCalendarStartDate}
          actualStartDayOfWeek={week.actualStartDayOfWeek}
          actualEndDayOfWeek={week.actualEndDayOfWeek}
        />
      </CollapsibleSection>

      {/* Notes Section - collapsed by default */}
      <CollapsibleSection
        title="Notes"
        icon={ClipboardList}
        defaultOpen={false}
        hasContent={formData.notes?.length > 0 || !!formData.manualNotes}
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
          {formData.notes.length < 3 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Add note..."
                className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
              />
              <button
                type="button"
                onClick={addNote}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-[#faf8f6] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent hover:text-brand-accent transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
          {formData.notes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {formData.notes.map((note, index) => (
                editingNoteIndex === index ? (
                  <input
                    key={index}
                    type="text"
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEditingNote();
                      if (e.key === 'Escape') cancelEditingNote();
                    }}
                    onBlur={saveEditingNote}
                    autoFocus
                    className="px-3 py-1.5 text-sm bg-white dark:bg-[#11141b] border border-brand-accent rounded-full font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                  />
                ) : (
                  <span
                    key={index}
                    onClick={() => startEditingNote(index)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#faf8f6] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-full text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer hover:border-brand-accent transition-colors"
                    title="Click to edit"
                  >
                    {note}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeNote(index); }}
                      className="p-0.5 text-[#a7a39e] hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )
              ))}
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
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
          />
        </div>
      </CollapsibleSection>

      {/* Instance mode info banner */}
      {(isClientView || isCohortMode) && (
        <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300 font-albert">
            You are editing this {isCohortMode ? 'cohort' : 'client'}. Changes will not affect the template or other {isCohortMode ? 'cohorts' : 'clients'}.
          </p>
        </div>
      )}

      {/* Template mode sync notice */}
      {!isClientView && !isCohortMode && programId && !!(cohorts?.length || enrollments?.length) && (
        <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300 font-albert">
            Changes here won&apos;t auto-sync. Use &quot;Sync to {programType === 'group' ? 'Cohorts' : 'Clients'}&quot; to push updates.
          </p>
        </div>
      )}

      {/* Sync Template Dialog */}
      {programId && (
        <SyncTemplateDialog
          open={syncDialogOpen}
          onOpenChange={setSyncDialogOpen}
          programId={programId}
          weekNumber={week.weekNumber}
          targetType={programType === 'group' ? 'cohorts' : 'clients'}
          enrollments={enrollments}
          cohorts={cohorts}
          onSyncComplete={() => setShowSyncButton(false)}
        />
      )}

      {/* Day Preview Popup */}
      {/* previewDayNumber is now programDayIndex (1-based), but previewDays is indexed by visual position.
          Need to add offset to convert programDayIndex back to visual position index for lookup. */}
      <DayPreviewPopup
        isOpen={previewDayNumber !== null}
        onClose={() => setPreviewDayNumber(null)}
        dayNumber={previewDayNumber || 1}
        day={previewDayNumber !== null ? previewDays[(actualStartDayOfWeek || 1) - 1 + previewDayNumber - 1] || null : null}
        habits={week.weeklyHabits}
        weekNumber={week.weekNumber}
        // Pass week data for resource assignments - use formData for live updates
        week={{ ...week, resourceAssignments: formData.resourceAssignments }}
        dayOfWeek={previewDayNumber || undefined}
        events={availableEvents}
        // Pass course/article lookups for display
        courses={availableCourses.reduce((acc, c) => ({ ...acc, [c.id]: c }), {})}
        articles={availableArticles.reduce((acc, a) => ({ ...acc, [a.id]: a }), {})}
        // Pass completion data for badges
        contentCompletion={contentCompletion}
        // Global day offset for display (e.g., week 2 day 1 shows as "Day 8")
        globalDayOffset={(week.startDayIndex || 1) - 1}
      />

      {/* Schedule Call Modal (1:1 programs) */}
      {clientUserId && clientName && (
        <ScheduleCallModal
          isOpen={showScheduleCallModal}
          onClose={() => setShowScheduleCallModal(false)}
          clientId={clientUserId}
          clientName={clientName}
          onSuccess={() => {
            setShowScheduleCallModal(false);
            onCallScheduled?.();
          }}
        />
      )}

      {/* Schedule Session Modal (group programs - using CreateEventModal) */}
      {(() => {
        // Debug: Log all conditions and values ALWAYS (not just when modal is open)
        console.log('[WeekEditor:ModalRender] Checking conditions:', {
          isCohortMode,
          cohortId,
          programId,
          effectiveInstanceId,
          weekNumber: week?.weekNumber,
          showScheduleCohortModal,
          willRenderModal: !!(isCohortMode && cohortId && programId),
        });
        return null;
      })()}
      {isCohortMode && cohortId && programId && (
        <CreateEventModal
          isOpen={showScheduleCohortModal}
          onClose={() => setShowScheduleCohortModal(false)}
          programId={programId}
          cohortId={cohortId}
          instanceId={effectiveInstanceId || undefined}
          weekIndex={week.weekNumber}
          onSuccess={() => {
            setShowScheduleCohortModal(false);
            onCallScheduled?.();
          }}
        />
      )}
    </div>
  );
}
