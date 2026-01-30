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
  value?: string
  onChange?: (time: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  zIndex?: string
  iconPosition?: 'left' | 'right' | 'none'
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

function WheelPicker({
  items,
  value,
  onChange,
  formatItem = (v) => String(v)
}: {
  items: number[]
  value: number
  onChange: (v: number) => void
  formatItem?: (v: number) => string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const itemHeight = 40

  // Scroll to value on mount and when value changes
  React.useEffect(() => {
    if (containerRef.current) {
      const index = items.indexOf(value)
      if (index !== -1) {
        containerRef.current.scrollTop = index * itemHeight
      }
    }
  }, [value, items])

  const handleScroll = () => {
    if (containerRef.current) {
      const scrollTop = containerRef.current.scrollTop
      const index = Math.round(scrollTop / itemHeight)
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1))
      if (items[clampedIndex] !== value) {
        onChange(items[clampedIndex])
      }
    }
  }

  return (
    <div className="relative h-[120px] overflow-hidden">
      {/* Selection highlight */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 bg-brand-accent/10 rounded-lg pointer-events-none z-0" />

      {/* Scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-none relative z-10"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Spacer top */}
        <div style={{ height: itemHeight }} />

        {items.map((item) => {
          const isSelected = item === value
          return (
            <div
              key={item}
              onClick={() => onChange(item)}
              className={cn(
                "h-10 flex items-center justify-center snap-center cursor-pointer transition-all",
                isSelected
                  ? "text-brand-accent font-semibold text-lg"
                  : "text-[#a7a39e] text-base"
              )}
            >
              {formatItem(item)}
            </div>
          )
        })}

        {/* Spacer bottom */}
        <div style={{ height: itemHeight }} />
      </div>
    </div>
  )
}

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

  const parsedValue = React.useMemo(() => {
    if (!value) return { hour: 12, minute: 0, isPM: false }
    const [h, m] = value.split(':').map(Number)
    return {
      hour: h % 12 || 12,
      minute: Math.round(m / 5) * 5,
      isPM: h >= 12
    }
  }, [value])

  const [selectedHour, setSelectedHour] = React.useState(parsedValue.hour)
  const [selectedMinute, setSelectedMinute] = React.useState(parsedValue.minute)
  const [isPM, setIsPM] = React.useState(parsedValue.isPM)

  React.useEffect(() => {
    if (open) {
      setSelectedHour(parsedValue.hour)
      setSelectedMinute(parsedValue.minute)
      setIsPM(parsedValue.isPM)
    }
  }, [open, parsedValue])

  const handleConfirm = () => {
    let hour24 = selectedHour
    if (isPM && selectedHour !== 12) hour24 = selectedHour + 12
    if (!isPM && selectedHour === 12) hour24 = 0
    onChange?.(`${String(hour24).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`)
    setOpen(false)
  }

  const displayTime = React.useMemo(() => {
    if (!value) return null
    const [h, m] = value.split(':').map(Number)
    const hour12 = h % 12 || 12
    const ampm = h < 12 ? 'AM' : 'PM'
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
  }, [value])

  return (
    <>
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
        <span className="font-albert text-sm">{displayTime || placeholder}</span>
        {iconPosition !== 'none' && (
          <Clock className="h-4 w-4 text-current flex-shrink-0" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[260px] p-4 rounded-2xl border-0 shadow-xl bg-white dark:bg-[#171b22]"
          hideCloseButton
          zIndex={zIndex}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Select time</DialogTitle>
          </VisuallyHidden.Root>

          {/* Wheels */}
          <div className="flex items-center gap-2 mb-4">
            <WheelPicker
              items={HOURS}
              value={selectedHour}
              onChange={setSelectedHour}
            />
            <span className="text-2xl font-light text-[#d1cdc8]">:</span>
            <WheelPicker
              items={MINUTES}
              value={selectedMinute}
              onChange={setSelectedMinute}
              formatItem={(v) => String(v).padStart(2, '0')}
            />
            {/* AM/PM */}
            <div className="flex flex-col gap-1 ml-1">
              <button
                type="button"
                onClick={() => setIsPM(false)}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                  !isPM
                    ? "bg-brand-accent text-white"
                    : "text-[#a7a39e] hover:text-[#1a1a1a]"
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => setIsPM(true)}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                  isPM
                    ? "bg-brand-accent text-white"
                    : "text-[#a7a39e] hover:text-[#1a1a1a]"
                )}
              >
                PM
              </button>
            </div>
          </div>

          {/* Confirm */}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-brand-accent text-white hover:opacity-90 transition-all"
          >
            Done
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
}
