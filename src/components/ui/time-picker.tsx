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
const PERIODS: ('AM' | 'PM')[] = ['AM', 'PM']

function WheelPicker({
  items,
  value,
  onChange,
  formatItem = (v) => String(v),
  width = 'w-[52px]'
}: {
  items: (number | string)[]
  value: number | string
  onChange: (v: number | string) => void
  formatItem?: (v: number | string) => string
  width?: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const itemHeight = 36
  const isScrolling = React.useRef(false)
  const scrollTimeout = React.useRef<NodeJS.Timeout | null>(null)

  // Scroll to value on mount and when value changes (but not during active scrolling)
  React.useEffect(() => {
    if (containerRef.current && !isScrolling.current) {
      const index = items.indexOf(value)
      if (index !== -1) {
        containerRef.current.scrollTo({
          top: index * itemHeight,
          behavior: 'auto'
        })
      }
    }
  }, [value, items])

  const handleScroll = () => {
    if (!containerRef.current) return

    isScrolling.current = true

    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current)
    }

    // Debounce the value change to slow down responsiveness
    scrollTimeout.current = setTimeout(() => {
      if (containerRef.current) {
        const scrollTop = containerRef.current.scrollTop
        const index = Math.round(scrollTop / itemHeight)
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1))

        if (items[clampedIndex] !== value) {
          onChange(items[clampedIndex])
        }

        // Snap to position
        containerRef.current.scrollTo({
          top: clampedIndex * itemHeight,
          behavior: 'smooth'
        })
      }

      // Reset scrolling flag after a delay
      setTimeout(() => {
        isScrolling.current = false
      }, 150)
    }, 80)
  }

  return (
    <div className={cn("relative h-[108px] overflow-hidden", width)}>
      {/* Selection highlight */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-9 bg-brand-accent/10 rounded-lg pointer-events-none z-0" />

      {/* Scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scrollbar-none relative z-10"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollSnapType: 'y mandatory'
        }}
      >
        {/* Spacer top */}
        <div style={{ height: itemHeight }} />

        {items.map((item) => {
          const isSelected = item === value
          return (
            <div
              key={item}
              onClick={() => onChange(item)}
              style={{ scrollSnapAlign: 'center' }}
              className={cn(
                "h-9 flex items-center justify-center cursor-pointer transition-all",
                isSelected
                  ? "text-brand-accent font-semibold text-base"
                  : "text-[#c5c0bb] text-sm"
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
    if (!value) return { hour: 12, minute: 0, period: 'AM' as const }
    const [h, m] = value.split(':').map(Number)
    return {
      hour: h % 12 || 12,
      minute: Math.round(m / 5) * 5,
      period: (h >= 12 ? 'PM' : 'AM') as 'AM' | 'PM'
    }
  }, [value])

  const [selectedHour, setSelectedHour] = React.useState(parsedValue.hour)
  const [selectedMinute, setSelectedMinute] = React.useState(parsedValue.minute)
  const [selectedPeriod, setSelectedPeriod] = React.useState<'AM' | 'PM'>(parsedValue.period)

  React.useEffect(() => {
    if (open) {
      setSelectedHour(parsedValue.hour)
      setSelectedMinute(parsedValue.minute)
      setSelectedPeriod(parsedValue.period)
    }
  }, [open, parsedValue])

  const handleConfirm = () => {
    let hour24 = selectedHour
    if (selectedPeriod === 'PM' && selectedHour !== 12) hour24 = selectedHour + 12
    if (selectedPeriod === 'AM' && selectedHour === 12) hour24 = 0
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
          className="w-[240px] p-4 rounded-2xl border-0 shadow-xl bg-white dark:bg-[#171b22]"
          hideCloseButton
          zIndex={zIndex}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Select time</DialogTitle>
          </VisuallyHidden.Root>

          {/* Wheels - all three scroll together */}
          <div className="flex items-center justify-center gap-1 mb-3">
            <WheelPicker
              items={HOURS}
              value={selectedHour}
              onChange={(v) => setSelectedHour(v as number)}
            />
            <span className="text-xl font-light text-[#d1cdc8]">:</span>
            <WheelPicker
              items={MINUTES}
              value={selectedMinute}
              onChange={(v) => setSelectedMinute(v as number)}
              formatItem={(v) => String(v).padStart(2, '0')}
            />
            <WheelPicker
              items={PERIODS}
              value={selectedPeriod}
              onChange={(v) => setSelectedPeriod(v as 'AM' | 'PM')}
              width="w-[44px]"
            />
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
