'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResourceItem {
  id: string;
  title: string;
}

interface ResourceGroup {
  label: string;
  items: ResourceItem[];
  iconClassName?: string;
}

interface ResourceLinkDropdownProps {
  placeholder: string;
  icon: LucideIcon;
  groups: ResourceGroup[];
  onSelect: (id: string) => void;
  onCreateNew?: () => void;
  createNewLabel?: string;
}

export function ResourceLinkDropdown({
  placeholder,
  icon: Icon,
  groups,
  onSelect,
  onCreateNew,
  createNewLabel = 'Create new',
}: ResourceLinkDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    }
    setIsOpen(false);
  };

  const hasItems = groups.some(g => g.items.length > 0);

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] px-3 py-2 text-sm",
          "hover:bg-[#f7f5f3] dark:hover:bg-[#1e222a] transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-0",
          "text-[#8c8c8c] dark:text-[#7d8190] font-albert"
        )}
      >
        <span>{placeholder}</span>
        <ChevronDown className={cn(
          "h-4 w-4 opacity-50 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 right-0 mt-1 z-[10001]",
            "border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]",
            "shadow-lg rounded-xl overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
        >
          <div className="max-h-[300px] overflow-y-auto">
            {groups.map((group, groupIndex) => (
              group.items.length > 0 && (
                <div key={group.label}>
                  {groupIndex > 0 && groups.slice(0, groupIndex).some(g => g.items.length > 0) && (
                    <div className="h-px bg-[#e1ddd8] dark:bg-[#262b35] mx-2" />
                  )}
                  <div className="px-3 py-2">
                    <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-semibold uppercase tracking-wider">
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                        "hover:bg-[#f7f5f3] dark:hover:bg-[#1e222a] transition-colors",
                        "text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 flex-shrink-0", group.iconClassName || "text-brand-accent")} />
                      <span className="truncate">{item.title}</span>
                    </button>
                  ))}
                </div>
              )
            ))}

            {/* Separator before create new - only if there are items */}
            {hasItems && onCreateNew && (
              <div className="h-px bg-[#e1ddd8] dark:bg-[#262b35] mx-2" />
            )}

            {/* Create new option - always show if provided */}
            {onCreateNew && (
              <button
                type="button"
                onClick={handleCreateNew}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left",
                  "hover:bg-[#f7f5f3] dark:hover:bg-[#1e222a] transition-colors",
                  "text-brand-accent font-albert font-medium"
                )}
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>{createNewLabel}</span>
              </button>
            )}

            {/* Empty state when no items and no create option */}
            {!hasItems && !onCreateNew && (
              <div className="px-3 py-4 text-center">
                <span className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic">
                  No items available
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
