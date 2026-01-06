'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import type { Program, ProgramDay, ProgramModule, ProgramWeek, ProgramOrientation, ClientViewContext } from '@/types';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Folder,
  Calendar,
  FileText,
  Sparkles,
  GripVertical,
  Trash2,
  AlertTriangle,
  Shuffle
} from 'lucide-react';
import { OrientationToggle } from './OrientationToggle';

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
  orientation: ProgramOrientation;
  onOrientationChange: (mode: ProgramOrientation) => void;
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
  /** Callback to create weeks that don't exist yet in database. Returns map of weekNumber to new weekId */
  onCreateMissingWeeks?: (weeks: Array<{ weekNumber: number; moduleId: string; startDayIndex: number; endDayIndex: number }>) => Promise<Map<number, string>>;
}

interface CalculatedWeek {
  weekNum: number;
  startDay: number;
  endDay: number;
  daysInWeek: number[];
  contentCount: number;
  totalDays: number;
  theme?: string;
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
  orientation,
  onOrientationChange,
  onModulesReorder,
  onWeeksReorder,
  onAddModule,
  onDeleteModule,
  onFillWeek,
  onAutoDistributeWeeks,
  isLoading = false,
  viewContext,
  onCreateMissingWeeks,
}: ModuleWeeksSidebarProps) {
  // In client view mode, disable reordering (structure comes from template)
  const isClientView = viewContext?.mode === 'client';
  const canReorder = !isClientView;
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.map(m => m.id))
  );
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [moduleToDelete, setModuleToDelete] = useState<ProgramModule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingWeeks, setIsCreatingWeeks] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Local state to track week order during drag operations
  // Stores just the weekNums in the desired order (not full objects)
  // This prevents visual "snap back" during async reorder operations
  const [localWeekOrder, setLocalWeekOrder] = useState<Map<string, number[]>>(new Map());

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
        theme: storedWeek?.theme,
        distribution: storedWeek?.distribution || 'repeat-daily',
        weeklyTasks: storedWeek?.weeklyTasks || [],
        storedWeekId: storedWeek?.id,
        moduleId: storedWeek?.moduleId,
        order: storedWeek?.order, // Preserve order for drag-drop
      };
    });
  }, [program.lengthDays, program.includeWeekends, days, weeks]);

  // Group weeks by module
  const weeksByModule = useMemo(() => {
    const map = new Map<string, CalculatedWeek[]>();

    // Initialize with empty arrays for each module
    modules.forEach(m => map.set(m.id, []));

    // Assign calculated weeks to their modules
    calculatedWeeks.forEach(week => {
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
  }, [modules, calculatedWeeks]);

  // Clear localWeekOrder when props catch up to local state
  // This prevents visual snap-back during async operations
  useEffect(() => {
    if (localWeekOrder.size === 0) return;

    // Check each module in localWeekOrder
    let allSynced = true;
    localWeekOrder.forEach((localWeekNums, moduleId) => {
      const propsWeeks = weeksByModule.get(moduleId);
      if (!propsWeeks) {
        allSynced = false;
        return;
      }

      // Compare order - check if props weekNums match local ordering
      const propsWeekNums = propsWeeks.map(w => w.weekNum);

      if (JSON.stringify(localWeekNums) !== JSON.stringify(propsWeekNums)) {
        allSynced = false;
      }
    });

    if (allSynced) {
      setLocalWeekOrder(new Map());
    }
  }, [weeksByModule, localWeekOrder]);

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
    // Store just the weekNums in the desired order (not full objects)
    setLocalWeekOrder(prev => {
      const next = new Map(prev);
      next.set(moduleId, reorderedWeeks.map(w => w.weekNum));
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

  const hasExistingContent = days.some(d => d.tasks?.length > 0 || d.title) ||
    weeks.some(w => w.weeklyTasks?.length || w.theme);

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

  const renderWeekRow = (week: CalculatedWeek, moduleId: string) => {
    const weekSelection: SidebarSelection = {
      type: 'week',
      id: week.storedWeekId || `week-${week.weekNum}`,
      weekNumber: week.weekNum,
      moduleId
    };
    const isWeekSelected = isSelected(weekSelection);
    const isWeekExpanded = expandedWeeks.has(week.weekNum);
    const hasWeeklyContent = week.weeklyTasks.length > 0 || week.theme;

    return (
      <div className="group/week">
        {/* Week row - FunnelStepsEditor style */}
        <div
          className={`p-4 bg-white dark:bg-[#171b22] hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors ${
            canReorder ? 'cursor-grab active:cursor-grabbing' : ''
          } ${isWeekSelected ? 'bg-brand-accent/5 dark:bg-brand-accent/10' : ''}`}
        >
          <div className="flex items-center gap-4">
            {/* Drag handle - only show in template mode */}
            {canReorder ? (
              <div className="touch-none">
                <GripVertical className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
              </div>
            ) : (
              <div className="w-5" /> /* Spacer to maintain alignment */
            )}

            {/* Week icon */}
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>

            {/* Week info - clickable */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (orientation === 'weekly') {
                  onSelect(weekSelection);
                } else {
                  toggleWeek(week.weekNum);
                }
              }}
              className="flex-1 min-w-0 text-left"
            >
              <AnimatePresence mode="wait">
                <motion.p
                  key={week.theme || week.weekNum}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`font-medium truncate ${
                    isWeekSelected
                      ? 'text-brand-accent'
                      : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}
                >
                  {week.theme || `Week ${week.weekNum}`}
                </motion.p>
              </AnimatePresence>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                Days {week.startDay}–{week.endDay}
              </p>
            </button>

            {/* Content indicator badges */}
            {orientation === 'daily' && week.contentCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded flex-shrink-0">
                {week.contentCount}/{week.totalDays}
              </span>
            )}

            {orientation === 'weekly' && hasWeeklyContent && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded flex-shrink-0">
                ✓
              </span>
            )}

            {/* Fill week with AI button - show in both modes */}
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

            {/* Expand/collapse for daily mode */}
            {orientation === 'daily' && (
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
            )}
          </div>
        </div>

        {/* Days in Week (only in Daily mode when expanded) */}
        {orientation === 'daily' && isWeekExpanded && (
          <div className="bg-[#faf8f6] dark:bg-[#1a1e25] border-t border-[#e1ddd8] dark:border-[#262b35]">
            {week.daysInWeek.map((dayIndex) => {
              const hasContent = dayHasContent(dayIndex);
              const isDaySelected = isSelected({ type: 'day', dayIndex });
              return (
                <button
                  key={dayIndex}
                  onClick={() => onSelect({ type: 'day', dayIndex, moduleId })}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 pl-[72px] transition-colors ${
                    isDaySelected
                      ? 'bg-brand-accent/10 text-brand-accent'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">Day {dayIndex}</span>
                  {hasContent && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render a module with its weeks
  const renderModuleWithWeeks = (module: ProgramModule) => {
    const isModuleExpanded = expandedModules.has(module.id);
    const isModuleSelected = isSelected({ type: 'module', id: module.id, moduleIndex: module.order });
    // Use local order if available (during drag), otherwise use computed order from props
    const propsWeeks = weeksByModule.get(module.id) || [];
    const localOrder = localWeekOrder.get(module.id);
    
    // If we have a local order, reorder the current weeks to match
    const moduleWeeks = localOrder
      ? localOrder.map(weekNum => propsWeeks.find(w => w.weekNum === weekNum)).filter((w): w is CalculatedWeek => w !== undefined)
      : propsWeeks;
    const weekCount = moduleWeeks.length;

    return (
      <div
        key={module.id}
        className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden"
      >
        {/* Module Header */}
        <div
          className={`p-4 bg-[#faf8f6] dark:bg-[#1a1e25] hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] transition-colors ${
            canReorder ? 'cursor-grab active:cursor-grabbing' : ''
          } group ${isModuleSelected ? 'bg-brand-accent/5 dark:bg-brand-accent/10' : ''}`}
        >
          <div className="flex items-center gap-4">
            {/* Drag handle for module - only show in template mode */}
            {canReorder ? (
              <div className="touch-none">
                <GripVertical className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
              </div>
            ) : (
              <div className="w-5" /> /* Spacer to maintain alignment */
            )}

            {/* Module icon */}
            <div className="w-10 h-10 rounded-lg bg-brand-accent/10 flex items-center justify-center flex-shrink-0">
              <Folder className="w-5 h-5 text-brand-accent" />
            </div>

            {/* Module name - clickable to select */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ type: 'module', id: module.id, moduleIndex: module.order });
              }}
              className="flex-1 min-w-0 text-left"
            >
              <p className={`font-medium truncate ${
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

            {/* Delete button - only show in template mode */}
            {canReorder && modules.length > 1 && onDeleteModule && (
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

        {/* Weeks inside module - draggable in template mode, static in client mode */}
        {isModuleExpanded && moduleWeeks.length > 0 && (
          canReorder ? (
            <Reorder.Group
              as="div"
              axis="y"
              values={moduleWeeks}
              onReorder={(newWeeks) => handleWeeksReorder(module.id, newWeeks)}
              className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]"
            >
              {moduleWeeks.map((week, idx) => (
                <Reorder.Item
                  as="div"
                  key={week.weekNum}
                  value={week}
                  className={idx === moduleWeeks.length - 1 ? 'rounded-b-xl' : ''}
                >
                  {renderWeekRow(week, module.id)}
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {moduleWeeks.map((week, idx) => (
                <div key={week.weekNum} className={idx === moduleWeeks.length - 1 ? 'rounded-b-xl' : ''}>
                  {renderWeekRow(week, module.id)}
                </div>
              ))}
            </div>
          )
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
    <div className="w-96 flex-shrink-0">
      {/* Orientation Toggle - moved up, no header */}
      <div className="mb-4">
        <OrientationToggle
          value={orientation}
          onChange={onOrientationChange}
          showConfirmation={true}
          hasExistingContent={hasExistingContent}
        />
      </div>

      {/* Modules & Weeks Tree */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
        <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto p-4">
        {sortedModules.length === 0 ? (
          // No modules yet - prompt to add one (only in template mode)
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-brand-accent" />
            </div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
              {canReorder
                ? 'No modules yet. Create your first module to organize weeks.'
                : 'No modules in this program. Add modules from the template view.'}
            </p>
            {canReorder && (
              <button
                onClick={onAddModule}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg text-sm font-medium font-albert hover:bg-brand-accent/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Module
              </button>
            )}
          </div>
        ) : canReorder ? (
          // Modules list with drag-and-drop (template mode)
          <Reorder.Group
            as="div"
            axis="y"
            values={sortedModules}
            onReorder={handleModuleReorder}
            className="space-y-4"
          >
            {sortedModules.map((module) => (
              <Reorder.Item as="div" key={module.id} value={module}>
                {renderModuleWithWeeks(module)}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          // Static modules list (client view mode - no reordering)
          <div className="space-y-4">
            {sortedModules.map((module) => renderModuleWithWeeks(module))}
          </div>
        )}

        {/* Add Module button - only show in template mode */}
        {canReorder && sortedModules.length > 0 && (
          <button
            onClick={onAddModule}
            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent hover:text-brand-accent transition-colors text-sm font-albert"
          >
            <Plus className="w-4 h-4" />
            Add Module
          </button>
        )}

        {/* Auto-distribute weeks button - only show when there are multiple modules and weeks */}
        {canReorder && sortedModules.length > 1 && onAutoDistributeWeeks && (
          <button
            onClick={onAutoDistributeWeeks}
            className="w-full flex items-center justify-center gap-2 py-3 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent transition-colors text-sm font-albert"
          >
            <Shuffle className="w-4 h-4" />
            Auto-Distribute Weeks
          </button>
        )}
        </div>
      </div>

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
