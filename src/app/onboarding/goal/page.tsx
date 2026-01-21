'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useTypewriter } from '@/hooks/useTypewriter';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { GoalValidationResult } from '@/types';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { DatePicker } from '@/components/ui/date-picker';
import { invalidateAlignmentCache } from '@/hooks/useAlignment';

const EXAMPLE_GOALS = [
  "lose 10 kg",
  "grow to $50k MRR",
  "publish my first book",
  "get 1,000 newsletter subscribers",
];

export default function GoalPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { logoUrl, appTitle } = useBrandingValues();
  const [goal, setGoal] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Modal state
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [validationResult, setValidationResult] = useState<GoalValidationResult | null>(null);
  const [showValidatedGoal, setShowValidatedGoal] = useState(false);

  const typewriterText = useTypewriter({
    words: EXAMPLE_GOALS,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
  });

  // Get tomorrow's date as the minimum selectable date
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const minDate = getTomorrowDate();

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value;
    setTargetDate(selectedDate || null);
    if (error === 'Please select a date in the future.') {
      setError('');
    }
  };

  const handleDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value;
    if (!selectedDate) {
      setTargetDate(null);
      return;
    }
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const selected = new Date(selectedDate);
    
    if (isNaN(selected.getTime()) || selected < tomorrow) {
      setError('Please select a date in the future.');
      setTargetDate(null);
    } else {
      setError('');
      setTargetDate(selectedDate);
    }
  };

  const handleValidate = async () => {
    if (!targetDate) {
      setError('Please select a target date for your goal.');
      return;
    }
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const selectedDate = new Date(targetDate);
    
    if (isNaN(selectedDate.getTime()) || selectedDate < tomorrow) {
      setError('Please select a valid date in the future.');
      return;
    }

    setError('');
    setIsValidating(true);

    try {
      const response = await fetch('/api/goal/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          goal: goal.trim(),
          targetDate: targetDate 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate goal');
      }

      const result: GoalValidationResult = await response.json();
      setValidationResult(result);

      if (result.status === 'good') {
        setShowValidatedGoal(true);
      } else {
        setShowSuggestion(true);
      }
    } catch (err) {
      setError('Failed to validate your goal. Please try again.');
      console.error('Validation error:', err);
    } finally {
      setIsValidating(false);
    }
  };

  const saveGoal = async (goalText: string, date: string, isAISuggested: boolean) => {
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/goal/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          goal: goalText,
          targetDate: date,
          isAISuggested: isAISuggested
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save goal');
      }

      // Invalidate alignment cache so dashboard shows updated goal status
      await invalidateAlignmentCache();

      router.push('/onboarding/support-needs');
    } catch (err) {
      setError('Failed to save your goal. Please try again.');
      console.error('Save error:', err);
      setIsSaving(false);
    }
  };

  const handleEditGoal = () => {
    if (validationResult?.suggestedGoal) {
      setGoal(validationResult.suggestedGoal);
    }
    setShowSuggestion(false);
  };

  const handleKeepOriginal = () => {
    setShowSuggestion(false);
    if (targetDate) {
      saveGoal(goal.trim(), targetDate, false);
    }
  };

  const handleContinueWithValidatedGoal = () => {
    if (targetDate) {
      saveGoal(goal.trim(), targetDate, false);
    }
  };

  if (!isLoaded || isSaving) {
    return (
      <div className="min-h-dvh bg-app-bg flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative mb-4 w-12 h-12 mx-auto">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8] dark:border-[#262b35]" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-brand-accent animate-spin" />
          </div>
          <p className="text-text-secondary font-sans text-[15px]">{isSaving ? 'Saving your goal...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  // Check if the date is valid and in the future
  const isDateValid = () => {
    if (!targetDate) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const selected = new Date(targetDate);
    return !isNaN(selected.getTime()) && selected >= tomorrow;
  };

  const isButtonEnabled = goal.trim().length >= 5 && isDateValid();

  return (
    <div className="min-h-dvh bg-app-bg">
      <div className="min-h-dvh flex flex-col">
        {/* Header with back button and logo */}
        <motion.div
          className="pt-6 pb-4 px-6 flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5 text-text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <Image
            src={logoUrl}
            alt={appTitle}
            width={48}
            height={48}
            className="rounded-lg"
            unoptimized
          />
          {/* Spacer for centering logo */}
          <div className="w-10 h-10" />
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 lg:py-12">
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
            {/* Header */}
            <motion.h1 
              className="font-albert text-[36px] lg:text-[48px] text-text-primary tracking-[-2px] leading-[1.2] mb-12 lg:mb-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              What do you want to achieve?
            </motion.h1>

            {/* Mad Libs Style Input */}
            <motion.div 
              className="space-y-8 mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* "I want to" input */}
              <div className="font-sans text-[24px] lg:text-[28px] text-text-primary tracking-[-0.5px] leading-[1.2]">
                <label className="block mb-2">I want to...</label>
                <div className="relative">
                  <AnimatePresence mode="wait">
                    {/* Show input when not validated */}
                    {!showValidatedGoal && !showSuggestion && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {/* Typewriter placeholder effect */}
                        {!goal && (
                          <div className="absolute top-1 left-0 pointer-events-none">
                            <span className="text-text-muted opacity-50">
                              {typewriterText}
                            </span>
                          </div>
                        )}
                        
                        <input
                          type="text"
                          value={goal}
                          onChange={(e) => setGoal(e.target.value)}
                          disabled={isValidating || isSaving}
                          className="w-full bg-transparent border-b-2 border-[#e1ddd8] focus:border-brand-accent outline-none pb-4 placeholder:text-transparent transition-colors"
                          autoFocus
                        />
                      </motion.div>
                    )}

                    {/* Show gradient text when validated or needs suggestion */}
                    {(showValidatedGoal || showSuggestion) && (
                      <motion.p 
                        className="bg-gradient-to-r from-[#ff6b6b] via-[#ff8c42] via-[#ffa500] via-[#9b59b6] to-brand-accent bg-clip-text text-transparent border-b-2 border-[#e1ddd8] pb-4"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        {goal.trim()}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* "By" date input */}
              <div className="font-sans text-[24px] lg:text-[28px] text-text-primary tracking-[-0.5px] leading-[1.2]">
                <label className="block mb-2">By...</label>
                {!showValidatedGoal && !showSuggestion ? (
                  <DatePicker
                    value={targetDate || ''}
                    onChange={(date) => {
                      setTargetDate(date || null);
                      // Clear error if valid date selected
                      if (error === 'Please select a date in the future.') {
                        setError('');
                      }
                    }}
                    minDate={new Date(minDate)}
                    disabled={isValidating || isSaving}
                    placeholder="Select target date"
                    className="w-full bg-transparent border-0 border-b-2 border-[#e1ddd8] focus:border-brand-accent rounded-none pb-4 text-text-muted"
                  />
                ) : (
                  <motion.p
                    className="border-b-2 border-[#e1ddd8] pb-4 text-text-muted"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {targetDate ? new Date(targetDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                  </motion.p>
                )}
              </div>
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Perfect validation box - when validated */}
            <AnimatePresence>
              {showValidatedGoal && validationResult && validationResult.status === 'good' && (
                <motion.div 
                  className="mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] dark:from-green-950/40 dark:to-green-900/30 border border-[#bbf7d0] dark:border-green-800/50 rounded-xl">
                    <svg className="w-5 h-5 text-[#22c55e] dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="font-semibold text-[#166534] dark:text-green-300">Perfect</p>
                      <p className="text-sm text-[#15803d] dark:text-green-400">This is a strong, measurable goal</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI Suggestion for needs_improvement */}
            <AnimatePresence>
              {showSuggestion && validationResult && validationResult.status === 'needs_improvement' && (
                <motion.div 
                  className="mb-8 space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                >
                  {validationResult.suggestedGoal && (
                    <div className="space-y-3 p-4 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-700/40 rounded-xl">
                      <div className="space-y-2">
                        <h3 className="font-albert text-[18px] font-medium text-amber-800 dark:text-amber-300 tracking-[-0.5px] leading-[1.3]">
                          💡 Suggestion:
                        </h3>
                        <p className="font-sans text-[16px] text-amber-900 dark:text-amber-200 tracking-[-0.5px] leading-[1.3]">
                          {validationResult.suggestedGoal}
                        </p>
                      </div>
                      
                      {validationResult.feedback && (
                        <p className="font-sans text-[14px] text-amber-700 dark:text-amber-400 leading-[1.4]">
                          {validationResult.feedback}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tip Section */}
            <AnimatePresence>
              {!showSuggestion && !showValidatedGoal && (
                <motion.div 
                  className="space-y-2 mb-12 p-4 bg-[#faf8f6] dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <h3 className="font-albert text-[18px] font-medium text-text-primary tracking-[-0.5px] leading-[1.3] flex items-center gap-2">
                    <span className="text-brand-accent">💡</span>
                    Tip:
                  </h3>
                  <p className="font-sans text-[14px] text-text-secondary leading-[1.4]">
                    Keep your goal simple and measurable. Don&apos;t set vague goals like &quot;I want to make money&quot;. Rather, set &quot;I want to grow to $50k MRR&quot; for example.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Actions */}
        <motion.div 
          className="sticky bottom-0 px-6 pb-8 pt-4 bg-gradient-to-t from-app-bg via-app-bg to-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto space-y-3">
            {showValidatedGoal ? (
              /* Validated goal - show Continue button */
              <button
                onClick={handleContinueWithValidatedGoal}
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-[#2c2520] to-[#3d342d] text-white font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(44,37,32,0.25)] hover:shadow-[0px_12px_32px_0px_rgba(44,37,32,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Continue →'}
              </button>
            ) : showSuggestion ? (
              <>
                {/* Edit my goal button */}
                <button
                  onClick={handleEditGoal}
                  className="w-full bg-[#2c2520] text-white font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  Edit my goal
                </button>

                {/* Keep original goal button */}
                <button
                  onClick={handleKeepOriginal}
                  disabled={isSaving}
                  className="w-full bg-white dark:bg-[#171b22] border border-[rgba(215,210,204,0.5)] dark:border-[#262b35] text-[#2c2520] dark:text-text-primary font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] hover:bg-[#faf8f6] dark:hover:bg-[#1d222b] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Keep original goal
                </button>
              </>
            ) : (
              <button
                onClick={handleValidate}
                disabled={!isButtonEnabled || isValidating}
                className="w-full bg-[#2c2520] text-white font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:bg-[#e1ddd8] disabled:text-text-secondary disabled:shadow-none"
              >
                {isValidating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Validating...
                  </span>
                ) : (
                  'Next →'
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
