'use client';

import { Users, User } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';

export type ProgramType = 'group' | 'individual';

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

  const pills = [
    { 
      type: 'group' as ProgramType, 
      label: 'Group Programs', 
      icon: Users,
      count: groupCount 
    },
    { 
      type: 'individual' as ProgramType, 
      label: '1:1 Coaching', 
      icon: User,
      count: individualCount 
    },
  ];

  return (
    <div className="flex gap-2">
      {pills.map(({ type, label, icon: Icon, count }) => {
        const isSelected = selectedType === type;
        
        return (
          <button
            key={type}
            onClick={() => onSelect(type)}
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






