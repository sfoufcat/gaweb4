import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
          variant === 'default' && "bg-earth-900 dark:bg-brand-accent text-white",
          variant === 'secondary' && "bg-earth-100 dark:bg-[#262b35] text-earth-800 dark:text-[#f5f5f8]",
          variant === 'destructive' && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
          variant === 'outline' && "border border-earth-200 dark:border-[#262b35] text-earth-700 dark:text-[#f5f5f8]",
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
