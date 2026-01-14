'use client';

import React, { useState } from 'react';
import { ChevronDown, Plus, LucideIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const [open, setOpen] = useState(false);

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    }
    setOpen(false);
  };

  const hasItems = groups.some(g => g.items.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] px-3 py-2 text-sm",
            "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "text-[#8c8c8c] dark:text-[#7d8190] font-albert"
          )}
        >
          <span>{placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] shadow-lg rounded-xl overflow-hidden"
        align="start"
        sideOffset={4}
      >
        <div className="max-h-[300px] overflow-y-auto">
          {groups.map((group, groupIndex) => (
            group.items.length > 0 && (
              <div key={group.label}>
                {groupIndex > 0 && groups[groupIndex - 1].items.length > 0 && (
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
                    <Icon className={cn("w-4 h-4", group.iconClassName || "text-brand-accent")} />
                    <span className="truncate">{item.title}</span>
                  </button>
                ))}
              </div>
            )
          ))}

          {/* Separator before create new */}
          {(hasItems || onCreateNew) && (
            <div className="h-px bg-[#e1ddd8] dark:bg-[#262b35] mx-2" />
          )}

          {/* Create new option */}
          {onCreateNew && (
            <button
              type="button"
              onClick={handleCreateNew}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                "hover:bg-[#f7f5f3] dark:hover:bg-[#1e222a] transition-colors",
                "text-brand-accent font-albert"
              )}
            >
              <Plus className="w-4 h-4" />
              <span>{createNewLabel}</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
