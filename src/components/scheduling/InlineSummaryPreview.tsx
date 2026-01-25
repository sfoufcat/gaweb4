'use client';

import { FileText, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import type { CallSummary } from '@/types';

interface InlineSummaryPreviewProps {
  summary: CallSummary;
  onViewFull: () => void;
}

/**
 * InlineSummaryPreview
 *
 * Compact call summary preview for EventDetailPopup.
 * Shows executive summary (truncated) and action items count.
 */
export function InlineSummaryPreview({
  summary,
  onViewFull,
}: InlineSummaryPreviewProps) {
  const actionItemsCount = summary.actionItems?.length ?? 0;
  const isProcessing = summary.status === 'processing';
  const isFailed = summary.status === 'failed';

  // Processing state
  if (isProcessing) {
    return (
      <div className="p-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded-xl">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
          <div>
            <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
              Generating summary...
            </p>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              This may take a few minutes
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (isFailed) {
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-600 dark:text-red-400">
            Summary generation failed
          </p>
        </div>
        {summary.processingError && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
            {summary.processingError}
          </p>
        )}
      </div>
    );
  }

  // Truncate executive summary to ~100 chars
  const executiveSummary = summary.summary?.executive || '';
  const truncatedSummary =
    executiveSummary.length > 120
      ? executiveSummary.slice(0, 120).trim() + '...'
      : executiveSummary;

  return (
    <div className="space-y-2">
      {/* Summary preview card */}
      <div className="p-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded-xl space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-accent" />
          <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
            Call Summary
          </span>
          {actionItemsCount > 0 && (
            <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-brand-accent/10 text-brand-accent rounded-full">
              {actionItemsCount} action{actionItemsCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Executive summary preview */}
        {truncatedSummary && (
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
            {truncatedSummary}
          </p>
        )}

        {/* Key points preview (first 2) */}
        {summary.summary?.keyDiscussionPoints && summary.summary.keyDiscussionPoints.length > 0 && (
          <div className="space-y-1 pt-1">
            {summary.summary.keyDiscussionPoints.slice(0, 2).map((point, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] line-clamp-1">
                  {point}
                </span>
              </div>
            ))}
            {summary.summary.keyDiscussionPoints.length > 2 && (
              <p className="text-xs text-[#888] dark:text-[#777] pl-5">
                +{summary.summary.keyDiscussionPoints.length - 2} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* View full summary button */}
      <button
        onClick={onViewFull}
        className="w-full flex items-center justify-center gap-1 px-4 py-2.5 text-sm font-medium text-brand-accent hover:bg-brand-accent/5 rounded-xl transition-colors"
      >
        View Full Summary
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
