'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronDown, FileText, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { CohortViewContext, ProgramCohort } from '@/types';

/**
 * CohortSelector Component
 *
 * Dropdown for selecting between template view and cohort-specific views
 * for group program editing. Shows "Template" option first,
 * followed by all program cohorts.
 */

interface CohortSelectorProps {
  cohorts: ProgramCohort[];
  value: CohortViewContext;
  onChange: (context: CohortViewContext) => void;
  onCreateCohort?: () => void;
  loading?: boolean;
  className?: string;
  size?: 'default' | 'large';
}

export function CohortSelector({
  cohorts,
  value,
  onChange,
  onCreateCohort,
  loading = false,
  className = '',
  size = 'default',
}: CohortSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Get display info for current selection
  const currentDisplay = useMemo(() => {
    if (value.mode === 'template') {
      return { name: 'Template', subtitle: 'Master content', isTemplate: true };
    }
    const cohort = cohorts.find(c => c.id === value.cohortId);
    if (cohort) {
      return {
        name: cohort.name,
        subtitle: '',
        enrollmentCount: cohort.currentEnrollment,
        isTemplate: false,
      };
    }
    return { name: 'Select view...', subtitle: '', enrollmentCount: undefined, isTemplate: false };
  }, [value, cohorts]);

  // Filter cohorts by search term
  const filteredCohorts = useMemo(() =>
    cohorts.filter(c => {
      const name = c.name.toLowerCase();
      const term = searchTerm.toLowerCase();
      return name.includes(term);
    }),
    [cohorts, searchTerm]
  );

  // Sort: active first, then upcoming, then completed
  const sortedCohorts = useMemo(() =>
    [...filteredCohorts].sort((a, b) => {
      const statusOrder = { active: 0, upcoming: 1, completed: 2, archived: 3 };
      return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
    }),
    [filteredCohorts]
  );

  const selectTemplate = () => {
    onChange({ mode: 'template' });
    setOpen(false);
    setSearchTerm('');
  };

  const selectCohort = (cohort: ProgramCohort) => {
    onChange({
      mode: 'cohort',
      cohortId: cohort.id,
      cohortName: cohort.name,
      cohortStartDate: cohort.startDate,
    });
    setOpen(false);
    setSearchTerm('');
  };

  const getStatusColor = (status: ProgramCohort['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'upcoming':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'completed':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400';
      case 'archived':
        return 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-500';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400';
    }
  };

  const isLarge = size === 'large';

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`w-full justify-between h-auto font-normal text-left border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] ${
              isLarge ? 'min-h-[44px] px-3' : 'min-h-[36px] sm:min-h-[40px] px-2 sm:px-3'
            }`}
          >
            <div className={`flex items-center flex-1 min-w-0 ${isLarge ? 'gap-2' : 'gap-1.5 sm:gap-2'}`}>
              {currentDisplay.isTemplate ? (
                <div className={`flex items-center justify-center rounded-full bg-brand-accent/10 flex-shrink-0 ${
                  isLarge ? 'h-7 w-7' : 'h-6 w-6 sm:h-7 sm:w-7'
                }`}>
                  <FileText className={`text-brand-accent ${isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'}`} />
                </div>
              ) : (
                <div className={`flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 flex-shrink-0 ${
                  isLarge ? 'h-7 w-7' : 'h-6 w-6 sm:h-7 sm:w-7'
                }`}>
                  <Users className={`text-purple-600 dark:text-purple-400 ${isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'}`} />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className={`font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate ${
                  isLarge ? 'text-sm' : 'text-xs sm:text-sm'
                }`}>
                  {loading ? 'Loading...' : currentDisplay.name}
                  {!currentDisplay.isTemplate && currentDisplay.enrollmentCount !== undefined && (
                    <span className="text-brand-accent ml-1">({currentDisplay.enrollmentCount})</span>
                  )}
                </span>
              </div>
            </div>
            <ChevronDown className={`shrink-0 opacity-50 ${isLarge ? 'ml-2 h-4 w-4' : 'ml-1.5 sm:ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4'}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={`p-0 ${isLarge ? 'w-[var(--radix-popover-trigger-width)]' : 'w-[320px]'}`} align="start">
          {/* Search input */}
          <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <input
              type="text"
              placeholder="Search cohorts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent dark:focus:ring-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8]"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto p-1">
            {/* Template option - always first */}
            <button
              type="button"
              onClick={selectTemplate}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left"
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-md border-2 flex-shrink-0 transition-all ${
                  value.mode === 'template'
                    ? 'bg-brand-accent border-brand-accent'
                    : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#171b22]'
                }`}
              >
                {value.mode === 'template' && (
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                )}
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/10 flex-shrink-0">
                <FileText className="h-4 w-4 text-brand-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Template
                </div>
                <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  Edit master content for all cohorts
                </div>
              </div>
            </button>

            {/* Separator */}
            {(sortedCohorts.length > 0 || onCreateCohort) && (
              <div className="my-1 mx-2 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
            )}

            {/* Cohorts */}
            {loading ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                Loading cohorts...
              </div>
            ) : sortedCohorts.length === 0 && searchTerm ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                No cohorts found.
              </div>
            ) : sortedCohorts.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-text-secondary dark:text-[#7d8190] mb-2">
                  No cohorts yet.
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  Create a cohort to add recordings and call summaries.
                </p>
              </div>
            ) : (
              sortedCohorts.map(cohort => {
                const isSelected = value.mode === 'cohort' && value.cohortId === cohort.id;
                const dateRange = `${new Date(cohort.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(cohort.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                return (
                  <button
                    key={cohort.id}
                    type="button"
                    onClick={() => selectCohort(cohort)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left"
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border-2 flex-shrink-0 transition-all ${
                        isSelected
                          ? 'bg-brand-accent border-brand-accent'
                          : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#171b22]'
                      }`}
                    >
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      )}
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 flex-shrink-0">
                      <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {cohort.name}
                      </div>
                      <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                        {dateRange} · {cohort.currentEnrollment} enrolled
                      </div>
                    </div>
                    {/* Status badge */}
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${getStatusColor(cohort.status)}`}>
                      {cohort.status}
                    </span>
                  </button>
                );
              })
            )}

            {/* Create cohort button */}
            {onCreateCohort && (
              <>
                <div className="my-1 mx-2 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onCreateCohort();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left text-brand-accent"
                >
                  <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="font-medium">Create new cohort</span>
                </button>
              </>
            )}
          </div>

          {/* Footer with count */}
          <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
