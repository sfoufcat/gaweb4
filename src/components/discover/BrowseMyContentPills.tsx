'use client';

import { Compass, Library } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';

export type DiscoverViewMode = 'browse' | 'my-content';

interface BrowseMyContentPillsProps {
  selectedMode: DiscoverViewMode;
  onSelect: (mode: DiscoverViewMode) => void;
  myContentCount?: number;
}

/**
 * Helper to convert hex to RGB for rgba usage
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Pill toggle for Discover page to switch between Browse and My Content views.
 * Browse shows unpurchased public content, My Content shows all purchased items.
 */
export function BrowseMyContentPills({ 
  selectedMode, 
  onSelect,
  myContentCount 
}: BrowseMyContentPillsProps) {
  const { colors } = useBrandingValues();

  // Get RGB values for accent color to use with opacity
  const accentRgb = hexToRgb(colors.accentLight);
  const accentBgLight = accentRgb 
    ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.15)` 
    : colors.accentLight;

  const pills = [
    { 
      mode: 'browse' as DiscoverViewMode, 
      label: 'Browse', 
      icon: Compass,
    },
    { 
      mode: 'my-content' as DiscoverViewMode, 
      label: 'My Content', 
      icon: Library,
      count: myContentCount 
    },
  ];

  return (
    <div className="flex gap-2">
      {pills.map(({ mode, label, icon: Icon, count }) => {
        const isSelected = selectedMode === mode;
        
        return (
          <button
            key={mode}
            onClick={() => onSelect(mode)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full
              border transition-all hover:shadow-sm cursor-pointer
              ${isSelected 
                ? 'dark:bg-[#222631] dark:border-[#313746]' 
                : 'bg-white/70 dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:bg-white dark:hover:bg-[#1d222b]'
              }
            `}
            style={isSelected ? {
              backgroundColor: accentBgLight,
              borderColor: colors.accentLight,
            } : undefined}
          >
            <Icon 
              className={`w-4 h-4 ${isSelected ? '' : 'text-[#9d9890] dark:text-[#7d8190]'}`}
              style={isSelected ? { color: colors.accentLight } : undefined}
            />
            
            <span 
              className={`font-albert font-medium text-sm tracking-[-0.5px] ${
                isSelected 
                  ? 'text-text-primary dark:text-[#f5f5f8]' 
                  : 'text-text-secondary dark:text-[#b2b6c2]'
              }`}
            >
              {label}
            </span>

            {count !== undefined && count > 0 && (
              <span 
                className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  isSelected 
                    ? 'text-text-primary dark:text-[#f5f5f8]' 
                    : 'bg-[#e1ddd8]/50 dark:bg-[#262b35] text-text-muted dark:text-[#7d8190]'
                }`}
                style={isSelected ? { 
                  backgroundColor: colors.accentLight + '30',
                  color: colors.accentLight 
                } : undefined}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

