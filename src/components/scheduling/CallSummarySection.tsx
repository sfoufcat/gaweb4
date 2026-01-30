'use client';

import { useState } from 'react';
import { ChevronDown, FileText, CheckCircle2, Lightbulb, TrendingUp, Target } from 'lucide-react';
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
 * Styled with cloudy, soft aesthetic matching the app design.
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

  // Processing state
  if (summary.status === 'processing') {
    return (
      <div className="bg-gradient-to-br from-white to-earth-50/50 dark:from-[#171b22] dark:to-[#1d222b] rounded-[24px] border border-[#e8e4df]/60 dark:border-[#262b35] p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-accent/10 to-brand-accent/5 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-brand-accent/60 border-t-transparent rounded-full animate-spin" />
          </div>
          <div>
            <p className="font-albert text-[15px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px]">
              Generating summary...
            </p>
            <p className="font-sans text-[13px] text-text-muted dark:text-[#7d8190] mt-0.5">
              This may take a few minutes
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (summary.status === 'failed') {
    return (
      <div className="bg-gradient-to-br from-red-50 to-red-100/30 dark:from-red-900/10 dark:to-red-900/5 rounded-[24px] border border-red-200/60 dark:border-red-800/20 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <span className="text-lg">⚠️</span>
          </div>
          <div>
            <p className="font-albert text-[15px] font-semibold text-red-600 dark:text-red-400 tracking-[-0.3px]">
              Summary generation failed
            </p>
            {summary.processingError && (
              <p className="font-sans text-[13px] text-red-500/80 dark:text-red-400/70 mt-0.5">
                {summary.processingError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const executiveSummary = summary.summary?.executive || '';

  return (
    <div className="bg-gradient-to-br from-white via-white to-earth-50/30 dark:from-[#171b22] dark:via-[#171b22] dark:to-[#1a1f28] rounded-[24px] border border-[#e8e4df]/60 dark:border-[#262b35] overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-earth-50/50 dark:hover:bg-[#1d222b]/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-accent/15 to-brand-accent/5 dark:from-brand-accent/20 dark:to-brand-accent/10 flex items-center justify-center">
            <FileText className="w-[18px] h-[18px] text-brand-accent" />
          </div>
          <div className="text-left">
            <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.4px]">
              Call Summary
            </h3>
            {hasActionItems && (
              <p className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] mt-0.5">
                {summary.actionItems!.length} action item{summary.actionItems!.length !== 1 ? 's' : ''} for you
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[#a7a39e] dark:text-[#7d8190] transition-transform duration-300 ease-out ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Executive Summary - always visible */}
      {executiveSummary && (
        <div className="px-5 pb-4">
          <div className="bg-earth-50/50 dark:bg-[#1d222b]/50 rounded-2xl p-4">
            <p className={`font-sans text-[14px] leading-[1.7] text-text-primary dark:text-[#e8e8ec] ${
              !expanded ? 'line-clamp-2' : ''
            }`}>
              {executiveSummary}
            </p>
          </div>
        </div>
      )}

      {/* Additional Details - animated */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-6 space-y-5">

            {/* Key Discussion Points */}
            {hasKeyPoints && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500/80" />
                  <h4 className="font-albert text-[13px] font-semibold text-text-muted dark:text-[#7d8190] uppercase tracking-[0.5px]">
                    Key Points
                  </h4>
                </div>
                <ul className="space-y-2.5">
                  {summary.summary!.keyDiscussionPoints!.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-3 group">
                      <div className="w-1.5 h-1.5 mt-2 rounded-full bg-green-400/60 group-hover:bg-green-400 transition-colors shrink-0" />
                      <span className="font-sans text-[14px] leading-[1.6] text-text-secondary dark:text-[#b2b6c2]">
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Client Progress */}
            {hasClientProgress && (
              <div className="bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10 dark:to-transparent rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-500/80" />
                  <h4 className="font-albert text-[13px] font-semibold text-text-muted dark:text-[#7d8190] uppercase tracking-[0.5px]">
                    Your Progress
                  </h4>
                </div>
                <p className="font-sans text-[14px] leading-[1.6] text-text-secondary dark:text-[#b2b6c2]">
                  {summary.summary!.clientProgress}
                </p>
              </div>
            )}

            {/* Breakthroughs */}
            {hasBreakthroughs && (
              <div className="bg-gradient-to-r from-amber-50/60 to-transparent dark:from-amber-900/10 dark:to-transparent rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <h4 className="font-albert text-[13px] font-semibold text-text-muted dark:text-[#7d8190] uppercase tracking-[0.5px]">
                    Breakthroughs
                  </h4>
                </div>
                <ul className="space-y-2">
                  {summary.summary!.breakthroughs!.map((breakthrough, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-amber-400 mt-0.5">✦</span>
                      <span className="font-sans text-[14px] leading-[1.6] text-amber-700 dark:text-amber-300/90">
                        {breakthrough}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Challenges */}
            {hasChallenges && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-text-muted dark:text-[#7d8190]" />
                  <h4 className="font-albert text-[13px] font-semibold text-text-muted dark:text-[#7d8190] uppercase tracking-[0.5px]">
                    Areas to Focus
                  </h4>
                </div>
                <ul className="space-y-2">
                  {summary.summary!.challenges!.map((challenge, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 mt-2 rounded-full bg-earth-300 dark:bg-earth-600 shrink-0" />
                      <span className="font-sans text-[14px] leading-[1.6] text-text-secondary dark:text-[#b2b6c2]">
                        {challenge}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items */}
            {hasActionItems && (
              <div className="bg-gradient-to-br from-brand-accent/5 to-transparent dark:from-brand-accent/10 dark:to-transparent rounded-2xl p-4 border border-brand-accent/10 dark:border-brand-accent/20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-full bg-brand-accent/20 flex items-center justify-center">
                    <span className="text-[10px]">✓</span>
                  </div>
                  <h4 className="font-albert text-[13px] font-semibold text-brand-accent uppercase tracking-[0.5px]">
                    Your Action Items
                  </h4>
                </div>
                <ul className="space-y-3">
                  {summary.actionItems!.map((item) => (
                    <li key={item.id} className="flex items-start gap-3">
                      <div
                        className={`w-2.5 h-2.5 mt-1.5 rounded-full shrink-0 ${
                          item.priority === 'high'
                            ? 'bg-red-400 shadow-sm shadow-red-400/30'
                            : item.priority === 'medium'
                            ? 'bg-amber-400 shadow-sm shadow-amber-400/30'
                            : 'bg-earth-400'
                        }`}
                      />
                      <span className="font-sans text-[14px] leading-[1.6] text-text-primary dark:text-[#e8e8ec] font-medium">
                        {item.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
