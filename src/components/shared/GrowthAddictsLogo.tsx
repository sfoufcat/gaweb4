'use client';

import { motion } from 'framer-motion';

interface GrowthAddictsLogoProps {
  className?: string;
  animated?: boolean;
}

/**
 * Animated GrowthAddicts Logo
 * 
 * A stylized "G" with an upward arrow integrated into the design.
 * Features a light animation that sweeps through the arrow to create
 * a dynamic, energetic effect.
 */
export function GrowthAddictsLogo({ className = 'w-8 h-8', animated = true }: GrowthAddictsLogoProps) {
  // Unique ID for the gradient to avoid conflicts when multiple logos are rendered
  const gradientId = `ga-light-sweep-${Math.random().toString(36).slice(2, 9)}`;
  
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Animated gradient for the light sweep effect */}
        {animated && (
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
            <motion.stop
              offset="0%"
              stopColor="currentColor"
              stopOpacity={0.4}
              animate={{
                stopOpacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.stop
              offset="50%"
              stopColor="currentColor"
              stopOpacity={1}
              animate={{
                offset: ['30%', '70%', '30%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.stop
              offset="100%"
              stopColor="currentColor"
              stopOpacity={0.6}
              animate={{
                stopOpacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </linearGradient>
        )}
      </defs>

      {/* The "G" shape - outer arc */}
      <path
        d="M16 4C9.373 4 4 9.373 4 16c0 6.627 5.373 12 12 12 4.418 0 8.284-2.39 10.36-5.946"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />
      
      {/* The horizontal bar of the G */}
      <path
        d="M16 16h10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />
      
      {/* The upward arrow - main shaft */}
      <motion.path
        d="M22 20V7"
        stroke={animated ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        initial={animated ? { pathLength: 0 } : undefined}
        animate={animated ? { pathLength: 1 } : undefined}
        transition={{
          duration: 0.8,
          ease: 'easeOut',
        }}
      />
      
      {/* Arrow head - left wing */}
      <motion.path
        d="M17 11l5-4"
        stroke={animated ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={animated ? { pathLength: 0, opacity: 0 } : undefined}
        animate={animated ? { pathLength: 1, opacity: 1 } : undefined}
        transition={{
          duration: 0.4,
          delay: 0.5,
          ease: 'easeOut',
        }}
      />
      
      {/* Arrow head - right wing */}
      <motion.path
        d="M27 11l-5-4"
        stroke={animated ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={animated ? { pathLength: 0, opacity: 0 } : undefined}
        animate={animated ? { pathLength: 1, opacity: 1 } : undefined}
        transition={{
          duration: 0.4,
          delay: 0.5,
          ease: 'easeOut',
        }}
      />

      {/* Animated light particle traveling up the arrow */}
      {animated && (
        <motion.circle
          cx="22"
          cy="14"
          r="2"
          fill="currentColor"
          opacity={0.8}
          animate={{
            cy: [20, 7, 7, 20],
            opacity: [0, 0.9, 0.9, 0],
            scale: [0.5, 1.2, 1, 0.5],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
            times: [0, 0.4, 0.6, 1],
          }}
        />
      )}
    </svg>
  );
}

export default GrowthAddictsLogo;

