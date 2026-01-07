'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { ProgramType } from '@/types';

interface UserProgramEnrollment {
  programId: string;
  programName: string;
  programType: ProgramType;
  status: 'active' | 'upcoming' | 'completed';
}

interface ProgramManagerPopoverProps {
  programs: UserProgramEnrollment[];
  disabled?: boolean;
}

export function ProgramManagerPopover({
  programs,
  disabled = false,
}: ProgramManagerPopoverProps) {
  const [open, setOpen] = useState(false);

  // Get display text for trigger
  const getDisplayText = () => {
    if (programs.length === 0) {
      return null;
    }
    const first = programs[0];
    const prefix = first.programType === 'individual' ? '(1:1)' : '(Group)';
    return `${prefix} ${first.programName}`;
  };

  const displayText = getDisplayText();
  const extraCount = programs.length - 1;

  // No programs - show dash
  if (programs.length === 0) {
    return <span className="text-[#8c8c8c] dark:text-[#7d8190] text-sm font-albert">—</span>;
  }

  // Get badge color based on program type
  const getBadgeColor = (type: ProgramType) => {
    return type === 'individual'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={`flex items-center gap-1.5 max-w-[200px] px-2 py-1 rounded-lg border border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-[#11141b] transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-albert truncate max-w-[120px] ${getBadgeColor(programs[0].programType)}`}>
            {displayText}
          </span>
          {extraCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 text-[#5f5a55] dark:text-[#b2b6c2] rounded-full text-xs font-medium font-albert whitespace-nowrap">
              +{extraCount}
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[280px] p-0 bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h4 className="font-albert font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
            Enrolled Programs
          </h4>
          <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
            {programs.length} program{programs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Programs list */}
        <div className="max-h-[250px] overflow-y-auto p-2 space-y-1">
          {programs.map((program) => (
            <div
              key={program.programId}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-[#faf8f6] dark:bg-[#11141b]"
            >
              <div className="flex-1 min-w-0">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-albert ${getBadgeColor(program.programType)}`}>
                  {program.programType === 'individual' ? '(1:1)' : '(Group)'}
                </span>
                <span className="ml-2 font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                  {program.programName}
                </span>
              </div>
              <span className={`text-xs font-albert px-1.5 py-0.5 rounded ${
                program.status === 'active'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : program.status === 'upcoming'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {program.status}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
