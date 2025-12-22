'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * ProgramSelector Component
 * 
 * Multi-select dropdown for assigning content to programs.
 * Fetches available programs for the current organization.
 * 
 * Used in admin content forms (articles, courses, events, downloads, links)
 * to associate content with specific programs.
 */

interface Program {
  id: string;
  name: string;
  type: 'group' | 'individual';
}

interface ProgramSelectorProps {
  value: string[];
  onChange: (programIds: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function ProgramSelector({
  value = [],
  onChange,
  placeholder = 'Select programs...',
  className = '',
}: ProgramSelectorProps) {
  const [open, setOpen] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch programs on mount
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const response = await fetch('/api/admin/programs');
        if (response.ok) {
          const data = await response.json();
          setPrograms(data.programs || []);
        }
      } catch (error) {
        console.error('Failed to fetch programs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrograms();
  }, []);

  const toggleProgram = (programId: string) => {
    if (value.includes(programId)) {
      onChange(value.filter(id => id !== programId));
    } else {
      onChange([...value, programId]);
    }
  };

  const removeProgram = (programId: string) => {
    onChange(value.filter(id => id !== programId));
  };

  const selectedPrograms = programs.filter(p => value.includes(p.id));

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[40px] font-normal"
          >
            {selectedPrograms.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedPrograms.map(program => (
                  <span
                    key={program.id}
                    className="inline-flex items-center gap-1 bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] text-xs px-2 py-0.5 rounded-full"
                  >
                    {program.name}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProgram(program.id);
                      }}
                      className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-text-secondary dark:text-[#7d8190]">
                {loading ? 'Loading programs...' : placeholder}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search programs..." />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Loading...' : 'No programs found.'}
              </CommandEmpty>
              <CommandGroup>
                {programs.map(program => (
                  <CommandItem
                    key={program.id}
                    value={program.name}
                    onSelect={() => toggleProgram(program.id)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          value.includes(program.id)
                            ? 'bg-[#a07855] border-[#a07855]'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {value.includes(program.id) && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <span>{program.name}</span>
                      <span className="ml-auto text-xs text-text-secondary dark:text-[#7d8190]">
                        {program.type === 'group' ? 'Group' : '1:1'}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Helper text */}
      <p className="text-xs text-text-secondary dark:text-[#7d8190] mt-1">
        Select which programs this content should be available in. Leave empty for all users.
      </p>
    </div>
  );
}

