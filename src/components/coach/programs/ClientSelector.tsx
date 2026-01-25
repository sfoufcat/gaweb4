'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Check, ChevronDown, ChevronLeft, ChevronRight, FileText, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { ClientViewContext, ProgramEnrollment } from '@/types';

/**
 * ClientSelector Component
 *
 * Dropdown for selecting between template view and individual client views
 * for 1:1 (individual) program editing. Shows "Template" option first,
 * followed by all enrolled clients.
 */

interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    imageUrl?: string;
  };
}

interface ClientSelectorProps {
  enrollments: EnrollmentWithUser[];
  value: ClientViewContext;
  onChange: (context: ClientViewContext) => void;
  loading?: boolean;
  className?: string;
  size?: 'default' | 'large';
}

export function ClientSelector({
  enrollments,
  value,
  onChange,
  loading = false,
  className = '',
  size = 'default',
}: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive'>('active');
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Get display name for a client
  const getClientName = (enrollment: EnrollmentWithUser) => {
    if (enrollment.user?.firstName || enrollment.user?.lastName) {
      return `${enrollment.user.firstName || ''} ${enrollment.user.lastName || ''}`.trim();
    }
    return enrollment.user?.email || 'Unknown Client';
  };

  // Get display info for current selection
  const currentDisplay = useMemo(() => {
    if (value.mode === 'template') {
      return { name: 'Template', subtitle: '', imageUrl: null, isTemplate: true };
    }
    const enrollment = enrollments.find(e => e.id === value.enrollmentId);
    if (enrollment) {
      return {
        name: getClientName(enrollment),
        subtitle: '',
        imageUrl: enrollment.user?.imageUrl,
        isTemplate: false,
      };
    }
    return { name: 'Select view...', subtitle: '', imageUrl: null, isTemplate: false };
  }, [value, enrollments]);

  // Count enrollments by status category
  const activeCount = useMemo(() =>
    enrollments.filter(e => e.status === 'active' || e.status === 'upcoming').length,
    [enrollments]
  );
  const inactiveCount = useMemo(() =>
    enrollments.filter(e => e.status === 'stopped' || e.status === 'completed').length,
    [enrollments]
  );

  // Filter by status category first
  const statusFilteredEnrollments = useMemo(() =>
    enrollments.filter(e => {
      if (statusFilter === 'active') {
        return e.status === 'active' || e.status === 'upcoming';
      }
      return e.status === 'stopped' || e.status === 'completed';
    }),
    [enrollments, statusFilter]
  );

  // Then filter by search term
  const searchFilteredEnrollments = useMemo(() =>
    statusFilteredEnrollments.filter(e => {
      const name = getClientName(e).toLowerCase();
      const email = (e.user?.email || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      return name.includes(term) || email.includes(term);
    }),
    [statusFilteredEnrollments, searchTerm]
  );

  // Sort by createdAt descending (most recently added first)
  const sortedEnrollments = useMemo(() =>
    [...searchFilteredEnrollments].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [searchFilteredEnrollments]
  );

  // Pagination
  const totalPages = Math.ceil(sortedEnrollments.length / PAGE_SIZE);
  const paginatedEnrollments = sortedEnrollments.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(0);
  }, [statusFilter, searchTerm]);

  const selectTemplate = () => {
    onChange({ mode: 'template' });
    setOpen(false);
    setSearchTerm('');
  };

  const selectClient = (enrollment: EnrollmentWithUser) => {
    onChange({
      mode: 'client',
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      userName: getClientName(enrollment),
      enrollmentStartedAt: enrollment.startedAt,
    });
    setOpen(false);
    setSearchTerm('');
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
              ) : currentDisplay.imageUrl ? (
                <Image
                  src={currentDisplay.imageUrl}
                  alt={currentDisplay.name}
                  width={28}
                  height={28}
                  className={`rounded-full flex-shrink-0 ${isLarge ? 'w-7 h-7' : 'w-6 h-6 sm:w-7 sm:h-7'}`}
                />
              ) : (
                <div className={`flex items-center justify-center rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0 ${
                  isLarge ? 'h-7 w-7' : 'h-6 w-6 sm:h-7 sm:w-7'
                }`}>
                  <User className={`text-text-secondary dark:text-[#7d8190] ${isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'}`} />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className={`font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate ${
                  isLarge ? 'text-sm' : 'text-xs sm:text-sm'
                }`}>
                  {loading ? 'Loading...' : currentDisplay.name}
                </span>
                {currentDisplay.subtitle && (
                  <span className={`text-[#5f5a55] dark:text-[#b2b6c2] truncate ${
                    isLarge ? 'text-xs' : 'text-[10px] sm:text-xs'
                  }`}>
                    {currentDisplay.subtitle}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className={`shrink-0 opacity-50 ${isLarge ? 'ml-2 h-4 w-4' : 'ml-1.5 sm:ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4'}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          {/* Search input */}
          <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent dark:focus:ring-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8]"
            />
          </div>

          {/* Status filter pills */}
          <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35] flex gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === 'active'
                  ? 'bg-brand-accent/15 text-brand-accent border border-brand-accent/30'
                  : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] border border-transparent hover:bg-[#e9e5e0] dark:hover:bg-[#313746]'
              }`}
            >
              Active
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                statusFilter === 'active'
                  ? 'bg-brand-accent/20 text-brand-accent'
                  : 'bg-[#e1ddd8]/50 dark:bg-[#3a4150] text-[#7d7a76] dark:text-[#7d8190]'
              }`}>
                {activeCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-brand-accent/15 text-brand-accent border border-brand-accent/30'
                  : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] border border-transparent hover:bg-[#e9e5e0] dark:hover:bg-[#313746]'
              }`}
            >
              Inactive
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                statusFilter === 'inactive'
                  ? 'bg-brand-accent/20 text-brand-accent'
                  : 'bg-[#e1ddd8]/50 dark:bg-[#3a4150] text-[#7d7a76] dark:text-[#7d8190]'
              }`}>
                {inactiveCount}
              </span>
            </button>
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
                  Edit master content for all clients
                </div>
              </div>
            </button>

            {/* Separator */}
            {paginatedEnrollments.length > 0 && (
              <div className="my-1 mx-2 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
            )}

            {/* Enrolled clients */}
            {loading ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                Loading clients...
              </div>
            ) : sortedEnrollments.length === 0 && searchTerm ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                No clients found.
              </div>
            ) : sortedEnrollments.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                No {statusFilter === 'active' ? 'active' : 'inactive'} clients.
              </div>
            ) : (
              paginatedEnrollments.map(enrollment => {
                const isSelected = value.mode === 'client' && value.enrollmentId === enrollment.id;
                const clientName = getClientName(enrollment);

                return (
                  <button
                    key={enrollment.id}
                    type="button"
                    onClick={() => selectClient(enrollment)}
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
                    {enrollment.user?.imageUrl ? (
                      <Image
                        src={enrollment.user.imageUrl}
                        alt={clientName}
                        width={28}
                        height={28}
                        className="rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                        <User className="h-4 w-4 text-text-secondary dark:text-[#7d8190]" />
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
                    {/* Status badge */}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                        enrollment.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : enrollment.status === 'upcoming'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : enrollment.status === 'completed'
                          ? 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {enrollment.status}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with pagination */}
          <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1 rounded hover:bg-[#e9e5e0] dark:hover:bg-[#262b35] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              </button>
              <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] min-w-[60px] text-center">
                {totalPages > 0 ? `${currentPage + 1} of ${totalPages}` : '0 of 0'}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1 rounded hover:bg-[#e9e5e0] dark:hover:bg-[#262b35] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              </button>
            </div>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              {sortedEnrollments.length} client{sortedEnrollments.length !== 1 ? 's' : ''}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
