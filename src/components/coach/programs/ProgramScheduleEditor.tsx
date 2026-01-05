'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Video, BookOpen, ChevronLeft, ChevronRight, CalendarDays, Clock, Edit2 } from 'lucide-react';
import type { Program, ProgramDay } from '@/types';
import type { DiscoverCourse } from '@/types/discover';

interface ProgramScheduleEditorProps {
  program: Program;
  days: ProgramDay[];
  courses: DiscoverCourse[];
  onDayClick: (dayIndex: number) => void;
  onAddCall: (dayIndex: number) => void;
}

export function ProgramScheduleEditor({
  program,
  days,
  courses,
  onDayClick,
  onAddCall,
}: ProgramScheduleEditorProps) {
  const [currentWeek, setCurrentWeek] = useState(1);

  // Calculate weeks based on program length
  const includeWeekends = program.includeWeekends !== false;
  const daysPerWeek = includeWeekends ? 7 : 5;
  const totalWeeks = Math.ceil((program.lengthDays || 30) / daysPerWeek);

  // Get days for current week
  const weekDays = useMemo(() => {
    const startDay = (currentWeek - 1) * daysPerWeek + 1;
    const endDay = Math.min(startDay + daysPerWeek - 1, program.lengthDays || 30);

    return Array.from({ length: endDay - startDay + 1 }, (_, i) => {
      const dayIndex = startDay + i;
      const dayData = days.find(d => d.dayIndex === dayIndex);
      return {
        dayIndex,
        data: dayData,
        hasContent: dayData && ((dayData.tasks?.length || 0) > 0 || (dayData.courseAssignments?.length || 0) > 0),
      };
    });
  }, [currentWeek, daysPerWeek, program.lengthDays, days]);

  // Get course by ID
  const getCourse = (courseId: string) => courses.find(c => c.id === courseId);

  // Day name for header
  const getDayName = (dayOfWeek: number) => {
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return names[dayOfWeek % 7];
  };

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Program Schedule
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
            disabled={currentWeek === 1}
            className="p-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
          <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert min-w-[100px] text-center">
            Week {currentWeek} of {totalWeeks}
          </span>
          <button
            onClick={() => setCurrentWeek(Math.min(totalWeeks, currentWeek + 1))}
            disabled={currentWeek === totalWeeks}
            className="p-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {Array.from({ length: Math.min(7, weekDays.length) }, (_, i) => (
          <div
            key={`header-${i}`}
            className="text-center text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] pb-2 font-albert"
          >
            {getDayName(i)}
          </div>
        ))}

        {/* Day Cells */}
        {weekDays.map(({ dayIndex, data, hasContent }) => (
          <div
            key={dayIndex}
            className="min-h-[140px] bg-[#faf8f6] dark:bg-[#1d222b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-2 space-y-1.5"
          >
            {/* Day Number Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Day {dayIndex}
              </span>
              <button
                onClick={() => onDayClick(dayIndex)}
                className="p-1 rounded hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent transition-colors"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>

            {/* Day Content */}
            {data?.title && (
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate font-albert">
                {data.title}
              </p>
            )}

            {/* Tasks Count */}
            {data?.tasks && data.tasks.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-[#a7a39e] dark:text-[#7d8190]">
                <CalendarDays className="w-3 h-3" />
                <span>{data.tasks.length} task{data.tasks.length > 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Course Assignments */}
            {data?.courseAssignments && data.courseAssignments.length > 0 && (
              <div className="space-y-1">
                {data.courseAssignments.slice(0, 2).map((assignment, idx) => {
                  const course = getCourse(assignment.courseId);
                  return course ? (
                    <div
                      key={idx}
                      className="flex items-center gap-1 p-1 bg-blue-50 dark:bg-blue-900/20 rounded text-xs"
                    >
                      <BookOpen className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span className="truncate text-blue-700 dark:text-blue-300">
                        {course.title}
                      </span>
                    </div>
                  ) : null;
                })}
                {data.courseAssignments.length > 2 && (
                  <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                    +{data.courseAssignments.length - 2} more
                  </span>
                )}
              </div>
            )}

            {/* Add Actions */}
            <div className="flex gap-1 mt-auto pt-1">
              <button
                onClick={() => onAddCall(dayIndex)}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                title="Schedule call"
              >
                <Video className="w-3 h-3" />
                <span>Call</span>
              </button>
              <button
                onClick={() => onDayClick(dayIndex)}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                title="Add course"
              >
                <BookOpen className="w-3 h-3" />
                <span>Course</span>
              </button>
            </div>

            {/* Empty State */}
            {!hasContent && !data?.title && (
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={() => onDayClick(dayIndex)}
                  className="text-xs text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent transition-colors font-albert"
                >
                  <Plus className="w-4 h-4 mx-auto mb-1" />
                  Add content
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Fill remaining cells for incomplete weeks */}
        {weekDays.length < 7 &&
          Array.from({ length: 7 - weekDays.length }, (_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[140px] bg-[#f3f1ef]/50 dark:bg-[#171b22]/50 rounded-xl border border-dashed border-[#e1ddd8] dark:border-[#262b35]"
            />
          ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
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
