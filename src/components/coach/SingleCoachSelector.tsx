'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Check, ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * SingleCoachSelector Component
 *
 * Single-select dropdown for selecting a primary program coach.
 * Similar to CoachSelector but for single selection only.
 */

interface Coach {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
}

interface SingleCoachSelectorProps {
  coaches: Coach[];
  value: string | null;
  onChange: (coachId: string) => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SingleCoachSelector({
  coaches,
  value,
  onChange,
  loading = false,
  placeholder = 'Select coach...',
  className = '',
  disabled = false,
}: SingleCoachSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectCoach = (coachId: string) => {
    onChange(coachId);
    setOpen(false);
    setSearchTerm('');
  };

  const selectedCoach = useMemo(() =>
    coaches.find(c => c.id === value),
    [value, coaches]
  );

  // Filter coaches by search term
  const filteredCoaches = useMemo(() =>
    coaches.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [coaches, searchTerm]
  );

  // If only one coach and it's selected, show as disabled/static
  const isSingleCoachSelected = coaches.length === 1 && coaches[0]?.id === value;

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={(newOpen) => {
        if (!disabled && !isSingleCoachSelected) {
          setOpen(newOpen);
        }
      }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isSingleCoachSelected}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 min-h-[42px]",
              "border border-[#e1ddd8] dark:border-[#262b35] rounded-lg",
              "bg-white dark:bg-[#171b22]",
              "text-left font-albert text-sm",
              "focus:outline-none focus:ring-2 focus:ring-brand-accent",
              "transition-colors",
              (disabled || isSingleCoachSelected)
                ? "opacity-70 cursor-not-allowed bg-[#f5f3ef] dark:bg-[#1a1f2b]"
                : "hover:border-[#c5c0ba] dark:hover:border-[#3a4150] cursor-pointer"
            )}
          >
            {selectedCoach ? (
              <>
                {selectedCoach.imageUrl ? (
                  <Image
                    src={selectedCoach.imageUrl}
                    alt={selectedCoach.name}
                    width={28}
                    height={28}
                    className="rounded-full object-cover flex-shrink-0"
                    style={{ width: 28, height: 28 }}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
                      {selectedCoach.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="flex-1 text-[#1a1a1a] dark:text-[#f5f5f8] truncate text-left">
                  {selectedCoach.name}
                </span>
                {isSingleCoachSelected && (
                  <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">(only coach)</span>
                )}
              </>
            ) : (
              <span className="flex-1 text-[#a7a39e] dark:text-[#7d8190] text-left">
                {loading ? 'Loading coaches...' : placeholder}
              </span>
            )}
            {!isSingleCoachSelected && (
              <ChevronDown className={cn(
                "h-4 w-4 flex-shrink-0 text-[#a7a39e] dark:text-[#7d8190] transition-transform",
                open && "rotate-180"
              )} />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 z-[10010]"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Search input */}
          <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <input
              type="text"
              placeholder="Search coaches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
            />
          </div>

          {/* Coach list */}
          <div className="max-h-[250px] overflow-y-auto p-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-[#a7a39e] dark:text-[#7d8190] font-albert">
                Loading...
              </div>
            ) : filteredCoaches.length === 0 ? (
              <div className="p-4 text-center text-sm text-[#a7a39e] dark:text-[#7d8190] font-albert">
                {searchTerm ? 'No coaches found.' : 'No coaches available.'}
              </div>
            ) : (
              filteredCoaches.map(coach => {
                const isSelected = coach.id === value;

                return (
                  <button
                    key={coach.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selectCoach(coach.id);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left transition-colors"
                  >
                    {/* Selection indicator */}
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border-2 flex-shrink-0 transition-all",
                        isSelected
                          ? 'bg-brand-accent border-brand-accent'
                          : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#171b22]'
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      )}
                    </div>

                    {/* Coach avatar */}
                    {coach.imageUrl ? (
                      <Image
                        src={coach.imageUrl}
                        alt={coach.name}
                        width={32}
                        height={32}
                        className="rounded-full object-cover flex-shrink-0"
                        style={{ width: 32, height: 32 }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
                          {coach.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Coach info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate font-albert">
                        {coach.name}
                      </div>
                      <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate font-albert">
                        {coach.email}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
