"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

/**
 * Simple tooltip implementation using CSS hover states + touch support
 * Uses portal to escape overflow clipping from parent containers (like modals)
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
  triggerRef: React.RefObject<HTMLElement | null>
}>({ isOpen: false, setIsOpen: () => {}, triggerRef: { current: null } })

const Tooltip: React.FC<TooltipProps> = ({ children, open, onOpenChange }) => {
  const [isOpen, setIsOpenState] = React.useState(open ?? false)
  const triggerRef = React.useRef<HTMLElement | null>(null)

  const setIsOpen = React.useCallback((newOpen: boolean) => {
    setIsOpenState(newOpen)
    onOpenChange?.(newOpen)
  }, [onOpenChange])

  // Sync with controlled state
  React.useEffect(() => {
    if (open !== undefined) setIsOpenState(open)
  }, [open])

  return (
    <TooltipContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      <div className="relative inline-flex group">{children}</div>
    </TooltipContext.Provider>
  )
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

const TooltipTrigger = React.forwardRef<HTMLDivElement, TooltipTriggerProps>(
  ({ className, asChild, children, ...props }, ref) => {
    const { setIsOpen, triggerRef } = React.useContext(TooltipContext)
    const localRef = React.useRef<HTMLDivElement>(null)

    // Merge refs
    React.useEffect(() => {
      const element = localRef.current
      if (element) {
        triggerRef.current = element
      }
    }, [triggerRef])

    const handleMouseEnter = () => setIsOpen(true)
    const handleMouseLeave = () => setIsOpen(false)

    const handleTouchStart = (e: React.TouchEvent) => {
      e.stopPropagation()
      setIsOpen(true)
      setTimeout(() => setIsOpen(false), 2000)
    }

    if (asChild && React.isValidElement<{ className?: string; onTouchStart?: React.TouchEventHandler; onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler }>(children)) {
      return React.cloneElement(children, {
        ref: localRef,
        className: cn(children.props.className, "cursor-default"),
        onTouchStart: handleTouchStart,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        ...props,
      } as React.HTMLAttributes<HTMLElement>)
    }

    return (
      <div
        ref={localRef}
        className={cn("cursor-default", className)}
        onTouchStart={handleTouchStart}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
  ({ className, side = "top", sideOffset = 8, children, ...props }, ref) => {
    const { isOpen, triggerRef } = React.useContext(TooltipContext)
    const [position, setPosition] = React.useState({ top: 0, left: 0 })
    const [mounted, setMounted] = React.useState(false)
    const contentRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
      setMounted(true)
    }, [])

    React.useEffect(() => {
      if (isOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const contentEl = contentRef.current
        const contentWidth = contentEl?.offsetWidth || 0
        const contentHeight = contentEl?.offsetHeight || 0
        const viewportWidth = window.innerWidth
        const padding = 8 // Min distance from viewport edge

        let top = 0
        let left = 0

        switch (side) {
          case "top":
            top = rect.top - contentHeight - sideOffset + window.scrollY
            left = rect.left + rect.width / 2 - contentWidth / 2 + window.scrollX
            break
          case "bottom":
            top = rect.bottom + sideOffset + window.scrollY
            left = rect.left + rect.width / 2 - contentWidth / 2 + window.scrollX
            break
          case "left":
            top = rect.top + rect.height / 2 - contentHeight / 2 + window.scrollY
            left = rect.left - contentWidth - sideOffset + window.scrollX
            break
          case "right":
            top = rect.top + rect.height / 2 - contentHeight / 2 + window.scrollY
            left = rect.right + sideOffset + window.scrollX
            break
        }

        // Clamp left position to stay within viewport
        if (left < padding) {
          left = padding
        } else if (left + contentWidth > viewportWidth - padding) {
          left = viewportWidth - contentWidth - padding
        }

        setPosition({ top, left })
      }
    }, [isOpen, side, sideOffset, triggerRef])

    if (!mounted || !isOpen) return null

    return createPortal(
      <div
        ref={(node) => {
          // Handle both refs
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
          ;(contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        className={cn(
          "fixed z-[10001]",
          "px-3 py-1.5 text-sm",
          "rounded-md border",
          "bg-[#1a1a1a] dark:bg-[#f5f5f8]",
          "text-white dark:text-[#1a1a1a]",
          "shadow-md",
          "animate-in fade-in-0 zoom-in-95",
          "whitespace-nowrap",
          className
        )}
        style={{ top: position.top, left: position.left }}
        {...props}
      >
        {children}
      </div>,
      document.body
    )
  }
)
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
