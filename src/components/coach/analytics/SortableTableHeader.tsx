'use client';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

interface SortableTableHeaderProps<T extends string> {
  label: string;
  field: T;
  currentSort: T | null;
  direction: SortDirection;
  onSort: (field: T) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function SortableTableHeader<T extends string>({
  label,
  field,
  currentSort,
  direction,
  onSort,
  align = 'left',
  className,
}: SortableTableHeaderProps<T>) {
  const isActive = currentSort === field;

  const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider cursor-pointer select-none hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors ${className || ''}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1.5 ${alignClass}`}>
        <span>{label}</span>
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-brand-accent" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-brand-accent" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
        )}
      </div>
    </th>
  );
}
