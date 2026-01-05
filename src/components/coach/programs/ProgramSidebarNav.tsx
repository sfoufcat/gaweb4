'use client';

import React, { useState, useMemo } from 'react';
import type { Program, ProgramDay, ProgramModule, ProgramWeek, ProgramOrientation } from '@/types';
import { ChevronDown, ChevronRight, Plus, Folder, Calendar, FileText, Sparkles } from 'lucide-react';

// Selection types
export type SidebarSelection =
  | { type: 'module'; id: string; moduleIndex: number }
  | { type: 'week'; id: string; weekNumber: number; moduleId?: string }
  | { type: 'day'; dayIndex: number; weekId?: string; moduleId?: string };

interface ProgramSidebarNavProps {
  program: Program;
  modules: ProgramModule[];
  weeks: ProgramWeek[];
  days: ProgramDay[];
  selection: SidebarSelection | null;
  onSelect: (selection: SidebarSelection) => void;
  orientation: ProgramOrientation;
  onOrientationChange: (mode: ProgramOrientation) => void;
  onAddModule?: () => void;
  onAddWeek?: (moduleId: string) => void;
  onFillWithAI?: () => void;
  isLoading?: boolean;
}

/**
 * Hierarchical sidebar navigation for program content
 * Supports both legacy (no modules) and new module-based structure
 */
export function ProgramSidebarNav({
  program,
  modules,
  weeks,
  days,
  selection,
  onSelect,
  orientation,
  onOrientationChange,
  onAddModule,
  onAddWeek,
  onFillWithAI,
  isLoading = false,
}: ProgramSidebarNavProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(modules[0]?.id ? [modules[0].id] : []));
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string | number>>(new Set([1]));

  // Check if program is configured for modules (may have 0 modules initially)
  const isModuleMode = program.hasModules === true;
  const hasExistingModules = modules.length > 0;

  // Calculate week structure for legacy programs (no modules)
  const legacyWeeks = useMemo(() => {
    if (isModuleMode && hasExistingModules) return [];

    const totalDays = program.lengthDays || 30;
    const includeWeekends = program.includeWeekends !== false;
    const daysPerWeek = includeWeekends ? 7 : 5;
    const numWeeks = Math.ceil(totalDays / daysPerWeek);

    return Array.from({ length: numWeeks }, (_, weekIdx) => {
      const weekNum = weekIdx + 1;
      const startDay = weekIdx * daysPerWeek + 1;
      const endDay = Math.min(startDay + daysPerWeek - 1, totalDays);

      // Check content status
      const daysInWeek = Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i);
      const daysWithContent = daysInWeek.filter(day =>
        days.some(d => d.dayIndex === day && (d.tasks?.length > 0 || d.title))
      );

      return {
        weekNum,
        startDay,
        endDay,
        daysInWeek,
        contentCount: daysWithContent.length,
        totalDays: daysInWeek.length,
      };
    });
  }, [isModuleMode, hasExistingModules, program.lengthDays, program.includeWeekends, days]);

  // Toggle module expansion
  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  // Toggle week expansion
  const toggleWeek = (weekKey: string | number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekKey)) {
        next.delete(weekKey);
      } else {
        next.add(weekKey);
      }
      return next;
    });
  };

  // Check if selection matches
  const isSelected = (check: SidebarSelection) => {
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
  };

  // Get weeks for a module
  const getModuleWeeks = (moduleId: string) => {
    return weeks.filter(w => w.moduleId === moduleId).sort((a, b) => a.order - b.order);
  };

  // Get days for a week
  const getWeekDays = (weekStartDay: number, weekEndDay: number) => {
    return Array.from({ length: weekEndDay - weekStartDay + 1 }, (_, i) => weekStartDay + i);
  };

  // Check if a day has content
  const dayHasContent = (dayIndex: number) => {
    return days.some(d => d.dayIndex === dayIndex && (d.tasks?.length > 0 || d.title));
  };

  if (isLoading) {
    return (
      <div className="w-56 flex-shrink-0 space-y-2 animate-pulse">
        <div className="h-8 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
        <div className="h-6 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
        <div className="h-6 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
        <div className="h-6 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
      </div>
    );
  }

  return (
    <div className="w-56 flex-shrink-0">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          Program Content
        </h3>
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

      {/* Navigation tree */}
      <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {hasExistingModules ? (
          // Module-based structure (has modules)
          <>
            {modules.sort((a, b) => a.order - b.order).map((module) => {
              const moduleWeeks = getModuleWeeks(module.id);
              const isExpanded = expandedModules.has(module.id);

              return (
                <div key={module.id} className="mb-2">
                  {/* Module Header */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="p-1 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      )}
                    </button>
                    <button
                      onClick={() => onSelect({ type: 'module', id: module.id, moduleIndex: module.order })}
                      className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium font-albert transition-colors ${
                        isSelected({ type: 'module', id: module.id, moduleIndex: module.order })
                          ? 'bg-brand-accent/10 text-brand-accent'
                          : 'text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                      }`}
                    >
                      <Folder className="w-4 h-4" />
                      <span className="truncate">{module.name}</span>
                    </button>
                  </div>

                  {/* Module's Weeks */}
                  {isExpanded && (
                    <div className="ml-5 mt-1 space-y-1 border-l-2 border-[#e1ddd8] dark:border-[#262b35] pl-2">
                      {moduleWeeks.map((week) => {
                        const weekKey = week.id;
                        const isWeekExpanded = expandedWeeks.has(weekKey);
                        const weekDays = getWeekDays(week.startDayIndex, week.endDayIndex);
                        const daysWithContent = weekDays.filter(d => dayHasContent(d)).length;

                        return (
                          <div key={week.id}>
                            {/* Week Header */}
                            <div className="flex items-center gap-1">
                              {orientation === 'daily' && (
                                <button
                                  onClick={() => toggleWeek(weekKey)}
                                  className="p-0.5 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded"
                                >
                                  {isWeekExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-[#5f5a55] dark:text-[#b2b6c2]" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-[#5f5a55] dark:text-[#b2b6c2]" />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => onSelect({
                                  type: 'week',
                                  id: week.id,
                                  weekNumber: week.weekNumber,
                                  moduleId: module.id
                                })}
                                className={`flex-1 flex items-center justify-between px-2 py-1 rounded text-sm font-albert transition-colors ${
                                  isSelected({ type: 'week', id: week.id, weekNumber: week.weekNumber })
                                    ? 'bg-brand-accent/10 text-brand-accent'
                                    : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3" />
                                  <span>{week.name || `Week ${week.weekNumber}`}</span>
                                </div>
                                <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                                  {daysWithContent}/{weekDays.length}
                                </span>
                              </button>
                            </div>

                            {/* Week's Days (only in daily orientation) */}
                            {orientation === 'daily' && isWeekExpanded && (
                              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[#e1ddd8] dark:border-[#262b35] pl-2">
                                {weekDays.map((dayIndex) => {
                                  const hasContent = dayHasContent(dayIndex);
                                  return (
                                    <button
                                      key={dayIndex}
                                      onClick={() => onSelect({
                                        type: 'day',
                                        dayIndex,
                                        weekId: week.id,
                                        moduleId: module.id
                                      })}
                                      className={`w-full text-left flex items-center gap-1.5 px-2 py-1 rounded text-sm font-albert transition-colors ${
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
                      })}

                      {/* Add Week button */}
                      {onAddWeek && (
                        <button
                          onClick={() => onAddWeek(module.id)}
                          className="w-full flex items-center gap-1.5 px-2 py-1 text-sm text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Week</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Module button */}
            {onAddModule && (
              <button
                onClick={onAddModule}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Module</span>
              </button>
            )}
          </>
        ) : isModuleMode || orientation === 'weekly' ? (
          // Module mode but no modules yet - show prompt to create first module
          <div className="text-center py-6 px-2">
            <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-[#a7a39e] dark:text-[#7d8190]" />
            </div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
              No modules yet
            </p>
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mb-4 font-albert">
              Create modules to organize your program content into sections
            </p>
            {onAddModule && (
              <button
                onClick={onAddModule}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg text-sm font-medium font-albert hover:bg-brand-accent/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Module</span>
              </button>
            )}
          </div>
        ) : (
          // Legacy week-based structure (daily mode, no modules)
          legacyWeeks.map((week) => {
            const weekKey = week.weekNum;
            const isExpanded = expandedWeeks.has(weekKey);

            return (
              <div key={week.weekNum} className="mb-1">
                {/* Week Header - Legacy mode is always daily */}
                <button
                  onClick={() => toggleWeek(weekKey)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium font-albert transition-colors bg-[#faf8f6] dark:bg-[#1e222a] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]"
                >
                  <div className="flex items-center gap-2">
                    {orientation === 'daily' && (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      )
                    )}
                    <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">Week {week.weekNum}</span>
                  </div>
                  <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                    {week.contentCount}/{week.totalDays}
                    {week.contentCount > 0 && <span className="text-green-500 ml-1">✓</span>}
                  </span>
                </button>

                {/* Days in Week (only in daily orientation) */}
                {orientation === 'daily' && isExpanded && (
                  <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-[#e1ddd8] dark:border-[#262b35] pl-2">
                    {week.daysInWeek.map((dayIndex) => {
                      const hasContent = dayHasContent(dayIndex);
                      return (
                        <button
                          key={dayIndex}
                          onClick={() => onSelect({ type: 'day', dayIndex })}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-albert transition-colors ${
                            isSelected({ type: 'day', dayIndex })
                              ? 'bg-brand-accent/10 text-brand-accent'
                              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                          }`}
                        >
                          Day {dayIndex} {hasContent && <span className="text-green-500">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
