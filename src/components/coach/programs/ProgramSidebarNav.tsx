'use client';

import React, { useState, useMemo } from 'react';
import type { Program, ProgramDay, ProgramModule, ProgramWeek, ProgramOrientation } from '@/types';
import { ChevronDown, ChevronRight, Plus, Folder, Calendar, FileText, Sparkles } from 'lucide-react';
import { OrientationToggle } from './OrientationToggle';

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
  onFillWithAI?: () => void;
  onFillWeek?: (weekNumber: number) => void;
  onWeekDistributionChange?: (weekNumber: number, distribution: 'repeat-daily' | 'spread') => void;
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
  onFillWithAI,
  onFillWeek,
  onWeekDistributionChange,
  isLoading = false,
}: ProgramSidebarNavProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(modules[0]?.id ? [modules[0].id] : []));
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string | number>>(new Set([1]));

  const hasExistingModules = modules.length > 0;

  // Auto-calculate weeks based on program length (always used)
  const calculatedWeeks = useMemo(() => {
    const totalDays = program.lengthDays || 30;
    const includeWeekends = program.includeWeekends !== false;
    const daysPerWeek = includeWeekends ? 7 : 5;
    const numWeeks = Math.ceil(totalDays / daysPerWeek);

    return Array.from({ length: numWeeks }, (_, weekIdx) => {
      const weekNum = weekIdx + 1;
      const startDay = weekIdx * daysPerWeek + 1;
      const endDay = Math.min(startDay + daysPerWeek - 1, totalDays);

      // Check content status from days
      const daysInWeek = Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i);
      const daysWithContent = daysInWeek.filter(day =>
        days.some(d => d.dayIndex === day && (d.tasks?.length > 0 || d.title))
      );
      
      // Get stored week data if it exists (for theme, distribution, etc.)
      const storedWeek = weeks.find(w => w.weekNumber === weekNum);

      return {
        weekNum,
        startDay,
        endDay,
        daysInWeek,
        contentCount: daysWithContent.length,
        totalDays: daysInWeek.length,
        // Include stored week data
        theme: storedWeek?.theme,
        distribution: storedWeek?.distribution || 'spread',
        weeklyTasks: storedWeek?.weeklyTasks || [],
        storedWeekId: storedWeek?.id,
      };
    });
  }, [program.lengthDays, program.includeWeekends, days, weeks]);

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

  // Check if program has content (for mode switch confirmation)
  const hasExistingContent = days.some(d => d.tasks?.length > 0 || d.title) || 
    weeks.some(w => w.weeklyTasks?.length || w.theme);

  return (
    <div className="w-64 flex-shrink-0">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
          Program Content
        </h3>
        {/* Mode Toggle */}
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

      {/* Navigation tree */}
      <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {/* Optional Modules Section */}
        {hasExistingModules && (
          <div className="mb-3 pb-3 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mb-2 px-1">Modules (optional groupings)</p>
            {modules.sort((a, b) => a.order - b.order).map((module) => (
              <button
                key={module.id}
                onClick={() => onSelect({ type: 'module', id: module.id, moduleIndex: module.order })}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium font-albert transition-colors mb-1 ${
                  isSelected({ type: 'module', id: module.id, moduleIndex: module.order })
                    ? 'bg-brand-accent/10 text-brand-accent'
                    : 'text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                }`}
              >
                <Folder className="w-4 h-4" />
                <span className="truncate">{module.name}</span>
              </button>
            ))}
            {onAddModule && (
              <button
                onClick={onAddModule}
                className="w-full flex items-center gap-2 px-2 py-1 text-sm text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Add Module</span>
              </button>
            )}
          </div>
        )}

        {/* Auto-calculated Weeks */}
        {calculatedWeeks.map((week) => {
          const weekKey = week.weekNum;
          const isExpanded = expandedWeeks.has(weekKey);
          const weekSelection: SidebarSelection = { 
            type: 'week', 
            id: week.storedWeekId || `week-${week.weekNum}`, 
            weekNumber: week.weekNum 
          };

          return (
            <div key={week.weekNum} className="mb-1 group/week">
              {/* Week Header */}
              <div className="flex items-center gap-1">
                {/* Expand/collapse button only in Daily mode */}
                {orientation === 'daily' && (
                  <button
                    onClick={() => toggleWeek(weekKey)}
                    className="p-1 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    )}
                  </button>
                )}
                
                {/* Week button - in Weekly mode this opens WeekEditor, in Daily mode it's just a grouping */}
                <button
                  onClick={() => {
                    if (orientation === 'weekly') {
                      onSelect(weekSelection);
                    } else {
                      toggleWeek(weekKey);
                    }
                  }}
                  className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium font-albert transition-colors ${
                    orientation === 'weekly' && isSelected(weekSelection)
                      ? 'bg-brand-accent/10 text-brand-accent'
                      : 'bg-[#faf8f6] dark:bg-[#1e222a] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    <span>{week.theme || `Week ${week.weekNum}`}</span>
                  </div>
                  
                  {orientation === 'weekly' ? (
                    /* Distribution selector in weekly mode */
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
                    /* Content count in daily mode */
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

              {/* DEPRECATED: Day navigation - kept for future use
                  Days are now viewed via DayPreviewPopup from the Week Editor
              {orientation === 'daily' && isExpanded && (
                <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-[#e1ddd8] dark:border-[#262b35] pl-2">
                  {week.daysInWeek.map((dayIndex) => {
                    const hasContent = dayHasContent(dayIndex);
                    return (
                      <button
                        key={dayIndex}
                        onClick={() => onSelect({ type: 'day', dayIndex })}
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
              */}
            </div>
          );
        })}

        {/* Add Module button (if no modules yet) */}
        {!hasExistingModules && onAddModule && (
          <button
            onClick={onAddModule}
            className="w-full flex items-center gap-2 px-3 py-2 mt-2 text-sm text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent transition-colors border-t border-[#e1ddd8] dark:border-[#262b35] pt-3"
          >
            <Plus className="w-4 h-4" />
            <span>Add Module (optional)</span>
          </button>
        )}
      </div>
    </div>
  );
}
