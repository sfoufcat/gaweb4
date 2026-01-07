'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft } from 'lucide-react';
import { mutate } from 'swr';
import type { CheckInStep, CheckInStepCondition, EmotionalState } from '@/types';

// Import extracted step components
import {
  EmotionalStartStep,
  AcceptStep,
  BreathStep,
  ReframeStep,
  NeutralizeStep,
  BeginManifestStep,
  ManifestStep,
  PlanDayStep,
  // Evening check-in steps
  EveningTaskReviewStep,
  EveningMoodStep,
  EveningReflectionStep,
  // Weekly check-in steps
  OnTrackStep,
  WeeklyProgressStep,
  VoiceTextStep,
  WeeklyFocusStep,
} from '@/components/checkin/steps';

// Import hooks
import { useCheckInFlow } from '@/hooks/useCheckInFlow';
import { useEveningCheckIn } from '@/hooks/useEveningCheckIn';
import { useWeeklyReflection } from '@/hooks/useWeeklyReflection';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface CheckInFlowRendererProps {
  flowType?: 'morning' | 'evening' | 'weekly' | 'custom';
  flowId?: string;
  onComplete?: () => void;
  onClose?: () => void;
}

// Step component registry
// These map step types to their existing implementations or new generic ones
interface StepComponentProps {
  config: Record<string, unknown>;
  data: Record<string, unknown>;
  onComplete: (data?: Record<string, unknown>) => void;
  onBack?: () => void;
}

/**
 * CheckInFlowRenderer
 * 
 * Dynamically renders check-in steps based on the flow configuration.
 * This component fetches the flow for the user's organization and renders
 * each step in sequence.
 */
export function CheckInFlowRenderer({ flowType, flowId, onComplete, onClose }: CheckInFlowRendererProps) {
  const router = useRouter();
  const { flow, steps, isLoading, error, isDisabled } = useCheckInFlow(
    flowId ? { flowId } : { type: flowType }
  );
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionData, setSessionData] = useState<Record<string, unknown>>({});
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);

  // Filter steps based on enabled status and conditions
  const visibleSteps = useMemo(() => {
    return steps.filter(step => {
      // Skip disabled steps
      if (step.enabled === false) {
        return false;
      }

      // Check conditional display
      if (!step.conditions || step.conditions.length === 0) {
        return true;
      }

      const logic = step.conditionLogic || 'and';
      const results = step.conditions.map(condition => 
        evaluateCondition(condition, sessionData)
      );

      return logic === 'and' 
        ? results.every(Boolean) 
        : results.some(Boolean);
    });
  }, [steps, sessionData]);

  const currentStep = visibleSteps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === visibleSteps.length - 1;

  // Save session when flow completes
  const saveSession = useCallback(async (finalSessionData: Record<string, unknown>) => {
    // Only save sessions for flows we can track (need flow id)
    const effectiveFlowId = flowId || flow?.id;
    if (!effectiveFlowId) return;

    try {
      setIsSavingSession(true);
      await fetch('/api/checkin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowId: effectiveFlowId,
          sessionData: finalSessionData,
        }),
      });
    } catch (err) {
      // Log but don't block flow completion
      console.error('Failed to save check-in session:', err);
    } finally {
      setIsSavingSession(false);
    }
  }, [flowId, flow?.id]);

  const handleStepComplete = useCallback(async (stepData?: Record<string, unknown>) => {
    // Merge step data into session
    const updatedSessionData = stepData 
      ? { ...sessionData, ...stepData }
      : sessionData;
    
    if (stepData) {
      setSessionData(updatedSessionData);
    }

    if (isLastStep) {
      // Flow complete - save session first
      setIsNavigating(true);
      await saveSession(updatedSessionData);
      
      // Wait for exit animation to complete before navigating
      // This ensures the overlay fades out and sidebar can appear
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        } else {
          router.push('/');
        }
      }, 300);
    } else {
      // Move to next step
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [isLastStep, onComplete, router, sessionData, saveSession]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      router.push('/');
    }
  }, [onClose, router]);

  // Flow disabled - auto-redirect to dashboard
  // This happens when a coach has disabled this check-in type
  useEffect(() => {
    if (isDisabled) {
      router.replace('/');
    }
  }, [isDisabled, router]);

  // Loading state
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center z-[9999]"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a] dark:border-[#f5f5f8]" />
      </motion.div>
    );
  }

  // Flow disabled state - show brief message while redirecting
  if (isDisabled) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] flex flex-col items-center justify-center z-[9999] p-6"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a] dark:border-[#f5f5f8]" />
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] flex flex-col items-center justify-center z-[9999] p-6"
      >
        <div className="text-center max-w-md">
          <p className="text-6xl mb-6">⚠️</p>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-4">
            Something went wrong
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-8">
            {error}
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-full font-medium"
          >
            Go back
          </button>
        </div>
      </motion.div>
    );
  }

  // No steps
  if (visibleSteps.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] flex flex-col items-center justify-center z-[9999] p-6"
      >
        <div className="text-center max-w-md">
          <p className="text-6xl mb-6">📝</p>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-4">
            No steps configured
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-8">
            This check-in flow has no steps. Please contact your coach.
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-full font-medium"
          >
            Go back
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {!isNavigating && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] bg-[#faf8f6] dark:bg-[#05070b] flex flex-col overflow-hidden"
        >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        {!isFirstStep ? (
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-[#1a1a1a] dark:text-[#f5f5f8] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-10" />
        )}
        
        {/* Progress indicator */}
        <div className="flex gap-1">
          {visibleSteps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index <= currentStepIndex
                  ? 'bg-brand-accent'
                  : 'bg-[#e1ddd8] dark:bg-[#262b35]'
              }`}
            />
          ))}
        </div>
        
        <button
          onClick={handleClose}
          className="p-2 -mr-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* Immersive steps (full-screen with own backgrounds) render instantly without slide animation */}
          {currentStep && ['visualization', 'mood_scale', 'breathing', 'begin_manifest', 'task_planner'].includes(currentStep.type) ? (
            <motion.div
              key={currentStep?.id || currentStepIndex}
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <GenericStepRenderer
                step={currentStep}
                data={sessionData}
                onComplete={handleStepComplete}
                onBack={!isFirstStep ? handleBack : undefined}
                isLastStep={isLastStep}
              />
            </motion.div>
          ) : (
            <motion.div
              key={currentStep?.id || currentStepIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {currentStep && (
                <GenericStepRenderer
                  step={currentStep}
                  data={sessionData}
                  onComplete={handleStepComplete}
                  onBack={!isFirstStep ? handleBack : undefined}
                  isLastStep={isLastStep}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Generic step renderer that handles all step types
interface GenericStepRendererProps {
  step: CheckInStep;
  data: Record<string, unknown>;
  onComplete: (data?: Record<string, unknown>) => void;
  onBack?: () => void;
  isLastStep: boolean;
}

function GenericStepRenderer({ step, data, onComplete, onBack, isLastStep }: GenericStepRendererProps) {
  const stepConfig = (step.config as { type: string; config: Record<string, unknown> })?.config || {};

  // Render based on step type
  // Uses extracted morning check-in components for full functionality
  switch (step.type) {
    // Morning check-in steps - using extracted original components
    case 'mood_scale':
      return <EmotionalStartStep config={stepConfig} onComplete={onComplete} />;
    case 'accept':
      return <AcceptStep config={stepConfig} data={data} onComplete={onComplete} />;
    case 'breathing':
      return <BreathStep config={stepConfig} onComplete={onComplete} />;
    case 'reframe':       // Legacy/alternate name
    case 'reframe_input':
      return <ReframeStep config={stepConfig} onComplete={onComplete} />;
    case 'ai_reframe':
    case 'ai_reframe_input': // Legacy/alternate name for ai_reframe
    case 'ai_reframe_output': // Legacy/alternate name for ai_reframe
      return <NeutralizeStep config={stepConfig} data={data} onComplete={onComplete} />;
    case 'begin_manifest':
      return <BeginManifestStep config={stepConfig} onComplete={onComplete} />;
    case 'visualization':
      return <ManifestStep config={stepConfig} onComplete={onComplete} />;
    case 'task_planner':
      return <PlanDayStep config={stepConfig} onComplete={onComplete} />;

    // Evening check-in steps - using extracted components
    case 'evening_task_review':
      return <EveningTaskReviewStep config={stepConfig} onComplete={onComplete} />;
    case 'evening_mood':
      return <EveningMoodStep config={stepConfig} onComplete={onComplete} />;
    case 'evening_reflection':
      return <EveningReflectionStep config={stepConfig} data={data} onComplete={onComplete} />;

    // Weekly check-in steps - using extracted components
    case 'on_track_scale':
      return <OnTrackStep config={stepConfig} onComplete={onComplete} />;
    case 'momentum_progress':
      return <WeeklyProgressStep config={stepConfig} onComplete={onComplete} />;
    case 'voice_text':
      return <VoiceTextStep config={stepConfig} onComplete={onComplete} />;
    case 'weekly_focus':
      return <WeeklyFocusStep config={stepConfig} onComplete={onComplete} />;

    // Generic steps - keeping inline implementations
    case 'explainer':
      return <ExplainerStep config={stepConfig} onComplete={onComplete} />;
    case 'single_select':
      return <SingleSelectStep config={stepConfig} onComplete={onComplete} />;
    case 'open_text':
      return <OpenTextStep config={stepConfig} onComplete={onComplete} />;
    case 'completion':
      return <CompletionStep config={stepConfig} onComplete={onComplete} isLastStep={isLastStep} />;
    case 'progress_scale':
      return <ProgressScaleStep config={stepConfig} data={data} onComplete={onComplete} />;
    case 'task_review':
      return <TaskReviewStep config={stepConfig} onComplete={onComplete} />;
    case 'goal_achieved':
      return <GoalAchievedStep config={stepConfig} onComplete={onComplete} />;
    default:
      return <DefaultStep step={step} onComplete={onComplete} />;
  }
}

// Condition evaluator
function evaluateCondition(condition: CheckInStepCondition, data: Record<string, unknown>): boolean {
  const fieldValue = data[condition.field];
  
  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'gt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;
    case 'gte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue >= condition.value;
    case 'lt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;
    case 'lte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue <= condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    default:
      return true;
  }
}

// =============================================================================
// STEP COMPONENTS
// =============================================================================

function ExplainerStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: () => void }) {
  const heading = String(config.heading || '');
  const body = config.body ? String(config.body) : '';
  const ctaText = config.ctaText ? String(config.ctaText) : 'Continue';
  const imageUrl = config.imageUrl ? String(config.imageUrl) : '';
  
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <div className="max-w-md text-center">
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt="" 
            className="w-full max-w-xs mx-auto mb-8 rounded-2xl"
          />
        )}
        <h1 className="font-albert text-[28px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] mb-6">
          {heading}
        </h1>
        {body && (
          <p className="font-albert text-[18px] md:text-[20px] text-[#5f5a55] dark:text-[#b2b6c2] tracking-[-0.5px] leading-[1.5] mb-8">
            {body}
          </p>
        )}
        <button
          onClick={() => onComplete()}
          className="w-full max-w-[400px] bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {ctaText}
        </button>
      </div>
    </div>
  );
}


function SingleSelectStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: (data?: Record<string, unknown>) => void }) {
  const options = (config.options as { id: string; label: string; value: string }[]) || [];
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = () => {
    if (selected) {
      const fieldName = (config.fieldName as string) || 'selection';
      onComplete({ [fieldName]: selected });
    }
  };

  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-8">
          {config.question as string}
        </h1>

        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelected(option.value)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                selected === option.value
                  ? 'border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d4d0cb] dark:hover:border-[#363d4a]'
              }`}
            >
              <span className="font-albert text-[16px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="pb-8">
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function OpenTextStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: (data?: Record<string, unknown>) => void }) {
  const [text, setText] = useState('');
  const isRequired = config.isRequired as boolean;
  const canContinue = !isRequired || text.trim().length > 0;

  const handleContinue = () => {
    const fieldName = (config.fieldName as string) || 'text';
    onComplete({ [fieldName]: text.trim() });
  };

  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-8">
          {config.question as string}
        </h1>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={(config.placeholder as string) || 'Start typing...'}
          className="flex-1 w-full p-4 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#666d7c] resize-none focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent min-h-[200px]"
        />
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}


/**
 * ConfettiPiece - Individual confetti particle with random properties
 */
function ConfettiPiece({ index }: { index: number }) {
  const colors = ['#ff6b6b', '#ff8c42', '#ffa500', '#9b59b6', '#a07855', '#4ecdc4', '#45b7d1', '#96ceb4'];
  const color = colors[index % colors.length];
  const left = Math.random() * 100;
  const animationDelay = Math.random() * 0.5;
  const animationDuration = 2 + Math.random() * 2;
  const size = 8 + Math.random() * 8;
  const rotation = Math.random() * 360;

  return (
    <motion.div
      initial={{ y: -20, rotate: rotation, opacity: 1 }}
      animate={{ y: '100vh', rotate: rotation + 720, opacity: 0 }}
      transition={{
        duration: animationDuration,
        delay: animationDelay,
        ease: 'linear'
      }}
      className="fixed pointer-events-none"
      style={{
        left: `${left}%`,
        top: 0,
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        zIndex: 9999,
      }}
    />
  );
}

function CompletionStep({ config, onComplete, isLastStep }: { config: Record<string, unknown>; onComplete: () => void; isLastStep: boolean }) {
  const { isDemoMode, openSignupModal } = useDemoMode();
  const { completeCheckIn } = useEveningCheckIn();
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emoji = config.emoji ? String(config.emoji) : '';
  const heading = config.heading ? String(config.heading) : '';
  const subheading = config.subheading ? String(config.subheading) : '';
  const buttonText = config.buttonText ? String(config.buttonText) : 'Continue';
  const flowType = config.flowType ? String(config.flowType) : '';
  const confettiCount = config.confettiCount ? Number(config.confettiCount) : 100;

  useEffect(() => {
    if (config.showConfetti) {
      setShowConfetti(true);
    }
  }, [config.showConfetti]);

  // Generate confetti pieces array
  const confettiPieces = showConfetti ? Array.from({ length: confettiCount }, (_, i) => i) : [];

  const handleComplete = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Trigger confetti on button press for evening flow
    if (flowType === 'evening' && config.showConfetti) {
      setShowConfetti(true);
    }

    try {
      // Evening flow specific completion logic
      if (flowType === 'evening' && !isDemoMode) {
        // Mark evening check-in as completed
        await completeCheckIn();

        // Move all focus tasks to backlog so user can use them tomorrow
        await fetch('/api/tasks/move-to-backlog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        // Invalidate dashboard cache so "Day closed" state shows immediately
        await mutate(
          (key) => typeof key === 'string' && key.startsWith('/api/dashboard'),
          undefined,
          { revalidate: true }
        );
      }
    } catch (error) {
      console.error('Failed to complete check-in:', error);
    }

    // Wait for confetti animation if showing, then complete
    if (showConfetti || (flowType === 'evening' && config.showConfetti)) {
      setTimeout(() => {
        if (isDemoMode && flowType === 'evening') {
          openSignupModal();
        }
        onComplete();
      }, 1500);
    } else {
      onComplete();
    }
  }, [isSubmitting, flowType, isDemoMode, config.showConfetti, showConfetti, completeCheckIn, openSignupModal, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 relative">
      {/* Confetti Layer */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confettiPieces.map((index) => (
            <ConfettiPiece key={index} index={index} />
          ))}
        </div>
      )}

      <div className="text-center max-w-md">
        {emoji && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="text-[60px] mb-6"
          >
            {emoji}
          </motion.div>
        )}

        <h1 className="font-albert text-[28px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] mb-4">
          {heading}
        </h1>

        {subheading && (
          <p className="font-albert text-[18px] md:text-[20px] text-[#5f5a55] dark:text-[#b2b6c2] tracking-[-0.5px] leading-[1.5] mb-8">
            {subheading}
          </p>
        )}

        <button
          onClick={handleComplete}
          disabled={isSubmitting}
          className="w-full max-w-[400px] bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-80"
        >
          {isSubmitting && flowType === 'evening' ? 'See you tomorrow!' : buttonText}
        </button>
      </div>
    </div>
  );
}

function ProgressScaleStep({ config, data, onComplete }: { config: Record<string, unknown>; data: Record<string, unknown>; onComplete: (data?: Record<string, unknown>) => void }) {
  const [progress, setProgress] = useState(50);

  const handleContinue = () => {
    onComplete({ weeklyProgress: progress });
  };

  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-8">
          {config.question as string}
        </h1>

        <div className="text-6xl font-bold text-brand-accent mb-8">
          {progress}%
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={(e) => setProgress(parseInt(e.target.value))}
          className="w-full h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg appearance-none cursor-pointer accent-brand-accent"
        />

        <div className="flex justify-between w-full mt-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="pb-8">
        <button
          onClick={handleContinue}
          className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function TaskReviewStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: () => void }) {
  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-8">
          {config.heading as string || 'How did you do today?'}
        </h1>

        <p className="text-center text-[#5f5a55] dark:text-[#b2b6c2] mb-8">
          Task review integration - uses existing task components
        </p>
      </div>

      <div className="pb-8">
        <button
          onClick={onComplete}
          className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/**
 * LiquidCelebration - Animated liquid blob celebration for weekly completion
 */
function LiquidCelebration({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const blobs = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 80 + Math.random() * 200,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 1.5,
    color: [
      'rgba(120, 180, 140, 0.7)',
      'rgba(100, 160, 130, 0.6)',
      'rgba(80, 140, 110, 0.5)',
      'rgba(140, 200, 160, 0.6)',
      'rgba(160, 210, 180, 0.5)',
      'rgba(90, 170, 130, 0.7)',
    ][i % 6],
  })), []);

  const sparkles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80,
    delay: Math.random() * 1,
    size: 4 + Math.random() * 8,
  })), []);

  return (
    <motion.div
      className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Liquid blobs */}
      {blobs.map((blob) => (
        <motion.div
          key={blob.id}
          className="absolute rounded-full"
          style={{
            left: `${blob.x}%`,
            top: `${blob.y}%`,
            width: blob.size,
            height: blob.size,
            background: blob.color,
            filter: 'blur(40px)',
          }}
          initial={{ scale: 0, opacity: 0, x: '-50%', y: '-50%' }}
          animate={{
            scale: [0, 1.5, 1.2, 1.8, 0],
            opacity: [0, 0.8, 0.6, 0.4, 0],
            x: ['-50%', '-30%', '-70%', '-50%'],
            y: ['-50%', '-70%', '-30%', '-50%'],
          }}
          transition={{
            duration: blob.duration,
            delay: blob.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Sparkles */}
      {sparkles.map((sparkle) => (
        <motion.div
          key={`sparkle-${sparkle.id}`}
          className="absolute"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: sparkle.size,
            height: sparkle.size,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1, delay: sparkle.delay + 0.5, ease: 'easeOut' }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <path
              d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
              fill="rgba(255, 215, 0, 0.9)"
            />
          </svg>
        </motion.div>
      ))}

      {/* Center burst */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 3, 4], opacity: [0, 0.6, 0] }}
        transition={{ duration: 1.5, delay: 0.2, ease: 'easeOut' }}
      >
        <div
          className="w-[200px] h-[200px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(120, 180, 140, 0.8) 0%, rgba(100, 160, 130, 0.4) 50%, transparent 70%)',
          }}
        />
      </motion.div>
    </motion.div>
  );
}

function GoalAchievedStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: () => void }) {
  const router = useRouter();
  const { isDemoMode, openSignupModal } = useDemoMode();
  const { markGoalComplete } = useWeeklyReflection();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const heading = config.heading ? String(config.heading) : '';
  const description = config.description ? String(config.description) : '';
  const emoji = config.emoji ? String(config.emoji) : '💫';
  const isGoalAchieved = Boolean(config.isGoalAchieved);
  const flowType = config.flowType ? String(config.flowType) : '';

  // Mark goal complete on mount if this is goal achieved screen
  useEffect(() => {
    if (isGoalAchieved && !isDemoMode) {
      markGoalComplete();
    }
  }, [isGoalAchieved, isDemoMode, markGoalComplete]);

  const handleCreateNewGoal = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (isDemoMode) {
        openSignupModal();
        onComplete();
      } else {
        // Navigate to goal onboarding to create new goal
        router.push('/onboarding/goal');
      }
    } catch (error) {
      console.error('Error navigating:', error);
      setIsSubmitting(false);
    }
  }, [isSubmitting, isDemoMode, openSignupModal, onComplete, router]);

  const handleSkipForNow = useCallback(() => {
    if (isDemoMode) {
      openSignupModal();
    }
    onComplete();
  }, [isDemoMode, openSignupModal, onComplete]);

  const handleCloseWeek = useCallback(() => {
    setIsClosing(true);
    setShowCelebration(true);
  }, []);

  const handleCelebrationComplete = useCallback(() => {
    if (isDemoMode) {
      openSignupModal();
    }
    onComplete();
  }, [isDemoMode, openSignupModal, onComplete]);

  // Goal Achieved Screen - when user hit 100% progress
  if (isGoalAchieved) {
    return (
      <div className="flex flex-col h-full px-6 py-8">
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="text-[60px] mb-6"
          >
            {emoji}
          </motion.div>

          <h1 className="font-albert text-[28px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-6">
            {heading || 'Goal achieved — well done!'}
          </h1>

          {description ? (
            <p className="font-albert text-[18px] text-[#5f5a55] dark:text-[#b2b6c2] tracking-[-0.5px] leading-[1.5] text-center whitespace-pre-line">
              {description}
            </p>
          ) : (
            <div className="font-albert text-[20px] md:text-[24px] font-medium text-[#1a1a1a] dark:text-white tracking-[-1px] md:tracking-[-1.5px] leading-[1.4] space-y-4 text-center">
              <p>You reached your goal — that&apos;s a milestone worth celebrating.</p>
              <p>Your effort and consistency are really paying off.</p>
              <p className="mt-6">If you&apos;re ready, set a new goal to keep your momentum going.</p>
              <p>Or skip for now and enjoy the win — you&apos;ve earned it.</p>
            </div>
          )}
        </div>

        <div className="pb-8 space-y-3">
          <button
            onClick={handleCreateNewGoal}
            disabled={isSubmitting}
            className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Loading...' : 'Create new goal'}
          </button>
          <button
            onClick={handleSkipForNow}
            disabled={isSubmitting}
            className="w-full max-w-[400px] mx-auto block bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] py-4 rounded-full font-sans text-[16px] font-bold hover:bg-[#f3f1ef] dark:hover:bg-[#1d222b] transition-all disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // Normal Weekly Completion Screen - "Great work reflecting"
  return (
    <>
      {/* Celebration Animation */}
      <AnimatePresence>
        {showCelebration && (
          <LiquidCelebration onComplete={handleCelebrationComplete} />
        )}
      </AnimatePresence>

      <motion.div
        animate={{ opacity: isClosing ? 0.3 : 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col h-full px-6 py-8"
      >
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="text-[60px] mb-6"
          >
            {emoji || '🎉'}
          </motion.div>

          <h1 className="font-albert text-[28px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-6">
            {heading || 'Great work reflecting on your week!'}
          </h1>

          {description && (
            <p className="font-albert text-[20px] md:text-[24px] font-medium text-[#1a1a1a] dark:text-white tracking-[-1px] md:tracking-[-1.5px] leading-[1.4] text-center mb-8 md:mb-10">
              {description}
            </p>
          )}
        </div>

        <div className="pb-8">
          <button
            onClick={handleCloseWeek}
            disabled={isClosing}
            className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isClosing ? 'Closing...' : 'Close my week'}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function DefaultStep({ step, onComplete }: { step: CheckInStep; onComplete: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <div className="text-center max-w-md">
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-4">
          Step type: {step.type}
        </p>
        <button
          onClick={onComplete}
          className="px-8 py-4 bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-full font-sans text-[16px] font-bold"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

