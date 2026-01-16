'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Check, ChevronDown, LayoutDashboard, User, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ProgramEnrollment, ProgramCohort } from '@/types';

/**
 * Unified selector for dashboard view context
 * - "Program" = program-wide dashboard (no selection)
 * - Client selection = individual client view (for 1:1 programs)
 * - Cohort selection = cohort-specific view (for group programs)
 */

export type DashboardViewContext =
  | { mode: 'program' }
  | { mode: 'client'; clientId: string; clientName: string; enrollmentId: string }
  | { mode: 'cohort'; cohortId: string; cohortName: string };

interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    imageUrl?: string;
  };
}

interface ClientCohortSelectorProps {
  programType: 'individual' | 'cohort';
  enrollments?: EnrollmentWithUser[];
  cohorts?: ProgramCohort[];
  value: DashboardViewContext;
  onChange: (context: DashboardViewContext) => void;
  loading?: boolean;
  className?: string;
}

export function ClientCohortSelector({
  programType,
  enrollments = [],
  cohorts = [],
  value,
  onChange,
  loading = false,
  className,
}: ClientCohortSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Get client name helper
  const getClientName = (enrollment: EnrollmentWithUser) => {
    if (enrollment.user?.firstName || enrollment.user?.lastName) {
      return `${enrollment.user.firstName || ''} ${enrollment.user.lastName || ''}`.trim();
    }
    return enrollment.user?.email || 'Unknown Client';
  };

  // Current display info
  const currentDisplay = useMemo(() => {
    if (value.mode === 'program') {
      return {
        name: 'Program Overview',
        subtitle: 'All members',
        icon: 'program',
        imageUrl: null,
      };
    }
    if (value.mode === 'client') {
      const enrollment = enrollments.find(e => e.userId === value.clientId);
      return {
        name: value.clientName,
        subtitle: 'Individual view',
        icon: 'client',
        imageUrl: enrollment?.user?.imageUrl || null,
      };
    }
    if (value.mode === 'cohort') {
      return {
        name: value.cohortName,
        subtitle: 'Cohort view',
        icon: 'cohort',
        imageUrl: null,
      };
    }
    return { name: 'Select view...', subtitle: '', icon: 'program', imageUrl: null };
  }, [value, enrollments]);

  // Filter enrollments
  const filteredEnrollments = useMemo(() => {
    if (programType !== 'individual') return [];
    return enrollments
      .filter(e => e.status === 'active' || e.status === 'upcoming')
      .filter(e => {
        const name = getClientName(e).toLowerCase();
        const email = (e.user?.email || '').toLowerCase();
        return name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
      });
  }, [enrollments, searchTerm, programType]);

  // Filter cohorts
  const filteredCohorts = useMemo(() => {
    if (programType !== 'cohort') return [];
    return cohorts
      .filter(c => c.status === 'active' || c.status === 'upcoming')
      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [cohorts, searchTerm, programType]);

  const selectProgram = () => {
    onChange({ mode: 'program' });
    setOpen(false);
    setSearchTerm('');
  };

  const selectClient = (enrollment: EnrollmentWithUser) => {
    onChange({
      mode: 'client',
      clientId: enrollment.userId,
      clientName: getClientName(enrollment),
      enrollmentId: enrollment.id,
    });
    setOpen(false);
    setSearchTerm('');
  };

  const selectCohort = (cohort: ProgramCohort) => {
    onChange({
      mode: 'cohort',
      cohortId: cohort.id,
      cohortName: cohort.name,
    });
    setOpen(false);
    setSearchTerm('');
  };

  const hasItems = programType === 'individual' ? enrollments.length > 0 : cohorts.length > 0;

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[44px] font-normal text-left border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] px-3 hover:bg-[#faf8f6] dark:hover:bg-[#1e222a]"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Icon/Avatar */}
              {currentDisplay.icon === 'program' ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-accent/20 to-brand-accent/10 flex-shrink-0">
                  <LayoutDashboard className="h-4 w-4 text-brand-accent" />
                </div>
              ) : currentDisplay.icon === 'cohort' ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 flex-shrink-0">
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              ) : currentDisplay.imageUrl ? (
                <Image
                  src={currentDisplay.imageUrl}
                  alt={currentDisplay.name}
                  width={32}
                  height={32}
                  className="rounded-full flex-shrink-0"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                  <User className="h-4 w-4 text-[#8c8c8c] dark:text-[#7d8190]" />
                </div>
              )}

              {/* Text */}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                  {loading ? 'Loading...' : currentDisplay.name}
                </span>
                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                  {currentDisplay.subtitle}
                </span>
              </div>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[320px] p-0" align="start">
          {/* Search */}
          {hasItems && (
            <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190]" />
                <input
                  type="text"
                  placeholder={`Search ${programType === 'individual' ? 'clients' : 'cohorts'}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
            </div>
          )}

          <div className="max-h-[300px] overflow-y-auto p-1">
            {/* Program Overview option */}
            <button
              type="button"
              onClick={selectProgram}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left transition-colors"
            >
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-md border-2 flex-shrink-0 transition-all',
                  value.mode === 'program'
                    ? 'bg-brand-accent border-brand-accent'
                    : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#171b22]'
                )}
              >
                {value.mode === 'program' && (
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                )}
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-accent/20 to-brand-accent/10 flex-shrink-0">
                <LayoutDashboard className="h-4 w-4 text-brand-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Program Overview
                </div>
                <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  View all members&apos; progress
                </div>
              </div>
            </button>

            {/* Separator */}
            {hasItems && (
              <div className="my-1 mx-2 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
            )}

            {/* Clients list (for individual programs) */}
            {programType === 'individual' && (
              loading ? (
                <div className="p-4 text-center text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                  Loading clients...
                </div>
              ) : filteredEnrollments.length === 0 && searchTerm ? (
                <div className="p-4 text-center text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                  No clients found.
                </div>
              ) : filteredEnrollments.length === 0 ? (
                <div className="p-4 text-center text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                  No active clients.
                </div>
              ) : (
                filteredEnrollments.map(enrollment => {
                  const isSelected = value.mode === 'client' && value.clientId === enrollment.userId;
                  const clientName = getClientName(enrollment);

                  return (
                    <button
                      key={enrollment.id}
                      type="button"
                      onClick={() => selectClient(enrollment)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left transition-colors"
                    >
                      <div
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-md border-2 flex-shrink-0 transition-all',
                          isSelected
                            ? 'bg-brand-accent border-brand-accent'
                            : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#171b22]'
                        )}
                      >
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                        )}
                      </div>
                      {enrollment.user?.imageUrl ? (
                        <Image
                          src={enrollment.user.imageUrl}
                          alt={clientName}
                          width={32}
                          height={32}
                          className="rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                          <User className="h-4 w-4 text-[#8c8c8c] dark:text-[#7d8190]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                          {clientName}
                        </div>
                        <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                          {enrollment.user?.email}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                          enrollment.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        )}
                      >
                        {enrollment.status}
                      </span>
                    </button>
                  );
                })
              )
            )}

            {/* Cohorts list (for group programs) */}
            {programType === 'cohort' && (
              loading ? (
                <div className="p-4 text-center text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                  Loading cohorts...
                </div>
              ) : filteredCohorts.length === 0 && searchTerm ? (
                <div className="p-4 text-center text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                  No cohorts found.
                </div>
              ) : filteredCohorts.length === 0 ? (
                <div className="p-4 text-center text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                  No active cohorts.
                </div>
              ) : (
                filteredCohorts.map(cohort => {
                  const isSelected = value.mode === 'cohort' && value.cohortId === cohort.id;

                  return (
                    <button
                      key={cohort.id}
                      type="button"
                      onClick={() => selectCohort(cohort)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left transition-colors"
                    >
                      <div
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-md border-2 flex-shrink-0 transition-all',
                          isSelected
                            ? 'bg-brand-accent border-brand-accent'
                            : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#171b22]'
                        )}
                      >
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                        )}
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 flex-shrink-0">
                        <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                          {cohort.name}
                        </div>
                        <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                          {cohort.currentEnrollment} members
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                          cohort.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        )}
                      >
                        {cohort.status}
                      </span>
                    </button>
                  );
                })
              )
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              {programType === 'individual'
                ? `${enrollments.filter(e => e.status === 'active' || e.status === 'upcoming').length} active client${enrollments.length !== 1 ? 's' : ''}`
                : `${cohorts.filter(c => c.status === 'active' || c.status === 'upcoming').length} active cohort${cohorts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
