import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-earth-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          variant === 'default' && "bg-earth-900 text-white hover:bg-earth-800 shadow",
          variant === 'outline' && "border border-earth-200 hover:bg-earth-50",
          variant === 'ghost' && "hover:bg-earth-100",
          size === 'default' && "h-11 px-8 py-2",
          size === 'sm' && "h-9 px-4 text-sm",
          size === 'lg' && "h-12 px-10 text-lg",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

