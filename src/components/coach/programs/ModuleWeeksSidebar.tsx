'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import type { Program, ProgramDay, ProgramModule, ProgramWeek, ProgramOrientation } from '@/types';
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
  AlertTriangle
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
  isLoading?: boolean;
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
 * Modules are collapsible containers, weeks are nested and can be dragged between modules
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
  onWeekMoveToModule,
  onAddModule,
  onDeleteModule,
  onFillWithAI,
  onFillWeek,
  onWeekDistributionChange,
  isLoading = false,
}: ModuleWeeksSidebarProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.map(m => m.id))
  );
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [moduleToDelete, setModuleToDelete] = useState<ProgramModule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

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

    // Sort weeks within each module by week number
    map.forEach((moduleWeeks) => {
      moduleWeeks.sort((a, b) => a.weekNum - b.weekNum);
    });

    return map;
  }, [modules, calculatedWeeks]);

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
      <div className="w-64 flex-shrink-0 space-y-2 animate-pulse">
        <div className="h-8 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
        <div className="h-6 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
        <div className="h-6 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
        <div className="h-6 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
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
    const isWeekExpanded = expandedWeeks.has(week.weekNum);

    return (
      <div key={week.weekNum} className="group/week">
        {/* Week Header */}
        <div className="flex items-center gap-1">
          {/* Drag handle */}
          <div className="touch-none cursor-grab active:cursor-grabbing p-1">
            <GripVertical className="w-4 h-4 text-[#a7a39e] dark:text-[#7d8190]" />
          </div>

          {/* Expand/collapse button only in Daily mode */}
          {orientation === 'daily' && (
            <button
              onClick={() => toggleWeek(week.weekNum)}
              className="p-1 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded"
            >
              {isWeekExpanded ? (
                <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              )}
            </button>
          )}

          {/* Week button */}
          <button
            onClick={() => {
              if (orientation === 'weekly') {
                onSelect(weekSelection);
              } else {
                toggleWeek(week.weekNum);
              }
            }}
            className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded-lg text-sm font-medium font-albert transition-colors ${
              orientation === 'weekly' && isSelected(weekSelection)
                ? 'bg-brand-accent/10 text-brand-accent'
                : 'bg-[#faf8f6] dark:bg-[#1e222a] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              <span className="truncate">{week.theme || `Week ${week.weekNum}`}</span>
            </div>

            {orientation === 'weekly' ? (
              <select
                value={week.distribution}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onWeekDistributionChange?.(week.weekNum, e.target.value as 'repeat-daily' | 'spread');
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] border border-[#e1ddd8] dark:border-[#363b45] cursor-pointer hover:border-brand-accent transition-colors"
              >
                <option value="repeat-daily">Repeat Daily</option>
                <option value="spread">Spread</option>
              </select>
            ) : (
              <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                {week.contentCount}/{week.totalDays}
                {week.contentCount > 0 && <span className="text-green-500 ml-1">✓</span>}
              </span>
            )}
          </button>

          {/* Fill week with AI button */}
          {onFillWeek && orientation === 'weekly' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFillWeek(week.weekNum);
              }}
              className="p-1 hover:bg-brand-accent/10 rounded opacity-0 group-hover/week:opacity-100 transition-opacity"
              title="Fill week with AI"
            >
              <Sparkles className="w-3 h-3 text-brand-accent" />
            </button>
          )}
        </div>

        {/* Days in Week (only in Daily mode when expanded) */}
        {orientation === 'daily' && isWeekExpanded && (
          <div className="ml-10 mt-1 space-y-0.5 border-l-2 border-[#e1ddd8] dark:border-[#262b35] pl-2">
            {week.daysInWeek.map((dayIndex) => {
              const hasContent = dayHasContent(dayIndex);
              return (
                <button
                  key={dayIndex}
                  onClick={() => onSelect({ type: 'day', dayIndex, moduleId })}
                  className={`w-full text-left flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-albert transition-colors ${
                    isSelected({ type: 'day', dayIndex })
                      ? 'bg-brand-accent/10 text-brand-accent'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Day {dayIndex}</span>
                  {hasContent && <span className="text-green-500 text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 flex-shrink-0">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
          Program Content
        </h3>
        <OrientationToggle
          value={orientation}
          onChange={onOrientationChange}
          showConfirmation={true}
          hasExistingContent={hasExistingContent}
        />
      </div>

      {/* Fill with AI button */}
      {onFillWithAI && (
        <button
          onClick={onFillWithAI}
          className="w-full mb-4 flex items-center justify-center gap-2 px-3 py-2 bg-brand-accent text-white rounded-lg text-sm font-medium font-albert hover:bg-brand-accent/90 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Fill with AI
        </button>
      )}

      {/* Modules & Weeks Tree */}
      <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {sortedModules.length === 0 ? (
          // No modules yet - prompt to add one
          <div className="text-center py-4">
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
              No modules yet
            </p>
            <button
              onClick={onAddModule}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg text-sm font-medium font-albert hover:bg-brand-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Module
            </button>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={sortedModules}
            onReorder={handleModuleReorder}
            className="space-y-2"
          >
            {sortedModules.map((module) => {
              const isModuleExpanded = expandedModules.has(module.id);
              const moduleWeeks = weeksByModule.get(module.id) || [];
              const weekCount = moduleWeeks.length;

              return (
                <Reorder.Item
                  key={module.id}
                  value={module}
                  className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden"
                >
                  {/* Module Header */}
                  <div
                    className={`flex items-center gap-2 p-3 cursor-grab active:cursor-grabbing transition-colors ${
                      isSelected({ type: 'module', id: module.id, moduleIndex: module.order })
                        ? 'bg-brand-accent/10'
                        : 'hover:bg-[#faf8f6] dark:hover:bg-white/5'
                    }`}
                  >
                    {/* Drag handle */}
                    <div className="touch-none">
                      <GripVertical className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                    </div>

                    {/* Module icon */}
                    <div className="w-8 h-8 rounded-lg bg-brand-accent/10 flex items-center justify-center">
                      <Folder className="w-4 h-4 text-brand-accent" />
                    </div>

                    {/* Module name - clickable to select */}
                    <button
                      onClick={() => onSelect({ type: 'module', id: module.id, moduleIndex: module.order })}
                      className="flex-1 text-left"
                    >
                      <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                        {module.name}
                      </p>
                    </button>

                    {/* Week count badge */}
                    <span className="text-xs px-2 py-0.5 bg-[#f5f3f0] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] rounded font-albert">
                      {weekCount} {weekCount === 1 ? 'week' : 'weeks'}
                    </span>

                    {/* Delete button */}
                    {modules.length > 1 && onDeleteModule && (
                      <button
                        onClick={(e) => handleDeleteModuleClick(module, e)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete module"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}

                    {/* Expand/collapse button */}
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="p-1 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded"
                    >
                      {isModuleExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      )}
                    </button>
                  </div>

                  {/* Weeks inside module */}
                  {isModuleExpanded && moduleWeeks.length > 0 && (
                    <div className="px-3 pb-3 space-y-1 border-t border-[#e1ddd8] dark:border-[#262b35] pt-2">
                      {moduleWeeks.map(week => renderWeekRow(week, module.id))}
                    </div>
                  )}

                  {/* Empty state for module with no weeks */}
                  {isModuleExpanded && moduleWeeks.length === 0 && (
                    <div className="px-3 pb-3 border-t border-[#e1ddd8] dark:border-[#262b35] pt-2">
                      <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert text-center py-2">
                        Drag weeks here
                      </p>
                    </div>
                  )}
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        )}

        {/* Add Module button */}
        {sortedModules.length > 0 && (
          <button
            onClick={onAddModule}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent hover:text-brand-accent transition-colors text-sm font-albert"
          >
            <Plus className="w-4 h-4" />
            Add Module
          </button>
        )}
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
