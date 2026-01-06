'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Video, BookOpen, ChevronRight, CalendarDays, Clock, Edit2 } from 'lucide-react';
import type { Program, ProgramDay, ProgramModule, ProgramWeek, ProgramOrientation } from '@/types';
import type { DiscoverCourse } from '@/types/discover';

interface ProgramScheduleEditorProps {
  program: Program;
  days: ProgramDay[];
  courses: DiscoverCourse[];
  modules: ProgramModule[];
  weeks: ProgramWeek[];
  orientation: ProgramOrientation;
  onOrientationChange: (orientation: ProgramOrientation) => void;
  onDayClick: (dayIndex: number) => void;
  onAddCall: (dayIndex: number) => void;
}

export function ProgramScheduleEditor({
  program,
  days,
  courses,
  modules,
  weeks,
  orientation,
  onOrientationChange,
  onDayClick,
  onAddCall,
}: ProgramScheduleEditorProps) {
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  // Calculate weeks based on program length and orientation
  const includeWeekends = program.includeWeekends !== false;
  const daysPerWeek = includeWeekends ? 7 : 5;

  // Module colors for visual distinction
  const moduleColors = [
    { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', accent: 'bg-blue-100 dark:bg-blue-900/30' },
    { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', accent: 'bg-purple-100 dark:bg-purple-900/30' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', accent: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', accent: 'bg-amber-100 dark:bg-amber-900/30' },
    { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300', accent: 'bg-rose-100 dark:bg-rose-900/30' },
  ];

  // Group weeks by module
  const moduleWeeksMap = useMemo(() => {
    const map = new Map<string, ProgramWeek[]>();

    // Sort modules by order
    const sortedModules = [...modules].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Initialize with empty arrays for each module
    sortedModules.forEach(m => map.set(m.id, []));

    // Group weeks into their modules, sorted by order
    weeks.forEach(week => {
      if (week.moduleId && map.has(week.moduleId)) {
        map.get(week.moduleId)!.push(week);
      }
    });

    // Sort weeks within each module by order
    map.forEach((moduleWeeks) => {
      moduleWeeks.sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    return map;
  }, [modules, weeks]);

  // Get days for a specific week
  const getWeekDays = (weekNum: number, weekLength: number) => {
    const startDay = (weekNum - 1) * daysPerWeek + 1;
    const endDay = Math.min(startDay + weekLength - 1, program.lengthDays || 30);

    return Array.from({ length: Math.max(0, endDay - startDay + 1) }, (_, i) => {
      const dayIndex = startDay + i;
      const dayData = days.find(d => d.dayIndex === dayIndex);
      return {
        dayIndex,
        data: dayData,
        hasContent: dayData && ((dayData.tasks?.length || 0) > 0 || (dayData.courseAssignments?.length || 0) > 0),
      };
    });
  };

  // Day name for header
  const getDayName = (dayOfWeek: number) => {
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return names[dayOfWeek % 7];
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

  return (
    <div className="space-y-4">
      {/* Header with Weekly/Daily Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Program Schedule
        </h3>
        <div className="flex items-center bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg p-1">
          <button
            type="button"
            onClick={() => onOrientationChange('weekly')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium font-albert rounded-md transition-colors ${
              orientation === 'weekly'
                ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Weekly
          </button>
          <button
            type="button"
            onClick={() => onOrientationChange('daily')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium font-albert rounded-md transition-colors ${
              orientation === 'daily'
                ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Daily
          </button>
        </div>
      </div>

      {/* Modules and Weeks Structure */}
      <div className="space-y-4">
        {sortedModules.map((module, moduleIndex) => {
          const moduleColor = moduleColors[moduleIndex % moduleColors.length];
          const moduleWeeks = moduleWeeksMap.get(module.id) || [];
          const isCollapsed = collapsedModules.has(module.id);

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
                    {moduleWeeks.length} week{moduleWeeks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <ChevronRight className={`w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
              </button>

              {/* Module Weeks */}
              {!isCollapsed && (
                <div className="p-4 space-y-6 bg-white dark:bg-[#171b22]">
                  {moduleWeeks.length === 0 ? (
                    <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] text-center py-4 font-albert">
                      No weeks in this module
                    </p>
                  ) : (
                    moduleWeeks.map((week) => {
                      const weekDays = getWeekDays(week.weekNumber, daysPerWeek);

                      return (
                        <div key={week.id} className="space-y-2">
                          {/* Week Header */}
                          <div className="flex items-center gap-2 pb-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                            <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              Week {week.weekNumber}
                            </span>
                            {week.theme && (
                              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                                — {week.theme}
                              </span>
                            )}
                          </div>

                          {/* Week Grid */}
                          <div className="grid grid-cols-7 gap-2">
                            {/* Day Headers */}
                            {Array.from({ length: Math.min(7, daysPerWeek) }, (_, i) => (
                              <div
                                key={`header-${week.id}-${i}`}
                                className="text-center text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] pb-1 font-albert"
                              >
                                {getDayName(i)}
                              </div>
                            ))}

                            {/* Day Cells */}
                            {weekDays.map(({ dayIndex, data, hasContent }) => (
                              <div
                                key={dayIndex}
                                className={`min-h-[100px] ${moduleColor.bg} rounded-lg border ${moduleColor.border} p-2 space-y-1`}
                              >
                                {/* Day Number Header */}
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                                    Day {dayIndex}
                                  </span>
                                  <button
                                    onClick={() => onDayClick(dayIndex)}
                                    className="p-0.5 rounded hover:bg-white/50 dark:hover:bg-black/20 text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent transition-colors"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* Day Content */}
                                {data?.title && (
                                  <p className="text-[10px] text-[#5f5a55] dark:text-[#b2b6c2] truncate font-albert">
                                    {data.title}
                                  </p>
                                )}

                                {/* Tasks Count */}
                                {data?.tasks && data.tasks.length > 0 && (
                                  <div className="flex items-center gap-1 text-[10px] text-[#a7a39e] dark:text-[#7d8190]">
                                    <CalendarDays className="w-2.5 h-2.5" />
                                    <span>{data.tasks.length}</span>
                                  </div>
                                )}

                                {/* Course Assignments */}
                                {data?.courseAssignments && data.courseAssignments.length > 0 && (
                                  <div className="flex items-center gap-1 text-[10px]">
                                    <BookOpen className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                                    <span className="text-blue-700 dark:text-blue-300">
                                      {data.courseAssignments.length}
                                    </span>
                                  </div>
                                )}

                                {/* Empty State - Add Button */}
                                {!hasContent && !data?.title && (
                                  <button
                                    onClick={() => onDayClick(dayIndex)}
                                    className="w-full h-full flex items-center justify-center"
                                  >
                                    <Plus className="w-4 h-4 text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent transition-colors" />
                                  </button>
                                )}
                              </div>
                            ))}

                            {/* Fill remaining cells for incomplete weeks */}
                            {weekDays.length < daysPerWeek &&
                              Array.from({ length: daysPerWeek - weekDays.length }, (_, i) => (
                                <div
                                  key={`empty-${week.id}-${i}`}
                                  className="min-h-[100px] bg-[#f3f1ef]/30 dark:bg-[#171b22]/30 rounded-lg border border-dashed border-[#e1ddd8] dark:border-[#262b35]"
                                />
                              ))}
                          </div>
                        </div>
                      );
                    })
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
      <div className="flex items-center gap-4 text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert pt-2">
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
      </div>
    </div>
  );
}
