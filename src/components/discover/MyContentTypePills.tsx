'use client';

// HIDDEN: 'squad' kept for backwards compatibility but hidden from UI
// Standalone squads disabled - squads now managed via Program > Community
export type MyContentFilter = 'all' | 'article' | 'course' | 'event' | 'program' | 'squad';

interface MyContentTypePillsProps {
  selectedFilter: MyContentFilter;
  onSelect: (filter: MyContentFilter) => void;
  counts: {
    programs: number;
    squads: number;
    courses: number;
    articles: number;
    events: number;
    downloads: number;
    links: number;
  };
  totalCount: number;
}

/**
 * Horizontal scrollable pills for filtering My Content by type.
 * Shows: All, Articles, Courses, Events, Programs, Squads
 */
export function MyContentTypePills({ 
  selectedFilter, 
  onSelect,
  counts,
  totalCount,
}: MyContentTypePillsProps) {
  // Define filter options - only show types that have content
  // HIDDEN: 'squad' removed - standalone squads disabled, now managed via Program > Community
  const allFilters: { key: MyContentFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: totalCount },
    { key: 'article', label: 'Articles', count: counts.articles },
    { key: 'course', label: 'Courses', count: counts.courses },
    { key: 'event', label: 'Events', count: counts.events },
    { key: 'program', label: 'Programs', count: counts.programs },
    // { key: 'squad', label: 'Squads', count: counts.squads },
  ];
  
  // Always show All, only show others if they have items
  const filters = allFilters.filter(f => f.key === 'all' || f.count > 0);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onSelect(filter.key)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            selectedFilter === filter.key
              ? 'bg-brand-accent text-white'
              : 'bg-[#f3f1ef] dark:bg-[#171b22] text-text-secondary dark:text-[#b2b6c2] hover:bg-[#e8e4df] dark:hover:bg-[#1d222b]'
          }`}
        >
          <span>{filter.label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            selectedFilter === filter.key
              ? 'bg-white/20 text-white'
              : 'bg-[#e1ddd8]/50 dark:bg-[#262b35] text-text-muted dark:text-[#7d8190]'
          }`}>
            {filter.count}
          </span>
        </button>
      ))}
    </div>
  );
}

