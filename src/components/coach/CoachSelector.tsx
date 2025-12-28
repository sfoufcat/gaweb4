'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * CoachSelector Component
 * 
 * Multi-select dropdown for assigning coaches to programs/squads.
 * Coaches are passed as props (already loaded by parent component).
 * Selection order is preserved to show assignment order.
 */

interface Coach {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
}

interface CoachSelectorProps {
  coaches: Coach[];
  value: string[];
  onChange: (coachIds: string[]) => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
}

export function CoachSelector({
  coaches,
  value = [],
  onChange,
  loading = false,
  placeholder = 'Select coaches...',
  className = '',
}: CoachSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleCoach = (coachId: string) => {
    if (value.includes(coachId)) {
      onChange(value.filter(id => id !== coachId));
    } else {
      onChange([...value, coachId]);
    }
  };

  const removeCoach = (coachId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(id => id !== coachId));
  };

  const selectedCoaches = useMemo(() => 
    value.map(id => coaches.find(c => c.id === id)).filter(Boolean) as Coach[],
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

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[40px] font-normal text-left border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]"
          >
            {selectedCoaches.length > 0 ? (
              <div className="flex flex-wrap gap-1 flex-1">
                {selectedCoaches.map((coach, index) => (
                  <span
                    key={coach.id}
                    className="inline-flex items-center gap-1.5 bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] text-xs px-2 py-1 rounded-full"
                  >
                    {coach.imageUrl && (
                      <Image
                        src={coach.imageUrl}
                        alt={coach.name}
                        width={16}
                        height={16}
                        className="rounded-full"
                      />
                    )}
                    <span className="max-w-[100px] truncate">{coach.name}</span>
                    <span className="text-[#a07855] dark:text-[#b8896a] font-medium">#{index + 1}</span>
                    <button
                      type="button"
                      onClick={(e) => removeCoach(coach.id, e)}
                      className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-text-secondary dark:text-[#7d8190]">
                {loading ? 'Loading coaches...' : placeholder}
              </span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <input
              type="text"
              placeholder="Search coaches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a] dark:focus:ring-[#b8896a] text-[#1a1a1a] dark:text-[#f5f5f8]"
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto p-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                Loading...
              </div>
            ) : filteredCoaches.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                {searchTerm ? 'No coaches found.' : 'No coaches available.'}
              </div>
            ) : (
              filteredCoaches.map(coach => {
                const isSelected = value.includes(coach.id);
                const selectionIndex = value.indexOf(coach.id);
                
                return (
                  <button
                    key={coach.id}
                    type="button"
                    onClick={() => toggleCoach(coach.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left"
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border-2 flex-shrink-0 transition-all ${
                        isSelected
                          ? 'bg-[#a07855] dark:bg-[#b8896a] border-[#a07855] dark:border-[#b8896a]'
                          : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#171b22]'
                      }`}
                    >
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      )}
                    </div>
                    {coach.imageUrl && (
                      <Image
                        src={coach.imageUrl}
                        alt={coach.name}
                        width={28}
                        height={28}
                        className="rounded-full flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {coach.name}
                      </div>
                      <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                        {coach.email}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs text-[#a07855] dark:text-[#b8896a] font-medium flex-shrink-0">
                        #{selectionIndex + 1}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          
          {/* Assignment order helper */}
          {value.length > 0 && (
            <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                <span className="font-medium">Assignment order:</span>{' '}
                {selectedCoaches.map(c => c.name).join(' → ')} → (repeat)
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

