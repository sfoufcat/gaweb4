"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isBefore, isAfter, startOfDay } from "date-fns"

import { cn } from "@/lib/utils"

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type CalendarProps = {
  mode?: "single"
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  onTodayClick?: () => void
  showTodayButton?: boolean
  disabled?: (date: Date) => boolean
  fromDate?: Date
  toDate?: Date
  initialFocus?: boolean
  className?: string
}

function Calendar({
  className,
  selected,
  onSelect,
  onTodayClick,
  showTodayButton = false,
  disabled,
  fromDate,
  toDate,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (selected) {
      return selected
    }
    return new Date()
  })

  // Update current month when selected changes
  React.useEffect(() => {
    if (selected) {
      setCurrentMonth(selected)
    }
  }, [selected])

  // Get all days for the calendar grid
  const calendarDays = React.useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })

    // Add padding days from previous month
    const startDay = start.getDay()
    const paddingBefore: (Date | null)[] = Array(startDay).fill(null)

    // Add padding days after to complete the grid
    const totalCells = Math.ceil((days.length + startDay) / 7) * 7
    const paddingAfter: (Date | null)[] = Array(totalCells - days.length - startDay).fill(null)

    return [...paddingBefore, ...days, ...paddingAfter]
  }, [currentMonth])

  // Check if a date is disabled
  const isDateDisabled = (date: Date) => {
    if (disabled && disabled(date)) return true
    if (fromDate && isBefore(startOfDay(date), startOfDay(fromDate))) return true
    if (toDate && isAfter(startOfDay(date), startOfDay(toDate))) return true
    return false
  }

  // Handle date selection
  const handleSelect = (date: Date) => {
    if (isDateDisabled(date)) return
    if (onSelect) {
      onSelect(date)
    }
  }

  // Navigate months
  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))

  return (
    <div className={cn("flex flex-col w-[320px]", className)}>
      {/* Header with month/year and navigation */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e4df] dark:border-[#262b35]">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="p-2.5 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d] transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </button>

        <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {format(currentMonth, "MMMM yyyy")}
        </h2>

        <button
          type="button"
          onClick={goToNextMonth}
          className="p-2.5 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d] transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="h-10 flex items-center justify-center text-xs font-medium text-[#8a8580] dark:text-[#6b7280] tracking-wide"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="h-10 w-10" />
            }

            const isSelected = selected && isSameDay(day, selected)
            const isCurrentDay = isToday(day)
            const isDisabledDay = isDateDisabled(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleSelect(day)}
                disabled={isDisabledDay}
                className={cn(
                  "h-10 w-10 rounded-full text-sm font-medium transition-all duration-150 flex items-center justify-center mx-auto",
                  "focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 dark:focus:ring-offset-[#171b22]",
                  // Base state
                  !isSelected && !isCurrentDay && isCurrentMonth && !isDisabledDay && [
                    "text-[#1a1a1a] dark:text-[#f5f5f8]",
                    "hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d]",
                  ],
                  // Outside current month (shouldn't happen but safety)
                  !isCurrentMonth && "text-[#d1cdc8] dark:text-[#3a4150]",
                  // Today (not selected)
                  isCurrentDay && !isSelected && [
                    "bg-[#f5f3f0] dark:bg-[#1f242d]",
                    "text-brand-accent font-semibold",
                    "ring-2 ring-inset ring-brand-accent/40",
                  ],
                  // Selected
                  isSelected && [
                    "bg-brand-accent text-white font-semibold",
                    "hover:bg-brand-accent/90",
                    "shadow-lg shadow-brand-accent/30",
                  ],
                  // Disabled
                  isDisabledDay && "text-[#d1cdc8] dark:text-[#3a4150] cursor-not-allowed hover:bg-transparent"
                )}
              >
                {format(day, "d")}
              </button>
            )
          })}
        </div>
      </div>

      {/* Today button */}
      {showTodayButton && (
        <div className="px-4 pb-4 pt-2 border-t border-[#e8e4df] dark:border-[#262b35]">
          <button
            type="button"
            onClick={onTodayClick}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 font-albert",
              "text-brand-accent",
              "hover:bg-brand-accent/10",
              "active:bg-brand-accent/20",
              "focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2"
            )}
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
