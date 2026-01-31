'use client';

import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AnalyticsDateDropdownProps {
  value: number;
  onChange: (days: number) => void;
  className?: string;
}

const DATE_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 60, label: 'Last 60 days' },
  { value: 90, label: 'Last 90 days' },
];

export function AnalyticsDateDropdown({ value, onChange, className }: AnalyticsDateDropdownProps) {
  const selectedOption = DATE_OPTIONS.find(opt => opt.value === value) || DATE_OPTIONS[1];

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
          <span>{selectedOption.label}</span>
          <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {DATE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={option.value === value ? 'bg-[#f3f1ef] dark:bg-[#262b35]' : ''}
          >
            {option.label}
            {option.value === value && (
              <svg className="ml-auto w-4 h-4 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
