'use client';

import { useState, useEffect, useMemo } from 'react';
import { Wand2, Loader2, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';

type FillTarget = 'current' | 'next' | 'until_call';

interface FillWeekFromSummaryButtonProps {
  eventId: string;
  onFilled?: (result: { daysUpdated: number; weeksUpdated: number }) => void;
  className?: string;
}

const ALL_FILL_OPTIONS: { value: FillTarget; label: string; description: string }[] = [
  { value: 'until_call', label: 'Until next call', description: 'Fill days until the next scheduled call' },
  { value: 'current', label: 'Current week', description: 'Fill remaining days of this week' },
  { value: 'next', label: 'Next week', description: 'Fill all days of next week' },
];

/**
 * FillWeekFromSummaryButton
 *
 * Button to auto-fill program week(s) from a call summary.
 * Shows target selection and handles loading/error/success states.
 */
export function FillWeekFromSummaryButton({
  eventId,
  onFilled,
  className = '',
}: FillWeekFromSummaryButtonProps) {
  const [state, setState] = useState<'idle' | 'selecting' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ daysUpdated: number; weeksUpdated: number }>();
  const [hasNextCall, setHasNextCall] = useState<boolean | null>(null);

  // Check if there's a next call for this program
  useEffect(() => {
    async function checkNextCall() {
      try {
        const response = await fetch(`/api/events/${eventId}/has-next-call`);
        if (response.ok) {
          const data = await response.json();
          setHasNextCall(data.hasNextCall);
        }
      } catch {
        // On error, assume no next call to be safe
        setHasNextCall(false);
      }
    }
    checkNextCall();
  }, [eventId]);

  // Filter options based on whether there's a next call
  const fillOptions = useMemo(() => {
    if (hasNextCall === false) {
      return ALL_FILL_OPTIONS.filter(opt => opt.value !== 'until_call');
    }
    return ALL_FILL_OPTIONS;
  }, [hasNextCall]);

  // Default selection: until_call if available, otherwise current
  const [selectedTarget, setSelectedTarget] = useState<FillTarget>('until_call');

  // Update default when options change
  useEffect(() => {
    if (hasNextCall === false && selectedTarget === 'until_call') {
      setSelectedTarget('current');
    }
  }, [hasNextCall, selectedTarget]);

  const handleFill = async (target: FillTarget) => {
    setState('loading');
    setError(undefined);

    try {
      const response = await fetch(`/api/events/${eventId}/fill-week-from-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fillTarget: target }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult({ daysUpdated: data.daysUpdated || 0, weeksUpdated: data.weeksUpdated || 0 });
        setState('success');
        onFilled?.(data);
      } else {
        setError(data.error || 'Failed to fill week');
        setState('error');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setState('error');
    }
  };

  // Success state
  if (state === 'success' && result) {
    return (
      <div className={`p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl ${className}`}>
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              Week filled successfully
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
              {result.daysUpdated} day{result.daysUpdated !== 1 ? 's' : ''} updated
              {result.weeksUpdated > 1 ? ` across ${result.weeksUpdated} weeks` : ''}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (state === 'loading') {
    return (
      <div className={`p-4 bg-brand-accent/5 border border-brand-accent/20 rounded-xl ${className}`}>
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
          <div className="text-center">
            <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
              Filling week from summary...
            </p>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
              Creating tasks from action items
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
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
        <button
          onClick={() => setState('selecting')}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-[#262b35] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Selecting state - show options
  if (state === 'selecting') {
    return (
      <div className={`p-4 bg-[#f9f8f6] dark:bg-[#1e222b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl ${className}`}>
        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
          Fill tasks to:
        </p>
        <div className="space-y-2">
          {fillOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setSelectedTarget(option.value);
                handleFill(option.value);
              }}
              className="w-full flex items-center gap-3 p-3 bg-white dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#363c49] rounded-lg hover:border-brand-accent dark:hover:border-brand-accent transition-colors text-left"
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedTarget === option.value
                    ? 'border-brand-accent'
                    : 'border-[#d1ccc6] dark:border-[#4a5060]'
                }`}
              >
                {selectedTarget === option.value && (
                  <div className="w-2 h-2 rounded-full bg-brand-accent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {option.label}
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  {option.description}
                </p>
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={() => setState('idle')}
          className="mt-3 w-full text-center text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Idle state - show main button
  return (
    <button
      onClick={() => setState('selecting')}
      className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-accent/10 text-brand-accent rounded-xl font-albert font-medium text-sm hover:bg-brand-accent/20 transition-colors ${className}`}
    >
      <Wand2 className="w-4 h-4" />
      Fill Week from Summary
    </button>
  );
}
