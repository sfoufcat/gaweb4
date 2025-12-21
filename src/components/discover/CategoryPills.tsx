'use client';

import type { DiscoverCategory } from '@/types/discover';
import { useBrandingValues } from '@/contexts/BrandingContext';

interface CategoryPillsProps {
  categories: DiscoverCategory[];
  selectedCategory?: string | null;
  onSelect?: (categoryId: string | null) => void;
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

export function CategoryPills({ categories, selectedCategory, onSelect }: CategoryPillsProps) {
  const { colors } = useBrandingValues();
  
  const handleClick = (categoryId: string) => {
    if (!onSelect) return;
    // Toggle: if already selected, deselect (show all)
    if (selectedCategory === categoryId) {
      onSelect(null);
    } else {
      onSelect(categoryId);
    }
  };

  // Get RGB values for accent color to use with opacity
  const accentRgb = hexToRgb(colors.accentLight);
  const accentBgLight = accentRgb 
    ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.15)` 
    : colors.accentLight;
  const accentBgMedium = accentRgb 
    ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.25)` 
    : colors.accentLight;

  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((category) => {
        const isSelected = selectedCategory === category.id;
        
        return (
          <button
            key={category.id}
            onClick={() => handleClick(category.id)}
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
              {category.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
