'use client';

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface GenerateSummaryButtonProps {
  eventId: string;
  durationMinutes: number;
  onGenerated: (summaryId: string) => void;
  className?: string;
}

/**
 * GenerateSummaryButton
 *
 * Button to generate AI summary for events with recordings.
 * Shows credit cost and handles loading/error states.
 */
export function GenerateSummaryButton({
  eventId,
  durationMinutes,
  onGenerated,
  className = '',
}: GenerateSummaryButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string>();
  const [creditsRequired, setCreditsRequired] = useState<number>();

  // Flat rate: 1 credit per summary regardless of duration
  const credits = 1;

  const handleGenerate = async () => {
    setState('loading');
    setError(undefined);

    try {
      const response = await fetch(`/api/events/${eventId}/generate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onGenerated(data.summaryId);
      } else if (response.status === 402) {
        // Insufficient credits
        setCreditsRequired(data.creditsRequired);
        setError(`Need ${data.creditsRequired} credits (${data.creditsAvailable} available)`);
        setState('error');
      } else {
        setError(data.error || 'Failed to generate summary');
        setState('error');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setState('error');
    }
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div className={`p-4 bg-brand-accent/5 border border-brand-accent/20 rounded-xl ${className}`}>
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
          <div className="text-center">
            <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
              Generating summary...
            </p>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
              This may take a few minutes
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className={`p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl ${className}`}>
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
            {creditsRequired && (
              <a
                href="/coach/settings?tab=billing"
                className="text-xs text-red-500 hover:underline mt-1 inline-block"
              >
                Purchase more credits →
              </a>
            )}
          </div>
        </div>
        <button
          onClick={handleGenerate}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-[#262b35] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  // Idle state - show generate button
  return (
    <button
      onClick={handleGenerate}
      className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-accent text-white rounded-xl font-albert font-medium text-sm hover:bg-brand-accent/90 transition-colors ${className}`}
    >
      <Sparkles className="w-4 h-4" />
      Get Summary ({credits} credit{credits !== 1 ? 's' : ''})
    </button>
  );
}
