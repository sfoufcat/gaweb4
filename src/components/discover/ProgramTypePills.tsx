'use client';

import { useBrandingValues } from '@/contexts/BrandingContext';

export type ProgramType = 'all' | 'group' | 'individual';

interface ProgramTypePillsProps {
  selectedType: ProgramType;
  onSelect: (type: ProgramType) => void;
  groupCount?: number;
  individualCount?: number;
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

export function ProgramTypePills({ 
  selectedType, 
  onSelect,
  groupCount,
  individualCount 
}: ProgramTypePillsProps) {
  const { colors } = useBrandingValues();

  // Get RGB values for accent color to use with opacity
  const accentRgb = hexToRgb(colors.accentLight);
  const accentBgLight = accentRgb 
    ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.15)` 
    : colors.accentLight;
  const accentBgMedium = accentRgb 
    ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.25)` 
    : colors.accentLight;

  const totalCount = (groupCount || 0) + (individualCount || 0);

  const pills = [
    { 
      type: 'all' as ProgramType, 
      label: 'All',
      count: totalCount 
    },
    { 
      type: 'group' as ProgramType, 
      label: 'Group',
      count: groupCount 
    },
    { 
      type: 'individual' as ProgramType, 
      label: 'Individual',
      count: individualCount 
    },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {pills.map(({ type, label, count }) => {
        const isSelected = selectedType === type;
        
        return (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={`
              flex items-center gap-1 px-3 py-1.5 rounded-full
              border transition-all hover:shadow-sm cursor-pointer
              ${isSelected 
                ? 'dark:bg-[#222631] dark:border-[#313746]' 
                : 'bg-white dark:bg-[#222631] border-[#e1ddd8] dark:border-[#262b35]'
              }
            `}
            style={isSelected ? {
              backgroundColor: accentBgLight,
              borderColor: colors.accentLight,
            } : undefined}
          >
            {/* Checkmark icon with brand accent */}
            <div 
              className={`w-5 h-5 rounded-full flex items-center justify-center ${!isSelected ? 'bg-[#f3f1ef] dark:bg-[#262b35]' : ''}`}
              style={isSelected ? { backgroundColor: accentBgMedium } : undefined}
            >
              <svg 
                className={`w-3 h-3 ${!isSelected ? 'text-[#9d9890] dark:text-[#b2b6c2]' : ''}`} 
                style={isSelected ? { color: colors.accentLight } : undefined}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <span className={`font-albert font-semibold text-lg tracking-[-1px] leading-[1.3] ${isSelected ? 'text-text-primary dark:text-[#f5f5f8]' : 'text-text-secondary dark:text-[#b2b6c2]'}`}>
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
