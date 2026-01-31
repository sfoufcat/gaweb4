'use client';

import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type SortDirection = 'asc' | 'desc';

interface SortOption<T extends string> {
  value: T;
  label: string;
}

interface AnalyticsSortDropdownProps<T extends string> {
  options: SortOption<T>[];
  value: T;
  direction: SortDirection;
  onChange: (field: T, direction: SortDirection) => void;
  className?: string;
}

export function AnalyticsSortDropdown<T extends string>({
  options,
  value,
  direction,
  onChange,
  className,
}: AnalyticsSortDropdownProps<T>) {
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  const handleSelect = (field: T) => {
    if (field === value) {
      // Toggle direction
      onChange(field, direction === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to desc
      onChange(field, 'desc');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium
            bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm
            border border-[#e1ddd8]/60 dark:border-[#262b35]/60
            text-[#1a1a1a] dark:text-[#f5f5f8]
            hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]
            transition-colors ${className || ''}`}
        >
          <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Sort:</span>
          <span>{selectedOption.label}</span>
          {direction === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-brand-accent" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-brand-accent" />
          )}
          <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`flex items-center justify-between ${option.value === value ? 'bg-[#f3f1ef] dark:bg-[#262b35]' : ''}`}
          >
            <span>{option.label}</span>
            {option.value === value && (
              <span className="flex items-center gap-1 text-brand-accent">
                {direction === 'asc' ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
                )}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
