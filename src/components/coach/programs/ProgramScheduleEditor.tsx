'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Video,
  BookOpen,
  ChevronRight,
  CalendarDays,
  FileText,
  Download,
  Link2,
  ClipboardList,
  GraduationCap,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import type { Program, ProgramDay, ProgramModule, ProgramWeek, UnifiedEvent } from '@/types';
import type { DiscoverCourse, DiscoverArticle } from '@/types/discover';
import { calculateCalendarWeeks, dayIndexToDate, type CalendarWeek } from '@/lib/calendar-weeks';
import { getResourcesForDay } from '@/lib/program-utils-client';
import { DayPreviewPopup } from './DayPreviewPopup';

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
  // Optional props for enhanced day preview
  events?: UnifiedEvent[];
  articles?: Record<string, DiscoverArticle>;
  // Task completion data for client/cohort view
  taskCompletions?: Map<string, { completed: boolean; completedAt?: string }>;
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
  events = [],
  articles = {},
  taskCompletions,
}: ProgramScheduleEditorProps) {
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const [previewDayIndex, setPreviewDayIndex] = useState<number | null>(null);

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
    { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', accent: 'bg-blue-500', accentBg: 'bg-blue-100 dark:bg-blue-900/30' },
    { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', accent: 'bg-purple-500', accentBg: 'bg-purple-100 dark:bg-purple-900/30' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', accent: 'bg-emerald-500', accentBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', accent: 'bg-amber-500', accentBg: 'bg-amber-100 dark:bg-amber-900/30' },
    { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300', accent: 'bg-rose-500', accentBg: 'bg-rose-100 dark:bg-rose-900/30' },
  ];

  // Status colors for day cards - consistent with sidebar
  const statusColors = {
    past: {
      bg: 'bg-yellow-50/70 dark:bg-yellow-950/30',
      border: 'border-yellow-300 dark:border-yellow-800',
      text: 'text-yellow-700 dark:text-yellow-300',
      textMuted: 'text-yellow-600/70 dark:text-yellow-400/70',
    },
    active: {
      bg: 'bg-[#F8FFFB] dark:bg-emerald-950/30',
      border: 'border-emerald-300 dark:border-emerald-700',
      text: 'text-emerald-700 dark:text-emerald-300',
      textMuted: 'text-emerald-600/70 dark:text-emerald-400/70',
    },
    future: {
      bg: 'bg-gray-50/70 dark:bg-gray-900/30',
      border: 'border-gray-200 dark:border-gray-700',
      text: 'text-[#1a1a1a] dark:text-[#f5f5f8]',
      textMuted: 'text-[#a7a39e] dark:text-[#7d8190]',
    },
  };

  // Module status colors (orange for active module - matches row view)
  const moduleStatusColors = {
    past: {
      bg: 'bg-yellow-50/40 dark:bg-yellow-950/15',
      border: 'border-yellow-300 dark:border-yellow-700',
      text: 'text-yellow-700 dark:text-yellow-300',
      accent: 'bg-yellow-500',
      accentBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    active: {
      bg: 'bg-orange-50/40 dark:bg-orange-950/15',
      border: 'border-orange-300 dark:border-orange-700',
      text: 'text-orange-700 dark:text-orange-300',
      accent: 'bg-orange-500',
      accentBg: 'bg-orange-100 dark:bg-orange-900/30',
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

  // Get day of week (1=Mon, 2=Tue, ..., 7=Sun) for resource lookup
  const getDayOfWeek = (dayIndex: number): number => {
    const date = dayIndexToDate(effectiveStartDate, dayIndex, includeWeekends);
    const jsDay = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    return jsDay === 0 ? 7 : jsDay; // Convert to 1=Mon, ..., 7=Sun
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

  // Get stored week for a calendar week
  const getStoredWeek = (cw: CalendarWeek): ProgramWeek | undefined => {
    const directMatch = weeks.find(w => w.weekNumber === cw.weekNumber);
    if (directMatch) return directMatch;

    const firstDay = cw.startDayIndex;
    return weeks.find(w =>
      w.startDayIndex !== undefined &&
      w.endDayIndex !== undefined &&
      firstDay >= w.startDayIndex &&
      firstDay <= w.endDayIndex
    );
  };

  // Get days for a calendar week
  const getWeekDays = (cw: CalendarWeek) => {
    return Array.from({ length: cw.endDayIndex - cw.startDayIndex + 1 }, (_, i) => {
      const dayIndex = cw.startDayIndex + i;
      const dayData = days.find(d => d.dayIndex === dayIndex);
      const dayOfWeek = getDayOfWeek(dayIndex);
      const storedWeek = getStoredWeek(cw);

      // Get resources for this day from week's resourceAssignments
      const dayResources = storedWeek ? getResourcesForDay(storedWeek, dayOfWeek) : [];

      return {
        dayIndex,
        data: dayData,
        dayOfWeek,
        resources: dayResources,
        hasContent: dayData && ((dayData.tasks?.length || 0) > 0 || dayResources.length > 0),
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

  // Handle day click - open preview popup (don't notify parent to stay on calendar view)
  const handleDayClick = (dayIndex: number) => {
    setPreviewDayIndex(dayIndex);
    // Note: We intentionally don't call onDayClick here to stay on calendar view
    // The preview popup handles showing day content
  };

  // Close preview popup
  const handleClosePreview = () => {
    setPreviewDayIndex(null);
  };

  // Get preview data for DayPreviewPopup
  const getPreviewData = () => {
    if (previewDayIndex === null) return null;

    const dayData = days.find(d => d.dayIndex === previewDayIndex);

    // Find which calendar week contains this day
    const calendarWeek = calendarWeeks.find(cw =>
      previewDayIndex >= cw.startDayIndex && previewDayIndex <= cw.endDayIndex
    );

    const storedWeek = calendarWeek ? getStoredWeek(calendarWeek) : undefined;
    const dayOfWeek = getDayOfWeek(previewDayIndex);
    const dayNumberInWeek = calendarWeek ? previewDayIndex - calendarWeek.startDayIndex + 1 : 1;
    const calendarDate = format(dayIndexToDate(effectiveStartDate, previewDayIndex, includeWeekends), 'yyyy-MM-dd');

    // Calculate global day offset for display
    const globalDayOffset = calendarWeek ? calendarWeek.startDayIndex - 1 : 0;

    return {
      dayNumber: dayNumberInWeek,
      day: dayData || null,
      weekNumber: calendarWeek?.weekNumber || 1,
      week: storedWeek,
      dayOfWeek,
      calendarDate,
      globalDayOffset,
    };
  };

  // Build courses lookup for DayPreviewPopup
  const coursesLookup = useMemo(() => {
    const lookup: Record<string, DiscoverCourse> = {};
    courses.forEach(c => {
      lookup[c.id] = c;
    });
    return lookup;
  }, [courses]);

  // Convert task completions to simple boolean map for DayPreviewPopup
  const taskCompletionsMap = useMemo(() => {
    if (!taskCompletions) return undefined;
    const map = new Map<string, boolean>();
    taskCompletions.forEach((value, key) => {
      map.set(key, value.completed);
    });
    return map;
  }, [taskCompletions]);

  // Render day cells for a calendar week - Desktop
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
        const colors = statusColors[status];
        const dayDate = dayIndexToDate(effectiveStartDate, day.dayIndex, includeWeekends);
        const dayName = format(dayDate, 'EEE'); // Mon, Tue, etc.

        // Get content for preview
        const tasks = day.data?.tasks || [];
        const courseResources = day.resources.filter(r => r.resourceType === 'course');
        const articleResources = day.resources.filter(r => r.resourceType === 'article');
        const downloadResources = day.resources.filter(r => r.resourceType === 'download');
        const linkResources = day.resources.filter(r => r.resourceType === 'link');
        const questionnaireResources = day.resources.filter(r => r.resourceType === 'questionnaire');
        const videoResources = day.resources.filter(r => r.resourceType === 'video');

        cells.push(
          <div
            key={day.dayIndex}
            className={`min-h-[120px] ${colors.bg} rounded-xl border ${colors.border} p-3 flex flex-col transition-all cursor-pointer hover:ring-2 hover:ring-brand-accent/30 hover:shadow-sm`}
            onClick={() => handleDayClick(day.dayIndex)}
          >
            {/* Day Header - Centered like mobile */}
            <div className="text-center mb-2">
              {/* Day name (Mon, Tue, etc.) */}
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${colors.textMuted}`}>
                {dayName}
              </div>

              {/* Large day number */}
              <div className={`text-2xl font-bold leading-none ${colors.text}`}>
                {day.dayIndex}
              </div>

              {/* Date below (client view only) */}
              {viewMode === 'client' && (
                <div className={`text-[10px] mt-0.5 ${colors.textMuted}`}>
                  {format(dayDate, 'MMM d')}
                </div>
              )}
            </div>

            {/* Content Preview */}
            <div className="flex-1 space-y-1.5 min-h-0">
              {/* Task Labels (up to 2) */}
              {tasks.slice(0, 2).map((task, idx) => (
                <div
                  key={task.id || idx}
                  className="text-[10px] text-[#5f5a55] dark:text-[#b2b6c2] truncate leading-tight"
                >
                  <span className="inline-block w-1 h-1 rounded-full bg-brand-accent mr-1 align-middle" />
                  {task.label}
                </div>
              ))}

              {/* +N more tasks */}
              {tasks.length > 2 && (
                <div className="text-[10px] text-[#a7a39e] dark:text-[#7d8190]">
                  +{tasks.length - 2} more
                </div>
              )}

              {/* Resource Icons */}
              {(courseResources.length > 0 || articleResources.length > 0 || downloadResources.length > 0 ||
                linkResources.length > 0 || questionnaireResources.length > 0 || videoResources.length > 0) && (
                <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
                  {(courseResources.length > 0 || videoResources.length > 0) && (
                    <div className="flex items-center gap-0.5 text-purple-600 dark:text-purple-400" title={`${courseResources.length + videoResources.length} courses/videos`}>
                      <GraduationCap className="w-3 h-3" />
                      {(courseResources.length + videoResources.length) > 1 && (
                        <span className="text-[9px]">{courseResources.length + videoResources.length}</span>
                      )}
                    </div>
                  )}
                  {articleResources.length > 0 && (
                    <div className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400" title={`${articleResources.length} articles`}>
                      <FileText className="w-3 h-3" />
                      {articleResources.length > 1 && (
                        <span className="text-[9px]">{articleResources.length}</span>
                      )}
                    </div>
                  )}
                  {downloadResources.length > 0 && (
                    <div className="flex items-center gap-0.5 text-green-600 dark:text-green-400" title={`${downloadResources.length} downloads`}>
                      <Download className="w-3 h-3" />
                      {downloadResources.length > 1 && (
                        <span className="text-[9px]">{downloadResources.length}</span>
                      )}
                    </div>
                  )}
                  {linkResources.length > 0 && (
                    <div className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400" title={`${linkResources.length} links`}>
                      <Link2 className="w-3 h-3" />
                      {linkResources.length > 1 && (
                        <span className="text-[9px]">{linkResources.length}</span>
                      )}
                    </div>
                  )}
                  {questionnaireResources.length > 0 && (
                    <div className="flex items-center gap-0.5 text-pink-600 dark:text-pink-400" title={`${questionnaireResources.length} forms`}>
                      <ClipboardList className="w-3 h-3" />
                      {questionnaireResources.length > 1 && (
                        <span className="text-[9px]">{questionnaireResources.length}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Empty State */}
            {!day.hasContent && tasks.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <Plus className="w-4 h-4 text-[#c4c0bb] dark:text-[#4a4f5a]" />
              </div>
            )}
          </div>
        );
      } else {
        // Empty cell for days not in this week
        cells.push(
          <div
            key={`empty-${cw.weekNumber}-${col}`}
            className="min-h-[120px] bg-[#f3f1ef]/30 dark:bg-[#171b22]/30 rounded-xl border border-dashed border-[#e1ddd8] dark:border-[#262b35]"
          />
        );
      }
    }

    return cells;
  };

  // Mobile-optimized day cells - horizontal scroll with larger touch targets
  const renderMobileDayCells = (cw: CalendarWeek, moduleColor: typeof moduleColors[0]) => {
    const weekDays = getWeekDays(cw);

    return weekDays.map(day => {
      const status = getDayStatus(day.dayIndex);
      const colors = statusColors[status];
      const dayDate = dayIndexToDate(effectiveStartDate, day.dayIndex, includeWeekends);
      const dayName = format(dayDate, 'EEE'); // Mon, Tue, etc.

      // Get content indicators
      const tasks = day.data?.tasks || [];
      const hasResources = day.resources.length > 0;
      const hasContent = tasks.length > 0 || hasResources;

      return (
        <div
          key={day.dayIndex}
          onClick={() => handleDayClick(day.dayIndex)}
          className={`flex-shrink-0 w-[72px] snap-start ${colors.bg} rounded-xl border-2 ${colors.border} p-2 transition-all cursor-pointer active:scale-95 ${
            status === 'active' ? 'ring-2 ring-emerald-400/50' : ''
          }`}
        >
          {/* Day name (Mon, Tue, etc.) */}
          <div className={`text-[10px] font-semibold uppercase tracking-wider text-center mb-0.5 ${colors.textMuted}`}>
            {dayName}
          </div>

          {/* Day number - large and centered */}
          <div className={`text-2xl font-bold text-center leading-none ${colors.text}`}>
            {day.dayIndex}
          </div>

          {/* Date below (client view only) */}
          <div className={`text-[10px] text-center mt-0.5 ${colors.textMuted}`}>
            {viewMode === 'client' ? format(dayDate, 'MMM d') : ''}
          </div>

          {/* Content indicators */}
          <div className="flex items-center justify-center gap-1 mt-2">
            {tasks.length > 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-brand-accent" title={`${tasks.length} tasks`} />
            )}
            {hasResources && (
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Resources" />
            )}
            {!hasContent && (
              <Plus className="w-3 h-3 text-[#c4c0bb] dark:text-[#4a4f5a]" />
            )}
          </div>
        </div>
      );
    });
  };

  const previewData = getPreviewData();

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
                <motion.div
                  animate={{ rotate: isCollapsed ? 0 : 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                </motion.div>
              </button>

              {/* Module Weeks - Animated */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 space-y-6 bg-white dark:bg-[#171b22]">
                      {moduleCalendarWeeks.length === 0 ? (
                        <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] text-center py-4 font-albert">
                          No weeks in this module
                        </p>
                      ) : (
                        moduleCalendarWeeks.map((cw) => {
                          const weekTheme = getWeekTheme(cw);
                          return (
                            <div key={`${cw.type}-${cw.weekNumber}`} className="space-y-3">
                              {/* Week Header - Enhanced with theme badge */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 pb-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                                    {cw.label}
                                  </span>
                                  {weekTheme && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent font-medium">
                                      {weekTheme}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                                  Days {cw.startDayIndex}–{cw.endDayIndex}
                                </span>
                              </div>

                              {/* Week Grid - Desktop */}
                              <div className={`hidden sm:grid gap-2 ${gridCols === 5 ? 'grid-cols-5' : 'grid-cols-7'}`}>
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

                              {/* Week Grid - Mobile: Horizontal scroll */}
                              <div className="sm:hidden -mx-3 px-3">
                                <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                                  {renderMobileDayCells(cw, moduleColor)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
            <GraduationCap className="w-2 h-2 text-purple-600 dark:text-purple-400" />
          </div>
          <span>Course</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <FileText className="w-2 h-2 text-blue-600 dark:text-blue-400" />
          </div>
          <span>Article</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Download className="w-2 h-2 text-green-600 dark:text-green-400" />
          </div>
          <span>Download</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
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
              <div className="w-3 h-3 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700" />
              <span>Today</span>
            </div>
          </>
        )}
      </div>

      {/* Day Preview Popup */}
      {previewData && (
        <DayPreviewPopup
          isOpen={previewDayIndex !== null}
          onClose={handleClosePreview}
          dayNumber={previewData.dayNumber}
          day={previewData.day}
          weekNumber={previewData.weekNumber}
          week={previewData.week}
          dayOfWeek={previewData.dayOfWeek}
          calendarDate={previewData.calendarDate}
          globalDayOffset={previewData.globalDayOffset}
          courses={coursesLookup}
          articles={articles}
          events={events}
          taskCompletions={taskCompletionsMap}
        />
      )}
    </div>
  );
}
