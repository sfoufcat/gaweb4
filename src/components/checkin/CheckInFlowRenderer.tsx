'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { CheckInStep, CheckInStepType, CheckInStepCondition, EmotionalState, Task } from '@/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
  UniqueIdentifier,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Import existing step components (we'll map to these)
import { useCheckInFlow } from '@/hooks/useCheckInFlow';
import { useTasks } from '@/hooks/useTasks';
import { useDailyFocusLimit } from '@/hooks/useDailyFocusLimit';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { TaskSheetDefine } from '@/components/tasks/TaskSheetDefine';

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

// Emotional states with proper labels and gradient backgrounds (from EmotionalSlider)
const EMOTIONAL_STATES: EmotionalState[] = [
  'low_stuck',
  'uneasy',
  'uncertain',
  'neutral',
  'steady',
  'confident',
  'energized',
];

const STATE_LABELS: Record<EmotionalState, string> = {
  low_stuck: 'Low / Stuck',
  uneasy: 'Uneasy',
  uncertain: 'Uncertain',
  neutral: 'Neutral',
  steady: 'Steady',
  confident: 'Confident',
  energized: 'Energized',
};

const STATE_BACKGROUNDS: Record<EmotionalState, string> = {
  low_stuck: 'linear-gradient(135deg, #8B4B6B 0%, #2C1810 50%, #1A0A0A 100%)',
  uneasy: 'linear-gradient(135deg, #9B6B6B 0%, #6B4B4B 50%, #2C1818 100%)',
  uncertain: 'linear-gradient(135deg, #A8B5C7 0%, #C4A89B 50%, #E87C6C 100%)',
  neutral: 'linear-gradient(135deg, #B5C4C7 0%, #D4C4B5 50%, #C9A890 100%)',
  steady: 'linear-gradient(135deg, #89A8B5 0%, #A5C4B8 50%, #B5D4C8 100%)',
  confident: 'linear-gradient(135deg, #9BCACA 0%, #C4A8B5 50%, #D4B5C4 100%)',
  energized: 'linear-gradient(135deg, #6BD4CA 0%, #9BCAFF 50%, #D4CAFF 100%)',
};

function MoodScaleStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: (data?: Record<string, unknown>) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(Math.floor(EMOTIONAL_STATES.length / 2)); // Start at neutral

  const currentState = EMOTIONAL_STATES[currentIndex];
  const thumbPosition = (currentIndex / (EMOTIONAL_STATES.length - 1)) * 100;

  const handlePositionChange = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percentage * (EMOTIONAL_STATES.length - 1));
    
    setCurrentIndex(index);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handlePositionChange(e.clientX);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      handlePositionChange(e.clientX);
    }
  }, [isDragging, handlePositionChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handlePositionChange(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      handlePositionChange(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleContinue = () => {
    const fieldName = (config.fieldName as string) || 'emotionalState';
    onComplete({ [fieldName]: currentState });
  };

  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-8">
          {(config.question as string) || "How are you feeling right now?"}
        </h1>

        {/* Mood display card with gradient background */}
        <div 
          className="relative w-full h-[260px] rounded-[20px] overflow-hidden mb-8 transition-all duration-500"
          style={{ background: STATE_BACKGROUNDS[currentState] }}
        >
          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-black/35" />
          
          {/* Content */}
          <div className="relative z-10 h-full flex items-center justify-center p-6">
            <h2 className="font-albert text-[48px] font-medium text-[#f1ece6] text-center tracking-[-2px] leading-[1.2]">
              {STATE_LABELS[currentState]}
            </h2>
          </div>
        </div>

        {/* Slider with multi-color gradient track */}
        <div className="w-full px-4 mb-8">
          <div 
            ref={sliderRef}
            className="relative h-[24px] cursor-pointer"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => setIsDragging(false)}
          >
            {/* Track background with gradient */}
            <div className="absolute top-[9px] left-0 right-0 h-[6px] rounded-[12px] overflow-hidden">
              {/* Multi-color gradient track matching emotional states */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, #E74C3C 0%, #F39C12 25%, #95A5A6 50%, #3498DB 75%, #27AE60 100%)',
                }}
              />
              {/* Gray overlay for unselected portion */}
              <div 
                className="absolute top-0 bottom-0 right-0 bg-[#e1ddd8] dark:bg-[#262b35]"
                style={{ left: `${thumbPosition}%` }}
              />
            </div>

            {/* Thumb */}
            <div 
              className="absolute top-0 w-[24px] h-[24px] rounded-full bg-white border-2 border-[#2c2520] dark:border-[#f5f5f8] shadow-md cursor-grab active:cursor-grabbing transition-all duration-150"
              style={{ 
                left: `${thumbPosition}%`,
                transform: 'translateX(-50%)',
              }}
            />
          </div>

          {/* Labels */}
          <div className="flex justify-between mt-3">
            <span className="font-sans text-[14px] text-[#a7a39e] dark:text-[#666d7c]">Low / Stuck</span>
            <span className="font-sans text-[14px] text-[#a7a39e] dark:text-[#666d7c]">Energized</span>
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
  const [phase, setPhase] = useState<'idle' | 'inhale' | 'exhale' | 'complete'>('idle');
  const [cycleCount, setCycleCount] = useState(0);
  const cycles = (config.cycles as number) || 1;

  const startBreathing = () => {
    if (phase !== 'idle') return;
    setPhase('inhale');
    setCycleCount(0);
  };

  useEffect(() => {
    if (phase === 'idle') return;
    if (phase === 'complete') {
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }

    let timeout: NodeJS.Timeout;

    if (phase === 'inhale') {
      // Inhale for 5 seconds, then exhale
      timeout = setTimeout(() => {
        setPhase('exhale');
      }, 5000);
    } else if (phase === 'exhale') {
      // Exhale for 5 seconds, then check if more cycles needed
      timeout = setTimeout(() => {
        const newCount = cycleCount + 1;
        setCycleCount(newCount);

        // Complete after configured cycles
        if (newCount >= cycles) {
          setPhase('complete');
        } else {
          setPhase('inhale');
        }
      }, 5000);
    }

    return () => clearTimeout(timeout);
  }, [phase, cycleCount, cycles, onComplete]);

  // Get the scale class for the circles
  const getScale = () => {
    switch (phase) {
      case 'inhale':
        return 'scale-100';
      case 'exhale':
        return 'scale-75';
      default:
        return 'scale-75';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <div className="text-center">
        <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] mb-8">
          {config.heading as string || 'Take a deep breath'}
        </h1>

        <div className="flex flex-col items-center justify-center py-8">
          {phase === 'idle' ? (
            // Start button
            <button
              onClick={startBreathing}
              className="w-[200px] h-[200px] rounded-full bg-white dark:bg-[#171b22] border border-[rgba(215,210,204,0.5)] dark:border-[#262b35] flex items-center justify-center shadow-sm hover:shadow-md transition-all"
            >
              <span className="font-sans text-[16px] font-bold text-[#2c2520] dark:text-[#f5f5f8] tracking-[-0.5px]">
                Take a deep breath
              </span>
            </button>
          ) : phase === 'complete' ? (
            // Completion state
            <div className="w-[200px] h-[200px] rounded-full bg-[#2c2520] dark:bg-white flex items-center justify-center">
              <span className="font-albert text-[18px] font-semibold text-[#f1ece6] dark:text-[#1a1a1a] tracking-[-1px]">
                Well done ✨
              </span>
            </div>
          ) : (
            // Breathing animation - multiple overlapping circles
            <div className="relative w-[280px] h-[280px] flex items-center justify-center">
              {/* Multiple overlapping circles for the breathing effect */}
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const angle = (i / 8) * Math.PI * 2;
                const offsetX = Math.cos(angle) * 40;
                const offsetY = Math.sin(angle) * 40;

                return (
                  <div
                    key={i}
                    className={`absolute w-[200px] h-[200px] rounded-full bg-[#2c2520] dark:bg-white transition-all ease-in-out ${getScale()}`}
                    style={{
                      transitionDuration: '5000ms',
                      transform: phase === 'inhale'
                        ? `translate(${offsetX}px, ${offsetY}px) scale(1)`
                        : `translate(0px, 0px) scale(0.75)`,
                      opacity: 0.8,
                    }}
                  />
                );
              })}

              {/* Center text */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <span className="font-albert text-[18px] font-semibold text-[#f1ece6] dark:text-[#1a1a1a] tracking-[-1px]">
                  {phase === 'inhale' ? 'Breathe in' : 'Breathe out'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Cycle indicator */}
        {phase !== 'idle' && phase !== 'complete' && cycles > 1 && (
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-4">
            Cycle {cycleCount + 1} of {cycles}
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

// ====== TASK PLANNER COMPONENTS ======

// Rocket Launch Animation Component
const RocketLaunchAnimation = ({ onComplete }: { onComplete: () => void }) => {
  return (
    <div 
      className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden bg-[#faf8f6] dark:bg-[#05070b]"
      style={{ minHeight: '100dvh' }}
    >
      <div className="w-full h-full relative">
        <div className="w-full h-full animate-page-fade-in">
          {/* Multiple rockets */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute text-[60px] md:text-[80px]"
              style={{
                left: `${30 + i * 20}%`,
                bottom: 0,
              }}
              initial={{ 
                y: 100,
                opacity: 0,
                rotate: 0,
              }}
              animate={{ 
                y: [100, -200, -800],
                opacity: [0, 1, 1, 0],
                rotate: [0, -5, 5, 0],
              }}
              transition={{
                duration: 1.8,
                delay: i * 0.15,
                ease: [0.4, 0, 0.2, 1],
                times: [0, 0.2, 0.8, 1],
              }}
              onAnimationComplete={() => {
                if (i === 1) onComplete();
              }}
            >
              🚀
            </motion.div>
          ))}

          {/* Smoke/exhaust particles */}
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={`smoke-${i}`}
              className="absolute w-4 h-4 md:w-6 md:h-6 rounded-full bg-[#e1ddd8]"
              style={{
                left: `${25 + Math.random() * 50}%`,
                bottom: 50,
              }}
              initial={{ 
                y: 0,
                opacity: 0,
                scale: 0.5,
              }}
              animate={{ 
                y: [0, 50, 150],
                opacity: [0, 0.6, 0],
                scale: [0.5, 1.5, 2],
                x: [0, (Math.random() - 0.5) * 100],
              }}
              transition={{
                duration: 1.5,
                delay: 0.2 + i * 0.08,
                ease: 'easeOut',
              }}
            />
          ))}

          {/* Sparkles */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute"
              style={{
                left: `${20 + Math.random() * 60}%`,
                bottom: `${10 + Math.random() * 30}%`,
                width: 8 + Math.random() * 8,
                height: 8 + Math.random() * 8,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.8,
                delay: 0.3 + i * 0.05,
                ease: 'easeOut',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                <path
                  d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                  fill="rgba(255, 180, 50, 0.9)"
                />
              </svg>
            </motion.div>
          ))}

          {/* Center text */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <h2 className="font-albert text-[32px] md:text-[48px] font-medium text-[#1a1a1a] dark:text-white tracking-[-2px]">
              Let&apos;s go! 🔥
            </h2>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Empty drop zone component for when Daily Focus has no tasks
function EmptyFocusDropZone({ isOver }: { isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: 'empty-focus-drop-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-full rounded-[20px] p-4 border-2 border-dashed transition-all duration-200 ${
        isOver 
          ? 'border-[#8b7355] bg-[#8b7355]/10 scale-[1.02]' 
          : 'border-[#e1ddd8] dark:border-[#262b35] bg-[#f3f1ef]/50 dark:bg-[#1d222b]/50'
      }`}
    >
      <p className={`text-center font-albert text-[16px] tracking-[-0.5px] leading-[1.3] transition-colors ${
        isOver ? 'text-[#8b7355]' : 'text-[#a7a39e] dark:text-[#7d8190]'
      }`}>
        {isOver ? 'Drop here to add to Daily Focus' : 'Drag a task here'}
      </p>
    </div>
  );
}

// Sortable Task Item Component
function SortableTaskItem({ 
  task, 
  onClick,
  onEdit,
  onDelete,
  showControls = false,
  showDragHandle = true,
}: { 
  task: Task; 
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showControls?: boolean;
  showDragHandle?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-[#171b22] rounded-[20px] p-4 flex items-center gap-2 ${
        task.status === 'completed' ? 'opacity-60' : ''
      }`}
      {...(showDragHandle ? {} : attributes)}
      {...(showDragHandle ? {} : listeners)}
    >
      {/* Drag handle for backlog only */}
      {showDragHandle && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-[#a7a39e] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] touch-none"
        >
          <GripVertical className="w-5 h-5" />
        </div>
      )}

      {/* Task title */}
      <button
        onClick={onClick}
        className={`flex-1 text-left font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] ${
          task.status === 'completed' 
            ? 'line-through text-[#a7a39e] dark:text-[#7d8190]' 
            : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
        } ${!showDragHandle ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {task.title}
      </button>

      {/* Controls for focus tasks */}
      {showControls && task.listType === 'focus' && (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 text-[#a7a39e] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] transition-colors"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-[#a7a39e] dark:text-[#7d8190] hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function TaskPlannerStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: () => void }) {
  const { isDemoMode, openSignupModal } = useDemoMode();
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  const {
    focusTasks,
    backlogTasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    fetchTasks,
  } = useTasks({ date: today });
  
  const { limit: focusLimit } = useDailyFocusLimit();

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingTo, setAddingTo] = useState<'focus' | 'backlog'>('focus');
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRocketAnimation, setShowRocketAnimation] = useState(false);
  const [showFocusFullWarning, setShowFocusFullWarning] = useState(false);
  
  const hasSyncedProgram = useRef(false);

  // Sync program tasks on load
  useEffect(() => {
    if (hasSyncedProgram.current) return;
    hasSyncedProgram.current = true;

    const syncProgramTasks = async () => {
      try {
        const response = await fetch('/api/programs/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (!response.ok) return;
        
        const result = await response.json();
        if (result.tasksCreated > 0) {
          await fetchTasks();
        }
      } catch (error) {
        console.error('[TASK_PLANNER] Error syncing program tasks:', error);
      }
    };

    syncProgramTasks();
  }, [fetchTasks]);

  // Drag state
  const activeTask = activeId ? [...focusTasks, ...backlogTasks].find(t => t.id === activeId) : null;
  const overTask = overId ? [...focusTasks, ...backlogTasks].find(t => t.id === overId) : null;
  const isOverEmptyFocusZone = overId === 'empty-focus-drop-zone';
  const isDraggingToFocus = activeTask && (
    (overTask && activeTask.listType === 'backlog' && overTask.listType === 'focus') ||
    (isOverEmptyFocusZone && activeTask.listType === 'backlog')
  );
  const canMoveToFocus = isDraggingToFocus && focusTasks.length < focusLimit;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id);
  const handleDragOver = (event: DragOverEvent) => setOverId(event.over?.id ?? null);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const allTasks = [...focusTasks, ...backlogTasks];
    const draggedTask = allTasks.find((t) => t.id === active.id);
    const targetTask = allTasks.find((t) => t.id === over.id);

    // Handle dropping on empty focus zone
    if (over.id === 'empty-focus-drop-zone' && draggedTask && draggedTask.listType === 'backlog') {
      const updatedTask = { ...draggedTask, listType: 'focus' as const, order: 0 };
      const reorderedBacklog = backlogTasks
        .filter(t => t.id !== active.id)
        .map((task, index) => ({ ...task, order: index }));
      reorderTasks([updatedTask, ...reorderedBacklog]);
      return;
    }

    if (!draggedTask || !targetTask) return;

    // If moving between lists
    if (draggedTask.listType !== targetTask.listType) {
      if (targetTask.listType === 'focus' && focusTasks.length >= focusLimit) {
        setShowFocusFullWarning(true);
        setTimeout(() => setShowFocusFullWarning(false), 3000);
        return;
      }

      const targetList = targetTask.listType === 'focus' ? focusTasks : backlogTasks;
      const targetIndex = targetList.findIndex(t => t.id === over.id);
      
      const updatedDraggedTask = { ...draggedTask, listType: targetTask.listType };
      const newTargetList = [...targetList];
      newTargetList.splice(targetIndex, 0, updatedDraggedTask);
      
      const reorderedTargetList = newTargetList.map((task, index) => ({ ...task, order: index }));
      const sourceList = draggedTask.listType === 'focus' ? focusTasks : backlogTasks;
      const reorderedSourceList = sourceList
        .filter(t => t.id !== active.id)
        .map((task, index) => ({ ...task, order: index }));
      
      reorderTasks([...reorderedTargetList, ...reorderedSourceList]);
      return;
    }

    // Reordering within same list
    const tasks = draggedTask.listType === 'focus' ? focusTasks : backlogTasks;
    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    if (oldIndex !== newIndex) {
      const reordered = arrayMove(tasks, oldIndex, newIndex).map((task, index) => ({ ...task, order: index }));
      reorderTasks(reordered);
    }
  };

  const handleAddTask = (listType: 'focus' | 'backlog') => {
    setAddingTo(listType);
    setEditingTask(null);
    setShowAddSheet(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowAddSheet(true);
  };

  const handleDeleteTask = async (task: Task) => {
    await deleteTask(task.id);
  };

  const handleSaveTask = async (title: string, isPrivate: boolean) => {
    if (editingTask) {
      await updateTask(editingTask.id, { title, isPrivate });
    } else {
      await createTask({ title, isPrivate, listType: addingTo });
    }
  };

  const handleStartDay = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (!isDemoMode) {
        await fetch('/api/checkin/morning', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasksPlanned: true, completedAt: new Date().toISOString() }),
        });

        fetch('/api/checkin/morning/squad-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(console.error);
      }

      setShowRocketAnimation(true);
    } catch (error) {
      console.error('Error completing check-in:', error);
      setIsSubmitting(false);
    }
  };

  const handleAnimationComplete = useCallback(() => {
    if (isDemoMode) {
      openSignupModal();
    }
    onComplete();
  }, [onComplete, isDemoMode, openSignupModal]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Rocket Animation */}
      <AnimatePresence>
        {showRocketAnimation && (
          <RocketLaunchAnimation onComplete={handleAnimationComplete} />
        )}
      </AnimatePresence>

      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex-1 w-full max-w-[650px] mx-auto px-6 pt-8 pb-32">
          <h1 className="font-albert text-[36px] md:text-[42px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-10">
            {(config.heading as string) || 'Plan your day'}
          </h1>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {/* Focus Tasks */}
            <div className={`space-y-2 mb-4 transition-all duration-200 ${
              isDraggingToFocus 
                ? canMoveToFocus
                  ? 'ring-2 ring-[#8b7355] ring-offset-2 dark:ring-offset-[#05070b] rounded-[24px] p-2 bg-[#8b7355]/5'
                  : 'ring-2 ring-red-300 ring-offset-2 dark:ring-offset-[#05070b] rounded-[24px] p-2 bg-red-50/30 dark:bg-red-900/20'
                : ''
            }`}>
              {(showFocusFullWarning || (isDraggingToFocus && !canMoveToFocus)) && (
                <div className="text-center py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium rounded-[16px] mb-2 animate-in fade-in duration-200 border border-red-100 dark:border-red-800">
                  Daily Focus is full (max {focusLimit} tasks)
                </div>
              )}

              <SortableContext items={focusTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {focusTasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onClick={() => {}}
                    onEdit={() => handleEditTask(task)}
                    onDelete={() => handleDeleteTask(task)}
                    showControls={true}
                    showDragHandle={false}
                  />
                ))}
              </SortableContext>

              {focusTasks.length === 0 && activeId && activeTask?.listType === 'backlog' && (
                <EmptyFocusDropZone isOver={isOverEmptyFocusZone} />
              )}

              {focusTasks.length < focusLimit && !activeId && (
                <button
                  onClick={() => handleAddTask('focus')}
                  className="w-full bg-[#f3f1ef] dark:bg-[#1d222b] rounded-[20px] p-4 flex items-center justify-center"
                >
                  <span className="font-albert text-[18px] font-semibold text-[#a7a39e] dark:text-[#7d8190] tracking-[-1px] leading-[1.3]">
                    Add task
                  </span>
                </button>
              )}
            </div>

            {/* Backlog divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
              <span className="font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190]">Backlog</span>
              <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
            </div>

            {/* Backlog Tasks */}
            <div className="space-y-2">
              <SortableContext items={backlogTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {backlogTasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onClick={() => {}}
                    onEdit={() => handleEditTask(task)}
                    onDelete={() => handleDeleteTask(task)}
                    showDragHandle={true}
                  />
                ))}
              </SortableContext>

              <button
                onClick={() => handleAddTask('backlog')}
                className="w-full bg-[#f3f1ef] dark:bg-[#1d222b] rounded-[20px] p-4 flex items-center justify-center"
              >
                <span className="font-albert text-[18px] font-semibold text-[#a7a39e] dark:text-[#7d8190] tracking-[-1px] leading-[1.3]">
                  Add task
                </span>
              </button>
            </div>

            {/* Drag overlay */}
            <DragOverlay>
              {activeTask && (
                <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 flex items-center gap-2 shadow-lg opacity-90 rotate-2">
                  <GripVertical className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                  <span className="font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {activeTask.title}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Start Day button */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#faf8f6] dark:bg-[#05070b] px-6 pb-8 md:pb-12 pt-6 z-10">
          <button
            onClick={handleStartDay}
            disabled={isSubmitting}
            className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-white text-white dark:text-[#1a1a1a] py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Starting...' : 'Start Day'}
          </button>
        </div>

        {/* Add/Edit Task Sheet */}
        <TaskSheetDefine
          isOpen={showAddSheet}
          onClose={() => {
            setShowAddSheet(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
          onDelete={editingTask ? async () => {
            await handleDeleteTask(editingTask);
            setShowAddSheet(false);
            setEditingTask(null);
          } : undefined}
          task={editingTask}
        />
      </div>
    </>
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

type ManifestSlide = 'identity' | 'goal';

function VisualizationStep({ config, onComplete }: { config: Record<string, unknown>; onComplete: () => void }) {
  const [currentSlide, setCurrentSlide] = useState<ManifestSlide>('identity');
  const [identity, setIdentity] = useState<string | null>(null);
  const [hasIdentity, setHasIdentity] = useState(false);
  const [goal, setGoal] = useState<{ goal: string; targetDate: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Timer states
  const [identityProgress, setIdentityProgress] = useState(0);
  const [canContinueIdentity, setCanContinueIdentity] = useState(false);
  const [goalProgress, setGoalProgress] = useState(0);
  const [canContinueGoal, setCanContinueGoal] = useState(false);
  
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioStarted = useRef(false);
  const hasAutoAdvancedIdentity = useRef(false);
  const identityStartTime = useRef<number | null>(null);
  const goalStartTime = useRef<number | null>(null);
  
  const showGoal = (config.showGoal as boolean) ?? true;
  const showIdentity = (config.showIdentity as boolean) ?? true;
  const identityUnlockDuration = 10;
  const identityAutoContinueDuration = 20;
  const goalDuration = 20;

  // Fade in audio
  const fadeInAudio = useCallback((audio: HTMLAudioElement, targetVolume: number = 0.7, fadeDuration: number = 2000) => {
    audio.volume = 0;
    const steps = 20;
    const volumeStep = targetVolume / steps;
    const stepDuration = fadeDuration / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      currentStep++;
      audio.volume = Math.min(targetVolume, volumeStep * currentStep);
      if (currentStep >= steps) clearInterval(fadeInterval);
    }, stepDuration);

    return fadeInterval;
  }, []);

  // Fade out audio
  const fadeOutAudio = useCallback((audio: HTMLAudioElement, fadeDuration: number = 1500) => {
    const startVolume = audio.volume;
    const steps = 15;
    const volumeStep = startVolume / steps;
    const stepDuration = fadeDuration / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      currentStep++;
      audio.volume = Math.max(0, startVolume - volumeStep * currentStep);
      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        audio.pause();
      }
    }, stepDuration);

    return fadeInterval;
  }, []);

  // Move to goal slide
  const goToGoalSlide = useCallback(async () => {
    if (currentSlide === 'goal' || hasAutoAdvancedIdentity.current) return;
    hasAutoAdvancedIdentity.current = true;
    
    try {
      await fetch('/api/checkin/morning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestIdentityCompleted: true }),
      });
    } catch (error) {
      console.error('Error updating check-in:', error);
    }

    setCurrentSlide('goal');
    goalStartTime.current = Date.now();
  }, [currentSlide]);

  // Finish and continue
  const finishManifest = useCallback(async () => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    if (audioRef.current) fadeOutAudio(audioRef.current);

    await fetch('/api/checkin/morning', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifestGoalCompleted: true }),
    });

    onComplete();
  }, [onComplete, fadeOutAudio]);

  // Fetch user data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/user/me');
        const data = await response.json();
        
        if (showIdentity && data.user?.identity) {
          setIdentity(data.user.identity);
          setHasIdentity(true);
        } else {
          setHasIdentity(false);
          setCurrentSlide('goal');
          goalStartTime.current = Date.now();
          hasAutoAdvancedIdentity.current = true;
        }
        
        if (showGoal) {
          if (data.goal) {
            setGoal({ goal: data.goal.goal, targetDate: data.goal.targetDate });
          } else if (data.user?.goal) {
            setGoal({ goal: data.user.goal, targetDate: data.user.goalTargetDate || '' });
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setHasIdentity(false);
        setCurrentSlide('goal');
        goalStartTime.current = Date.now();
        hasAutoAdvancedIdentity.current = true;
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [showIdentity, showGoal]);

  // Audio playback
  useEffect(() => {
    if (isLoading || audioStarted.current) return;
    audioStarted.current = true;

    if (audioRef.current) {
      const audio = audioRef.current;
      
      const playFromCenter = () => {
        if (audio.duration && isFinite(audio.duration)) {
          audio.currentTime = audio.duration / 2;
        }
        audio.play().then(() => fadeInAudio(audio)).catch(console.log);
      };

      if (audio.readyState >= 1) {
        playFromCenter();
      } else {
        audio.addEventListener('loadedmetadata', playFromCenter, { once: true });
      }
    }
  }, [isLoading, fadeInAudio]);

  // Timer logic
  useEffect(() => {
    if (isLoading) return;

    if (hasIdentity && !identityStartTime.current) {
      identityStartTime.current = Date.now();
    }

    if (progressInterval.current) clearInterval(progressInterval.current);

    progressInterval.current = setInterval(() => {
      const now = Date.now();
      
      if (currentSlide === 'identity' && identityStartTime.current && hasIdentity) {
        const elapsed = now - identityStartTime.current;
        const seconds = elapsed / 1000;
        
        setIdentityProgress(Math.min(100, (seconds / identityUnlockDuration) * 100));
        
        if (seconds >= identityUnlockDuration) setCanContinueIdentity(true);
        if (seconds >= identityAutoContinueDuration && !hasAutoAdvancedIdentity.current) goToGoalSlide();
      } else if (currentSlide === 'goal' && goalStartTime.current) {
        const elapsed = now - goalStartTime.current;
        setGoalProgress(Math.min(100, (elapsed / (goalDuration * 1000)) * 100));
        if (elapsed >= goalDuration * 1000) setCanContinueGoal(true);
      }
    }, 100);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isLoading, hasIdentity, currentSlide, goToGoalSlide]);

  const formatTargetDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleContinue = () => {
    if (currentSlide === 'identity' && hasIdentity) {
      if (!canContinueIdentity) return;
      goToGoalSlide();
    } else {
      if (!canContinueGoal) return;
      finishManifest();
    }
  };

  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center h-full"
        style={{ background: 'linear-gradient(180deg, #B8D4D4 0%, #D4B8C8 50%, #E8C8B8 100%)' }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  const canContinue = (currentSlide === 'identity' && hasIdentity) ? canContinueIdentity : canContinueGoal;

  return (
    <div className="relative h-full overflow-hidden">
      {/* Audio element */}
      <audio ref={audioRef} loop src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/audio%2Fmanifest%20(1).mp3?alt=media&token=84b6136a-ba75-42ee-9941-261cf3ebbd6c" />

      {/* Instagram story-style progress indicators */}
      <div className="absolute top-[20px] left-[20px] right-[20px] z-50 flex gap-2">
        {hasIdentity && (
          <div className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-white/70"
              initial={{ width: 0 }}
              animate={{ width: currentSlide === 'identity' ? `${identityProgress}%` : '100%' }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}
        <div className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-white/70"
            initial={{ width: 0 }}
            animate={{ width: currentSlide === 'goal' ? `${goalProgress}%` : '0%' }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      {/* Animated background gradient */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
          style={{ 
            background: (currentSlide === 'identity' && hasIdentity)
              ? 'linear-gradient(180deg, #B8D4D4 0%, #D4B8C8 50%, #E8C8B8 100%)'
              : 'linear-gradient(180deg, #E066FF 0%, #9933FF 50%, #6600CC 100%)'
          }}
        />
      </AnimatePresence>

      {/* Decorative pulsing circles */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="absolute w-[320px] h-[320px] md:w-[450px] md:h-[450px] rounded-full border"
            style={{ borderColor: (currentSlide === 'identity' && hasIdentity) ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute w-[380px] h-[380px] md:w-[520px] md:h-[520px] rounded-full border"
            style={{ borderColor: (currentSlide === 'identity' && hasIdentity) ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)' }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <motion.div
            className="absolute w-[440px] h-[440px] md:w-[600px] md:h-[600px] rounded-full border"
            style={{ borderColor: (currentSlide === 'identity' && hasIdentity) ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}
            animate={{ scale: [1, 1.06, 1], opacity: [0.08, 0.15, 0.08] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
        </div>

        {/* Floating orbs for goal slide */}
        {currentSlide === 'goal' && (
          <>
            <motion.div
              className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
              animate={{ x: ['-20%', '120%'], y: ['20%', '60%'] }}
              transition={{ duration: 25, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
              style={{ left: '-10%', top: '10%', background: 'rgba(255, 255, 255, 0.15)' }}
            />
            <motion.div
              className="absolute w-[350px] h-[350px] rounded-full blur-3xl"
              animate={{ x: ['100%', '-20%'], y: ['60%', '20%'] }}
              transition={{ duration: 30, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: 5 }}
              style={{ right: '-10%', bottom: '10%', background: 'rgba(255, 255, 255, 0.12)' }}
            />
          </>
        )}
      </div>

      {/* Content slides */}
      <div className="h-full flex flex-col items-center justify-center px-8 relative z-10">
        <AnimatePresence mode="wait">
          {currentSlide === 'identity' && hasIdentity ? (
            <motion.div
              key="identity"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-[500px]"
            >
              <h1 className="font-albert text-[42px] md:text-[56px] font-medium text-[#1a1a1a] tracking-[-2px] leading-[1.2]">
                I am {identity}
              </h1>
            </motion.div>
          ) : (
            <motion.div
              key="goal"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-[500px]"
            >
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="font-albert text-[20px] md:text-[24px] text-white/70 tracking-[-1px] leading-[1.2] mb-4"
              >
                I want to
              </motion.p>
              
              {goal ? (
                <>
                  <h1 className="font-albert text-[42px] md:text-[56px] font-medium text-white tracking-[-2px] leading-[1.2] capitalize">
                    {goal.goal}
                  </h1>
                  {goal.targetDate && (
                    <p className="mt-4 font-sans text-[16px] md:text-[18px] text-white/60 tracking-[-0.4px]">
                      by {formatTargetDate(goal.targetDate)}
                    </p>
                  )}
                </>
              ) : (
                <h1 className="font-albert text-[42px] md:text-[56px] font-medium text-white tracking-[-2px] leading-[1.2]">
                  Set your goal
                </h1>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Continue button */}
      <div className="absolute bottom-[40px] left-0 right-0 px-6 z-50">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] border transition-all shadow-[0px_8px_30px_0px_rgba(0,0,0,0.2)] cursor-pointer disabled:cursor-not-allowed"
          style={{
            backgroundColor: (currentSlide === 'identity' && hasIdentity)
              ? canContinue ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'
              : canContinue ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
            color: (currentSlide === 'identity' && hasIdentity)
              ? canContinue ? '#2c2520' : 'rgba(255,255,255,0.4)'
              : canContinue ? '#ffffff' : 'rgba(255,255,255,0.4)',
            borderColor: canContinue ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)',
          }}
        >
          Continue
        </button>
      </div>

      {/* Tap zones for navigation */}
      <div className="absolute inset-0 flex z-20 pointer-events-none">
        {currentSlide === 'goal' && hasIdentity && (
          <button
            onClick={() => {
              setCurrentSlide('identity');
              goalStartTime.current = null;
              setGoalProgress(0);
              setCanContinueGoal(false);
              hasAutoAdvancedIdentity.current = false;
            }}
            className="w-1/4 h-full pointer-events-auto"
            aria-label="Previous"
          />
        )}
        <div className="flex-1" />
        {currentSlide === 'identity' && canContinueIdentity && hasIdentity && (
          <button
            onClick={goToGoalSlide}
            className="w-1/4 h-full pointer-events-auto"
            aria-label="Next"
          />
        )}
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

