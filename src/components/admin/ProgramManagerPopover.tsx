'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Users, User, Loader2, AlertCircle, BookOpen } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  // Reset state when popover closes
  useEffect(() => {
    if (!open) {
      setSelectedProgramId(null);
      setSelectedCohortId(null);
      setShowCohortSelect(false);
      setShowAddDropdown(false);
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
    setShowAddDropdown(false);

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
  const handleCohortSelect = async (cohortId: string) => {
    if (!selectedProgramId) return;
    setSelectedCohortId(cohortId);

    if (onAddToProgram) {
      await onAddToProgram(selectedProgramId, cohortId);
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
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium font-albert truncate max-w-[140px] ${getBadgeColor(programs[0].programType)}`}>
          {displayText}
        </span>
        {extraCount > 0 && (
          <span className="inline-flex items-center px-2 py-1 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 text-[#5f5a55] dark:text-[#b2b6c2] rounded-full text-xs font-medium font-albert whitespace-nowrap">
            +{extraCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setShowAddDropdown(false);
        setShowCohortSelect(false);
      }
    }}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled || isEnrolling}
          className={`flex items-center gap-1.5 max-w-[220px] pr-2.5 py-1.5 rounded-xl border border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35] hover:bg-[#faf8f6]/80 dark:hover:bg-[#11141b]/80 transition-all duration-200 ${
            disabled || isEnrolling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${open ? 'bg-[#faf8f6] dark:bg-[#11141b] border-[#e1ddd8] dark:border-[#262b35]' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {isEnrolling ? (
            <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
          ) : programs.length > 0 ? (
            <>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium font-albert truncate max-w-[130px] ${getBadgeColor(programs[0].programType)}`}>
                {displayText}
              </span>
              {extraCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 text-[#5f5a55] dark:text-[#b2b6c2] rounded-full text-xs font-medium font-albert">
                  +{extraCount}
                </span>
              )}
            </>
          ) : (
            <span className="text-[#8c8c8c] dark:text-[#7d8190] text-sm font-albert">None</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[320px] p-0 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-b from-[#faf8f6] to-white dark:from-[#1a1f2a] dark:to-[#171b22]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-albert font-semibold text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                {showCohortSelect ? 'Select Cohort' : 'Programs'}
              </h4>
              <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                {showCohortSelect && selectedProgram
                  ? selectedProgram.name
                  : `${programs.length} ${programs.length === 1 ? 'program' : 'programs'} enrolled`}
              </p>
            </div>
          </div>
        </div>

        {/* Cohort Selection View */}
        {showCohortSelect ? (
          <div className="p-3 space-y-3">
            {loadingCohorts ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
              </div>
            ) : selectedProgramCohorts.length === 0 ? (
              <div className="py-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
                <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  No available cohorts
                </p>
                <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] mt-1">
                  Create a cohort first in the program settings.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {selectedProgramCohorts.map((cohort) => (
                  <button
                    key={cohort.id}
                    onClick={() => handleCohortSelect(cohort.id)}
                    disabled={isEnrolling}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] hover:bg-[#f5f2ef] dark:hover:bg-[#1a1f2a] transition-colors text-left"
                  >
                    <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {cohort.name}
                    </span>
                    <span className={`text-xs font-albert px-2 py-0.5 rounded-full ${
                      cohort.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {cohort.status}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Back button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelCohortSelect}
              className="w-full font-albert text-sm rounded-xl"
            >
              Back to programs
            </Button>
          </div>
        ) : (
          <>
            {/* Enrolled programs list */}
            <div className="max-h-[220px] overflow-y-auto">
              {programs.length > 0 ? (
                <div className="p-2 space-y-1">
                  {programs.map((program) => (
                    <div
                      key={program.programId}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] hover:bg-[#f5f2ef] dark:hover:bg-[#1a1f2a] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={`p-1 rounded-lg ${program.programType === 'individual' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                          {program.programType === 'individual' ? (
                            <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                          {program.programName}
                        </span>
                      </div>
                      <span className={`text-xs font-albert px-2 py-0.5 rounded-full flex-shrink-0 ${
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
                <div className="p-6 text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-[#8c8c8c] dark:text-[#7d8190]" />
                  </div>
                  <p className="font-albert text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                    Not enrolled in any programs
                  </p>
                </div>
              )}
            </div>

            {/* Add to program section */}
            {availablePrograms.length > 0 && onAddToProgram && (
              <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <div className="relative">
                  <button
                    onClick={() => setShowAddDropdown(!showAddDropdown)}
                    disabled={isEnrolling}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-all duration-200 group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2] group-hover:text-brand-accent transition-colors">
                      <Plus className="w-4 h-4" />
                      <span className="font-albert text-sm font-medium">Add to program</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] group-hover:text-brand-accent transition-all duration-200 ${showAddDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showAddDropdown && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg overflow-hidden z-10">
                      <div className="max-h-[180px] overflow-y-auto py-1">
                        {availablePrograms.map((program) => (
                          <button
                            key={program.id}
                            onClick={() => handleProgramSelect(program.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#faf8f6] dark:hover:bg-[#11141b] transition-colors"
                          >
                            <div className={`p-1 rounded-lg ${program.type === 'individual' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                              {program.type === 'individual' ? (
                                <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              ) : (
                                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] block truncate">
                                {program.name}
                              </span>
                              <span className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                                {program.type === 'individual' ? '1:1' : 'Group'}
                                {program.priceInCents > 0 && ` · $${(program.priceInCents / 100).toFixed(0)}`}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All programs enrolled message */}
            {availablePrograms.length === 0 && programs.length > 0 && onAddToProgram && (
              <div className="p-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
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
