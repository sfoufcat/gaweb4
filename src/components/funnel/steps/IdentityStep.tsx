'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useTypewriter } from '@/hooks/useTypewriter';
import type { FunnelStepConfigIdentity } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, var(--brand-accent-light))';
const primaryHoverVar = 'var(--funnel-primary-hover, var(--brand-accent-dark))';

const DEFAULT_IDENTITY_EXAMPLES = [
  "someone who brings value to others",
  "a guide for people with anxiety",
  "a disciplined and consistent creator",
  "a leader who inspires transformation",
];

interface IdentityStepProps {
  config: FunnelStepConfigIdentity;
  onComplete: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  data: Record<string, unknown>;
  isFirstStep: boolean;
}

export function IdentityStep({
  config,
  onComplete,
  onBack,
  data,
  isFirstStep,
}: IdentityStepProps) {
  const examples = config.examples?.length ? config.examples : DEFAULT_IDENTITY_EXAMPLES;
  
  const [identity, setIdentity] = useState(data.identity as string || '');
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState('');

  const typewriterText = useTypewriter({
    words: examples,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
  });

  const handleValidate = async () => {
    if (identity.trim().length < 10) {
      setError('Please describe who you are becoming in a bit more detail.');
      return;
    }

    setError('');
    setIsValidating(true);

    try {
      const response = await fetch('/api/identity/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          statement: identity.trim(),
          flowSessionId: data.flowSessionId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.isValid) {
          setIsValidated(true);
        } else if (result.suggestion) {
          setSuggestion(result.suggestion);
        } else {
          setIsValidated(true);
        }
      } else {
        // Allow to continue even if validation fails
        setIsValidated(true);
      }
    } catch {
      // Allow to continue
      setIsValidated(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleUseSuggestion = () => {
    if (suggestion) {
      // Remove "I am " prefix if present
      const cleanSuggestion = suggestion
        .replace(/^I am\s+/i, '')
        .replace(/^I'm\s+/i, '')
        .trim();
      setIdentity(cleanSuggestion);
      setSuggestion(null);
      setIsValidated(true);
    }
  };

  const handleKeepOriginal = () => {
    setSuggestion(null);
    setIsValidated(true);
  };

  const handleContinue = async () => {
    await onComplete({
      identity: identity.trim(),
    });
  };

  const handleExampleClick = (example: string) => {
    setIdentity(example);
    setIsValidated(false);
    setSuggestion(null);
  };

  const isButtonEnabled = identity.trim().length >= 10;
  const heading = config.heading || "Who are you becoming?";
  const promptText = config.promptText || "I am becoming...";

  return (
    <div className="w-full max-w-xl lg:max-w-2xl mx-auto relative">
      {/* Back button at top-left */}
      {!isFirstStep && onBack && (
        <button
          onClick={onBack}
          className="absolute -top-2 left-0 p-2 rounded-full hover:bg-[#f5f3f0] transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
      )}

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
        Define the person you're working to become. This becomes your north star.
      </motion.p>

      {/* Identity Input Section */}
      <motion.div 
        className="space-y-6 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Label with "I am" prefix */}
        <label className="block text-lg text-text-primary">
          {promptText}
        </label>

        {/* Input Box */}
        <div className="relative bg-white border-2 border-[#e1ddd8] rounded-xl p-4 focus-within:border-brand-accent transition-colors">
          <AnimatePresence mode="wait">
            {!isValidated && !suggestion ? (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative"
              >
                {/* Typewriter placeholder */}
                {!identity && (
                  <div className="absolute top-0 left-0 pointer-events-none">
                    <span className="text-text-muted opacity-50 text-lg">
                      {typewriterText}
                    </span>
                  </div>
                )}
                
                <textarea
                  value={identity}
                  onChange={(e) => {
                    setIdentity(e.target.value);
                    setIsValidated(false);
                    setSuggestion(null);
                  }}
                  disabled={isValidating}
                  rows={2}
                  maxLength={200}
                  className="w-full bg-transparent outline-none placeholder:text-transparent resize-none text-lg text-text-primary"
                  autoFocus
                />
              </motion.div>
            ) : (
              <motion.p 
                key="validated"
                className="bg-gradient-to-r from-brand-accent via-brand-accent/80 to-brand-accent bg-clip-text text-transparent text-lg"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {identity.trim()}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Character count */}
        {!isValidated && !suggestion && (
          <div className="text-right text-sm text-text-muted">
            {identity.length}/200
          </div>
        )}

        {/* Example buttons */}
        {!isValidated && !suggestion && (
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
                className="px-4 py-2 bg-[#faf8f6] border border-[#e1ddd8] rounded-full text-sm text-text-secondary hover:bg-[#f5f2ef] hover:border-brand-accent hover:text-text-primary active:scale-[0.98] transition-all"
              >
                {example}
              </button>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Suggestion Modal */}
      <AnimatePresence>
        {suggestion && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 p-4 bg-[#faf8f6] border border-[#e1ddd8] rounded-xl"
          >
            <p className="text-sm text-text-secondary mb-3">We have a suggestion to make your identity statement stronger:</p>
            <p className="text-text-primary font-medium mb-4">"{suggestion}"</p>
            <div className="flex gap-3">
              <button
                onClick={handleUseSuggestion}
                className="flex-1 py-2 px-4 text-white rounded-lg text-sm transition-colors"
                style={{ backgroundColor: primaryVar }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = primaryHoverVar}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
              >
                Use suggestion
              </button>
              <button
                onClick={handleKeepOriginal}
                className="py-2 px-4 text-text-secondary hover:text-text-primary text-sm transition-colors"
              >
                Keep mine
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
      >
        {!isValidated && !suggestion ? (
          <button
            onClick={handleValidate}
            disabled={!isButtonEnabled || isValidating}
            className="w-full py-3 px-6 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: primaryVar }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = primaryHoverVar)}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
          >
            {isValidating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Checking...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        ) : isValidated ? (
          <div className="flex gap-3">
            <button
              onClick={() => {
                setIsValidated(false);
                setSuggestion(null);
              }}
              className="px-6 py-3 text-text-secondary hover:text-text-primary transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 py-3 px-6 text-white rounded-xl font-medium transition-colors"
              style={{ backgroundColor: primaryVar }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = primaryHoverVar}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
            >
              Continue
            </button>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

