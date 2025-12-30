import * as React from "react"
import { cn } from "@/lib/utils"

interface LinedGradientBackgroundProps {
  className?: string;
  /** Whether to use fixed positioning (covers viewport) or absolute (covers parent) */
  fixed?: boolean;
}

/**
 * A subtle vertical lined gradient background effect.
 * Replicates the warm, textured background from the GrowthAddicts homepage.
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
        "inset-0 pointer-events-none overflow-hidden -z-10",
        className
      )}
      aria-hidden="true"
    >
      {/* Base background color */}
      <div className="absolute inset-0 bg-app-bg" />
      
      {/* Vertical lines layer - wide soft stripes */}
      <div 
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 80px,
              rgba(215, 205, 195, 0.5) 80px,
              rgba(215, 205, 195, 0.5) 82px,
              transparent 82px,
              transparent 180px
            )
          `,
        }}
      />
      
      {/* Vertical lines layer - medium stripes offset */}
      <div 
        className="absolute inset-0 opacity-[0.25] dark:opacity-[0.1]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 120px,
              rgba(200, 190, 180, 0.4) 120px,
              rgba(200, 190, 180, 0.4) 121px,
              transparent 121px,
              transparent 240px
            )
          `,
        }}
      />
      
      {/* Vertical lines layer - thin accent stripes */}
      <div 
        className="absolute inset-0 opacity-[0.2] dark:opacity-[0.08]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 200px,
              rgba(180, 170, 160, 0.3) 200px,
              rgba(180, 170, 160, 0.3) 201px,
              transparent 201px,
              transparent 350px
            )
          `,
        }}
      />
      
      {/* Soft gradient overlay for depth */}
      <div 
        className="absolute inset-0 opacity-30 dark:opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(
              180deg,
              transparent 0%,
              rgba(250, 248, 246, 0.5) 50%,
              transparent 100%
            )
          `,
        }}
      />
      
      {/* Dark mode specific overlay - subtle blue tint */}
      <div 
        className="absolute inset-0 opacity-0 dark:opacity-100"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 100px,
              rgba(30, 40, 60, 0.15) 100px,
              rgba(30, 40, 60, 0.15) 102px,
              transparent 102px,
              transparent 220px
            )
          `,
        }}
      />
    </div>
  )
}

