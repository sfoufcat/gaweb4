'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import type { FunnelStepConfigQuestion, FunnelQuestionOption } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, var(--brand-accent-light))';
const primaryHoverVar = 'var(--funnel-primary-hover, var(--brand-accent-dark))';

// Preset question configurations
const PRESET_QUESTIONS: Record<string, {
  question: string;
  options: FunnelQuestionOption[];
  fieldName: string;
}> = {
  workday: {
    question: "How would you describe your typical workday?",
    fieldName: 'workdayStyle',
    options: [
      { id: '1', label: 'Chaotic', value: 'chaotic', emoji: '🌪️', description: 'Constantly putting out fires', order: 0 },
      { id: '2', label: 'Busy', value: 'busy', emoji: '🏃', description: 'Always on the go', order: 1 },
      { id: '3', label: 'Productive', value: 'productive', emoji: '✅', description: 'Getting things done', order: 2 },
      { id: '4', label: 'Disciplined', value: 'disciplined', emoji: '🎯', description: 'Focused and intentional', order: 3 },
    ],
  },
  obstacles: {
    question: "What's your biggest obstacle right now?",
    fieldName: 'obstacles',
    options: [
      { id: '1', label: 'Time', value: 'time', emoji: '⏰', description: "Not enough hours in the day", order: 0 },
      { id: '2', label: 'Focus', value: 'focus', emoji: '🎯', description: 'Too many distractions', order: 1 },
      { id: '3', label: 'Clarity', value: 'clarity', emoji: '🔍', description: "Not sure what to prioritize", order: 2 },
      { id: '4', label: 'Motivation', value: 'motivation', emoji: '💪', description: 'Struggling to stay consistent', order: 3 },
    ],
  },
  business_stage: {
    question: "What stage is your business at?",
    fieldName: 'businessStage',
    options: [
      { id: '1', label: 'Just Starting', value: 'just_starting', emoji: '🌱', description: 'Beginning the journey', order: 0 },
      { id: '2', label: 'Building Momentum', value: 'building_momentum', emoji: '🚀', description: 'Getting traction', order: 1 },
      { id: '3', label: 'Growing Steadily', value: 'growing_steadily', emoji: '📈', description: 'Consistent growth', order: 2 },
      { id: '4', label: 'Leveling Up', value: 'leveling_up', emoji: '⬆️', description: 'Ready for the next stage', order: 3 },
      { id: '5', label: 'Reinventing', value: 'reinventing', emoji: '🔄', description: 'Pivoting or transforming', order: 4 },
    ],
  },
  goal_impact: {
    question: "How much would achieving your goal change your life?",
    fieldName: 'goalImpact',
    options: [
      { id: '1', label: 'Transformational', value: 'transformational', emoji: '✨', description: 'Complete life change', order: 0 },
      { id: '2', label: 'A lot', value: 'a_lot', emoji: '🎯', description: 'Major improvement', order: 1 },
      { id: '3', label: 'Somewhat', value: 'somewhat', emoji: '👍', description: 'Meaningful difference', order: 2 },
      { id: '4', label: 'A little', value: 'a_little', emoji: '📍', description: 'Nice to have', order: 3 },
    ],
  },
  support_needs: {
    question: "What kind of support would help you most?",
    fieldName: 'supportNeeds',
    options: [
      { id: '1', label: 'Daily check-ins', value: 'daily_checkins', emoji: '📅', description: 'Regular accountability', order: 0 },
      { id: '2', label: 'Accountability', value: 'accountability', emoji: '🤝', description: 'Someone to keep me on track', order: 1 },
      { id: '3', label: 'Clear system', value: 'clear_system', emoji: '📋', description: 'Structure and process', order: 2 },
      { id: '4', label: 'Expert guidance', value: 'expert_guidance', emoji: '🧭', description: 'Professional advice', order: 3 },
      { id: '5', label: 'Inspiration', value: 'inspiration', emoji: '💡', description: 'Ideas and motivation', order: 4 },
    ],
  },
};

interface QuestionStepProps {
  config: FunnelStepConfigQuestion;
  onComplete: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  data: Record<string, unknown>;
  isFirstStep: boolean;
}

export function QuestionStep({
  config,
  onComplete,
  onBack,
  data,
  isFirstStep,
}: QuestionStepProps) {
  // Get preset or custom configuration
  const preset = PRESET_QUESTIONS[config.questionType];
  const question = config.question || preset?.question || 'Question';
  const options = config.options || preset?.options || [];
  const fieldName = config.fieldName || preset?.fieldName || 'answer';
  const isMultiChoice = config.questionType === 'multi_choice' || fieldName === 'supportNeeds';

  // Initialize state with proper type checking to prevent data leakage between question types
  const getInitialSelected = (): string | string[] => {
    const stored = data[fieldName];
    if (isMultiChoice) {
      return Array.isArray(stored) ? stored : [];
    }
    // For single choice and scale, only accept string values
    return typeof stored === 'string' ? stored : '';
  };

  const getInitialTextInput = (): string => {
    // Only initialize text input if this is a text question AND stored value is a string (not number from scale)
    if (config.questionType !== 'text') return '';
    const stored = data[fieldName];
    return typeof stored === 'string' && isNaN(Number(stored)) ? stored : '';
  };

  const [selected, setSelected] = useState<string | string[]>(getInitialSelected);
  const [textInput, setTextInput] = useState(getInitialTextInput);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOptionClick = (value: string) => {
    if (isMultiChoice) {
      const current = selected as string[];
      if (current.includes(value)) {
        setSelected(current.filter(v => v !== value));
      } else {
        setSelected([...current, value]);
      }
    } else {
      setSelected(value);
    }
  };

  const handleContinue = async () => {
    setIsSubmitting(true);
    
    let answer: unknown;
    if (config.questionType === 'text') {
      answer = textInput.trim();
    } else if (config.questionType === 'scale') {
      answer = selected;
    } else {
      answer = selected;
    }

    await onComplete({ [fieldName]: answer });
    setIsSubmitting(false);
  };

  const canContinue = () => {
    if (config.questionType === 'text') {
      const minLen = config.minLength || 1;
      return textInput.trim().length >= minLen;
    }
    if (isMultiChoice) {
      return (selected as string[]).length > 0;
    }
    return selected !== '';
  };

  // Render text input
  if (config.questionType === 'text') {
    return (
      <div className="w-full max-w-xl mx-auto relative">
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-albert text-[28px] sm:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4">
            {question}
          </h1>
          {config.description && (
            <p className="text-text-secondary">{config.description}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your answer..."
            className="w-full p-4 border-2 border-[#e1ddd8] rounded-xl bg-white focus:outline-none resize-none"
            style={{ 
              borderColor: textInput ? primaryVar : undefined,
            }}
            onFocus={(e) => e.target.style.borderColor = primaryVar}
            onBlur={(e) => e.target.style.borderColor = '#e1ddd8'}
            rows={4}
            maxLength={config.maxLength || 500}
          />
          <div className="text-right text-sm text-text-muted mt-1">
            {textInput.length}/{config.maxLength || 500}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <button
            onClick={handleContinue}
            disabled={!canContinue() || isSubmitting}
            className="w-full py-3 px-6 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: primaryVar }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = primaryHoverVar)}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </button>
        </motion.div>
      </div>
    );
  }

  // Render scale input
  if (config.questionType === 'scale') {
    const min = config.scaleMin || 1;
    const max = config.scaleMax || 10;
    const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

    return (
      <div className="w-full max-w-xl mx-auto relative">
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-albert text-[28px] sm:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4">
            {question}
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-between gap-2 mb-4"
        >
          {values.map((value) => (
            <button
              key={value}
              onClick={() => setSelected(String(value))}
              className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                selected === String(value)
                  ? 'text-white'
                  : 'bg-white border-2 border-[#e1ddd8] text-text-primary'
              }`}
              style={selected === String(value) ? { backgroundColor: primaryVar } : undefined}
              onMouseEnter={(e) => {
                if (selected !== String(value)) e.currentTarget.style.borderColor = primaryVar;
              }}
              onMouseLeave={(e) => {
                if (selected !== String(value)) e.currentTarget.style.borderColor = '#e1ddd8';
              }}
            >
              {value}
            </button>
          ))}
        </motion.div>

        {config.scaleLabels && (
          <div className="flex justify-between text-sm text-text-muted">
            <span>{config.scaleLabels.min}</span>
            <span>{config.scaleLabels.max}</span>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <button
            onClick={handleContinue}
            disabled={!canContinue() || isSubmitting}
            className="w-full py-3 px-6 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: primaryVar }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = primaryHoverVar)}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </button>
        </motion.div>
      </div>
    );
  }

  // Check if any option has an image
  const hasImageOptions = options.some(o => o.imageUrl);
  // Determine image display mode: 'card' (default) or 'inline'
  const imageDisplayMode = config.imageDisplayMode || 'card';
  // Use card layout only when there are images AND mode is 'card'
  const useCardLayout = hasImageOptions && imageDisplayMode === 'card';

  // Render choice options (single or multi)
  return (
    <div className="w-full max-w-xl mx-auto relative">
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-albert text-[28px] sm:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4">
          {question}
        </h1>
        {config.description && (
          <p className="text-text-secondary">{config.description}</p>
        )}
        {isMultiChoice && (
          <p className="text-text-muted text-sm mt-2">Select all that apply</p>
        )}
      </motion.div>

      {/* Card layout: grid on desktop, 2x2 on mobile */}
      {useCardLayout ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3 sm:gap-4"
        >
          {options.sort((a, b) => a.order - b.order).map((option, index) => {
            const isSelected = isMultiChoice
              ? (selected as string[]).includes(option.value)
              : selected === option.value;

            return (
              <motion.button
                key={option.id}
                onClick={() => handleOptionClick(option.value)}
                className={`relative p-3 sm:p-4 rounded-xl border-2 text-center transition-all ${
                  isSelected
                    ? 'bg-[#faf8f6]'
                    : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb]'
                }`}
                style={isSelected ? { borderColor: primaryVar } : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                {/* Selection indicator */}
                <div 
                  className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 ${
                    isSelected ? '' : 'border-[#d4d0cb]'
                  }`}
                  style={isSelected ? { borderColor: primaryVar, backgroundColor: primaryVar } : undefined}
                >
                  {isSelected && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>

                {/* Image */}
                {option.imageUrl && (
                  <div className="w-full aspect-square rounded-lg overflow-hidden mb-3">
                    <Image
                      src={option.imageUrl}
                      alt={option.label}
                      width={200}
                      height={200}
                      className="w-full h-full object-cover"
                      unoptimized={option.imageUrl.startsWith('http')}
                    />
                  </div>
                )}

                {/* Label */}
                <p className="font-medium text-text-primary text-sm sm:text-base">{option.label}</p>
              </motion.button>
            );
          })}
        </motion.div>
      ) : (
        /* Standard vertical list layout (with optional inline thumbnails) */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          {options.sort((a, b) => a.order - b.order).map((option, index) => {
            const isSelected = isMultiChoice
              ? (selected as string[]).includes(option.value)
              : selected === option.value;

            return (
              <motion.button
                key={option.id}
                onClick={() => handleOptionClick(option.value)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'bg-[#faf8f6]'
                    : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb]'
                }`}
                style={isSelected ? { borderColor: primaryVar } : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <div className="flex items-center gap-4">
                  {/* Inline image thumbnail (when imageDisplayMode is 'inline') */}
                  {option.imageUrl && imageDisplayMode === 'inline' ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={option.imageUrl}
                        alt={option.label}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        unoptimized={option.imageUrl.startsWith('http')}
                      />
                    </div>
                  ) : option.emoji ? (
                    <span className="text-2xl">{option.emoji}</span>
                  ) : null}
                  <div className="flex-1">
                    <p className="font-medium text-text-primary">{option.label}</p>
                    {option.description && (
                      <p className="text-sm text-text-secondary mt-0.5">{option.description}</p>
                    )}
                  </div>
                  {isMultiChoice ? (
                    <div 
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? '' : 'border-[#d4d0cb]'
                      }`}
                      style={isSelected ? { borderColor: primaryVar, backgroundColor: primaryVar } : undefined}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div 
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                        isSelected ? '' : 'border-[#d4d0cb]'
                      }`}
                      style={isSelected ? { borderColor: primaryVar, backgroundColor: primaryVar } : undefined}
                    >
                      {isSelected && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8"
      >
        <button
          onClick={handleContinue}
          disabled={!canContinue() || isSubmitting}
          className="w-full py-3 px-6 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: primaryVar }}
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = primaryHoverVar)}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
        </button>
      </motion.div>
    </div>
  );
}

