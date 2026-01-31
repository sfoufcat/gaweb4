'use client';

import { useState } from 'react';
import { CalendarDays, FileQuestion, Clock, ChevronRight, Video, History, FileText, Wand2, Check, Calendar, Phone, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { SummaryConfirmationModal } from '../SummaryConfirmationModal';

export interface UpcomingItem {
  type: 'call' | 'form';
  title: string;
  date?: string;
  actionType?: 'reschedule' | 'send_reminder';
}

export interface PastSessionItem {
  id: string;
  title: string;
  date: string;
  coverImageUrl?: string;
  hasRecording: boolean;
  hasSummary?: boolean;
  summaryId?: string;
  hasFilledFromSummary?: boolean;
  eventId: string;
  eventType?: 'coaching_1on1' | 'cohort_call' | 'squad_call' | 'intake_call' | 'community_event';
  onViewSummary?: () => void;
  onFillWeek?: () => void;
  onSummaryGenerated?: (summaryId: string) => void;
  onClick?: (e: React.MouseEvent) => void;
}

interface UpcomingSectionProps {
  items: UpcomingItem[];
  pastItems?: PastSessionItem[];
  onAction?: (item: UpcomingItem, action: string) => void;
  className?: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Phone; color: string; bg: string; label: string }> = {
  call: {
    icon: Phone,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: 'Scheduled Call',
  },
  form: {
    icon: FileQuestion,
    color: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    label: 'Form Due',
  },
  default: {
    icon: CalendarDays,
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-900/30',
    label: 'Event',
  },
};

const ITEMS_PER_PAGE = 5;

export function UpcomingSection({ items, pastItems = [], onAction, className }: UpcomingSectionProps) {
  const [showPast, setShowPast] = useState(false);
  const [pastPage, setPastPage] = useState(1);
  const [summaryConfirmEventId, setSummaryConfirmEventId] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Find the item for the current confirmation modal
  const confirmItem = summaryConfirmEventId
    ? pastItems.find(item => item.eventId === summaryConfirmEventId)
    : null;

  const handleGenerateSummary = async () => {
    if (!confirmItem || isGeneratingSummary) return;
    setIsGeneratingSummary(true);

    try {
      const response = await fetch(`/api/events/${confirmItem.eventId}/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (response.ok && data.success) {
        confirmItem.onSummaryGenerated?.(data.summaryId);
        setSummaryConfirmEventId(null);
      }
    } catch {
      // Error handling
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const displayedPastItems = pastItems.slice(0, pastPage * ITEMS_PER_PAGE);
  const hasMorePast = displayedPastItems.length < pastItems.length;
  const remainingCount = pastItems.length - displayedPastItems.length;

  const handleLoadMore = () => {
    setPastPage(prev => prev + 1);
  };

  return (
    <div className={cn('bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6', className)}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-500/20">
            {showPast ? (
              <History className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            ) : (
              <CalendarDays className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {showPast ? 'Past Sessions' : 'Upcoming'}
            </h3>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
              {showPast
                ? `${pastItems.length} past session${pastItems.length !== 1 ? 's' : ''}`
                : `${items.length} event${items.length !== 1 ? 's' : ''} scheduled`
              }
            </p>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.button
            key={showPast ? 'upcoming' : 'past'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (showPast) {
                setShowPast(false);
                setPastPage(1);
              } else {
                setShowPast(true);
              }
            }}
            className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium transition-colors"
          >
            {showPast ? 'view upcoming' : 'view past'}
          </motion.button>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {showPast ? (
          <motion.div
            key="past"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {displayedPastItems.map((item) => {
              const dateObj = new Date(item.date);
              const formattedDate = format(dateObj, 'MMM d, yyyy');

              // Card background based on recording status (matches SessionCard)
              const cardBgClass = item.hasRecording
                ? 'bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200/40 dark:border-emerald-800/30 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20'
                : 'bg-amber-50/40 dark:bg-amber-900/10 border-amber-200/40 dark:border-amber-800/30 hover:bg-amber-50/60 dark:hover:bg-amber-900/20';

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => item.onClick?.(e)}
                  onKeyDown={(e) => e.key === 'Enter' && item.onClick?.(e as unknown as React.MouseEvent)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] hover:shadow-[0_2px_4px_0_rgba(0,0,0,0.04)] transition-all group text-left cursor-pointer",
                    cardBgClass
                  )}
                >
                  {/* Left icon - Video with checkmark or Calendar */}
                  <div className="flex-shrink-0">
                    {item.hasRecording ? (
                      <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/30">
                        <Video className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <Check className="w-3 h-3 text-green-600 dark:text-green-400 absolute -bottom-0.5 -right-0.5 bg-white dark:bg-[#171b22] rounded-full" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#f3f1ef] dark:bg-[#262b35]">
                        <Calendar className="w-4 h-4 text-[#a7a39e] dark:text-[#7d8190]" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] mt-0.5">
                      {formattedDate}
                    </p>
                  </div>

                  {/* Right side icons */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Fill Week button - only when summary exists */}
                    {item.hasSummary && item.onFillWeek && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          item.onFillWeek?.();
                        }}
                        className="relative p-1.5 rounded-lg bg-brand-accent/5 hover:bg-brand-accent/10 transition-colors"
                        title={item.hasFilledFromSummary ? "Week filled from summary" : "Fill week from summary"}
                      >
                        <Wand2 className="w-4 h-4 text-brand-accent" />
                        {item.hasFilledFromSummary && (
                          <Check className="w-2.5 h-2.5 text-green-500 absolute -bottom-0.5 -right-0.5" />
                        )}
                      </button>
                    )}

                    {/* Summary button - View if exists, Get if has recording but no summary */}
                    {item.hasSummary ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          item.onViewSummary?.();
                        }}
                        className="relative p-1.5 rounded-lg bg-brand-accent/5 hover:bg-brand-accent/10 transition-colors"
                        title="View summary"
                      >
                        <FileText className="w-[18px] h-[18px] text-brand-accent" />
                        <Check className="w-2.5 h-2.5 text-green-500 absolute -bottom-0.5 -right-0.5" />
                      </button>
                    ) : item.hasRecording && item.onSummaryGenerated ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSummaryConfirmEventId(item.eventId);
                        }}
                        disabled={isGeneratingSummary && summaryConfirmEventId === item.eventId}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/20 transition-colors"
                        title="Generate summary (1 credit)"
                      >
                        {isGeneratingSummary && summaryConfirmEventId === item.eventId ? (
                          <Loader2 className="w-4 h-4 text-brand-accent animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-brand-accent" />
                        )}
                        <span className="text-xs font-medium text-brand-accent hidden sm:inline">Get Summary</span>
                      </button>
                    ) : null}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              );
            })}

            {/* Load more button */}
            {hasMorePast && (
              <button
                onClick={handleLoadMore}
                className="w-full py-3 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9]/60 dark:border-[#1e222a]/60 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#161a22] shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] hover:shadow-[0_2px_4px_0_rgba(0,0,0,0.04)] transition-all"
              >
                Load more ({remainingCount} remaining)
              </button>
            )}

            {/* Empty state for past */}
            {pastItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center mb-3">
                  <History className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6470]" />
                </div>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  No past sessions
                </p>
                <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] mt-1">
                  Completed sessions will appear here
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="upcoming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {items.map((item, index) => {
              const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.default;
              const TypeIcon = config.icon;
              const dateObj = item.date ? new Date(item.date) : null;
              const relativeTime = dateObj ? formatDistanceToNow(dateObj, { addSuffix: true }) : null;
              const formattedDate = dateObj
                ? format(dateObj, 'EEE, MMM d')
                : null;
              const formattedTime = dateObj
                ? format(dateObj, 'h:mm a')
                : null;

              return (
                <div
                  key={`${item.type}-${index}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] border border-[#f0ede9]/60 dark:border-[#1e222a]/60 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] hover:shadow-[0_2px_4px_0_rgba(0,0,0,0.04)] hover:bg-[#f5f3f0] dark:hover:bg-[#161a22] hover:border-[#e8e4df] dark:hover:border-[#262b35] transition-all group"
                >
                  {/* Icon */}
                  <div className={cn('p-2.5 rounded-xl flex-shrink-0', config.bg)}>
                    <TypeIcon className={cn('w-4 h-4', config.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {item.title}
                    </p>
                    {dateObj && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-[#8c8c8c] dark:text-[#7d8190]" />
                        <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                          {formattedDate} at {formattedTime}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Relative time badge - glassy pill */}
                  {relativeTime && (
                    <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] bg-[#f3f1ef] dark:bg-[#262b35] px-2.5 py-1 rounded-full flex-shrink-0">
                      {relativeTime}
                    </span>
                  )}

                  {/* Action button */}
                  {onAction && item.actionType && (
                    <button
                      onClick={() => onAction(item, item.actionType!)}
                      className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <ChevronRight className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190]" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Empty state for upcoming */}
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center mb-3">
                  <CalendarDays className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6470]" />
                </div>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Nothing scheduled
                </p>
                <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] mt-1">
                  Upcoming events will appear here
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary confirmation modal */}
      <SummaryConfirmationModal
        isOpen={!!summaryConfirmEventId}
        onClose={() => setSummaryConfirmEventId(null)}
        onConfirm={handleGenerateSummary}
        isLoading={isGeneratingSummary}
      />
    </div>
  );
}
