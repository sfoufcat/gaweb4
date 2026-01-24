"use client"

import * as React from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isBefore, isAfter, startOfDay } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"

export interface DatePickerProps {
  /** The selected date value (YYYY-MM-DD string or Date object) */
  value?: string | Date | null
  /** Called when the date changes */
  onChange?: (date: string) => void
  /** Placeholder text when no date is selected */
  placeholder?: string
  /** Minimum selectable date */
  minDate?: Date
  /** Maximum selectable date */
  maxDate?: Date
  /** Disable the picker */
  disabled?: boolean
  /** Additional class names for the trigger button */
  className?: string
  /** Format string for displaying the date */
  displayFormat?: string
  /** z-index class for the dialog (use when inside other modals) */
  zIndex?: string
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * A beautiful, modal-based date picker component.
 * Features a clean calendar design with smooth interactions.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  minDate,
  maxDate,
  disabled = false,
  className,
  displayFormat = "MMMM d, yyyy",
  zIndex,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (value) {
      const date = value instanceof Date ? value : new Date(value + "T00:00:00")
      return isNaN(date.getTime()) ? new Date() : date
    }
    return new Date()
  })

  // Parse the value to a Date object
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined
    if (value instanceof Date) return value
    const parsed = new Date(value + "T00:00:00")
    return isNaN(parsed.getTime()) ? undefined : parsed
  }, [value])

  // Update current month when value changes
  React.useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(selectedDate)
    }
  }, [selectedDate])

  // Get all days for the calendar grid
  const calendarDays = React.useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })

    // Add padding days from previous month
    const startDay = start.getDay()
    const paddingBefore: (Date | null)[] = Array(startDay).fill(null)

    // Add padding days after
    const totalCells = Math.ceil((days.length + startDay) / 7) * 7
    const paddingAfter: (Date | null)[] = Array(totalCells - days.length - startDay).fill(null)

    return [...paddingBefore, ...days, ...paddingAfter]
  }, [currentMonth])

  // Check if a date is disabled
  const isDateDisabled = (date: Date) => {
    if (minDate && isBefore(startOfDay(date), startOfDay(minDate))) return true
    if (maxDate && isAfter(startOfDay(date), startOfDay(maxDate))) return true
    return false
  }

  // Handle date selection
  const handleSelect = (date: Date) => {
    if (isDateDisabled(date)) return
    if (onChange) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      onChange(`${year}-${month}-${day}`)
    }
    setOpen(false)
  }

  // Navigate months
  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))
  const goToToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    handleSelect(today)
  }

  return (
    <>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "w-full justify-between text-left font-normal h-12 px-4",
          "border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b]",
          "rounded-xl hover:bg-[#faf8f6] dark:hover:bg-[#1c2028]",
          "focus:ring-2 focus:ring-brand-accent focus:ring-offset-0",
          "transition-all duration-200",
          !selectedDate && "text-[#a7a39e] dark:text-[#5f6470]",
          selectedDate && "text-[#1a1a1a] dark:text-[#f5f5f8]",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span className="font-albert text-sm">
          {selectedDate ? format(selectedDate, displayFormat) : placeholder}
        </span>
        <CalendarIcon className="h-4 w-4 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0" />
      </Button>

      {/* Calendar Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[340px] p-0 gap-0 rounded-2xl overflow-hidden border-[#e1ddd8] dark:border-[#262b35]"
          hideCloseButton
          zIndex={zIndex}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Select a date</DialogTitle>
          </VisuallyHidden.Root>

          {/* Header with month/year and navigation */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#e8e4df] dark:border-[#262b35]">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-2 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d] transition-colors"
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
              className="p-2 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d] transition-colors"
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
                  className="h-10 flex items-center justify-center text-xs font-medium text-[#8a8580] dark:text-[#6b7280] uppercase tracking-wide"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="h-10" />
                }

                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isCurrentDay = isToday(day)
                const isDisabled = isDateDisabled(day)
                const isCurrentMonth = isSameMonth(day, currentMonth)

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelect(day)}
                    disabled={isDisabled}
                    className={cn(
                      "h-10 w-full rounded-xl text-sm font-medium transition-all duration-150",
                      "focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 dark:focus:ring-offset-[#171b22]",
                      // Base state
                      !isSelected && !isCurrentDay && isCurrentMonth && !isDisabled && [
                        "text-[#1a1a1a] dark:text-[#f5f5f8]",
                        "hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d]",
                      ],
                      // Outside current month
                      !isCurrentMonth && "text-[#d1cdc8] dark:text-[#3a4150]",
                      // Today (not selected)
                      isCurrentDay && !isSelected && [
                        "bg-[#f5f3f0] dark:bg-[#1f242d]",
                        "text-brand-accent font-semibold",
                        "ring-1 ring-inset ring-brand-accent/30",
                      ],
                      // Selected
                      isSelected && [
                        "bg-brand-accent text-white font-semibold",
                        "hover:bg-brand-accent",
                        "shadow-md shadow-brand-accent/25",
                      ],
                      // Disabled
                      isDisabled && "text-[#d1cdc8] dark:text-[#3a4150] cursor-not-allowed hover:bg-transparent"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Footer with Today button */}
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={goToToday}
              className={cn(
                "w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                "text-brand-accent",
                "hover:bg-brand-accent/10",
                "active:bg-brand-accent/20",
                "focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2"
              )}
            >
              Today
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * A compact date picker variant for inline forms
 */
export function DatePickerCompact({
  value,
  onChange,
  placeholder = "Date",
  minDate,
  maxDate,
  disabled = false,
  className,
}: Omit<DatePickerProps, 'displayFormat'>) {
  return (
    <DatePicker
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      minDate={minDate}
      maxDate={maxDate}
      disabled={disabled}
      className={className}
      displayFormat="MMM d, yyyy"
    />
  )
}
