'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  /** API endpoint to fetch programs from. Defaults to /api/admin/programs for admin, use /api/coach/org-programs for coach context */
  programsApiEndpoint?: string;
  /** Whether to show the helper text below the selector */
  showHelperText?: boolean;
}

export function ProgramSelector({
  value = [],
  onChange,
  placeholder = 'Select programs...',
  className = '',
  programsApiEndpoint = '/api/admin/programs',
  showHelperText = false,
}: ProgramSelectorProps) {
  const [open, setOpen] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch programs on mount
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const response = await fetch(programsApiEndpoint);
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
  }, [programsApiEndpoint]);

  const toggleProgram = (programId: string) => {
    if (value.includes(programId)) {
      onChange(value.filter(id => id !== programId));
    } else {
      onChange([...value, programId]);
    }
  };

  const removeProgram = (programId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(id => id !== programId));
  };

  const selectedPrograms = programs.filter(p => value.includes(p.id));
  
  // Filter programs by search term
  const filteredPrograms = programs.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={cn('relative', className)}>
      {/* Trigger Button - styled like Select */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#0d0f14] px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selectedPrograms.length > 0 ? (
          <div className="flex flex-wrap gap-1 flex-1 mr-2 overflow-hidden">
            {selectedPrograms.map(program => (
              <span
                key={program.id}
                className="inline-flex items-center gap-1 bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] text-xs px-2 py-0.5 rounded-full"
              >
                {program.name}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => removeProgram(program.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      removeProgram(program.id, e as unknown as React.MouseEvent);
                    }
                  }}
                  className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[#9ca3af] dark:text-[#7d8190]">
            {loading ? 'Loading...' : placeholder}
          </span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Dropdown Content */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] shadow-md animate-in fade-in-0 zoom-in-95"
        >
          <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <input
              type="text"
              placeholder="Search programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#0d0f14] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8]"
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-[#9ca3af] dark:text-[#7d8190]">
                Loading...
              </div>
            ) : filteredPrograms.length === 0 ? (
              <div className="p-4 text-center text-sm text-[#9ca3af] dark:text-[#7d8190]">
                {searchTerm ? 'No programs found.' : 'No programs available.'}
              </div>
            ) : (
              filteredPrograms.map(program => (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => toggleProgram(program.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left"
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border flex-shrink-0 ${
                      value.includes(program.id)
                        ? 'bg-brand-accent border-brand-accent'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {value.includes(program.id) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="flex-1 text-[#1a1a1a] dark:text-[#f5f5f8]">{program.name}</span>
                  <span className="text-xs text-[#9ca3af] dark:text-[#7d8190]">
                    {program.type === 'group' ? 'Group' : '1:1'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Helper text - only shown if explicitly enabled */}
      {showHelperText && (
        <p className="text-xs text-[#9ca3af] dark:text-[#7d8190] mt-1">
          Select which programs this content should be available in. Leave empty for all users.
        </p>
      )}
    </div>
  );
}
