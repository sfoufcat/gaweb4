'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useTypewriter } from '@/hooks/useTypewriter';
import type { GoalValidationResult } from '@/types';

const EXAMPLE_GOALS = [
  "grow to 10k followers",
  "land my first brand deal",
  "make $1,000 from content",
  "build an engaged community",
];

export default function GoalSettingPage() {
  const router = useRouter();
  const { sessionId, saveData, isLoading: sessionLoading, data: sessionData } = useGuestSession();
  const [goal, setGoal] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Modal/validation state
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [validationResult, setValidationResult] = useState<GoalValidationResult | null>(null);
  const [showValidatedGoal, setShowValidatedGoal] = useState(false);

  const typewriterText = useTypewriter({
    words: EXAMPLE_GOALS,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
  });

  // Calculate 90-day target date
  const getTargetDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date.toISOString().split('T')[0];
  };

  const targetDate = getTargetDate();

  const handleValidate = async () => {
    if (!goal.trim()) {
      setError('Please enter your goal.');
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
          targetDate: targetDate,
          guestSessionId: sessionId
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

  const saveGoal = async (goalText: string, _isAISuggested: boolean) => {
    setIsSaving(true);
    setError('');

    try {
      // Generate a 1-2 word summary using AI for the graph label
      let goalSummary = goalText.split(' ').slice(0, 2).join(' ');
      try {
        const summaryResponse = await fetch('/api/goal/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal: goalText }),
        });
        if (summaryResponse.ok) {
          const data = await summaryResponse.json();
          if (data.goalSummary) {
            goalSummary = data.goalSummary;
          }
        }
      } catch {
        // Use fallback summary
      }

      // Save to guest session
      const returnStepIndex = sessionData.goalReturnStepIndex 
        ? parseInt(String(sessionData.goalReturnStepIndex), 10) 
        : ((typeof sessionData.contentCreatorQuizStep === 'number' ? sessionData.contentCreatorQuizStep : 0) + 1);

      await saveData({
        goal: goalText,           // Save to goal field for transformation page
        customGoal: goalText,     // Also save to customGoal to mark it as custom
        goalSummary,
        goalTargetDate: new Date(targetDate).toISOString(),
        contentCreatorQuizStep: returnStepIndex,
        currentStep: 'content-creator',
      });

      // Navigate back to the quiz
      router.push('/start/content-creator');
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
    saveGoal(goal.trim(), false);
  };

  const handleContinueWithValidatedGoal = () => {
    saveGoal(goal.trim(), false);
  };

  const handleBack = () => {
    router.back();
  };

  if (sessionLoading || isSaving) {
    return (
      <div className="fixed inset-0 bg-app-bg flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="relative mb-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
          </div>
          <p className="text-text-secondary font-sans text-[15px]">{isSaving ? 'Saving your goal...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  const isButtonEnabled = goal.trim().length >= 5;

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Header */}
        <motion.div 
          className="pt-6 pb-2 px-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between max-w-xl lg:max-w-2xl mx-auto">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-[#e1ddd8]/50 active:scale-95 transition-all"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            
            {/* Logo */}
            <Image 
              src="/logo.jpg" 
              alt="GrowthAddicts" 
              width={40} 
              height={40} 
              className="rounded-lg"
            />
            
            {/* Spacer */}
            <div className="w-9" />
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 lg:py-12">
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
            {/* Header */}
            <motion.h1 
              className="font-albert text-[32px] lg:text-[42px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Set your own 90-day goal
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="font-sans text-[15px] text-text-secondary text-center mb-10"
            >
              What do you want to achieve in the next 90 days? Be specific about what success looks like for you.
            </motion.p>

            {/* Goal Input Section */}
            <motion.div 
              className="space-y-6 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* Label */}
              <label className="block font-sans text-[18px] lg:text-[20px] text-text-primary tracking-[-0.5px] leading-[1.2]">
                In the next 90 days I want to...
              </label>

              {/* Bordered Input Box */}
              <div className="relative bg-white border-2 border-[#e1ddd8] rounded-xl p-4 focus-within:border-[#a07855] transition-colors">
                <AnimatePresence mode="wait">
                  {/* Show input when not validated */}
                  {!showValidatedGoal && !showSuggestion && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="relative"
                    >
                      {/* Typewriter placeholder effect */}
                      {!goal && (
                        <div className="absolute top-0 left-0 pointer-events-none">
                          <span className="text-text-muted opacity-50 text-[18px] lg:text-[20px]">
                            {typewriterText}
                          </span>
                        </div>
                      )}
                      
                      <textarea
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        disabled={isValidating || isSaving}
                        rows={3}
                        className="w-full bg-transparent outline-none placeholder:text-transparent resize-none text-[18px] lg:text-[20px] text-text-primary"
                        autoFocus
                      />
                    </motion.div>
                  )}

                  {/* Show gradient text when validated or needs suggestion */}
                  {(showValidatedGoal || showSuggestion) && (
                    <motion.p 
                      className="bg-gradient-to-r from-[#ff6b6b] via-[#ff8c42] via-[#ffa500] via-[#9b59b6] to-[#a07855] bg-clip-text text-transparent text-[18px] lg:text-[20px] min-h-[72px]"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      {goal.trim()}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Clickable Suggestion Buttons */}
              {!showValidatedGoal && !showSuggestion && (
                <motion.div 
                  className="flex flex-wrap gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  {EXAMPLE_GOALS.map((exampleGoal, index) => (
                    <button
                      key={index}
                      onClick={() => setGoal(exampleGoal)}
                      className="px-4 py-2 bg-[#faf8f6] border border-[#e1ddd8] rounded-full text-[14px] text-text-secondary hover:bg-[#f5f2ef] hover:border-[#a07855] hover:text-text-primary active:scale-[0.98] transition-all"
                    >
                      {exampleGoal}
                    </button>
                  ))}
                </motion.div>
              )}
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-sm text-red-700">{error}</p>
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
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] border border-[#bbf7d0] rounded-xl">
                    <svg className="w-5 h-5 text-[#22c55e] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="font-semibold text-[#166534]">Perfect</p>
                      <p className="text-sm text-[#15803d]">This is a strong, measurable goal</p>
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
                    <div className="space-y-3 p-4 bg-amber-50/50 border border-amber-200/50 rounded-xl">
                      <div className="space-y-2">
                        <h3 className="font-albert text-[18px] font-medium text-amber-800 tracking-[-0.5px] leading-[1.3]">
                          💡 Suggestion:
                        </h3>
                        <p className="font-sans text-[16px] text-amber-900 tracking-[-0.5px] leading-[1.3]">
                          {validationResult.suggestedGoal}
                        </p>
                      </div>
                      
                      {validationResult.feedback && (
                        <p className="font-sans text-[14px] text-amber-700 leading-[1.4]">
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
                  className="space-y-2 mb-8 p-4 bg-[#faf8f6] border border-[#e1ddd8] rounded-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <h3 className="font-albert text-[18px] font-medium text-text-primary tracking-[-0.5px] leading-[1.3] flex items-center gap-2">
                    <span className="text-[#a07855]">💡</span>
                    Tip:
                  </h3>
                  <p className="font-sans text-[14px] text-text-secondary leading-[1.4]">
                    Keep your goal simple and measurable. Don't set vague goals like "grow my audience". Instead, be specific: "Reach 10,000 Instagram followers" or "Get 500 newsletter subscribers".
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
                className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Continue →'}
              </button>
            ) : showSuggestion ? (
              <>
                {/* Edit my goal button */}
                <button
                  onClick={handleEditGoal}
                  className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Edit my goal
                </button>

                {/* Keep original goal button */}
                <button
                  onClick={handleKeepOriginal}
                  disabled={isSaving}
                  className="w-full bg-white border border-[rgba(215,210,204,0.5)] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] hover:bg-[#faf8f6] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Keep original goal
                </button>
              </>
            ) : (
              <button
                onClick={handleValidate}
                disabled={!isButtonEnabled || isValidating}
                className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#e1ddd8] disabled:text-text-muted disabled:shadow-none disabled:from-[#e1ddd8] disabled:to-[#e1ddd8]"
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
                  'Set My Goal ➜'
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

