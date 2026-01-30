'use client';

import { useState, useEffect } from 'react';
import { Wand2, Loader2, CheckCircle2 } from 'lucide-react';
import { FillWeekPreviewModal } from './FillWeekPreviewModal';
import type { CallSummary } from '@/types';

interface FillWeekFromSummaryButtonProps {
  eventId: string;
  /** Optional pre-fetched summary - if provided, skips fetching */
  summary?: CallSummary | null;
  onFilled?: (result: { daysUpdated: number; weeksUpdated: number }) => void;
  className?: string;
}

/**
 * FillWeekFromSummaryButton
 *
 * Button that opens the FillWeekPreviewModal to auto-fill program week(s) from a call summary.
 */
export function FillWeekFromSummaryButton({
  eventId,
  summary: providedSummary,
  onFilled,
  className = '',
}: FillWeekFromSummaryButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [summary, setSummary] = useState<CallSummary | null>(providedSummary ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFilled, setHasFilled] = useState(false);
  const [fillResult, setFillResult] = useState<{ daysUpdated: number; weeksUpdated: number } | null>(null);

  // Update summary if providedSummary changes
  useEffect(() => {
    if (providedSummary !== undefined) {
      setSummary(providedSummary);
    }
  }, [providedSummary]);

  const handleClick = async () => {
    // If we already have a summary, just open the modal
    if (summary) {
      setIsModalOpen(true);
      return;
    }

    // Otherwise, fetch the summary first
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/summary`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilled = (result: { daysUpdated: number; weeksUpdated: number }) => {
    setHasFilled(true);
    setFillResult(result);
    onFilled?.(result);
  };

  // Success state - show confirmation (non-clickable)
  if (hasFilled && fillResult) {
    return (
      <div className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-albert font-medium text-sm cursor-default ${className}`}>
        <CheckCircle2 className="w-4 h-4" />
        <span>Week filled from summary</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-accent/10 text-brand-accent rounded-xl font-albert font-medium text-sm hover:bg-brand-accent/20 transition-colors disabled:opacity-50 ${className}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wand2 className="w-4 h-4" />
        )}
        Fill Week from Summary
      </button>

      <FillWeekPreviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eventId={eventId}
        summary={summary}
        onFilled={handleFilled}
      />
    </>
  );
}
