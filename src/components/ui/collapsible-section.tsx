'use client';

import * as React from 'react';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  icon: Icon,
  description,
  defaultOpen = true,
  children,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn('border-t border-[#e1ddd8] dark:border-[#262b35]', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          {Icon && (
            <Icon className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
          )}
          <span className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {title}
          </span>
          {description && (
            <span className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
              {description}
            </span>
          )}
        </div>
        <ChevronRight
          className={cn(
            'w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] transition-transform duration-200',
            isOpen && 'rotate-90'
          )}
        />
      </button>
      {isOpen && (
        <div className="pb-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
