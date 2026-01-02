'use client';

import { useState } from 'react';
import { AlignmentSheet } from './AlignmentSheet';
import type { UserAlignment, UserAlignmentSummary } from '@/types';

// Fire icon SVG component
function FireIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M12 12C14 9.04 12 5 11 4C11 7.038 9.227 8.741 8 10C6.774 11.26 6 13.24 6 15C6 16.5913 6.63214 18.1174 7.75736 19.2426C8.88258 20.3679 10.4087 21 12 21C13.5913 21 15.1174 20.3679 16.2426 19.2426C17.3679 18.1174 18 16.5913 18 15C18 13.468 16.944 11.06 16 10C14.214 13 13.209 13 12 12Z" 
        fill="#E74C3C" 
        stroke="#E74C3C" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface AlignmentGaugeProps {
  alignment: UserAlignment | null;
  summary: UserAlignmentSummary | null;
  isLoading?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** When true, uses xs size on mobile and sm size on desktop */
  responsive?: boolean;
  className?: string;
  onPress?: () => void; // Optional custom click handler (e.g., for squad gauge)
}

/**
 * AlignmentGauge Component
 * 
 * Displays the daily alignment gauge with streak count.
 * Based on Figma designs:
 * - Complete: https://www.figma.com/design/.../node-id=1760-8609
 * - Incomplete: https://www.figma.com/design/.../node-id=1760-8721
 */
export function AlignmentGauge({
  alignment,
  summary,
  isLoading = false,
  size = 'sm',
  responsive = false,
  className = '',
  onPress,
}: AlignmentGaugeProps) {
  const [showSheet, setShowSheet] = useState(false);

  // Click handler - use custom onPress if provided, otherwise open default sheet
  const handleClick = () => {
    if (onPress) {
      onPress();
    } else {
      setShowSheet(true);
    }
  };

  // Size configurations
  // xs: 40px total (28 container + 12 padding) - matches w-10 h-10
  // sm: 62px total (50 container + 12 padding) - matches w-[62px] h-[62px]
  const sizeConfig = {
    xs: { container: 28, arc: 11, strokeWidth: 2, fontSize: 12, fireSize: 10 },
    sm: { container: 50, arc: 20, strokeWidth: 3, fontSize: 17, fireSize: 14 },
    md: { container: 100, arc: 40, strokeWidth: 4, fontSize: 35, fireSize: 28 },
    lg: { container: 120, arc: 48, strokeWidth: 5, fontSize: 39, fireSize: 32 },
  };

  // For responsive mode, we render with sm config but use CSS to scale on mobile
  const config = sizeConfig[responsive ? 'sm' : size];
  const streak = summary?.currentStreak ?? 0;
  const score = alignment?.alignmentScore ?? 0;

  // Calculate arc progress (0-100 maps to 0-1 for the arc)
  // The arc covers a half circle (180 degrees)
  const progress = score / 100;

  // SVG arc calculation
  const center = config.container / 2;
  const radius = config.arc;
  
  // Start angle is -90 (top), end angle depends on progress
  // For a half circle gauge going from left to right at the top
  const startAngle = -180; // Start from left
  
  // Convert angle to radians and calculate position
  const angleToRadians = (angle: number) => (angle * Math.PI) / 180;
  
  // Calculate arc path (half circle going from left to right)
  const describeArc = (startAng: number, endAng: number) => {
    const start = {
      x: center + radius * Math.cos(angleToRadians(startAng)),
      y: center + radius * Math.sin(angleToRadians(startAng)),
    };
    const end = {
      x: center + radius * Math.cos(angleToRadians(endAng)),
      y: center + radius * Math.sin(angleToRadians(endAng)),
    };
    const largeArcFlag = endAng - startAng <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  // Indicator position
  const indicatorAngle = startAngle + (180 * progress);
  const indicatorX = center + radius * Math.cos(angleToRadians(indicatorAngle));
  const indicatorY = center + radius * Math.sin(angleToRadians(indicatorAngle));

  // Colors for the gradient
  const getGradientId = () => `gauge-gradient-${size}`;

  // Responsive sizing classes (50px on mobile, 62px on desktop)
  const responsiveContainerClass = responsive 
    ? 'w-[50px] h-[50px] sm:w-[62px] sm:h-[62px]' 
    : '';
  const responsiveInnerClass = responsive 
    ? 'w-[38px] h-[38px] sm:w-[50px] sm:h-[50px]' 
    : '';

  if (isLoading) {
    return (
      <div 
        className={`bg-[#f3f1ef] dark:bg-[#181d28] rounded-[40px] p-1.5 sm:p-2 flex items-center justify-center ${responsiveContainerClass} ${className}`}
        style={responsive ? undefined : { width: config.container + 12, height: config.container + 12 }}
      >
        <div 
          className={`animate-pulse bg-[#e1ddd8] dark:bg-[#272d38] rounded-full ${responsiveInnerClass}`} 
          style={responsive ? undefined : { width: config.container, height: config.container }} 
        />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`bg-[#f3f1ef] dark:bg-[#181d28] rounded-[40px] p-[6px] sm:p-2 flex items-center justify-center hover:bg-[#e9e5e0] dark:hover:bg-[#272d38] transition-colors ${responsiveContainerClass} ${className}`}
        style={responsive ? undefined : { width: config.container + 12, height: config.container + 12 }}
        aria-label={`Daily alignment: ${score}% complete, ${streak} day streak. Tap for details.`}
      >
        <div 
          className={`relative ${responsiveInnerClass}`} 
          style={responsive ? undefined : { width: config.container, height: config.container }}
        >
          {/* SVG Gauge */}
          <svg 
            className="w-full h-full" 
            viewBox={`0 0 ${config.container} ${config.container}`}
          >
            <defs>
              {/* Gradient for the arc */}
              <linearGradient id={getGradientId()} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F59E0B" /> {/* Amber/Orange */}
                <stop offset="50%" stopColor="#FBBF24" /> {/* Yellow */}
                <stop offset="100%" stopColor="#22C55E" /> {/* Green */}
              </linearGradient>
            </defs>
            
            {/* Background arc (gray) */}
            <path
              d={describeArc(-180, 0)}
              fill="none"
              stroke="currentColor"
              className="text-[#e1ddd8] dark:text-[#272d38]"
              strokeWidth={config.strokeWidth}
              strokeLinecap="round"
            />
            
            {/* Progress arc */}
            {progress > 0 && (
              <path
                d={describeArc(-180, -180 + 180 * progress)}
                fill="none"
                stroke={`url(#${getGradientId()})`}
                strokeWidth={config.strokeWidth}
                strokeLinecap="round"
              />
            )}
            
            {/* Indicator dot */}
            <circle
              cx={indicatorX}
              cy={indicatorY}
              r={config.strokeWidth * 1.2}
              fill="currentColor"
              className="text-[#1a1a1a] dark:text-[#faf8f6]"
            />
          </svg>

          {/* Center content */}
          <div 
            className={`absolute inset-0 flex flex-col items-center justify-center ${responsive ? 'pt-1.5 sm:pt-1.5' : ''}`}
            style={responsive ? undefined : { paddingTop: size === 'sm' || size === 'xs' ? 6 : 8 }}
          >
            <span 
              className={`font-geist font-medium text-text-primary leading-none ${responsive ? 'text-[14px] sm:text-[17px]' : ''}`}
              style={responsive ? undefined : { fontSize: config.fontSize }}
            >
              {streak}
            </span>
            {responsive ? (
              <>
                <FireIcon size={12} className="mt-0.5 sm:hidden" />
                <FireIcon size={14} className="mt-0.5 hidden sm:block" />
              </>
            ) : (
              <FireIcon size={config.fireSize} className="mt-0.5" />
            )}
          </div>
        </div>
      </button>

      {/* Alignment Sheet - Only shown when no custom onPress handler */}
      {!onPress && (
        <AlignmentSheet
          isOpen={showSheet}
          onClose={() => setShowSheet(false)}
          alignment={alignment}
          summary={summary}
        />
      )}
    </>
  );
}

export default AlignmentGauge;

