"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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
}

/**
 * A beautiful, app-native date picker component.
 * Wraps the Calendar component in a Popover with styled trigger.
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
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parse the value to a Date object
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined
    if (value instanceof Date) return value
    // Handle YYYY-MM-DD string format
    const parsed = new Date(value + "T00:00:00")
    return isNaN(parsed.getTime()) ? undefined : parsed
  }, [value])

  // Handle date selection
  const handleSelect = (date: Date | undefined) => {
    if (date && onChange) {
      // Convert to YYYY-MM-DD format
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      onChange(`${year}-${month}-${day}`)
    }
    setOpen(false)
  }

  // Handle today click
  const handleTodayClick = () => {
    const today = new Date()
    handleSelect(today)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal h-auto py-2.5 px-3",
            "border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b]",
            "rounded-xl hover:bg-[#faf8f6] dark:hover:bg-[#1c2028]",
            "focus:ring-2 focus:ring-brand-accent focus:ring-offset-0",
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
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] rounded-2xl shadow-xl"
        align="start"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(date) => {
            if (minDate && date < minDate) return true
            if (maxDate && date > maxDate) return true
            return false
          }}
          initialFocus
          showTodayButton
          onTodayClick={handleTodayClick}
        />
      </PopoverContent>
    </Popover>
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
