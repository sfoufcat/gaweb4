"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  onTodayClick?: () => void;
  showTodayButton?: boolean;
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  onTodayClick,
  showTodayButton = false,
  ...props
}: CalendarProps) {
  return (
    <div className="flex flex-col">
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("p-4", className)}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center px-8",
          caption_label: "text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            "h-8 w-8 bg-transparent p-0 rounded-lg border border-[#e1ddd8] dark:border-[#3a4150] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors flex items-center justify-center"
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse",
          head_row: "flex",
          head_cell:
            "text-[#8a8580] dark:text-[#6b7280] rounded-md w-10 font-medium text-xs uppercase tracking-wide",
          row: "flex w-full mt-1",
          cell: cn(
            "h-10 w-10 text-center text-sm p-0 relative",
            "[&:has([aria-selected].day-range-end)]:rounded-r-xl",
            "[&:has([aria-selected].day-outside)]:bg-brand-accent/10",
            "[&:has([aria-selected])]:bg-brand-accent/10",
            "first:[&:has([aria-selected])]:rounded-l-xl",
            "last:[&:has([aria-selected])]:rounded-r-xl",
            "focus-within:relative focus-within:z-20"
          ),
          day: cn(
            "h-10 w-10 p-0 font-normal rounded-xl transition-all duration-150",
            "text-[#1a1a1a] dark:text-[#f5f5f8]",
            "hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d]",
            "focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 dark:focus:ring-offset-[#11141b]",
            "aria-selected:opacity-100"
          ),
          day_range_end: "day-range-end",
          day_selected: cn(
            "bg-brand-accent text-white",
            "hover:bg-brand-accent hover:text-white",
            "focus:bg-brand-accent focus:text-white",
            "font-semibold"
          ),
          day_today: cn(
            "bg-[#f5f3f0] dark:bg-[#1f242d]",
            "text-brand-accent font-semibold",
            "ring-1 ring-brand-accent/30"
          ),
          day_outside: cn(
            "day-outside text-[#c4c0bb] dark:text-[#4a5162]",
            "aria-selected:bg-brand-accent/30 aria-selected:text-white/70"
          ),
          day_disabled: "text-[#d1cdc8] dark:text-[#3a4150] cursor-not-allowed",
          day_range_middle:
            "aria-selected:bg-brand-accent/10 aria-selected:text-[#1a1a1a] dark:aria-selected:text-[#f5f5f8]",
          day_hidden: "invisible",
          ...classNames,
        }}
        components={{
          IconLeft: () => <ChevronLeft className="h-4 w-4" />,
          IconRight: () => <ChevronRight className="h-4 w-4" />,
        } as Record<string, unknown>}
        {...props}
      />
      {showTodayButton && (
        <div className="px-4 pb-3 pt-1 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <button
            type="button"
            onClick={onTodayClick}
            className="w-full py-2 text-sm font-medium text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors font-albert"
          >
            Today
          </button>
        </div>
      )}
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

