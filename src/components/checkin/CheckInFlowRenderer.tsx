'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft } from 'lucide-react';
import type { CheckInStep, CheckInStepType, CheckInStepCondition } from '@/types';

// Import existing step components (we'll map to these)
import { useCheckInFlow } from '@/hooks/useCheckInFlow';

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
      
      if (onComplete) {
        onComplete();
      } else {
        router.push('/');
      }
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

  // Flow disabled state
  if (isDisabled) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] flex flex-col items-center justify-center z-[9999] p-6"
      >
        <div className="text-center max-w-md">
          <p className="text-6xl mb-6">🌙</p>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-4">
            Check-in Not Available
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-8">
            This check-in flow has been disabled by your coach.
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
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
        </AnimatePresence>
      </div>
    </motion.div>
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
  switch (step.type) {
    case 'explainer':
      return <ExplainerStep config={stepConfig} onComplete={onComplete} />;
    case 'mood_scale':
      return <MoodScaleStep config={stepConfig} onComplete={onComplete} />;
    case 'single_select':
      return <SingleSelectStep config={stepConfig} onComplete={onComplete} />;
    case 'open_text':
      return <OpenTextStep config={stepConfig} onComplete={onComplete} />;
    case 'breathing':
      return <BreathingStep config={stepConfig} onComplete={onComplete} />;
    case 'completion':
      return <CompletionStep config={stepConfig} onComplete={onComplete} isLastStep={isLastStep} />;
    case 'progress_scale':
      return <ProgressScaleStep config={stepConfig} data={data} onComplete={onComplete} />;
    case 'task_planner':
      return <TaskPlannerStep config={stepConfig} onComplete={onComplete} />;
    case 'task_review':
      return <TaskReviewStep config={stepConfig} onComplete={onComplete} />;
    case 'visualization':
      return <VisualizationStep config={stepConfig} onComplete={onComplete} />;
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

function MoodScaleStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: (data?: Record<string, unknown>) => void }) {
  const options = (config.options as { value: string; label: string; color?: string }[]) || [];
  const [selectedIndex, setSelectedIndex] = useState(Math.floor(options.length / 2));
  const [isDragging, setIsDragging] = useState(false);

  const selected = options[selectedIndex];
  const thumbPosition = (selectedIndex / (options.length - 1)) * 100;

  const handleSliderInteraction = useCallback((clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percentage * (options.length - 1));
    setSelectedIndex(index);
  }, [options.length]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const slider = document.getElementById('mood-slider');
      if (slider) {
        handleSliderInteraction(e.clientX, slider.getBoundingClientRect());
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleSliderInteraction]);

  const handleContinue = () => {
    const fieldName = (config.fieldName as string) || 'emotionalState';
    onComplete({ [fieldName]: selected.value });
  };

  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-8">
          {config.question as string}
        </h1>

        {/* Current selection display */}
        <div 
          className="relative w-full aspect-square max-h-[280px] rounded-[20px] overflow-hidden flex items-center justify-center mb-8"
          style={{ 
            background: (selected?.color as string) || 'linear-gradient(180deg, #8BA89B 0%, #A8A090 50%, #B8A088 100%)'
          }}
        >
          <div className="absolute inset-0 bg-black/35" />
          <h2 className="relative z-10 font-albert text-[36px] md:text-[48px] font-medium text-white text-center tracking-[-2px] leading-[1.2]">
            {selected?.label}
          </h2>
        </div>

        {/* Slider */}
        <div className="w-full px-4 mb-8">
          <div 
            id="mood-slider"
            className="relative h-[24px] cursor-pointer"
            onMouseDown={(e) => {
              setIsDragging(true);
              handleSliderInteraction(e.clientX, e.currentTarget.getBoundingClientRect());
            }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              handleSliderInteraction(touch.clientX, e.currentTarget.getBoundingClientRect());
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              handleSliderInteraction(touch.clientX, e.currentTarget.getBoundingClientRect());
            }}
          >
            <div className="absolute top-[9px] left-0 right-0 h-[6px] rounded-[12px] bg-[#e1ddd8] dark:bg-[#262b35]" />
            <div 
              className="absolute top-[9px] left-0 h-[6px] rounded-l-[12px] bg-[#2c2520] dark:bg-[#f5f5f8]"
              style={{ width: `${thumbPosition}%` }}
            />
            <div 
              className="absolute top-0 w-[24px] h-[24px] rounded-full bg-[#f3f1ef] dark:bg-[#171b22] border-2 border-[#2c2520] dark:border-[#f5f5f8] cursor-grab active:cursor-grabbing transition-all duration-150"
              style={{ 
                left: `${thumbPosition}%`,
                transform: 'translateX(-50%)',
              }}
            />
          </div>

          <div className="flex justify-between mt-3">
            {options.length <= 5 ? (
              options.map((opt) => (
                <span key={opt.value} className="font-sans text-[14px] text-[#a7a39e] dark:text-[#666d7c]">
                  {opt.label}
                </span>
              ))
            ) : (
              <>
                <span className="font-sans text-[14px] text-[#a7a39e] dark:text-[#666d7c]">{options[0]?.label}</span>
                <span className="font-sans text-[14px] text-[#a7a39e] dark:text-[#666d7c]">{options[options.length - 1]?.label}</span>
              </>
            )}
          </div>
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

function BreathingStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: () => void }) {
  const pattern = (config.pattern as { inhale: number; hold?: number; exhale: number }) || { inhale: 4, exhale: 6 };
  const cycles = (config.cycles as number) || 3;
  const [phase, setPhase] = useState<'ready' | 'inhale' | 'hold' | 'exhale' | 'complete'>('ready');
  const [currentCycle, setCurrentCycle] = useState(0);

  useEffect(() => {
    if (phase === 'ready') return;
    if (phase === 'complete') {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }

    const durations = {
      inhale: pattern.inhale * 1000,
      hold: (pattern.hold || 0) * 1000,
      exhale: pattern.exhale * 1000,
    };

    const nextPhase = () => {
      if (phase === 'inhale') {
        if (pattern.hold) {
          setPhase('hold');
        } else {
          setPhase('exhale');
        }
      } else if (phase === 'hold') {
        setPhase('exhale');
      } else if (phase === 'exhale') {
        if (currentCycle < cycles - 1) {
          setCurrentCycle(prev => prev + 1);
          setPhase('inhale');
        } else {
          setPhase('complete');
        }
      }
    };

    const timer = setTimeout(nextPhase, durations[phase as keyof typeof durations]);
    return () => clearTimeout(timer);
  }, [phase, currentCycle, cycles, pattern, onComplete]);

  const startBreathing = () => {
    setPhase('inhale');
  };

  const getCircleScale = () => {
    switch (phase) {
      case 'inhale':
        return 1.5;
      case 'hold':
        return 1.5;
      case 'exhale':
        return 1;
      default:
        return 1;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <div className="text-center">
        <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] mb-8">
          {config.heading as string || 'Take a calming breath'}
        </h1>

        {/* Breathing circle */}
        <div className="relative w-48 h-48 mx-auto mb-8">
          <motion.div
            animate={{ scale: getCircleScale() }}
            transition={{ duration: phase === 'inhale' ? pattern.inhale : phase === 'exhale' ? pattern.exhale : 0.1 }}
            className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-accent/30 to-[#8c6245]/30 dark:from-[#b8896a]/30 dark:to-brand-accent/30"
          />
          <div className="absolute inset-4 rounded-full bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center">
            <span className="font-albert text-[20px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8] capitalize">
              {phase === 'ready' ? 'Ready?' : phase}
            </span>
          </div>
        </div>

        {/* Cycle indicator */}
        {phase !== 'ready' && phase !== 'complete' && (
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-8">
            Cycle {currentCycle + 1} of {cycles}
          </p>
        )}

        {phase === 'ready' && (
          <button
            onClick={startBreathing}
            className="px-8 py-4 bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-full font-sans text-[16px] font-bold"
          >
            Begin
          </button>
        )}

        {phase === 'complete' && (
          <p className="text-lg font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
            Well done ✨
          </p>
        )}
      </div>
    </div>
  );
}

function CompletionStep({ config, onComplete, isLastStep }: { config: Record<string, unknown>; onComplete: () => void; isLastStep: boolean }) {
  const [showConfetti, setShowConfetti] = useState(false);

  const emoji = config.emoji ? String(config.emoji) : '🎉';
  const heading = config.heading ? String(config.heading) : '';
  const subheading = config.subheading ? String(config.subheading) : '';
  const buttonText = config.buttonText ? String(config.buttonText) : 'Continue';

  useEffect(() => {
    if (config.showConfetti) {
      setShowConfetti(true);
    }
  }, [config.showConfetti]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      {/* Confetti placeholder */}
      
      <div className="text-center max-w-md">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="text-[60px] mb-6"
        >
          {emoji}
        </motion.div>

        <h1 className="font-albert text-[28px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] mb-4">
          {heading}
        </h1>

        {subheading && (
          <p className="font-albert text-[18px] md:text-[20px] text-[#5f5a55] dark:text-[#b2b6c2] tracking-[-0.5px] leading-[1.5] mb-8">
            {subheading}
          </p>
        )}

        <button
          onClick={onComplete}
          className="w-full max-w-[400px] bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {buttonText}
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

function TaskPlannerStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: () => void }) {
  // This would integrate with the existing task system
  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-8">
          {config.heading as string || 'Plan your day'}
        </h1>

        <p className="text-center text-[#5f5a55] dark:text-[#b2b6c2] mb-8">
          Task planner integration - uses existing task components
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

function VisualizationStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: () => void }) {
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<{ identity?: string; goal?: string; goalTargetDate?: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const duration = (config.durationSeconds as number) || 60;
  const showGoal = (config.showGoal as boolean) ?? true;
  const showIdentity = (config.showIdentity as boolean) ?? true;

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/user/me');
        const data = await response.json();
        setUserData({
          identity: data.user?.identity,
          goal: data.goal?.goal || data.user?.goal,
          goalTargetDate: data.goal?.targetDate || data.user?.goalTargetDate,
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, []);

  // Progress timer
  useEffect(() => {
    if (isLoading) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(100, (elapsed / (duration * 1000)) * 100);
      setProgress(newProgress);

      if (elapsed >= duration * 1000) {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [duration, isLoading]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a] dark:border-[#f5f5f8]" />
      </div>
    );
  }

  const hasIdentity = showIdentity && userData?.identity;
  const hasGoal = showGoal && userData?.goal;

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="px-6 pt-4">
        <div className="w-full h-[2px] bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-brand-accent"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center max-w-md">
          <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] mb-8">
            {config.heading as string || 'Visualize your success'}
          </h1>

          {/* Identity Section */}
          {hasIdentity && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8 p-6 rounded-2xl"
              style={{ background: 'linear-gradient(180deg, #B8D4D4 0%, #D4B8C8 50%, #E8C8B8 100%)' }}
            >
              <p className="text-sm text-[#5f5a55] mb-2">I am</p>
              <p className="font-albert text-[24px] md:text-[28px] text-[#1a1a1a] tracking-[-1px] leading-[1.2]">
                {userData.identity}
              </p>
            </motion.div>
          )}

          {/* Goal Section */}
          {hasGoal && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: hasIdentity ? 0.6 : 0.3 }}
              className="mb-8 p-6 rounded-2xl"
              style={{ background: 'linear-gradient(180deg, #E066FF 0%, #9933FF 50%, #6600CC 100%)' }}
            >
              <p className="text-sm text-white/70 mb-2">I want to</p>
              <p className="font-albert text-[24px] md:text-[28px] text-white tracking-[-1px] leading-[1.2]">
                {userData.goal}
              </p>
              {userData.goalTargetDate && (
                <p className="mt-2 text-sm text-white/60">
                  by {new Date(userData.goalTargetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </motion.div>
          )}

          {/* Fallback if neither is shown */}
          {!hasIdentity && !hasGoal && (
            <>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-48 h-48 mx-auto mb-8 rounded-full bg-gradient-to-br from-brand-accent to-[#8c6245] dark:from-[#b8896a] dark:to-brand-accent flex items-center justify-center"
              >
                <span className="text-5xl">✨</span>
              </motion.div>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-8">
                Close your eyes and visualize your success...
              </p>
            </>
          )}

          <button
            onClick={onComplete}
            className="px-8 py-4 bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-full font-sans text-[16px] font-bold"
          >
            {isComplete ? 'Continue' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoalAchievedStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: () => void }) {
  const heading = config.heading ? String(config.heading) : '';
  const description = config.description ? String(config.description) : '';
  
  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <div className="text-[60px] mb-6">💫</div>

        <h1 className="font-albert text-[28px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-6">
          {heading}
        </h1>

        {description && (
          <p className="font-albert text-[18px] text-[#5f5a55] dark:text-[#b2b6c2] tracking-[-0.5px] leading-[1.5] text-center whitespace-pre-line">
            {description}
          </p>
        )}
      </div>

      <div className="pb-8 space-y-3">
        {Boolean(config.showCreateNewGoal) && (
          <button
            onClick={onComplete}
            className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] py-4 rounded-full font-sans text-[16px] font-bold"
          >
            Create new goal
          </button>
        )}
        {Boolean(config.showSkipOption) && (
          <button
            onClick={onComplete}
            className="w-full max-w-[400px] mx-auto block bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] py-4 rounded-full font-sans text-[16px] font-bold"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
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

