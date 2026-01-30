'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle2, Lightbulb, TrendingUp, AlertCircle } from 'lucide-react';
import type { CallSummary } from '@/types';

interface CallSummarySectionProps {
  summary: CallSummary;
  defaultExpanded?: boolean;
}

/**
 * CallSummarySection
 *
 * Inline call summary display for discover events page.
 * Shows executive summary with expandable details.
 * Styled to match discover page design (earth colors, rounded cards).
 */
export function CallSummarySection({
  summary,
  defaultExpanded = false,
}: CallSummarySectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasKeyPoints = summary.summary?.keyDiscussionPoints && summary.summary.keyDiscussionPoints.length > 0;
  const hasActionItems = summary.actionItems && summary.actionItems.length > 0;
  const hasBreakthroughs = summary.summary?.breakthroughs && summary.summary.breakthroughs.length > 0;
  const hasChallenges = summary.summary?.challenges && summary.summary.challenges.length > 0;
  const hasClientProgress = !!summary.summary?.clientProgress;

  // Processing or failed states
  if (summary.status === 'processing') {
    return (
      <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-earth-100 dark:bg-earth-900/30 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-earth-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Generating summary...</p>
            <p className="text-xs text-text-muted">This may take a few minutes</p>
          </div>
        </div>
      </div>
    );
  }

  if (summary.status === 'failed') {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-800/30 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Summary generation failed</p>
            {summary.processingError && (
              <p className="text-xs text-red-500 dark:text-red-400">{summary.processingError}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const executiveSummary = summary.summary?.executive || '';

  return (
    <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-earth-50 dark:hover:bg-[#1d222b] transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-earth-500" />
          <span className="text-sm font-medium text-text-primary">Call Summary</span>
          {hasActionItems && (
            <span className="px-2 py-0.5 text-xs font-medium bg-earth-100 dark:bg-earth-900/30 text-earth-600 dark:text-earth-400 rounded-full">
              {summary.actionItems!.length} action{summary.actionItems!.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {/* Executive Summary Preview (always visible when not expanded) */}
      {!expanded && executiveSummary && (
        <div className="px-4 pb-4">
          <p className="text-sm text-text-secondary line-clamp-2">
            {executiveSummary}
          </p>
        </div>
      )}

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Executive Summary */}
          {executiveSummary && (
            <div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {executiveSummary}
              </p>
            </div>
          )}

          {/* Key Discussion Points */}
          {hasKeyPoints && (
            <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                Key Points
              </h4>
              <ul className="space-y-2">
                {summary.summary!.keyDiscussionPoints!.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-text-secondary">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Client Progress */}
          {hasClientProgress && (
            <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Progress
              </h4>
              <p className="text-sm text-text-secondary">{summary.summary!.clientProgress}</p>
            </div>
          )}

          {/* Breakthroughs */}
          {hasBreakthroughs && (
            <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                <Lightbulb className="w-3.5 h-3.5" />
                Breakthroughs
              </h4>
              <ul className="space-y-1.5">
                {summary.summary!.breakthroughs!.map((breakthrough, idx) => (
                  <li key={idx} className="text-sm text-green-600 dark:text-green-400 flex gap-2">
                    <span className="text-green-400">•</span>
                    <span>{breakthrough}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Challenges */}
          {hasChallenges && (
            <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                Challenges
              </h4>
              <ul className="space-y-1.5">
                {summary.summary!.challenges!.map((challenge, idx) => (
                  <li key={idx} className="text-sm text-text-secondary flex gap-2">
                    <span className="text-text-muted">•</span>
                    <span>{challenge}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {hasActionItems && (
            <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                Your Action Items
              </h4>
              <ul className="space-y-2">
                {summary.actionItems!.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <div
                      className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                        item.priority === 'high'
                          ? 'bg-red-500'
                          : item.priority === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-earth-400'
                      }`}
                    />
                    <span className="text-sm text-text-secondary">{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
