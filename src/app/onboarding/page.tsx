'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useTypewriter } from '@/hooks/useTypewriter';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useBrandingValues } from '@/contexts/BrandingContext';

type ValidationState = 'idle' | 'validating' | 'accepted' | 'needs_suggestion' | 'saving' | 'error';

interface ValidationResult {
  isValid: boolean;
  reasoning?: string;
  suggestion?: string;
}

const EXAMPLE_IDENTITIES = [
  "someone who brings value to others",
  "a guide for people with anxiety",
  "a disciplined and consistent creator",
  "a leader who inspires transformation",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { logoUrl, appTitle } = useBrandingValues();
  
  const [mission, setMission] = useState('');
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const typewriterText = useTypewriter({
    words: EXAMPLE_IDENTITIES,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
  });

  const MIN_LENGTH = 10;
  const MAX_LENGTH = 200;
  const isValidating = validationState === 'validating';
  const isSaving = validationState === 'saving';
  const canValidate = mission.trim().length >= MIN_LENGTH && validationState === 'idle';
  const canProceed = validationState === 'accepted';

  const handleValidate = async () => {
    setErrorMessage('');
    setValidationState('validating');

    try {
      const response = await fetch('/api/identity/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement: mission.trim() }),
      });

      if (!response.ok) throw new Error('Failed to validate mission');

      const result: ValidationResult = await response.json();
      setValidationResult(result);

      if (result.isValid) {
        setValidationState('accepted');
      } else {
        setValidationState('needs_suggestion');
      }
    } catch (error) {
      console.error('Validation error:', error);
      setErrorMessage('Failed to validate your mission. Please try again.');
      setValidationState('error');
    }
  };

  const handleSaveMission = async (missionToSave: string) => {
    setErrorMessage('');
    setValidationState('saving');

    try {
      const response = await fetch('/api/identity/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement: missionToSave }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save mission');
      }

      router.push('/onboarding/goal');
    } catch (error) {
      console.error('Save error:', error);
      const message = error instanceof Error ? error.message : 'Failed to save your mission. Please try again.';
      setErrorMessage(message);
      setValidationState('error');
    }
  };

  const handleUseSuggestion = () => {
    if (validationResult?.suggestion) {
      const cleanSuggestion = validationResult.suggestion
        .replace(/^I am\s+/i, '')
        .replace(/^I'm\s+/i, '')
        .trim();
      
      setMission(cleanSuggestion);
      setValidationState('accepted');
    }
  };

  const handleKeepOriginal = () => {
    setValidationState('accepted');
  };

  const handleEdit = () => {
    setValidationState('idle');
    setValidationResult(null);
  };

  const handleProceed = () => {
    handleSaveMission(mission.trim());
  };

  if (!isLoaded || isSaving) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
          </div>
          <p className="text-text-secondary font-sans text-[15px]">{isSaving ? 'Saving your mission...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Logo Header - centered */}
        <motion.div 
          className="pt-6 pb-4 px-6 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Image 
            src={logoUrl} 
            alt={appTitle} 
            width={48} 
            height={48} 
            className="rounded-lg"
            unoptimized
          />
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
              What is your mission?
            </motion.h1>

            {/* Input Section */}
            <motion.div 
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="font-sans text-[24px] lg:text-[28px] text-text-primary tracking-[-0.5px] leading-[1.2]">
                <div className="relative">
                  <label className="block mb-2">I am</label>
                  
                  {/* Show input when idle, validating, or error */}
                  <AnimatePresence mode="wait">
                    {(validationState === 'idle' || validationState === 'validating' || validationState === 'error') && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {/* Typewriter placeholder effect */}
                        {!mission && (
                          <div className="absolute top-12 left-0 pointer-events-none">
                            <span className="text-text-muted opacity-50">
                              {typewriterText}
                            </span>
                          </div>
                        )}
                        
                        <textarea
                          value={mission}
                          onChange={(e) => setMission(e.target.value)}
                          disabled={isValidating || isSaving}
                          rows={3}
                          maxLength={MAX_LENGTH}
                          className="w-full bg-transparent border-b-2 border-[#e1ddd8] focus:border-[#a07855] dark:border-[#b8896a] outline-none pb-2 placeholder:text-transparent transition-colors resize-none"
                          autoFocus
                        />
                      </motion.div>
                    )}

                    {/* Show gradient text when accepted */}
                    {validationState === 'accepted' && (
                      <motion.p 
                        className="bg-gradient-to-r from-[#ff6b6b] via-[#ff8c42] via-[#ffa500] via-[#9b59b6] to-[#a07855] bg-clip-text text-transparent border-b-2 border-[#e1ddd8] pb-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        {mission.trim()}
                      </motion.p>
                    )}

                    {/* Show gradient text when needs suggestion */}
                    {validationState === 'needs_suggestion' && (
                      <motion.p 
                        className="bg-gradient-to-r from-[#ff6b6b] via-[#ff8c42] via-[#ffa500] via-[#9b59b6] to-[#a07855] bg-clip-text text-transparent border-b-2 border-[#e1ddd8] pb-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        {mission.trim()}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Character Count - only show when editing */}
              {(validationState === 'idle' || validationState === 'validating' || validationState === 'error') && (
                <div className="flex justify-between items-center text-xs text-text-muted mt-2">
                  <span>
                    {mission.length < MIN_LENGTH 
                      ? `${MIN_LENGTH - mission.length} more to continue` 
                      : 'Ready to validate'}
                  </span>
                  <span className={mission.length > 180 ? 'text-amber-600' : ''}>
                    {mission.length} / {MAX_LENGTH}
                  </span>
                </div>
              )}
            </motion.div>

            {/* Perfect validation box - when accepted */}
            <AnimatePresence>
              {validationState === 'accepted' && (
                <motion.div 
                  className="mb-8 space-y-4"
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
                      <p className="text-sm text-[#15803d]">This is a strong mission statement</p>
                    </div>
                  </div>
                  {/* Edit button */}
                  <button
                    onClick={handleEdit}
                    className="text-sm text-text-secondary hover:text-text-primary underline underline-offset-2 transition-colors"
                  >
                    Edit my mission
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI Suggestion - when needs improvement */}
            <AnimatePresence>
              {validationState === 'needs_suggestion' && validationResult && (
                <motion.div 
                  className="mb-8 space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                >
                  {validationResult.suggestion && (
                    <div className="space-y-3 p-4 bg-amber-50/50 border border-amber-200/50 rounded-xl">
                      <div className="space-y-2">
                        <h3 className="font-albert text-[18px] font-medium text-amber-800 tracking-[-0.5px] leading-[1.3]">
                          💡 Suggestion:
                        </h3>
                        <p className="font-sans text-[16px] text-amber-900 tracking-[-0.5px] leading-[1.3]">
                          {validationResult.suggestion}
                        </p>
                      </div>
                      
                      {validationResult.reasoning && (
                        <p className="font-sans text-[14px] text-amber-700 leading-[1.4]">
                          {validationResult.reasoning}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action buttons for suggestion */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleUseSuggestion}
                      className="flex-1 bg-[#2c2520] text-white font-sans font-bold text-[14px] tracking-[-0.5px] leading-[1.4] py-3 px-4 rounded-[24px] hover:scale-[1.02] active:scale-[0.98] transition-transform"
                    >
                      Use Suggestion
                    </button>
                    <button
                      onClick={handleKeepOriginal}
                      className="flex-1 bg-white border border-[rgba(215,210,204,0.5)] text-[#2c2520] font-sans font-bold text-[14px] tracking-[-0.5px] leading-[1.4] py-3 px-4 rounded-[24px] hover:bg-[#faf8f6] active:scale-[0.98] transition-all"
                    >
                      Keep Mine
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div 
                  className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tip Section */}
            <AnimatePresence>
              {validationState === 'idle' && (
                <motion.div 
                  className="space-y-2 mb-8 p-4 bg-[#faf8f6] border border-[#e1ddd8] rounded-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <h3 className="font-albert text-[18px] font-medium text-text-primary tracking-[-0.5px] leading-[1.3] flex items-center gap-2">
                    <span className="text-[#a07855] dark:text-[#b8896a]">💡</span>
                    Tip:
                  </h3>
                  <p className="font-sans text-[14px] text-text-secondary leading-[1.4]">
                    Your mission defines WHO you are, not WHAT you want to achieve. For example: &quot;I am a guide to people with anxiety&quot; rather than &quot;I want to help people with anxiety&quot;.
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
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
            {canProceed ? (
              <button
                onClick={handleProceed}
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-[#2c2520] to-[#3d342d] text-white font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(44,37,32,0.25)] hover:shadow-[0px_12px_32px_0px_rgba(44,37,32,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Proceed with this mission →'}
              </button>
            ) : (
              <button
                onClick={handleValidate}
                disabled={!canValidate || isValidating}
                className="w-full bg-[#2c2520] text-white font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:bg-[#e1ddd8] disabled:text-text-muted disabled:shadow-none"
              >
                {isValidating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  'Continue →'
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
