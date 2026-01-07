'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useWeeklyReflection } from '@/hooks/useWeeklyReflection';
import type { WeeklyFocusStepProps } from './types';

interface FocusSuggestion {
  suggestion: string | null;
  currentWeek: number | null;
  trackName: string | null;
}

/**
 * WeeklyFocusStep - Public focus input with AI suggestion
 *
 * Text input for weekly focus, shows "(public)" badge,
 * AI suggestion pill, share/skip buttons.
 * Extracted from: src/app/checkin/weekly/focus/page.tsx
 */
export function WeeklyFocusStep({ config, onComplete }: WeeklyFocusStepProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [suggestion, setSuggestion] = useState<FocusSuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(true);

  // Get config values with defaults
  const {
    question = "What's your focus for the next week?",
    placeholder = "This week I'm committing to finishing my portfolio draft and running three times...",
    showAiSuggestion = true,
    showSkip = true,
    isPublic = true,
  } = config;

  const { checkIn, isLoading, saveReflection, completeCheckIn } = useWeeklyReflection();

  // Fetch CMS suggestion on mount
  useEffect(() => {
    if (!showAiSuggestion) {
      setSuggestionLoading(false);
      return;
    }

    async function fetchSuggestion() {
      try {
        const response = await fetch('/api/weekly-focus/suggestion');
        if (response.ok) {
          const data = await response.json();
          setSuggestion(data);
        }
      } catch (error) {
        console.error('Error fetching focus suggestion:', error);
      } finally {
        setSuggestionLoading(false);
      }
    }

    fetchSuggestion();
  }, [showAiSuggestion]);

  // Initialize with existing data
  useEffect(() => {
    if (checkIn?.publicFocus) {
      setText(checkIn.publicFocus);
    }
  }, [checkIn]);

  const handleShare = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Save the public focus
      if (text.trim()) {
        await saveReflection('publicFocus', text.trim());
      }
      // Complete the check-in
      await completeCheckIn();
      onComplete({ publicFocus: text.trim(), completed: true });
    } catch (error) {
      console.error('Error completing reflection:', error);
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (isSkipping) return;
    setIsSkipping(true);

    try {
      // Complete the check-in without public focus
      await completeCheckIn();
      onComplete({ completed: true });
    } catch (error) {
      console.error('Error skipping:', error);
      setIsSkipping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a] dark:border-white" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="max-w-[550px] w-full flex-1 md:flex-initial flex flex-col pt-4 md:pt-0">
          {/* Header */}
          <h1 className="font-albert text-[28px] md:text-[42px] text-[#1a1a1a] dark:text-white tracking-[-2px] leading-[1.2] mb-1">
            {question}
          </h1>

          {/* Public badge */}
          {isPublic && (
            <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#a0a0a0] tracking-[-0.3px] leading-[1.2] mb-4 md:mb-6">
              (public)
            </p>
          )}

          {/* Text Input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="w-full h-[140px] md:h-[180px] p-0 bg-transparent border-none resize-none font-sans text-[18px] md:text-[24px] text-[#1a1a1a] dark:text-white tracking-[-0.5px] leading-[1.4] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none"
            autoFocus
          />

          {/* CMS Suggestion Pill */}
          {showAiSuggestion && !suggestionLoading && suggestion?.suggestion && !text.trim() && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4"
            >
              <p className="font-sans text-[12px] text-[#5f5a55] dark:text-[#a0a0a0] mb-2">
                {suggestion.trackName ? `${suggestion.trackName} suggestion for week ${suggestion.currentWeek}:` : 'Suggested focus:'}
              </p>
              <button
                onClick={() => setText(suggestion.suggestion || '')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-accent/10 to-[#8c6245]/5 dark:from-brand-accent/20 dark:to-[#8c6245]/10 hover:from-brand-accent/20 hover:to-[#8c6245]/10 dark:hover:from-brand-accent/30 dark:hover:to-[#8c6245]/20 border border-brand-accent/20 dark:border-brand-accent/30 rounded-full transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-brand-accent" />
                <span className="font-sans text-[14px] text-[#1a1a1a] dark:text-white font-medium">
                  {suggestion.suggestion}
                </span>
              </button>
            </motion.div>
          )}

          {/* Spacer on mobile to push buttons down */}
          <div className="flex-1 md:hidden" />

          {/* Buttons */}
          <div className="space-y-3 mt-6 md:mt-10 pb-8 md:pb-0">
            <button
              onClick={handleShare}
              disabled={isSubmitting || isSkipping || !text.trim()}
              className={`w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] transition-all ${
                text.trim() && !isSubmitting && !isSkipping
                  ? 'bg-[#2c2520] dark:bg-white text-white dark:text-[#1a1a1a] hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#a7a39e] dark:text-[#7d8190] cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Sharing...' : 'Share my plan'}
            </button>

            {showSkip && (
              <button
                onClick={handleSkip}
                disabled={isSubmitting || isSkipping}
                className="w-full max-w-[400px] mx-auto block bg-white dark:bg-[#171b22] border border-[rgba(215,210,204,0.5)] dark:border-[#3a3f48] text-[#2c2520] dark:text-white py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] hover:bg-[#f3f1ef] dark:hover:bg-[#1d222b] transition-all disabled:opacity-50"
              >
                {isSkipping ? 'Skipping...' : 'Skip this time'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
