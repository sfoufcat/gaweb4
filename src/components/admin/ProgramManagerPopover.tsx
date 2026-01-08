'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Users, User, Loader2, AlertCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { ProgramType } from '@/types';

interface UserProgramEnrollment {
  programId: string;
  programName: string;
  programType: ProgramType;
  status: 'active' | 'upcoming' | 'completed';
}

interface ProgramOption {
  id: string;
  name: string;
  type: ProgramType;
  priceInCents: number;
  currency?: string;
}

interface CohortOption {
  id: string;
  name: string;
  programId: string;
  status: 'upcoming' | 'active' | 'completed' | 'archived';
  startDate: string;
}

interface ProgramManagerPopoverProps {
  programs: UserProgramEnrollment[];
  userId?: string;
  availablePrograms?: ProgramOption[];
  cohortsByProgram?: Record<string, CohortOption[]>;
  onAddToProgram?: (programId: string, cohortId?: string) => Promise<void>;
  onLoadCohorts?: (programId: string) => Promise<void>;
  disabled?: boolean;
  readOnly?: boolean;
  isEnrolling?: boolean;
}

export function ProgramManagerPopover({
  programs,
  userId,
  availablePrograms = [],
  cohortsByProgram = {},
  onAddToProgram,
  onLoadCohorts,
  disabled = false,
  readOnly = false,
  isEnrolling = false,
}: ProgramManagerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [showCohortSelect, setShowCohortSelect] = useState(false);

  // Reset state when popover closes
  useEffect(() => {
    if (!open) {
      setSelectedProgramId(null);
      setSelectedCohortId(null);
      setShowCohortSelect(false);
    }
  }, [open]);

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

  // Get badge color based on program type
  const getBadgeColor = (type: ProgramType) => {
    return type === 'individual'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  };

  // Handle program selection
  const handleProgramSelect = async (programId: string) => {
    const program = availablePrograms.find(p => p.id === programId);
    if (!program) return;

    setSelectedProgramId(programId);

    if (program.type === 'group') {
      // Need to select cohort for group programs
      setShowCohortSelect(true);
      setLoadingCohorts(true);

      // Load cohorts if not already loaded
      if (!cohortsByProgram[programId] && onLoadCohorts) {
        await onLoadCohorts(programId);
      }
      setLoadingCohorts(false);
    } else {
      // 1:1 program - add directly (will show paid warning in parent if needed)
      if (onAddToProgram) {
        await onAddToProgram(programId);
        setOpen(false);
      }
    }
  };

  // Handle cohort selection and enrollment
  const handleCohortSelect = async () => {
    if (!selectedProgramId || !selectedCohortId) return;

    if (onAddToProgram) {
      await onAddToProgram(selectedProgramId, selectedCohortId);
      setOpen(false);
    }
  };

  // Cancel cohort selection
  const handleCancelCohortSelect = () => {
    setSelectedProgramId(null);
    setSelectedCohortId(null);
    setShowCohortSelect(false);
  };

  // Get selected program
  const selectedProgram = selectedProgramId
    ? availablePrograms.find(p => p.id === selectedProgramId)
    : null;

  // Get cohorts for selected program
  const selectedProgramCohorts = selectedProgramId
    ? (cohortsByProgram[selectedProgramId] || []).filter(
        c => c.status === 'upcoming' || c.status === 'active'
      )
    : [];

  // Read-only mode - just show badges
  if (readOnly) {
    if (programs.length === 0) {
      return <span className="text-[#8c8c8c] dark:text-[#7d8190] text-sm font-albert">—</span>;
    }
    return (
      <div className="flex items-center gap-1.5 max-w-[200px]">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-albert truncate max-w-[140px] ${getBadgeColor(programs[0].programType)}`}>
          {displayText}
        </span>
        {extraCount > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 text-[#5f5a55] dark:text-[#b2b6c2] rounded-full text-xs font-medium font-albert whitespace-nowrap">
            +{extraCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled || isEnrolling}
          className={`flex items-center gap-1.5 max-w-[200px] px-2 py-1 rounded-lg border border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-[#11141b] transition-colors ${
            disabled || isEnrolling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {isEnrolling ? (
            <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
          ) : programs.length > 0 ? (
            <>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-albert truncate max-w-[120px] ${getBadgeColor(programs[0].programType)}`}>
                {displayText}
              </span>
              {extraCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 text-[#5f5a55] dark:text-[#b2b6c2] rounded-full text-xs font-medium font-albert whitespace-nowrap">
                  +{extraCount}
                </span>
              )}
            </>
          ) : (
            <span className="text-[#8c8c8c] dark:text-[#7d8190] text-sm font-albert">None</span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[300px] p-0 bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h4 className="font-albert font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
            {showCohortSelect ? 'Select Cohort' : 'Manage Programs'}
          </h4>
          <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
            {showCohortSelect && selectedProgram
              ? selectedProgram.name
              : `${programs.length} program${programs.length !== 1 ? 's' : ''} enrolled`}
          </p>
        </div>

        {/* Cohort Selection View */}
        {showCohortSelect ? (
          <div className="p-3 space-y-3">
            {loadingCohorts ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
              </div>
            ) : selectedProgramCohorts.length === 0 ? (
              <div className="py-4 text-center">
                <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  No available cohorts
                </p>
                <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] mt-1">
                  Create a cohort first in the program settings.
                </p>
              </div>
            ) : (
              <>
                <Select
                  value={selectedCohortId || ''}
                  onValueChange={setSelectedCohortId}
                >
                  <SelectTrigger className="w-full h-9 font-albert text-sm">
                    <SelectValue placeholder="Choose a cohort..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProgramCohorts.map((cohort) => (
                      <SelectItem key={cohort.id} value={cohort.id} className="font-albert text-sm">
                        <div className="flex items-center gap-2">
                          <span>{cohort.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            cohort.status === 'active'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          }`}>
                            {cohort.status}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelCohortSelect}
                className="flex-1 font-albert text-sm"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCohortSelect}
                disabled={!selectedCohortId || isEnrolling}
                className="flex-1 font-albert text-sm bg-brand-accent hover:bg-brand-accent/90"
              >
                {isEnrolling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Add to Cohort'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Enrolled programs list */}
            <div className="max-h-[200px] overflow-y-auto">
              {programs.length > 0 ? (
                <div className="p-2 space-y-1">
                  {programs.map((program) => (
                    <div
                      key={program.programId}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-[#faf8f6] dark:bg-[#11141b]"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {program.programType === 'individual' ? (
                          <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        ) : (
                          <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        )}
                        <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                          {program.programName}
                        </span>
                      </div>
                      <span className={`text-xs font-albert px-1.5 py-0.5 rounded flex-shrink-0 ${
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
              ) : (
                <div className="p-4 text-center">
                  <p className="font-albert text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                    Not enrolled in any programs
                  </p>
                </div>
              )}
            </div>

            {/* Add to program section */}
            {availablePrograms.length > 0 && onAddToProgram && (
              <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <Select
                  value=""
                  onValueChange={handleProgramSelect}
                  disabled={isEnrolling}
                >
                  <SelectTrigger className="w-full h-8 font-albert text-sm border-dashed">
                    <div className="flex items-center gap-1.5 text-[#5f5a55] dark:text-[#b2b6c2]">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to program</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {availablePrograms.map((program) => (
                      <SelectItem key={program.id} value={program.id} className="font-albert text-sm">
                        <div className="flex items-center gap-2">
                          {program.type === 'individual' ? (
                            <User className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <Users className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{program.name}</span>
                          <span className="text-xs text-[#8c8c8c]">
                            ({program.type === 'individual' ? '1:1' : 'Group'})
                          </span>
                          {program.priceInCents > 0 && (
                            <span className="text-xs text-green-600">
                              ${(program.priceInCents / 100).toFixed(0)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* All programs enrolled message */}
            {availablePrograms.length === 0 && programs.length > 0 && onAddToProgram && (
              <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] text-center">
                  Enrolled in all available programs
                </p>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
