"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"

export interface TimePickerProps {
  /** The selected time value (HH:mm format) */
  value?: string
  /** Called when the time changes */
  onChange?: (time: string) => void
  /** Placeholder text when no time is selected */
  placeholder?: string
  /** Disable the picker */
  disabled?: boolean
  /** Additional class names for the trigger button */
  className?: string
  /** z-index class for the dialog (use when inside other modals) */
  zIndex?: string
  /** Position of the clock icon */
  iconPosition?: 'left' | 'right' | 'none'
}

// Generate hours (0-23)
const HOURS = Array.from({ length: 24 }, (_, i) => i)
// Generate minutes (0, 5, 10, ... 55)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

/**
 * A beautiful, modal-based time picker component.
 * Features scrollable hour/minute selection matching DatePicker style.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "Time",
  disabled = false,
  className,
  zIndex,
  iconPosition = 'right',
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parse current value
  const [selectedHour, selectedMinute] = React.useMemo(() => {
    if (!value) return [12, 0]
    const [h, m] = value.split(':').map(Number)
    return [h ?? 12, m ?? 0]
  }, [value])

  // Local state for selection before confirming
  const [tempHour, setTempHour] = React.useState(selectedHour)
  const [tempMinute, setTempMinute] = React.useState(selectedMinute)

  // Refs for scroll containers
  const hourRef = React.useRef<HTMLDivElement>(null)
  const minuteRef = React.useRef<HTMLDivElement>(null)

  // Reset temp values when opening
  React.useEffect(() => {
    if (open) {
      setTempHour(selectedHour)
      setTempMinute(selectedMinute)
      // Scroll to selected values
      setTimeout(() => {
        if (hourRef.current) {
          const hourElement = hourRef.current.querySelector(`[data-hour="${selectedHour}"]`) as HTMLElement
          if (hourElement) {
            hourRef.current.scrollTop = hourElement.offsetTop - hourRef.current.clientHeight / 2 + hourElement.clientHeight / 2
          }
        }
        if (minuteRef.current) {
          const minuteElement = minuteRef.current.querySelector(`[data-minute="${selectedMinute}"]`) as HTMLElement
          if (minuteElement) {
            minuteRef.current.scrollTop = minuteElement.offsetTop - minuteRef.current.clientHeight / 2 + minuteElement.clientHeight / 2
          }
        }
      }, 50)
    }
  }, [open, selectedHour, selectedMinute])

  // Handle confirm
  const handleConfirm = () => {
    const h = String(tempHour).padStart(2, '0')
    const m = String(tempMinute).padStart(2, '0')
    onChange?.(`${h}:${m}`)
    setOpen(false)
  }

  // Format display time (12-hour format)
  const displayTime = React.useMemo(() => {
    if (!value) return null
    const [h, m] = value.split(':').map(Number)
    const hour12 = h % 12 || 12
    const ampm = h < 12 ? 'AM' : 'PM'
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
  }, [value])

  // Format temp time for preview
  const tempDisplayTime = React.useMemo(() => {
    const hour12 = tempHour % 12 || 12
    const ampm = tempHour < 12 ? 'AM' : 'PM'
    return `${hour12}:${String(tempMinute).padStart(2, '0')} ${ampm}`
  }, [tempHour, tempMinute])

  return (
    <>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "w-full justify-between text-left font-normal h-10 px-3",
          "border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b]",
          "rounded-lg hover:bg-[#faf8f6] dark:hover:bg-[#1c2028]",
          "focus:ring-2 focus:ring-brand-accent focus:ring-offset-0",
          "transition-all duration-200",
          !value && "text-[#a7a39e] dark:text-[#5f6470]",
          value && "text-[#1a1a1a] dark:text-[#f5f5f8]",
          disabled && "opacity-50 cursor-not-allowed",
          iconPosition === 'left' && "flex-row-reverse justify-end gap-2",
          className
        )}
      >
        <span className="font-albert text-sm">
          {displayTime || placeholder}
        </span>
        {iconPosition !== 'none' && (
          <Clock className="h-4 w-4 text-current flex-shrink-0" />
        )}
      </Button>

      {/* Time Picker Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[300px] p-0 gap-0 rounded-2xl overflow-hidden border-[#e1ddd8] dark:border-[#262b35]"
          hideCloseButton
          zIndex={zIndex}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Select a time</DialogTitle>
          </VisuallyHidden.Root>

          {/* Header with current selection */}
          <div className="px-4 py-4 border-b border-[#e8e4df] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
            <div className="text-center">
              <span className="font-albert text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                {tempDisplayTime}
              </span>
            </div>
          </div>

          {/* Time Selection */}
          <div className="flex bg-white dark:bg-[#171b22]">
            {/* Hours Column */}
            <div
              ref={hourRef}
              className="flex-1 h-[200px] overflow-y-auto border-r border-[#e8e4df] dark:border-[#262b35]"
            >
              {HOURS.map((hour) => {
                const isSelected = tempHour === hour
                const hour12 = hour % 12 || 12
                const ampm = hour < 12 ? 'AM' : 'PM'
                return (
                  <button
                    key={hour}
                    type="button"
                    data-hour={hour}
                    onClick={() => setTempHour(hour)}
                    className={cn(
                      "w-full py-3 px-4 text-center transition-all duration-150",
                      "focus:outline-none focus:bg-[#f5f3f0] dark:focus:bg-[#1f242d]",
                      isSelected && [
                        "bg-brand-accent text-white font-semibold",
                      ],
                      !isSelected && [
                        "text-[#1a1a1a] dark:text-[#f5f5f8]",
                        "hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d]",
                      ]
                    )}
                  >
                    <span className="font-albert text-[15px]">
                      {hour12} {ampm}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Minutes Column */}
            <div
              ref={minuteRef}
              className="flex-1 h-[200px] overflow-y-auto"
            >
              {MINUTES.map((minute) => {
                const isSelected = tempMinute === minute
                return (
                  <button
                    key={minute}
                    type="button"
                    data-minute={minute}
                    onClick={() => setTempMinute(minute)}
                    className={cn(
                      "w-full py-3 px-4 text-center transition-all duration-150",
                      "focus:outline-none focus:bg-[#f5f3f0] dark:focus:bg-[#1f242d]",
                      isSelected && [
                        "bg-brand-accent text-white font-semibold",
                      ],
                      !isSelected && [
                        "text-[#1a1a1a] dark:text-[#f5f5f8]",
                        "hover:bg-[#f5f3f0] dark:hover:bg-[#1f242d]",
                      ]
                    )}
                  >
                    <span className="font-albert text-[15px]">
                      :{String(minute).padStart(2, '0')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Footer with confirm button */}
          <div className="px-4 py-3 border-t border-[#e8e4df] dark:border-[#262b35]">
            <button
              type="button"
              onClick={handleConfirm}
              className={cn(
                "w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                "bg-brand-accent text-white",
                "hover:opacity-90",
                "active:scale-[0.98]",
                "focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2"
              )}
            >
              Confirm
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
