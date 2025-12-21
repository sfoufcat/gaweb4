'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTypewriter } from '@/hooks/useTypewriter';
import type { FunnelStepConfigGoal } from '@/types';

const DEFAULT_GOAL_EXAMPLES = [
  "grow to 10k followers",
  "land my first brand deal",
  "make $1,000 from content",
  "build an engaged community",
];

interface GoalStepProps {
  config: FunnelStepConfigGoal;
  onComplete: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  data: Record<string, unknown>;
  isFirstStep: boolean;
}

export function GoalStep({
  config,
  onComplete,
  onBack,
  data,
  isFirstStep,
}: GoalStepProps) {
  const examples = config.examples?.length ? config.examples : DEFAULT_GOAL_EXAMPLES;
  const timelineDays = config.timelineDays || 90;
  
  const [goal, setGoal] = useState(data.goal as string || '');
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [error, setError] = useState('');

  const typewriterText = useTypewriter({
    words: examples,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
  });

  // Calculate target date
  const getTargetDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + timelineDays);
    return date.toISOString().split('T')[0];
  };

  const handleValidate = async () => {
    if (!goal.trim()) {
      setError('Please enter your goal.');
      return;
    }

    setError('');
    setIsValidating(true);

    try {
      // Optional: Validate with AI
      const response = await fetch('/api/goal/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          goal: goal.trim(),
          targetDate: getTargetDate(),
        }),
      });

      if (response.ok) {
        setIsValidated(true);
      } else {
        // Even if validation fails, allow to continue
        setIsValidated(true);
      }
    } catch {
      // Allow to continue even if validation API fails
      setIsValidated(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleContinue = async () => {
    // Generate summary
    let goalSummary = goal.trim().split(' ').slice(0, 3).join(' ');
    
    try {
      const summaryResponse = await fetch('/api/goal/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        if (summaryData.goalSummary) {
          goalSummary = summaryData.goalSummary;
        }
      }
    } catch {
      // Use default summary
    }

    await onComplete({
      goal: goal.trim(),
      goalTargetDate: new Date(getTargetDate()).toISOString(),
      goalSummary,
    });
  };

  const handleExampleClick = (example: string) => {
    setGoal(example);
    setIsValidated(false);
  };

  const isButtonEnabled = goal.trim().length >= 5;
  const heading = config.heading || `Set your ${timelineDays}-day goal`;
  const promptText = config.promptText || `In the next ${timelineDays} days I want to...`;

  return (
    <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
      {/* Header */}
      <motion.h1 
        className="font-albert text-[28px] sm:text-[36px] lg:text-[42px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {heading}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-text-secondary text-center mb-10"
      >
        What do you want to achieve? Be specific about what success looks like for you.
      </motion.p>

      {/* Goal Input Section */}
      <motion.div 
        className="space-y-6 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Label */}
        <label className="block text-lg text-text-primary">
          {promptText}
        </label>

        {/* Input Box */}
        <div className="relative bg-white border-2 border-[#e1ddd8] rounded-xl p-4 focus-within:border-[#a07855] transition-colors">
          <AnimatePresence mode="wait">
            {!isValidated ? (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative"
              >
                {/* Typewriter placeholder */}
                {!goal && (
                  <div className="absolute top-0 left-0 pointer-events-none">
                    <span className="text-text-muted opacity-50 text-lg">
                      {typewriterText}
                    </span>
                  </div>
                )}
                
                <textarea
                  value={goal}
                  onChange={(e) => {
                    setGoal(e.target.value);
                    setIsValidated(false);
                  }}
                  disabled={isValidating}
                  rows={3}
                  className="w-full bg-transparent outline-none placeholder:text-transparent resize-none text-lg text-text-primary"
                  autoFocus
                />
              </motion.div>
            ) : (
              <motion.p 
                key="validated"
                className="bg-gradient-to-r from-[#a07855] via-[#c9a07a] to-[#a07855] bg-clip-text text-transparent text-lg min-h-[72px]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {goal.trim()}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Example buttons */}
        {!isValidated && (
          <motion.div 
            className="flex flex-wrap gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="px-4 py-2 bg-[#faf8f6] border border-[#e1ddd8] rounded-full text-sm text-text-secondary hover:bg-[#f5f2ef] hover:border-[#a07855] hover:text-text-primary active:scale-[0.98] transition-all"
              >
                {example}
              </button>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div 
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <p className="text-red-600 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex gap-3"
      >
        {!isFirstStep && onBack && (
          <button
            onClick={onBack}
            className="px-6 py-3 text-text-secondary hover:text-text-primary transition-colors"
          >
            Back
          </button>
        )}
        
        {!isValidated ? (
          <button
            onClick={handleValidate}
            disabled={!isButtonEnabled || isValidating}
            className="flex-1 py-3 px-6 bg-[#a07855] text-white rounded-xl font-medium hover:bg-[#8c6245] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isValidating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Checking...
              </span>
            ) : (
              'Set my goal'
            )}
          </button>
        ) : (
          <div className="flex-1 flex gap-3">
            <button
              onClick={() => setIsValidated(false)}
              className="px-6 py-3 text-text-secondary hover:text-text-primary transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 py-3 px-6 bg-[#a07855] text-white rounded-xl font-medium hover:bg-[#8c6245] transition-colors"
            >
              Continue
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

