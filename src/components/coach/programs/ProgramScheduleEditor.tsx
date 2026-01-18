'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Video, BookOpen, ChevronRight, CalendarDays, Edit2 } from 'lucide-react';
import type { Program, ProgramDay, ProgramModule, ProgramWeek } from '@/types';
import type { DiscoverCourse } from '@/types/discover';
import { calculateCalendarWeeks, dayIndexToDate, type CalendarWeek } from '@/lib/calendar-weeks';

interface ProgramScheduleEditorProps {
  program: Program;
  days: ProgramDay[];
  courses: DiscoverCourse[];
  modules: ProgramModule[];
  weeks: ProgramWeek[];
  onDayClick: (dayIndex: number) => void;
  onAddCall: (dayIndex: number) => void;
  // New props for calendar alignment
  currentDayIndex?: number;
  enrollmentStartDate?: string;
  viewMode?: 'template' | 'client';
}

// Get a default Monday start date for template view
function getDefaultMondayStart(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Get to Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToSubtract);
  return monday.toISOString().split('T')[0];
}

export function ProgramScheduleEditor({
  program,
  days,
  courses,
  modules,
  weeks,
  onDayClick,
  onAddCall,
  currentDayIndex,
  enrollmentStartDate,
  viewMode = 'template',
}: ProgramScheduleEditorProps) {
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  // Calculate calendar settings
  const includeWeekends = program.includeWeekends !== false;
  const gridCols = includeWeekends ? 7 : 5;
  const dayHeaders = includeWeekends
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  // For template view, always start on Monday
  // For client view, use enrollment date
  const effectiveStartDate = useMemo(() => {
    if (viewMode === 'client' && enrollmentStartDate) {
      return enrollmentStartDate;
    }
    return getDefaultMondayStart();
  }, [viewMode, enrollmentStartDate]);

  // Module colors for visual distinction
  const moduleColors = [
    { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', accent: 'bg-blue-100 dark:bg-blue-900/30' },
    { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', accent: 'bg-purple-100 dark:bg-purple-900/30' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', accent: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', accent: 'bg-amber-100 dark:bg-amber-900/30' },
    { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300', accent: 'bg-rose-100 dark:bg-rose-900/30' },
  ];

  // Status colors for day cards - consistent with sidebar
  const statusColors = {
    past: {
      bg: 'bg-yellow-50/70 dark:bg-yellow-950/30',
      border: 'border-yellow-300 dark:border-yellow-800',
    },
    active: {
      bg: 'bg-[#F8FFFB] dark:bg-emerald-950/30',
      border: 'border-emerald-300 dark:border-emerald-700',
    },
    future: {
      bg: 'bg-gray-50/70 dark:bg-gray-900/30',
      border: 'border-gray-200 dark:border-gray-700',
    },
  };

  // Module status colors (orange for active module - matches row view)
  const moduleStatusColors = {
    past: {
      bg: 'bg-yellow-50/40 dark:bg-yellow-950/15',
      border: 'border-yellow-300 dark:border-yellow-700',
      text: 'text-yellow-700 dark:text-yellow-300',
      accent: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    active: {
      bg: 'bg-orange-50/40 dark:bg-orange-950/15',
      border: 'border-orange-300 dark:border-orange-700',
      text: 'text-orange-700 dark:text-orange-300',
      accent: 'bg-orange-100 dark:bg-orange-900/30',
    },
    future: null, // Use default module color
  };

  // Calculate calendar-aligned weeks
  const calendarWeeks = useMemo(() => {
    const totalDays = program.lengthDays || 30;
    return calculateCalendarWeeks(effectiveStartDate, totalDays, includeWeekends);
  }, [effectiveStartDate, program.lengthDays, includeWeekends]);

  // Group calendar weeks by module
  const calendarWeeksByModule = useMemo(() => {
    const result = new Map<string, CalendarWeek[]>();

    // Sort modules by order and initialize map
    const sortedModules = [...modules].sort((a, b) => (a.order || 0) - (b.order || 0));
    sortedModules.forEach(m => result.set(m.id, []));

    // Map each calendar week to a module based on which module contains its first day
    calendarWeeks.forEach(cw => {
      const firstDay = cw.startDayIndex;

      // Find which stored week contains this day
      const storedWeek = weeks.find(w =>
        firstDay >= w.startDayIndex && firstDay <= w.endDayIndex
      );

      // Use the module from the stored week, or default to first module
      const moduleId = storedWeek?.moduleId || sortedModules[0]?.id;
      if (moduleId && result.has(moduleId)) {
        result.get(moduleId)!.push(cw);
      } else if (sortedModules.length > 0) {
        // Fallback: add to first module if no match
        result.get(sortedModules[0].id)!.push(cw);
      }
    });

    return result;
  }, [calendarWeeks, modules, weeks]);

  // Get day column position (0-indexed) based on actual calendar date
  const getDayColumn = (dayIndex: number): number => {
    const date = dayIndexToDate(effectiveStartDate, dayIndex, includeWeekends);
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    if (includeWeekends) {
      // Mon=0, Tue=1, ..., Sun=6
      return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    } else {
      // Mon=0, Tue=1, Wed=2, Thu=3, Fri=4
      return dayOfWeek - 1;
    }
  };

  // Get day status for styling
  const getDayStatus = (dayIndex: number): 'past' | 'active' | 'future' => {
    if (!currentDayIndex || viewMode !== 'client') return 'future';
    if (dayIndex < currentDayIndex) return 'past';
    if (dayIndex === currentDayIndex) return 'active';
    return 'future';
  };

  // Get module status based on its calendar weeks
  const getModuleStatus = (moduleCalendarWeeks: CalendarWeek[]): 'past' | 'active' | 'future' => {
    if (!currentDayIndex || viewMode !== 'client' || moduleCalendarWeeks.length === 0) return 'future';

    // Get the day range for this module
    const minDay = Math.min(...moduleCalendarWeeks.map(cw => cw.startDayIndex));
    const maxDay = Math.max(...moduleCalendarWeeks.map(cw => cw.endDayIndex));

    // If current day is within module range, it's active
    if (currentDayIndex >= minDay && currentDayIndex <= maxDay) return 'active';
    // If current day is past all days in module, module is past
    if (currentDayIndex > maxDay) return 'past';
    // Otherwise it's future
    return 'future';
  };

  // Get theme for a calendar week from stored week data
  const getWeekTheme = (cw: CalendarWeek): string | undefined => {
    // Direct match by weekNumber first (most accurate)
    const directMatch = weeks.find(w => w.weekNumber === cw.weekNumber);
    if (directMatch) return directMatch.theme;

    // Fallback: match by day range (for legacy data)
    const firstDay = cw.startDayIndex;
    const daysPerWeek = includeWeekends ? 7 : 5;
    const storedWeek = weeks.find(w => {
      // Use stored day indices if available
      if (w.startDayIndex !== undefined && w.endDayIndex !== undefined) {
        return firstDay >= w.startDayIndex && firstDay <= w.endDayIndex;
      }
      // Skip formula fallback for special weeks (0, -1) without stored indices
      if (w.weekNumber <= 0) return false;
      // Calculate for regular weeks only
      const weekStart = (w.weekNumber - 1) * daysPerWeek + 1;
      const weekEnd = w.weekNumber * daysPerWeek;
      return firstDay >= weekStart && firstDay <= weekEnd;
    });
    return storedWeek?.theme;
  };

  // Get days for a calendar week
  const getWeekDays = (cw: CalendarWeek) => {
    return Array.from({ length: cw.endDayIndex - cw.startDayIndex + 1 }, (_, i) => {
      const dayIndex = cw.startDayIndex + i;
      const dayData = days.find(d => d.dayIndex === dayIndex);
      return {
        dayIndex,
        data: dayData,
        hasContent: dayData && ((dayData.tasks?.length || 0) > 0 || (dayData.courseAssignments?.length || 0) > 0),
        column: getDayColumn(dayIndex),
      };
    });
  };

  // Toggle module collapse
  const toggleModule = (moduleId: string) => {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  // Sort modules by order
  const sortedModules = useMemo(() => {
    return [...modules].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [modules]);

  // Render day cells for a calendar week
  const renderDayCells = (cw: CalendarWeek, moduleColor: typeof moduleColors[0]) => {
    const weekDays = getWeekDays(cw);
    const daysByColumn = new Map<number, typeof weekDays[0]>();

    // Map days to their columns
    weekDays.forEach(day => {
      daysByColumn.set(day.column, day);
    });

    // Render all columns
    const cells = [];
    for (let col = 0; col < gridCols; col++) {
      const day = daysByColumn.get(col);

      if (day) {
        const status = getDayStatus(day.dayIndex);

        // All days use status colors: past=yellow, active=green, future=gray
        const bgClass = statusColors[status].bg;
        const borderClass = statusColors[status].border;

        cells.push(
          <div
            key={day.dayIndex}
            className={`min-h-[100px] ${bgClass} rounded-lg border ${borderClass} p-2 space-y-1 transition-colors`}
          >
            {/* Day Number Header */}
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium font-albert ${
                status === 'active'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : status === 'past'
                    ? 'text-yellow-700 dark:text-yellow-300'
                    : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
              }`}>
                Day {day.dayIndex}
              </span>
              <button
                onClick={() => onDayClick(day.dayIndex)}
                className="p-0.5 rounded hover:bg-white/50 dark:hover:bg-black/20 text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent transition-colors"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>

            {/* Day Content */}
            {day.data?.title && (
              <p className="text-[10px] text-[#5f5a55] dark:text-[#b2b6c2] truncate font-albert">
                {day.data.title}
              </p>
            )}

            {/* Tasks Count */}
            {day.data?.tasks && day.data.tasks.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-[#a7a39e] dark:text-[#7d8190]">
                <CalendarDays className="w-2.5 h-2.5" />
                <span>{day.data.tasks.length}</span>
              </div>
            )}

            {/* Course Assignments */}
            {day.data?.courseAssignments && day.data.courseAssignments.length > 0 && (
              <div className="flex items-center gap-1 text-[10px]">
                <BookOpen className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-700 dark:text-blue-300">
                  {day.data.courseAssignments.length}
                </span>
              </div>
            )}

            {/* Empty State - Add Button */}
            {!day.hasContent && !day.data?.title && (
              <button
                onClick={() => onDayClick(day.dayIndex)}
                className="w-full h-full flex items-center justify-center"
              >
                <Plus className="w-4 h-4 text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent transition-colors" />
              </button>
            )}
          </div>
        );
      } else {
        // Empty cell for days not in this week
        cells.push(
          <div
            key={`empty-${cw.weekNumber}-${col}`}
            className="min-h-[100px] bg-[#f3f1ef]/30 dark:bg-[#171b22]/30 rounded-lg border border-dashed border-[#e1ddd8] dark:border-[#262b35]"
          />
        );
      }
    }

    return cells;
  };

  return (
    <div className="space-y-4">
      {/* Modules and Weeks Structure */}
      <div className="space-y-4">
        {sortedModules.map((module, moduleIndex) => {
          const defaultModuleColor = moduleColors[moduleIndex % moduleColors.length];
          const moduleCalendarWeeks = calendarWeeksByModule.get(module.id) || [];
          const isCollapsed = collapsedModules.has(module.id);
          const moduleStatus = getModuleStatus(moduleCalendarWeeks);

          // Use status colors for client view, default module colors otherwise
          const moduleColor = (viewMode === 'client' && moduleStatusColors[moduleStatus])
            ? moduleStatusColors[moduleStatus]!
            : defaultModuleColor;

          return (
            <div key={module.id} className={`rounded-xl border ${moduleColor.border} overflow-hidden`}>
              {/* Module Header */}
              <button
                onClick={() => toggleModule(module.id)}
                className={`w-full flex items-center justify-between px-4 py-3 ${moduleColor.bg} hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${moduleColor.accent}`} />
                  <span className={`font-semibold font-albert ${moduleColor.text}`}>
                    {module.name || `Module ${moduleIndex + 1}`}
                  </span>
                  <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                    {moduleCalendarWeeks.length} week{moduleCalendarWeeks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <ChevronRight className={`w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
              </button>

              {/* Module Weeks */}
              {!isCollapsed && (
                <div className="p-4 space-y-6 bg-white dark:bg-[#171b22]">
                  {moduleCalendarWeeks.length === 0 ? (
                    <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] text-center py-4 font-albert">
                      No weeks in this module
                    </p>
                  ) : (
                    moduleCalendarWeeks.map((cw) => (
                      <div key={`${cw.type}-${cw.weekNumber}`} className="space-y-2">
                        {/* Week Header */}
                        <div className="flex items-center gap-2 pb-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                          <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            {cw.label}
                          </span>
                          {getWeekTheme(cw) && (
                            <span className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                              {getWeekTheme(cw)}
                            </span>
                          )}
                          <span className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                            Days {cw.startDayIndex}–{cw.endDayIndex}
                          </span>
                        </div>

                        {/* Week Grid */}
                        <div className={`grid gap-2 ${gridCols === 5 ? 'grid-cols-5' : 'grid-cols-7'}`}>
                          {/* Day Headers */}
                          {dayHeaders.map((name, i) => (
                            <div
                              key={`header-${cw.weekNumber}-${i}`}
                              className="text-center text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] pb-1 font-albert"
                            >
                              {name}
                            </div>
                          ))}

                          {/* Day Cells */}
                          {renderDayCells(cw, moduleColor)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* No modules state */}
        {modules.length === 0 && (
          <div className="text-center py-12 text-[#a7a39e] dark:text-[#7d8190]">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-albert">No modules defined yet</p>
            <p className="text-sm mt-1">Create modules in the Row view to organize your program</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert pt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Video className="w-2 h-2 text-purple-600 dark:text-purple-400" />
          </div>
          <span>Call</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <BookOpen className="w-2 h-2 text-blue-600 dark:text-blue-400" />
          </div>
          <span>Course</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CalendarDays className="w-2 h-2 text-green-600 dark:text-green-400" />
          </div>
          <span>Tasks</span>
        </div>
        {currentDayIndex && viewMode === 'client' && (
          <>
            <div className="w-px h-3 bg-[#e1ddd8] dark:bg-[#262b35]" />
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800" />
              <span>Past</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-orange-50 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700" />
              <span>Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700" />
              <span>Today</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
