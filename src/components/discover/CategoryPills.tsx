'use client';

import type { DiscoverCategory } from '@/types/discover';

interface CategoryPillsProps {
  categories: DiscoverCategory[];
  selectedCategory?: string | null;
  onSelect?: (categoryId: string | null) => void;
}

export function CategoryPills({ categories, selectedCategory, onSelect }: CategoryPillsProps) {
  const handleClick = (categoryId: string) => {
    if (!onSelect) return;
    // Toggle: if already selected, deselect (show all)
    if (selectedCategory === categoryId) {
      onSelect(null);
    } else {
      onSelect(categoryId);
    }
  };

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
                ? 'bg-earth-100 border-earth-300 dark:bg-[#222631] dark:border-[#313746]' 
                : 'bg-white dark:bg-[#222631] border-[#e1ddd8] dark:border-[#262b35]'
              }
            `}
          >
            {/* Icon placeholder - can be replaced with actual icons */}
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? 'bg-earth-200 dark:bg-[#313746]' : 'bg-earth-100 dark:bg-[#262b35]'}`}>
              <svg className="w-3 h-3 text-earth-500 dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
