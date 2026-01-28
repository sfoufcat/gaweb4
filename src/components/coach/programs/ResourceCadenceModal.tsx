'use client';

import { useMemo } from 'react';
import {
  Calendar,
  CalendarPlus,
  BookOpen,
  Check,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import type { ResourceDayTag } from '@/types';

interface CourseInfo {
  totalLessons: number;
  title?: string;
}

interface ResourceCadenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ResourceDayTag;
  onChange: (value: ResourceDayTag) => void;
  includeWeekends?: boolean;
  courseInfo?: CourseInfo;
  calendarStartDate?: string;
  resourceType?: 'course' | 'article' | 'download' | 'link' | 'questionnaire' | 'video';
}

// Helper to get display label for current value
export function getResourceCadenceLabel(value: ResourceDayTag, calendarStartDate?: string): string {
  if (value === 'week') return 'Week-level';
  if (value === 'daily') return 'Daily';
  if (value === 'spread') return 'Auto-spread';
  if (typeof value === 'number') {
    if (calendarStartDate) {
      const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const [year, month, dayOfMonth] = calendarStartDate.split('-').map(Number);
      const dayDate = new Date(year, month - 1, dayOfMonth + value - 1);
      return WEEKDAYS[dayDate.getDay()];
    }
    return `Day ${value}`;
  }
  if (Array.isArray(value)) {
    if (calendarStartDate) {
      const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const [year, month, dayOfMonth] = calendarStartDate.split('-').map(Number);
      return value.map(v => {
        const dayDate = new Date(year, month - 1, dayOfMonth + v - 1);
        return WEEKDAYS[dayDate.getDay()];
      }).join(', ');
    }
    return value.map(v => `Day ${v}`).join(', ');
  }
  return 'Week-level';
}

export function ResourceCadenceModal({
  open,
  onOpenChange,
  value,
  onChange,
  includeWeekends = true,
  courseInfo,
  calendarStartDate,
  resourceType,
}: ResourceCadenceModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const daysInWeek = includeWeekends ? 7 : 5;
  const isCourse = resourceType === 'course';

  // Calculate spread info for multi-day selection or auto-spread
  const spreadInfo = useMemo(() => {
    if (!courseInfo?.totalLessons || courseInfo.totalLessons === 0) return null;

    // For auto-spread, use all weekdays
    if (value === 'spread') {
      const lessonsPerDay = Math.ceil(courseInfo.totalLessons / daysInWeek);
      return {
        totalLessons: courseInfo.totalLessons,
        selectedDays: daysInWeek,
        lessonsPerDay,
      };
    }

    // For specific days array
    if (!Array.isArray(value) || value.length < 2) return null;

    const lessonsPerDay = Math.ceil(courseInfo.totalLessons / value.length);
    return {
      totalLessons: courseInfo.totalLessons,
      selectedDays: value.length,
      lessonsPerDay,
    };
  }, [courseInfo, value, daysInWeek]);

  const content = (
    <div className="space-y-3 pt-2">
      {/* Week-level option */}
      <button
        type="button"
        onClick={() => { onChange('week'); onOpenChange(false); }}
        className={cn(
          "w-full p-4 text-left rounded-xl transition-all flex items-center gap-4 border",
          value === 'week'
            ? "bg-brand-accent/10 border-brand-accent"
            : "bg-white dark:bg-[#1e222a] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc6] dark:hover:border-[#3a4150]"
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
          value === 'week' ? "bg-brand-accent/15" : "bg-[#f5f3f0] dark:bg-[#262b35]"
        )}>
          <Calendar className={cn("w-5 h-5", value === 'week' ? "text-brand-accent" : "text-[#5f5a55] dark:text-[#9ca3af]")} />
        </div>
        <div className="flex-1 min-w-0">
          <span className={cn("text-sm font-semibold block", value === 'week' ? "text-brand-accent" : "text-[#1a1a1a] dark:text-[#f5f5f8]")}>
            Week-level
          </span>
          <p className="text-xs text-[#6b6560] dark:text-[#9ca3af] mt-0.5">Available throughout the week</p>
        </div>
        {value === 'week' && <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />}
      </button>

      {/* Auto-spread option - only for courses */}
      {isCourse && (
        <button
          type="button"
          onClick={() => { onChange('spread'); onOpenChange(false); }}
          className={cn(
            "w-full p-4 text-left rounded-xl transition-all flex items-center gap-4 border",
            value === 'spread'
              ? "bg-brand-accent/10 border-brand-accent"
              : "bg-white dark:bg-[#1e222a] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc6] dark:hover:border-[#3a4150]"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
            value === 'spread' ? "bg-brand-accent/15" : "bg-[#f5f3f0] dark:bg-[#262b35]"
          )}>
            <BookOpen className={cn("w-5 h-5", value === 'spread' ? "text-brand-accent" : "text-[#5f5a55] dark:text-[#9ca3af]")} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={cn("text-sm font-semibold block", value === 'spread' ? "text-brand-accent" : "text-[#1a1a1a] dark:text-[#f5f5f8]")}>
              Auto-spread
            </span>
            <p className="text-xs text-[#6b6560] dark:text-[#9ca3af] mt-0.5">
              Lessons evenly distributed across all {daysInWeek} days
            </p>
          </div>
          {value === 'spread' && <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />}
        </button>
      )}

      {/* Daily option - hidden for courses (use auto-spread instead) */}
      {!isCourse && (
        <button
          type="button"
          onClick={() => { onChange('daily'); onOpenChange(false); }}
          className={cn(
            "w-full p-4 text-left rounded-xl transition-all flex items-center gap-4 border",
            value === 'daily'
              ? "bg-brand-accent/10 border-brand-accent"
              : "bg-white dark:bg-[#1e222a] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc6] dark:hover:border-[#3a4150]"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
            value === 'daily' ? "bg-brand-accent/15" : "bg-[#f5f3f0] dark:bg-[#262b35]"
          )}>
            <CalendarPlus className={cn("w-5 h-5", value === 'daily' ? "text-brand-accent" : "text-[#5f5a55] dark:text-[#9ca3af]")} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={cn("text-sm font-semibold block", value === 'daily' ? "text-brand-accent" : "text-[#1a1a1a] dark:text-[#f5f5f8]")}>
              Daily
            </span>
            <p className="text-xs text-[#6b6560] dark:text-[#9ca3af] mt-0.5">Available every day of the week</p>
          </div>
          {value === 'daily' && <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />}
        </button>
      )}

      {/* Specific day section - multi-select toggle */}
      <div className="pt-3 mt-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
        <p className="text-xs font-semibold text-[#3d3a36] dark:text-[#d1d5db] mb-3">Or pick specific days</p>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: daysInWeek }, (_, i) => {
            const dayNum = i + 1;
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
            // Support both single number and array of numbers
            const isSelected = Array.isArray(value)
              ? value.includes(dayNum)
              : value === dayNum;
            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => {
                  // Toggle day in/out of selection (multi-select mode)
                  let newDayTag: ResourceDayTag;
                  if (Array.isArray(value)) {
                    if (value.includes(dayNum)) {
                      // Remove day from array
                      const filtered = value.filter(d => d !== dayNum);
                      newDayTag = filtered.length === 1 ? filtered[0] : filtered.length === 0 ? 'week' : filtered;
                    } else {
                      // Add day to array
                      newDayTag = [...value, dayNum].sort((a, b) => a - b);
                    }
                  } else if (typeof value === 'number') {
                    if (value === dayNum) {
                      // Deselect single day → back to week
                      newDayTag = 'week';
                    } else {
                      // Add second day → create array
                      newDayTag = [value, dayNum].sort((a, b) => a - b);
                    }
                  } else {
                    // Was week/daily, select single day
                    newDayTag = dayNum;
                  }
                  onChange(newDayTag);
                  // Don't close modal - allow multiple selections
                }}
                className={cn(
                  "aspect-square rounded-xl text-sm font-medium transition-all flex flex-col items-center justify-center border",
                  isSelected
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

        {/* Spread info for multi-day courses (specific days selection) */}
        {spreadInfo && Array.isArray(value) && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {spreadInfo.totalLessons} lessons will be spread across {spreadInfo.selectedDays} days (~{spreadInfo.lessonsPerDay} per day)
            </p>
          </div>
        )}
      </div>

      {/* Auto-spread info - shown when spread is selected */}
      {isCourse && value === 'spread' && spreadInfo && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {spreadInfo.totalLessons} lessons will be spread across {spreadInfo.selectedDays} days (~{spreadInfo.lessonsPerDay} per day)
          </p>
        </div>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resource Cadence</DialogTitle>
            <DialogDescription>Choose when this resource should appear</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 pb-4">
          <DrawerTitle>Resource Cadence</DrawerTitle>
          <DrawerDescription>Choose when this resource should appear</DrawerDescription>
        </DrawerHeader>
        <div className="p-4">
          {content}
        </div>
        {/* Safe area padding for mobile */}
        <div className="h-safe-area-inset-bottom" />
      </DrawerContent>
    </Drawer>
  );
}
