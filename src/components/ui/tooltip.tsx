"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Simple tooltip implementation using CSS hover states + touch support
 * Based on shadcn/ui patterns but without the Radix dependency
 */

interface TooltipProviderProps {
  children: React.ReactNode
  delayDuration?: number
}

const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
  return <>{children}</>
}

interface TooltipProps {
  children: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  delayDuration?: number
}

const TooltipContext = React.createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({ isOpen: false, setIsOpen: () => {} })

const Tooltip: React.FC<TooltipProps> = ({ children, open, onOpenChange }) => {
  const [isOpen, setIsOpenState] = React.useState(open ?? false)

  const setIsOpen = React.useCallback((newOpen: boolean) => {
    setIsOpenState(newOpen)
    onOpenChange?.(newOpen)
  }, [onOpenChange])

  // Sync with controlled state
  React.useEffect(() => {
    if (open !== undefined) setIsOpenState(open)
  }, [open])

  return (
    <TooltipContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative inline-flex group">{children}</div>
    </TooltipContext.Provider>
  )
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

const TooltipTrigger = React.forwardRef<HTMLDivElement, TooltipTriggerProps>(
  ({ className, asChild, children, ...props }, ref) => {
    const { setIsOpen } = React.useContext(TooltipContext)

    const handleTouchStart = (e: React.TouchEvent) => {
      // Prevent default to avoid triggering click
      e.stopPropagation()
      setIsOpen(true)
      // Auto-close after 2 seconds on mobile
      setTimeout(() => setIsOpen(false), 2000)
    }

    if (asChild && React.isValidElement<{ className?: string; onTouchStart?: React.TouchEventHandler }>(children)) {
      return React.cloneElement(children, {
        ref,
        className: cn(children.props.className, "cursor-default"),
        onTouchStart: handleTouchStart,
        ...props,
      } as React.HTMLAttributes<HTMLElement>)
    }

    return (
      <div
        ref={ref}
        className={cn("cursor-default", className)}
        onTouchStart={handleTouchStart}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
  align?: "start" | "center" | "end"
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = "top", sideOffset = 4, children, ...props }, ref) => {
    const { isOpen } = React.useContext(TooltipContext)

    const positionClasses = {
      top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
      bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
      left: "right-full top-1/2 -translate-y-1/2 mr-2",
      right: "left-full top-1/2 -translate-y-1/2 ml-2",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-[10001]",
          // Show on hover (desktop) or when isOpen (mobile tap)
          isOpen ? "block" : "hidden group-hover:block",
          "px-3 py-1.5 text-sm",
          "rounded-md border",
          "bg-[#1a1a1a] dark:bg-[#f5f5f8]",
          "text-white dark:text-[#1a1a1a]",
          "shadow-md",
          "animate-in fade-in-0 zoom-in-95",
          "whitespace-nowrap",
          positionClasses[side],
          className
        )}
        style={{ marginBottom: side === "top" ? sideOffset : undefined, marginTop: side === "bottom" ? sideOffset : undefined }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
