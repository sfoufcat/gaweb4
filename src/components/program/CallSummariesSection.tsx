'use client';

/**
 * CallSummariesSection Component
 *
 * Displays past call summaries for the client.
 * Shows the most recent summaries with expandable details.
 */

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  Target,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import type { CallSummary } from '@/types';

interface CallSummariesSectionProps {
  summaries: CallSummary[];
  totalCount: number;
  isLoading?: boolean;
  showViewAll?: boolean;
  viewAllHref?: string;
}

export function CallSummariesSection({
  summaries,
  totalCount,
  isLoading = false,
  showViewAll = true,
  viewAllHref = '/call-summaries',
}: CallSummariesSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatDate = (dateValue: string | { seconds: number; nanoseconds: number } | null | undefined) => {
    if (!dateValue) return '';

    let date: Date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (typeof dateValue === 'object' && 'seconds' in dateValue) {
      // Firestore Timestamp
      date = new Date(dateValue.seconds * 1000);
    } else {
      return '';
    }

    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
          Call Summaries
        </h2>
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-6 flex items-center justify-center min-h-[120px]">
          <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
        </div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
          Call Summaries
        </h2>
        {showViewAll && totalCount > summaries.length && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-[14px] text-brand-accent hover:underline"
          >
            View all ({totalCount})
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {summaries.map((summary) => {
          const isExpanded = expandedId === summary.id;
          const actionItems = summary.actionItems || [];
          const focusAreas = summary.summary?.keyDiscussionPoints || [];

          return (
            <div
              key={summary.id}
              className="bg-white dark:bg-[#171b22] rounded-[16px] overflow-hidden"
            >
              {/* Summary Header */}
              <button
                onClick={() => toggleExpanded(summary.id)}
                className="w-full px-5 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>

                  <div className="text-left">
                    <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3]">
                      Call Summary
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[12px] text-text-muted dark:text-[#7d8190]">
                        <Calendar className="w-3 h-3" />
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {formatDate(summary.createdAt as any)}
                      </span>
                      {summary.callDurationSeconds && (
                        <span className="flex items-center gap-1 text-[12px] text-text-muted dark:text-[#7d8190]">
                          <Clock className="w-3 h-3" />
                          {Math.round(summary.callDurationSeconds / 60)} min
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                </motion.div>
              </button>

              {/* Expandable Content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4 border-t border-[#f3f1ef] dark:border-[#262b35] pt-4">
                      {/* Summary text */}
                      {summary.summary?.executive && (
                        <div>
                          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6]">
                            {summary.summary.executive}
                          </p>
                        </div>
                      )}

                      {/* Focus Areas */}
                      {focusAreas.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-brand-accent" />
                            <h4 className="font-sans text-[13px] font-semibold text-text-secondary dark:text-[#b2b6c2]">
                              Focus Areas
                            </h4>
                          </div>
                          <ul className="space-y-1.5 pl-6">
                            {focusAreas.map((focus, index) => (
                              <li
                                key={index}
                                className="flex items-center gap-2"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0" />
                                <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                                  {focus}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action Items */}
                      {actionItems.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <h4 className="font-sans text-[13px] font-semibold text-text-secondary dark:text-[#b2b6c2]">
                              Action Items
                            </h4>
                          </div>
                          <ul className="space-y-1.5 pl-6">
                            {actionItems.map((item, index) => (
                              <li
                                key={item.id || index}
                                className="flex items-start gap-2"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 mt-2" />
                                <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                                  {item.description}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
