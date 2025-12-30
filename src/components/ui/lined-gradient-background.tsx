import * as React from "react"
import { cn } from "@/lib/utils"

interface LinedGradientBackgroundProps {
  className?: string;
  /** Whether to use fixed positioning (covers viewport) or absolute (covers parent) */
  fixed?: boolean;
}

/**
 * A very subtle grain/noise texture background.
 * Adds warmth and depth without being distracting.
 * Supports both light and dark modes.
 */
export function LinedGradientBackground({ 
  className,
  fixed = false 
}: LinedGradientBackgroundProps) {
  return (
    <div 
      className={cn(
        fixed ? "fixed" : "absolute",
        "inset-0 pointer-events-none overflow-hidden",
        className
      )}
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* SVG noise filter definition */}
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="grain-texture">
            <feTurbulence 
              type="fractalNoise" 
              baseFrequency="0.8" 
              numOctaves="4" 
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="monoNoise"
            />
          </filter>
        </defs>
      </svg>
      
      {/* Grain overlay - light mode */}
      <div 
        className="absolute inset-0 opacity-[0.035] dark:opacity-0"
        style={{
          filter: 'url(#grain-texture)',
          backgroundColor: 'rgba(180, 160, 140, 1)',
        }}
      />
      
      {/* Grain overlay - dark mode */}
      <div 
        className="absolute inset-0 opacity-0 dark:opacity-[0.04]"
        style={{
          filter: 'url(#grain-texture)',
          backgroundColor: 'rgba(200, 210, 230, 1)',
        }}
      />
    </div>
  )
}

