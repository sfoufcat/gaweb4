'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import type { Program, ProgramDay, ProgramModule, ProgramWeek, ClientViewContext, CohortViewContext } from '@/types';
import { calculateCalendarWeeks, type CalendarWeek } from '@/lib/calendar-weeks';
import { calculateCyclesSinceDate, getActiveCycleNumber } from '@/lib/program-client-utils';
import type { ProgramEnrollment, ProgramCohort } from '@/types';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Folder,
  Calendar,
  CalendarDays,
  FileText,
  Sparkles,
  GripVertical,
  Trash2,
  AlertTriangle,
  Shuffle,
  Phone,
  BookOpen,
  CheckSquare,
  LayoutList,
  Settings2,
  RefreshCw,
  Loader2,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Selection types (same as ProgramSidebarNav for compatibility)
export type SidebarSelection =
  | { type: 'module'; id: string; moduleIndex: number }
  | { type: 'week'; id: string; weekNumber: number; moduleId?: string }
  | { type: 'day'; dayIndex: number; weekId?: string; moduleId?: string };

interface ModuleWeeksSidebarProps {
  program: Program;
  modules: ProgramModule[];
  weeks: ProgramWeek[];
  days: ProgramDay[];
  selection: SidebarSelection | null;
  onSelect: (selection: SidebarSelection) => void;
  onModulesReorder: (modules: ProgramModule[]) => Promise<void>;
  onWeeksReorder: (moduleId: string, weeks: ProgramWeek[]) => Promise<void>;
  onWeekMoveToModule: (weekId: string, targetModuleId: string, targetIndex: number) => Promise<void>;
  onAddModule: () => void;
  onDeleteModule?: (moduleId: string, action: 'move' | 'delete') => Promise<void>;
  onFillWithAI?: () => void;
  onFillWeek?: (weekNumber: number) => void;
  onWeekDistributionChange?: (weekNumber: number, distribution: 'repeat-daily' | 'spread') => void;
  onAutoDistributeWeeks?: () => Promise<void>;
  isLoading?: boolean;
  /** Client view context - when in client mode, reordering is disabled */
  viewContext?: ClientViewContext;
  /** Cohort view context - when in cohort mode, shows calendar-aligned weeks like client mode */
  cohortViewContext?: CohortViewContext;
  /** Callback to create weeks that don't exist yet in database. Returns map of weekNumber to new weekId */
  onCreateMissingWeeks?: (weeks: Array<{ weekNumber: number; moduleId: string; startDayIndex: number; endDayIndex: number }>) => Promise<Map<number, string>>;
  /** Current day index for client (1-based) - enables "Jump to Today" button */
  currentDayIndex?: number;
  /** Callback when "Jump to Today" button is clicked */
  onJumpToToday?: () => void;
  /** Enrollment ID when viewing a specific client (for sync/clear operations) */
  enrollmentId?: string;
  /** Cohort ID when viewing a specific cohort (for sync/clear operations) */
  cohortId?: string;
  /** Current enrollment data (for cycle display in client mode) */
  currentEnrollment?: ProgramEnrollment & { currentDayIndex?: number };
  /** Current cohort data (for cycle display in cohort mode) */
  currentCohort?: ProgramCohort;
  /** Selected cycle for filtering (evergreen programs) */
  selectedCycle?: number;
  /** Callback when a cycle is selected */
  onCycleSelect?: (cycle: number) => void;
}

interface CalculatedWeek {
  weekNum: number;
  startDay: number;
  endDay: number;
  daysInWeek: number[];
  contentCount: number;
  totalDays: number;
  label: string; // Display label (e.g., "Onboarding", "Week 1", "Closing")
  theme?: string; // Week theme from stored week (e.g., "Building Foundations")
  distribution: 'repeat-daily' | 'spread';
  weeklyTasks: unknown[];
  storedWeekId?: string;
  moduleId?: string;
  order?: number; // Order within module for drag-drop persistence
}

interface DeleteModuleModalProps {
  module: ProgramModule;
  adjacentModuleName: string | null;
  onClose: () => void;
  onMove: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function DeleteModuleModal({
  module,
  adjacentModuleName,
  onClose,
  onMove,
  onDelete,
  isDeleting
}: DeleteModuleModalProps) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={(e) => e.target === e.currentTarget && !isDeleting && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl w-full max-w-md shadow-2xl"
      >
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Delete Module
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {module.name}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            This module contains weeks. What would you like to do with them?
          </p>

          <div className="space-y-2">
            {adjacentModuleName && (
              <button
                onClick={onMove}
                disabled={isDeleting}
                className="w-full p-4 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-left hover:border-brand-accent hover:bg-brand-accent/5 transition-colors disabled:opacity-50"
              >
                <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Move weeks to &quot;{adjacentModuleName}&quot;
                </p>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                  All weeks will be transferred to the adjacent module
                </p>
              </button>
            )}

            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="w-full p-4 border border-red-200 dark:border-red-800/50 rounded-xl text-left hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              <p className="font-medium text-red-600 dark:text-red-400 font-albert">
                Delete module and all weeks
              </p>
              <p className="text-sm text-red-500/80 dark:text-red-400/80 font-albert mt-1">
                This action cannot be undone
              </p>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="w-full py-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors font-albert disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

/**
 * Drag-and-drop sidebar for managing program modules and weeks
 * Modules are collapsible containers, weeks are nested and can be reordered within modules
 */
export function ModuleWeeksSidebar({
  program,
  modules,
  weeks,
  days,
  selection,
  onSelect,
  onModulesReorder,
  onWeeksReorder,
  onAddModule,
  onDeleteModule,
  onFillWeek,
  onAutoDistributeWeeks,
  isLoading = false,
  viewContext,
  cohortViewContext,
  onCreateMissingWeeks,
  currentDayIndex,
  onJumpToToday,
  enrollmentId,
  cohortId,
  currentEnrollment,
  currentCohort,
  selectedCycle,
  onCycleSelect,
}: ModuleWeeksSidebarProps) {
  // In client view mode, disable reordering (structure comes from template)
  const isClientView = viewContext?.mode === 'client';
  // In cohort view mode, show calendar-aligned weeks like client mode
  const isCohortView = cohortViewContext?.mode === 'cohort';
  const canReorderModules = !isClientView && !isCohortView;
  // Weeks are calendar-aligned and cannot be reordered (they represent fixed Mon-Fri slots)
  const canReorderWeeks = false;
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.map(m => m.id))
  );
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [moduleToDelete, setModuleToDelete] = useState<ProgramModule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingWeeks, setIsCreatingWeeks] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSyncingTasks, setIsSyncingTasks] = useState(false);
  const [isClearingTasks, setIsClearingTasks] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [cycleDropdownOpen, setCycleDropdownOpen] = useState(false);
  const [cyclePage, setCyclePage] = useState(0);
  const CYCLES_PER_PAGE = 5;
  
  // Local state to track week order during drag operations
  // Stores storedWeekIds in the desired order (stable IDs that don't change after backend recalculation)
  // This prevents visual "snap back" during async reorder operations
  const [localWeekOrder, setLocalWeekOrder] = useState<Map<string, string[]>>(new Map());

  // Module colors for visual distinction - matches ProgramScheduleEditor calendar colors
  const moduleColors = [
    { bg: 'bg-blue-50/50 dark:bg-blue-900/15', icon: 'bg-blue-100/70 dark:bg-blue-900/25', iconText: 'text-blue-500 dark:text-blue-400' },
    { bg: 'bg-purple-50/50 dark:bg-purple-900/15', icon: 'bg-purple-100/70 dark:bg-purple-900/25', iconText: 'text-purple-500 dark:text-purple-400' },
    { bg: 'bg-emerald-50/50 dark:bg-emerald-900/15', icon: 'bg-emerald-100/70 dark:bg-emerald-900/25', iconText: 'text-emerald-500 dark:text-emerald-400' },
    { bg: 'bg-amber-50/50 dark:bg-amber-900/15', icon: 'bg-amber-100/70 dark:bg-amber-900/25', iconText: 'text-amber-500 dark:text-amber-400' },
    { bg: 'bg-rose-50/50 dark:bg-rose-900/15', icon: 'bg-rose-100/70 dark:bg-rose-900/25', iconText: 'text-rose-500 dark:text-rose-400' },
  ];

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Expand all modules by default when modules change
  React.useEffect(() => {
    setExpandedModules(new Set(modules.map(m => m.id)));
  }, [modules.length]); // eslint-disable-line react-hooks/exhaustive-deps

  

  // Auto-calculate weeks based on program length
  const calculatedWeeks = useMemo((): CalculatedWeek[] => {
    const totalDays = program.lengthDays || 30;
    const includeWeekends = program.includeWeekends !== false;
    const daysPerWeek = includeWeekends ? 7 : 5;
    const numWeeks = Math.ceil(totalDays / daysPerWeek);

    return Array.from({ length: numWeeks }, (_, weekIdx) => {
      const weekNum = weekIdx + 1;
      const startDay = weekIdx * daysPerWeek + 1;
      const endDay = Math.min(startDay + daysPerWeek - 1, totalDays);

      const daysInWeek = Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i);
      const daysWithContent = daysInWeek.filter(day =>
        days.some(d => d.dayIndex === day && (d.tasks?.length > 0 || d.title))
      );

      const storedWeek = weeks.find(w => w.weekNumber === weekNum);

      return {
        weekNum,
        startDay,
        endDay,
        daysInWeek,
        contentCount: daysWithContent.length,
        totalDays: daysInWeek.length,
        label: `Week ${weekNum}`,
        theme: storedWeek?.theme,
        distribution: storedWeek?.distribution || 'repeat-daily',
        weeklyTasks: storedWeek?.weeklyTasks || [],
        storedWeekId: storedWeek?.id,
        moduleId: storedWeek?.moduleId,
        order: storedWeek?.order, // Preserve order for drag-drop
      };
    });
  }, [program.lengthDays, program.includeWeekends, days, weeks]);

  // Calculate calendar-aligned weeks when in client view mode or cohort view mode
  // These are based on the client's enrollment start date or cohort start date
  const calendarWeeks = useMemo((): CalendarWeek[] => {
    let startDate: string | undefined;
    
    if (isClientView && viewContext?.mode === 'client' && viewContext.enrollmentStartedAt) {
      startDate = viewContext.enrollmentStartedAt;
    } else if (isCohortView && cohortViewContext?.mode === 'cohort' && cohortViewContext.cohortStartDate) {
      startDate = cohortViewContext.cohortStartDate;
    }
    
    if (!startDate) {
      return [];
    }
    
    const totalDays = program.lengthDays || 30;
    const includeWeekends = program.includeWeekends !== false;
    return calculateCalendarWeeks(startDate, totalDays, includeWeekends);
  }, [isClientView, isCohortView, viewContext, cohortViewContext, program.lengthDays, program.includeWeekends]);

  // Convert calendar weeks to CalculatedWeek format for display in client view
  const calendarWeeksAsCalculated = useMemo((): CalculatedWeek[] => {
    if (calendarWeeks.length === 0) return [];

    return calendarWeeks.map((cw, idx) => {
      const daysInWeek = Array.from(
        { length: cw.endDayIndex - cw.startDayIndex + 1 },
        (_, i) => cw.startDayIndex + i
      );

      // Find content for these days
      const daysWithContent = daysInWeek.filter(day =>
        days.some(d => d.dayIndex === day && (d.tasks?.length > 0 || d.title))
      );

      // Find the stored week that contains these days (for theme, etc.)
      const storedWeek = weeks.find(w => {
        const includeWeekends = program.includeWeekends !== false;
        const daysPerWeek = includeWeekends ? 7 : 5;
        const weekStart = (w.weekNumber - 1) * daysPerWeek + 1;
        const weekEnd = w.weekNumber * daysPerWeek;
        // Check if any of our calendar week days fall in this stored week
        return cw.startDayIndex >= weekStart && cw.startDayIndex <= weekEnd;
      });

      return {
        weekNum: idx + 1, // Sequential for internal use
        startDay: cw.startDayIndex,
        endDay: cw.endDayIndex,
        daysInWeek,
        contentCount: daysWithContent.length,
        totalDays: daysInWeek.length,
        label: cw.label, // Calendar week label (Onboarding, Week 1, etc.)
        theme: storedWeek?.theme, // Actual theme from stored week
        distribution: storedWeek?.distribution || 'repeat-daily',
        weeklyTasks: storedWeek?.weeklyTasks || [],
        storedWeekId: storedWeek?.id,
        moduleId: storedWeek?.moduleId,
        order: idx, // Maintain calendar order
      };
    });
  }, [calendarWeeks, days, weeks, program.includeWeekends]);

  // Use calendar weeks in client view or cohort view, template weeks otherwise
  const displayWeeks = useMemo((): CalculatedWeek[] => {
    if ((isClientView || isCohortView) && calendarWeeksAsCalculated.length > 0) {
      return calendarWeeksAsCalculated;
    }
    return calculatedWeeks;
  }, [isClientView, isCohortView, calendarWeeksAsCalculated, calculatedWeeks]);

  // Group weeks by module
  const weeksByModule = useMemo(() => {
    const map = new Map<string, CalculatedWeek[]>();

    // Initialize with empty arrays for each module
    modules.forEach(m => map.set(m.id, []));

    // Assign weeks to their modules based on moduleId
    const weeksToAssign = displayWeeks;

    weeksToAssign.forEach(week => {
      if (week.moduleId && map.has(week.moduleId)) {
        map.get(week.moduleId)!.push(week);
      } else if (modules.length > 0) {
        // Assign unassigned weeks to first module
        const firstModuleId = modules[0].id;
        map.get(firstModuleId)!.push(week);
      }
    });

    // Sort weeks within each module by order (or weekNum as fallback)
    map.forEach((moduleWeeks) => {
      moduleWeeks.sort((a, b) => {
        // If both have order, sort by order
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        // If only one has order, prioritize the one with order
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        // Fallback to weekNum for weeks without stored order
        return a.weekNum - b.weekNum;
      });
    });

    return map;
  }, [modules, displayWeeks]);

  // Clear localWeekOrder when props catch up to local state
  // This prevents visual snap-back during async operations
  useEffect(() => {
    if (localWeekOrder.size === 0) return;

    // Check each module in localWeekOrder
    let allSynced = true;
    localWeekOrder.forEach((localWeekIds, moduleId) => {
      const propsWeeks = weeksByModule.get(moduleId);
      if (!propsWeeks) {
        allSynced = false;
        return;
      }

      // Compare order - check if props storedWeekIds match local ordering
      const propsWeekIds = propsWeeks.map(w => w.storedWeekId || `temp-${w.weekNum}`);

      if (JSON.stringify(localWeekIds) !== JSON.stringify(propsWeekIds)) {
        allSynced = false;
      }
    });

    if (allSynced) {
      setLocalWeekOrder(new Map());
    }
  }, [weeksByModule, localWeekOrder]);

  // Determine view status for proper week expansion behavior
  const viewStatus = useMemo((): 'template' | 'upcoming' | 'active' | 'completed' => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isCohortView && cohortViewContext?.cohortStartDate) {
      const startDate = new Date(cohortViewContext.cohortStartDate);
      startDate.setHours(0, 0, 0, 0);
      const programEndDate = new Date(startDate);
      programEndDate.setDate(programEndDate.getDate() + (program.lengthDays || 30));

      if (today < startDate) return 'upcoming';
      if (today >= programEndDate) return 'completed';
      return 'active';
    }

    if (isClientView && viewContext?.enrollmentStartedAt) {
      const startDate = new Date(viewContext.enrollmentStartedAt);
      startDate.setHours(0, 0, 0, 0);
      if (today < startDate) return 'upcoming';
      // For client view, completed status is determined by currentDayIndex reaching program length
      return 'active';
    }

    return 'template';
  }, [isCohortView, isClientView, cohortViewContext, viewContext, program.lengthDays]);

  // Auto-expand to current week/day based on currentDayIndex and viewStatus
  // This runs once when displayWeeks are calculated and relevant data is available
  const hasInitializedExpansion = React.useRef(false);
  const previousViewStatus = React.useRef(viewStatus);

  // Reset expansion initialization when view mode changes (template <-> client <-> cohort)
  React.useEffect(() => {
    if (previousViewStatus.current !== viewStatus) {
      hasInitializedExpansion.current = false;
      previousViewStatus.current = viewStatus;
    }
  }, [viewStatus]);

  React.useEffect(() => {
    if (hasInitializedExpansion.current) return;
    if (displayWeeks.length === 0) return;

    if (!currentDayIndex) {
      // Template mode: default to week 1
      if (viewStatus === 'template') {
        if (expandedWeeks.size === 0) {
          setExpandedWeeks(new Set([1]));
          hasInitializedExpansion.current = true;
        }
        return;
      }

      // Completed cohort/enrollment: show last week
      if (viewStatus === 'completed') {
        const lastWeek = displayWeeks[displayWeeks.length - 1];
        setExpandedWeeks(new Set([lastWeek.weekNum]));
        hasInitializedExpansion.current = true;
        return;
      }

      // Upcoming cohort/enrollment: show Week 1
      if (viewStatus === 'upcoming') {
        setExpandedWeeks(new Set([1]));
        hasInitializedExpansion.current = true;
        return;
      }

      // Active cohort/enrollment but currentDayIndex not yet calculated: wait
      return;
    }

    // Find the week containing the current day
    const currentWeek = displayWeeks.find(
      w => currentDayIndex >= w.startDay && currentDayIndex <= w.endDay
    );

    if (currentWeek) {
      // Expand the current week
      setExpandedWeeks(new Set([currentWeek.weekNum]));

      // Ensure the module containing this week is expanded
      if (currentWeek.moduleId) {
        setExpandedModules(prev => {
          const next = new Set(prev);
          next.add(currentWeek.moduleId!);
          return next;
        });
      }

      // Auto-select the current day
      onSelect({
        type: 'day',
        dayIndex: currentDayIndex,
        weekId: currentWeek.storedWeekId,
        moduleId: currentWeek.moduleId,
      });

      hasInitializedExpansion.current = true;
    } else {
      // currentDayIndex is outside program range - default to week 1
      setExpandedWeeks(new Set([1]));
      hasInitializedExpansion.current = true;
    }
  }, [currentDayIndex, displayWeeks, expandedWeeks.size, onSelect, viewStatus]);

  // Sorted modules for rendering
  const sortedModules = useMemo(() =>
    [...modules].sort((a, b) => a.order - b.order),
    [modules]
  );

  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  const toggleWeek = useCallback((weekNum: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekNum)) {
        next.delete(weekNum);
      } else {
        next.add(weekNum);
      }
      return next;
    });
  }, []);

  const isSelected = useCallback((check: SidebarSelection) => {
    if (!selection) return false;
    if (selection.type !== check.type) return false;
    if (selection.type === 'module' && check.type === 'module') {
      return selection.id === check.id;
    }
    if (selection.type === 'week' && check.type === 'week') {
      return selection.id === check.id || selection.weekNumber === check.weekNumber;
    }
    if (selection.type === 'day' && check.type === 'day') {
      return selection.dayIndex === check.dayIndex;
    }
    return false;
  }, [selection]);

  const dayHasContent = useCallback((dayIndex: number) => {
    return days.some(d => d.dayIndex === dayIndex && (d.tasks?.length > 0 || d.title));
  }, [days]);

  const handleModuleReorder = useCallback(async (reorderedModules: ProgramModule[]) => {
    await onModulesReorder(reorderedModules);
  }, [onModulesReorder]);

  const handleWeeksReorder = useCallback(async (moduleId: string, reorderedWeeks: CalculatedWeek[]) => {
    // IMMEDIATELY update local state to prevent visual "snap back" during async operations
    // Store storedWeekIds (stable IDs) in the desired order, not weekNums (which change after backend recalculation)
    setLocalWeekOrder(prev => {
      const next = new Map(prev);
      next.set(moduleId, reorderedWeeks.map(w => w.storedWeekId || `temp-${w.weekNum}`));
      return next;
    });

    // Find weeks without stored IDs
    const missingWeeks = reorderedWeeks.filter(w => !w.storedWeekId);

    // Start with a mutable copy of the weeks array
    let weeksWithIds = [...reorderedWeeks];

    // If there are weeks without IDs, try to create them first
    if (missingWeeks.length > 0) {
      if (!onCreateMissingWeeks) {
        console.warn('[ModuleWeeksSidebar] Some weeks have not been saved yet and no create callback provided - cannot reorder');
        // Clear local state since we can't proceed
        setLocalWeekOrder(prev => {
          const next = new Map(prev);
          next.delete(moduleId);
          return next;
        });
        return;
      }

      setIsCreatingWeeks(true);
      try {
        // Create the missing weeks
        const weeksToCreate = missingWeeks.map(w => ({
          weekNumber: w.weekNum,
          moduleId: moduleId,
          startDayIndex: w.startDay,
          endDayIndex: w.endDay,
        }));

        const newWeekIds = await onCreateMissingWeeks(weeksToCreate);

        // Update weeksWithIds with the new IDs
        weeksWithIds = weeksWithIds.map(w => {
          if (!w.storedWeekId && newWeekIds.has(w.weekNum)) {
            return { ...w, storedWeekId: newWeekIds.get(w.weekNum), moduleId };
          }
          return w;
        });
      } catch (err) {
        console.error('[ModuleWeeksSidebar] Failed to create missing weeks:', err);
        setIsCreatingWeeks(false);
        // Clear local state on error
        setLocalWeekOrder(prev => {
          const next = new Map(prev);
          next.delete(moduleId);
          return next;
        });
        return;
      }
      setIsCreatingWeeks(false);
    }

    // Filter out any weeks that still don't have IDs (shouldn't happen, but safety check)
    const validWeeks = weeksWithIds.filter(w => w.storedWeekId);
    if (validWeeks.length === 0) {
      console.warn('[ModuleWeeksSidebar] No valid weeks with IDs to reorder');
      // Clear local state since we can't proceed
      setLocalWeekOrder(prev => {
        const next = new Map(prev);
        next.delete(moduleId);
        return next;
      });
      return;
    }

    // Convert CalculatedWeek[] to ProgramWeek[] format for the API
    const weekData = validWeeks.map(w => ({
      id: w.storedWeekId!,
      weekNumber: w.weekNum,
      moduleId: w.moduleId || moduleId,
    })) as ProgramWeek[];
    
    // Call parent handler - don't clear localWeekOrder here!
    // Let the useEffect below detect when props have caught up
    try {
      await onWeeksReorder(moduleId, weekData);
    } catch (err) {
      console.error('[ModuleWeeksSidebar] Failed to reorder weeks:', err);
      // Clear local state on error so it falls back to props
      setLocalWeekOrder(prev => {
        const next = new Map(prev);
        next.delete(moduleId);
        return next;
      });
    }
  }, [onWeeksReorder, onCreateMissingWeeks]);

  const handleDeleteModuleClick = useCallback((module: ProgramModule, e: React.MouseEvent) => {
    e.stopPropagation();

    // Don't allow deleting the last module
    if (modules.length <= 1) {
      return;
    }

    setModuleToDelete(module);
  }, [modules.length]);

  const handleDeleteModuleConfirm = useCallback(async (action: 'move' | 'delete') => {
    if (!moduleToDelete || !onDeleteModule) return;

    setIsDeleting(true);
    try {
      await onDeleteModule(moduleToDelete.id, action);
      setModuleToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }, [moduleToDelete, onDeleteModule]);

  const getAdjacentModuleName = useCallback(() => {
    if (!moduleToDelete) return null;
    const idx = sortedModules.findIndex(m => m.id === moduleToDelete.id);
    if (idx > 0) return sortedModules[idx - 1].name;
    if (idx < sortedModules.length - 1) return sortedModules[idx + 1].name;
    return null;
  }, [moduleToDelete, sortedModules]);

  // Handler for syncing tasks from template
  const handleSyncTasks = useCallback(async () => {
    if (!program.id || (!enrollmentId && !cohortId)) return;

    setIsSyncingTasks(true);
    try {
      const body = cohortId ? { cohortId } : { enrollmentId };
      const res = await fetch(`/api/coach/org-programs/${program.id}/sync-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync tasks');
      }

      const count = data.tasksCreated || data.totalTasksCreated || 0;
      alert(`Success: Synced ${count} tasks for entire program`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sync tasks');
    } finally {
      setIsSyncingTasks(false);
    }
  }, [program.id, enrollmentId, cohortId]);

  // Handler for clearing future tasks
  const handleClearTasks = useCallback(async () => {
    if (!program.id || (!enrollmentId && !cohortId)) return;

    setIsClearingTasks(true);
    try {
      const body = cohortId ? { cohortId } : { enrollmentId };
      const res = await fetch(`/api/coach/org-programs/${program.id}/clear-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear tasks');
      }

      const count = data.tasksDeleted || data.totalTasksDeleted || 0;
      alert(`Success: Cleared ${count} future tasks`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to clear tasks');
    } finally {
      setIsClearingTasks(false);
      setShowClearConfirm(false);
    }
  }, [program.id, enrollmentId, cohortId]);

  const hasExistingContent = days.some(d => d.tasks?.length > 0 || d.title) ||
    weeks.some(w => w.weeklyTasks?.length || w.theme);

  // Helper to determine week status based on currentDayIndex
  const getWeekStatus = useCallback((week: CalculatedWeek): 'past' | 'active' | 'future' => {
    if (!currentDayIndex) return 'future';
    if (currentDayIndex > week.endDay) return 'past';
    if (currentDayIndex >= week.startDay && currentDayIndex <= week.endDay) return 'active';
    return 'future';
  }, [currentDayIndex]);

  // Helper to determine day status based on currentDayIndex
  const getDayStatus = useCallback((dayIndex: number): 'past' | 'active' | 'future' => {
    if (!currentDayIndex) return 'future';
    if (dayIndex < currentDayIndex) return 'past';
    if (dayIndex === currentDayIndex) return 'active';
    return 'future';
  }, [currentDayIndex]);

  // Helper to determine module status based on its weeks
  const getModuleStatus = useCallback((moduleWeeks: CalculatedWeek[]): 'past' | 'active' | 'future' => {
    if (!currentDayIndex || moduleWeeks.length === 0) return 'future';
    const hasActiveWeek = moduleWeeks.some(w => currentDayIndex >= w.startDay && currentDayIndex <= w.endDay);
    if (hasActiveWeek) return 'active';
    const allPast = moduleWeeks.every(w => currentDayIndex > w.endDay);
    if (allPast) return 'past';
    return 'future';
  }, [currentDayIndex]);

  // Helper to get day content types for displaying icons
  const getDayContentTypes = useCallback((dayIndex: number): { hasTasks: boolean; hasCourses: boolean; hasCalls: boolean } => {
    const day = days.find(d => d.dayIndex === dayIndex);
    if (!day) return { hasTasks: false, hasCourses: false, hasCalls: false };

    const hasTasks = (day.tasks?.length || 0) > 0;
    const hasCourses = (day.courseAssignments?.length || 0) > 0;
    const hasCalls = day.scheduledItems?.some(item => item.type === 'call') || false;

    return { hasTasks, hasCourses, hasCalls };
  }, [days]);

  if (isLoading) {
    return (
      <div className="w-80 flex-shrink-0 space-y-4 animate-pulse">
        <div className="h-10 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
        <div className="bg-white border border-[#e1ddd8] rounded-xl overflow-hidden">
          <div className="p-4 bg-[#faf8f6]">
            <div className="h-6 w-32 bg-[#e1ddd8]/50 rounded" />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 border-t border-[#e1ddd8]">
              <div className="flex items-center gap-4">
                <div className="w-5 h-5 bg-[#e1ddd8]/50 rounded" />
                <div className="w-10 h-10 bg-[#e1ddd8]/50 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-[#e1ddd8]/50 rounded" />
                  <div className="h-3 w-16 bg-[#e1ddd8]/50 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const renderWeekRow = (week: CalculatedWeek, moduleId: string, moduleIndex: number = 0) => {
    const weekSelection: SidebarSelection = {
      type: 'week',
      id: week.storedWeekId || `week-${week.weekNum}`,
      weekNumber: week.weekNum,
      moduleId
    };
    const isWeekSelected = isSelected(weekSelection);
    const isWeekExpanded = expandedWeeks.has(week.weekNum);
    const weekStatus = getWeekStatus(week);
    const moduleColor = moduleColors[moduleIndex % moduleColors.length];

    // Status-based background colors - light mint for active, yellow for past, gray for future
    const statusBgClass = weekStatus === 'past'
      ? 'bg-yellow-50/50 dark:bg-yellow-950/20'
      : weekStatus === 'active'
      ? 'bg-[#F8FFFB] dark:bg-emerald-950/20'
      : 'bg-gray-50/50 dark:bg-gray-900/20';

    return (
      <div className="group/week">
        {/* Week row - with status-based coloring and modern selection */}
        <div
          className={`px-3 py-2.5 transition-all duration-150 ${statusBgClass} ${
            !statusBgClass ? 'bg-white/40 dark:bg-[#171b22]/40' : ''
          } ${
            canReorderWeeks ? 'cursor-grab active:cursor-grabbing' : ''
          } ${isWeekSelected ? 'bg-brand-accent/8 dark:bg-brand-accent/15 shadow-[inset_0_0_0_1px_rgba(var(--brand-accent-rgb),0.3)]' : ''} hover:bg-[#f5f3f0] dark:hover:bg-[#1e222a]`}
        >
          <div className="flex items-center gap-3">
            {/* Drag handle - only show if weeks can be reordered */}
            {canReorderWeeks && (
              <div className="touch-none">
                <GripVertical className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
              </div>
            )}

            {/* Week icon - status-based coloring, gray for future */}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              weekStatus === 'past'
                ? 'bg-yellow-100/70 dark:bg-yellow-900/25'
                : weekStatus === 'active'
                ? 'bg-emerald-100/70 dark:bg-emerald-900/25'
                : 'bg-gray-100/70 dark:bg-gray-900/25'
            }`}>
              <Calendar className={`w-5 h-5 ${
                weekStatus === 'past'
                  ? 'text-yellow-500 dark:text-yellow-400'
                  : weekStatus === 'active'
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`} />
            </div>

            {/* Week info - clickable to select week */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(weekSelection);
              }}
              className="flex-1 min-w-0 text-left"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={week.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 truncate"
                >
                  <span className={`font-medium ${
                    isWeekSelected
                      ? 'text-brand-accent'
                      : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}>
                    {week.label}
                  </span>
                  {week.theme && (
                    <span className="text-sm text-[#8c8c8c] dark:text-[#7d8190] truncate">
                      {week.theme}
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                Days {week.startDay}–{week.endDay}
              </p>
            </button>

            {/* Fill week with AI button */}
            {onFillWeek && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFillWeek(week.weekNum);
                }}
                className="p-2 hover:bg-brand-accent/10 rounded-lg opacity-0 group-hover/week:opacity-100 transition-all flex-shrink-0"
                title="Fill week with AI"
              >
                <Sparkles className="w-4 h-4 text-brand-accent" />
              </button>
            )}

            {/* Expand/collapse button - always visible */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleWeek(week.weekNum);
              }}
              className="p-2 hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] rounded-lg transition-colors flex-shrink-0"
            >
              {isWeekExpanded ? (
                <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              )}
            </button>
          </div>
        </div>

        {/* Days in Week - shown when expanded */}
        <AnimatePresence initial={false}>
          {isWeekExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
              className="bg-white/30 dark:bg-[#171b22]/30"
            >
              {week.daysInWeek.map((dayIndex) => {
                const isDaySelected = isSelected({ type: 'day', dayIndex });
                const dayStatus = getDayStatus(dayIndex);
                const contentTypes = getDayContentTypes(dayIndex);

                // Status-based background colors for days (lighter)
                const dayStatusBgClass = dayStatus === 'past'
                  ? 'bg-yellow-50/40 dark:bg-yellow-950/15'
                  : dayStatus === 'active'
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/15'
                  : '';

                return (
                  <button
                    key={dayIndex}
                    onClick={() => onSelect({ type: 'day', dayIndex, moduleId })}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 pl-12 transition-all duration-150 ${dayStatusBgClass} ${
                      isDaySelected
                        ? 'bg-brand-accent/8 dark:bg-brand-accent/15 shadow-[inset_0_0_0_1px_rgba(var(--brand-accent-rgb),0.3)] text-brand-accent'
                        : dayStatus === 'past'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : dayStatus === 'active'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                    } hover:bg-[#f5f3f0] dark:hover:bg-[#1e222a]`}
                  >
                    <FileText className={`w-4 h-4 flex-shrink-0 ${
                      isDaySelected ? 'text-brand-accent' :
                      dayStatus === 'past' ? 'text-yellow-500 dark:text-yellow-400' :
                      dayStatus === 'active' ? 'text-emerald-400 dark:text-emerald-500' :
                      'text-[#a7a39e] dark:text-[#7d8190]'
                    }`} />
                    <span className="font-medium flex-1">Day {dayIndex}</span>
                    {/* Content type icons - shown on the right */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {contentTypes.hasTasks && (
                        <span title="Has tasks">
                          <CheckSquare className="w-3.5 h-3.5 text-[#a7a39e] dark:text-[#7d8190]" />
                        </span>
                      )}
                      {contentTypes.hasCourses && (
                        <span title="Has course content">
                          <BookOpen className="w-3.5 h-3.5 text-[#a7a39e] dark:text-[#7d8190]" />
                        </span>
                      )}
                      {contentTypes.hasCalls && (
                        <span title="Has scheduled call">
                          <Phone className="w-3.5 h-3.5 text-[#a7a39e] dark:text-[#7d8190]" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Render a module with its weeks
  const renderModuleWithWeeks = (module: ProgramModule, moduleIndex: number) => {
    const isModuleExpanded = expandedModules.has(module.id);
    const isModuleSelected = isSelected({ type: 'module', id: module.id, moduleIndex: module.order });
    const moduleColor = moduleColors[moduleIndex % moduleColors.length];
    // Use local order if available (during drag), otherwise use computed order from props
    const propsWeeks = weeksByModule.get(module.id) || [];
    const localOrder = localWeekOrder.get(module.id);

    // If we have a local order (stored as storedWeekIds), reorder the current weeks to match
    const moduleWeeks = localOrder
      ? localOrder.map(id => propsWeeks.find(w => (w.storedWeekId || `temp-${w.weekNum}`) === id)).filter((w): w is CalculatedWeek => w !== undefined)
      : propsWeeks;
    const weekCount = moduleWeeks.length;
    const moduleStatus = getModuleStatus(moduleWeeks);

    // Status-based background colors for modules - module color for future
    const moduleStatusBgClass = moduleStatus === 'past'
      ? 'bg-yellow-50/40 dark:bg-yellow-950/15'
      : moduleStatus === 'active'
      ? 'bg-orange-50/40 dark:bg-orange-950/15'
      : moduleColor.bg;

    return (
      <div
        key={module.id}
        className="overflow-hidden rounded-xl mb-3 last:mb-0"
      >
        {/* Module Header - less left padding on desktop to sit further left than weeks */}
        <div
          className={`px-3 py-2.5 backdrop-blur-sm transition-all duration-150 ${moduleStatusBgClass} ${
            canReorderModules ? 'cursor-grab active:cursor-grabbing' : ''
          } group ${isModuleSelected ? 'bg-brand-accent/8 dark:bg-brand-accent/15 shadow-[inset_0_0_0_1px_rgba(var(--brand-accent-rgb),0.3)]' : ''} hover:bg-[#f5f3f0] dark:hover:bg-[#1e222a]`}
        >
          <div className="flex items-center gap-3">
            {/* Drag handle for module - only show in template mode */}
            {canReorderModules && (
              <div className="touch-none">
                <GripVertical className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
              </div>
            )}

            {/* Module icon - larger than week icons, module color for future */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              moduleStatus === 'past'
                ? 'bg-yellow-100 dark:bg-yellow-900/30'
                : moduleStatus === 'active'
                ? 'bg-orange-100 dark:bg-orange-900/30'
                : moduleColor.icon
            }`}>
              <Folder className={`w-5 h-5 ${
                moduleStatus === 'past'
                  ? 'text-yellow-500 dark:text-yellow-400'
                  : moduleStatus === 'active'
                  ? 'text-orange-500 dark:text-orange-400'
                  : moduleColor.iconText
              }`} />
            </div>

            {/* Module name - clickable to select, bold to differentiate from weeks */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ type: 'module', id: module.id, moduleIndex: module.order });
              }}
              className="flex-1 min-w-0 text-left"
            >
              <p className={`font-semibold truncate ${
                isModuleSelected
                  ? 'text-brand-accent'
                  : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
              }`}>
                {module.name}
              </p>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                {weekCount} {weekCount === 1 ? 'week' : 'weeks'}
              </p>
            </button>

            {/* Action buttons group */}
            <div className="flex items-center gap-1">
              {/* Delete button - only show in template mode */}
              {canReorderModules && modules.length > 1 && onDeleteModule && (
                <button
                  onClick={(e) => handleDeleteModuleClick(module, e)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  title="Delete module"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              )}

              {/* Expand/collapse button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleModule(module.id);
                }}
                className="p-2 hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] rounded-lg transition-colors flex-shrink-0"
              >
                {isModuleExpanded ? (
                  <ChevronDown className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Module-to-weeks divider - solid status-colored line */}
        {isModuleExpanded && moduleWeeks.length > 0 && (
          <div className={`h-px ${
            moduleStatus === 'past'
              ? 'bg-yellow-200 dark:bg-yellow-800'
              : moduleStatus === 'active'
              ? 'bg-orange-200 dark:bg-orange-800'
              : 'bg-gray-200 dark:bg-gray-700'
          }`} />
        )}

        {/* Weeks inside module - static (calendar-aligned weeks cannot be reordered) */}
        <AnimatePresence initial={false}>
          {isModuleExpanded && moduleWeeks.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              {canReorderWeeks ? (
                <Reorder.Group
                  as="div"
                  axis="y"
                  values={moduleWeeks}
                  onReorder={(newWeeks) => handleWeeksReorder(module.id, newWeeks)}
                  className="divide-y divide-[#e8e5e1] dark:divide-[#2a303d]"
                >
                  {moduleWeeks.map((week, idx) => (
                    <Reorder.Item
                      as="div"
                      key={week.storedWeekId || `temp-${week.weekNum}`}
                      value={week}
                      className={idx === moduleWeeks.length - 1 ? 'rounded-b-xl' : ''}
                    >
                      {renderWeekRow(week, module.id, moduleIndex)}
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              ) : (
                <div className="divide-y divide-[#e8e5e1] dark:divide-[#2a303d]">
                  {moduleWeeks.map((week, idx) => (
                    <div key={week.storedWeekId || `temp-${week.weekNum}`} className={idx === moduleWeeks.length - 1 ? 'rounded-b-xl' : ''}>
                      {renderWeekRow(week, module.id, moduleIndex)}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Module-ending divider - slim elegant separator */}
        {isModuleExpanded && moduleWeeks.length > 0 && (
          <div className={`h-px ${
            moduleStatus === 'past'
              ? 'bg-yellow-200 dark:bg-yellow-800'
              : moduleStatus === 'active'
              ? 'bg-orange-200 dark:bg-orange-800'
              : 'bg-gray-200 dark:bg-gray-700'
          }`} />
        )}

        {/* Empty state for module with no weeks */}
        {isModuleExpanded && moduleWeeks.length === 0 && (
          <div className="p-6 text-center border-t border-[#e1ddd8] dark:border-[#262b35]">
            <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] font-albert">
              No weeks in this module
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e1ddd8]/40 dark:border-[#262b35]/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <LayoutList className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
          <h3 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Structure</h3>
        </div>
      </div>

      {/* Modules & Weeks Tree */}
      <div className="flex-1 overflow-hidden relative">
        <div className="h-full max-h-[50vh] lg:max-h-[calc(100vh-220px)] overflow-y-auto px-2 py-3 scrollbar-thin scrollbar-thumb-[#d1cdc8] dark:scrollbar-thumb-[#363d4a] scrollbar-track-transparent">
        {sortedModules.length === 0 ? (
          // No modules yet - prompt to add one (only in template mode)
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-brand-accent" />
            </div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
              {canReorderModules
                ? 'No modules yet. Create your first module to organize weeks.'
                : 'No modules in this program. Add modules from the template view.'}
            </p>
            {canReorderModules && (
              <button
                onClick={onAddModule}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg text-sm font-medium font-albert hover:bg-brand-accent/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Module
              </button>
            )}
          </div>
        ) : canReorderModules ? (
          // Modules list with drag-and-drop (template mode)
          <Reorder.Group
            as="div"
            axis="y"
            values={sortedModules}
            onReorder={handleModuleReorder}
            className=""
          >
            {sortedModules.map((module, idx) => (
              <Reorder.Item as="div" key={module.id} value={module}>
                {renderModuleWithWeeks(module, idx)}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          // Static modules list (client view mode - no reordering)
          <div className="">
            {sortedModules.map((module, idx) => renderModuleWithWeeks(module, idx))}
          </div>
        )}

        {/* Add Module button - only show in template mode */}
        {canReorderModules && sortedModules.length > 0 && (
          <button
            onClick={onAddModule}
            className="mt-4 w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent hover:text-brand-accent transition-colors text-sm font-albert"
          >
            <Plus className="w-4 h-4" />
            Add Module
          </button>
        )}

        {/* Auto-distribute weeks button - only show when there are multiple modules and weeks */}
        {canReorderModules && sortedModules.length > 1 && onAutoDistributeWeeks && (
          <button
            onClick={onAutoDistributeWeeks}
            className="w-full flex items-center justify-center gap-2 py-3 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent transition-colors text-sm font-albert"
          >
            <Shuffle className="w-4 h-4" />
            Auto-Distribute Weeks
          </button>
        )}

        </div>
        {/* Fade gradient at bottom to indicate more content */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/80 dark:from-[#171b22]/80 to-transparent pointer-events-none" />
      </div>

      {/* Cycle Indicator/Selector - for evergreen programs, always visible below scroll area */}
      {program.durationType === 'evergreen' && (() => {
        // Calculate the current/max cycle number
        const maxCycleNumber = (() => {
          if (isClientView && currentEnrollment) {
            return getActiveCycleNumber(currentEnrollment);
          }
          if (isCohortView && currentCohort?.startDate) {
            return calculateCyclesSinceDate(
              currentCohort.startDate,
              program.lengthDays,
              program.includeWeekends !== false
            );
          }
          if (program.createdAt) {
            return calculateCyclesSinceDate(
              program.createdAt,
              program.lengthDays,
              program.includeWeekends !== false
            );
          }
          return 1;
        })();

        const currentCycleDisplay = selectedCycle || maxCycleNumber;
        const canSelectCycle = (isClientView || isCohortView) && onCycleSelect && maxCycleNumber > 1;

        // Generate cycles array (newest first)
        const allCycles = Array.from({ length: maxCycleNumber }, (_, i) => maxCycleNumber - i);
        const visibleCycles = allCycles.slice(cyclePage * CYCLES_PER_PAGE, (cyclePage + 1) * CYCLES_PER_PAGE);
        const hasMorePages = allCycles.length > CYCLES_PER_PAGE;
        const canGoNewer = cyclePage > 0;
        const canGoOlder = (cyclePage + 1) * CYCLES_PER_PAGE < allCycles.length;

        return (
          <div className="mx-3 my-2 relative flex-shrink-0">
            <button
              onClick={() => canSelectCycle && setCycleDropdownOpen(!cycleDropdownOpen)}
              disabled={!canSelectCycle}
              className={`w-full px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800/30 flex items-center justify-between ${
                canSelectCycle ? 'cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30' : 'cursor-default'
              }`}
            >
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-300 font-medium font-albert">
                  Cycle {currentCycleDisplay}
                </span>
              </div>
              {canSelectCycle && (
                <ChevronDown className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-transform ${cycleDropdownOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {/* Dropdown */}
            {cycleDropdownOpen && canSelectCycle && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e222a] rounded-lg border border-[#e1ddd8] dark:border-[#3d4351] shadow-lg z-50 overflow-hidden">
                {/* Newer cycles pagination */}
                {hasMorePages && canGoNewer && (
                  <button
                    onClick={() => setCyclePage(p => p - 1)}
                    className="w-full px-3 py-2 text-xs text-center text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] border-b border-[#e1ddd8] dark:border-[#3d4351]"
                  >
                    ↑ Newer cycles
                  </button>
                )}

                {/* Cycle options */}
                {visibleCycles.map(cycle => (
                  <button
                    key={cycle}
                    onClick={() => {
                      onCycleSelect?.(cycle);
                      setCycleDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] ${
                      cycle === currentCycleDisplay ? 'bg-emerald-50 dark:bg-emerald-900/30' : ''
                    }`}
                  >
                    <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Cycle {cycle}
                      {cycle === maxCycleNumber && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-2">(current)</span>
                      )}
                    </span>
                    {cycle === currentCycleDisplay && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>
                ))}

                {/* Older cycles pagination */}
                {hasMorePages && canGoOlder && (
                  <button
                    onClick={() => setCyclePage(p => p + 1)}
                    className="w-full px-3 py-2 text-xs text-center text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] border-t border-[#e1ddd8] dark:border-[#3d4351]"
                  >
                    ↓ Older cycles ({allCycles.length - (cyclePage + 1) * CYCLES_PER_PAGE} more)
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Status Legend + Tools Row - show when viewing client/cohort progress */}
      {currentDayIndex !== undefined && currentDayIndex > 0 && (
        <div className="px-4 py-2.5 border-t border-[#e1ddd8]/40 dark:border-[#262b35]/40 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Status Legend - left side */}
            <div className="flex items-center gap-3 text-xs font-albert">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded bg-amber-100/70 dark:bg-amber-900/30" />
                <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Past</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded bg-emerald-100/70 dark:bg-emerald-900/30" />
                <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded bg-slate-100/70 dark:bg-slate-800/30" />
                <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Future</span>
              </div>
            </div>

            {/* Tools Dropdown - right side, only when client/cohort selected */}
            {(isClientView || isCohortView) && (enrollmentId || cohortId) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1 text-xs text-[#5f5a55] dark:text-[#8a8f9c] hover:text-[#3d3a37] dark:hover:text-[#e8e6e3] transition-colors"
                    disabled={isSyncingTasks || isClearingTasks}
                  >
                    {isSyncingTasks || isClearingTasks ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Settings2 className="h-3 w-3" />
                    )}
                    <span>Tools</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={handleSyncTasks}
                    disabled={isSyncingTasks}
                    className="cursor-pointer text-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    Sync from Template
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowClearConfirm(true)}
                    disabled={isClearingTasks}
                    className="cursor-pointer text-xs text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Clear Future Tasks
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {/* Clear Tasks Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1e2430] rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[#3d3a37] dark:text-[#e8e6e3] mb-2">
              Clear Future Tasks
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#8a8f9c] mb-4">
              This will delete all incomplete program-sourced tasks for future days.
              Today&apos;s tasks and completed tasks will be preserved.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg
                  bg-slate-100 dark:bg-slate-800 text-[#3d3a37] dark:text-[#e8e6e3]
                  hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                disabled={isClearingTasks}
              >
                Cancel
              </button>
              <button
                onClick={handleClearTasks}
                className="px-4 py-2 text-sm font-medium rounded-lg
                  bg-red-500 text-white hover:bg-red-600 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isClearingTasks}
              >
                {isClearingTasks ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Clearing...
                  </span>
                ) : (
                  'Clear Tasks'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Module Modal */}
      {mounted && moduleToDelete && (
        <AnimatePresence>
          <DeleteModuleModal
            module={moduleToDelete}
            adjacentModuleName={getAdjacentModuleName()}
            onClose={() => setModuleToDelete(null)}
            onMove={() => handleDeleteModuleConfirm('move')}
            onDelete={() => handleDeleteModuleConfirm('delete')}
            isDeleting={isDeleting}
          />
        </AnimatePresence>
      )}
    </div>
  );
}
