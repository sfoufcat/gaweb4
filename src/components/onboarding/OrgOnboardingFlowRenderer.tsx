'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ArrowLeft } from 'lucide-react';
import { QuestionStep, GoalStep, IdentityStep, ExplainerStep, SuccessStep } from '@/components/funnel/steps';
import type { OnboardingStep, OnboardingStepType } from '@/types';

interface OrgOnboardingFlowRendererProps {
  flowId: string;
  isPreview?: boolean;
  onComplete?: () => void;
  onClose?: () => void;
}

interface FlowData {
  flow: {
    id: string;
    name: string;
    enabled: boolean;
  };
  steps: OnboardingStep[];
}

export function OrgOnboardingFlowRenderer({
  flowId,
  isPreview = false,
  onComplete,
  onClose,
}: OrgOnboardingFlowRendererProps) {
  const router = useRouter();
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionData, setSessionData] = useState<Record<string, unknown>>({});
  const [isNavigating, setIsNavigating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Fetch flow and steps
  useEffect(() => {
    async function fetchFlowData() {
      try {
        setIsLoading(true);
        setError(null);

        // Use preview endpoint for coach preview mode
        const endpoint = isPreview
          ? `/api/onboarding/preview/${flowId}`
          : `/api/onboarding/flow/${flowId}`;

        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to load onboarding flow');
        }

        const data = await response.json();
        setFlowData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load onboarding flow');
      } finally {
        setIsLoading(false);
      }
    }

    fetchFlowData();
  }, [flowId, isPreview]);

  // Filter enabled steps
  const visibleSteps = useMemo(() => {
    if (!flowData?.steps) return [];
    return flowData.steps
      .filter(step => step.config?.config) // Only steps with valid config
      .sort((a, b) => a.order - b.order);
  }, [flowData?.steps]);

  const currentStep = visibleSteps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === visibleSteps.length - 1;

  // Handle step completion
  const handleStepComplete = useCallback(async (stepData?: Record<string, unknown>) => {
    // Merge step data into session
    const updatedSessionData = stepData
      ? { ...sessionData, ...stepData }
      : sessionData;

    if (stepData) {
      setSessionData(updatedSessionData);
    }

    if (isLastStep) {
      // Flow complete
      setIsNavigating(true);

      // In preview mode, don't save responses
      if (!isPreview) {
        try {
          await fetch('/api/onboarding/responses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flowId,
              sessionData: updatedSessionData,
            }),
          });
        } catch (err) {
          console.error('Failed to save onboarding response:', err);
        }
      }

      // Wait for exit animation
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
  }, [isLastStep, isPreview, flowId, onComplete, router, sessionData]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  // Handle close
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      if (onClose) {
        onClose();
      } else {
        window.close();
        // Fallback if window.close doesn't work
        router.push('/');
      }
    }, 200);
  }, [onClose, router]);

  // Render step based on type
  const renderStep = useCallback(() => {
    if (!currentStep) return null;

    const stepConfig = currentStep.config?.config;
    if (!stepConfig) return null;

    const commonProps = {
      onComplete: handleStepComplete,
      onBack: isFirstStep ? undefined : handleBack,
      data: sessionData,
      isFirstStep,
    };

    switch (currentStep.type as OnboardingStepType) {
      case 'question':
        return (
          <QuestionStep
            config={stepConfig as Parameters<typeof QuestionStep>[0]['config']}
            {...commonProps}
          />
        );

      case 'goal_setting':
        return (
          <GoalStep
            config={stepConfig as Parameters<typeof GoalStep>[0]['config']}
            {...commonProps}
          />
        );

      case 'identity':
        return (
          <IdentityStep
            config={stepConfig as Parameters<typeof IdentityStep>[0]['config']}
            {...commonProps}
          />
        );

      case 'explainer':
        return (
          <ExplainerStep
            config={stepConfig as Parameters<typeof ExplainerStep>[0]['config']}
            onComplete={handleStepComplete}
            onBack={isFirstStep ? undefined : handleBack}
            isFirstStep={isFirstStep}
          />
        );

      case 'success':
        return (
          <SuccessStep
            config={stepConfig as Parameters<typeof SuccessStep>[0]['config']}
            onComplete={handleStepComplete}
            program={{ name: flowData?.flow.name || 'Onboarding' }}
          />
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
            <p className="text-text-secondary">Unknown step type: {currentStep.type}</p>
            <button
              onClick={() => handleStepComplete()}
              className="mt-4 px-6 py-2 bg-brand-accent text-white rounded-lg"
            >
              Continue
            </button>
          </div>
        );
    }
  }, [currentStep, handleStepComplete, handleBack, sessionData, isFirstStep, flowData?.flow.name]);

  // Loading state
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-app-bg flex items-center justify-center z-50"
      >
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-accent mx-auto mb-4" />
          <p className="text-text-secondary">Loading onboarding...</p>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (error || !flowData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-app-bg flex items-center justify-center z-50"
      >
        <div className="text-center p-6 max-w-md">
          <p className="text-red-500 mb-4">{error || 'Failed to load onboarding flow'}</p>
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-[#e1ddd8] hover:bg-[#d1ccc5] rounded-lg transition-colors"
          >
            Close
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
        className="fixed inset-0 bg-app-bg flex items-center justify-center z-50"
      >
        <div className="text-center p-6 max-w-md">
          <p className="text-text-secondary mb-4">This onboarding flow has no steps configured yet.</p>
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-[#e1ddd8] hover:bg-[#d1ccc5] rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="onboarding-flow"
        initial={{ opacity: 0 }}
        animate={{ opacity: isClosing || isNavigating ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-app-bg z-50 overflow-auto"
      >
        {/* Header with close button and preview banner */}
        <div className="sticky top-0 z-10 bg-app-bg">
          {isPreview && (
            <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
              <p className="text-center text-sm text-amber-700 dark:text-amber-300 font-medium">
                Preview Mode — Responses will not be saved
              </p>
            </div>
          )}
          <div className="flex items-center justify-between p-4">
            {/* Back button (only show if not first step) */}
            {!isFirstStep ? (
              <button
                onClick={handleBack}
                className="p-2 hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
            ) : (
              <div className="w-9" /> // Spacer
            )}

            {/* Progress indicator */}
            <div className="flex items-center gap-1.5">
              {visibleSteps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx <= currentStepIndex
                      ? 'w-6 bg-brand-accent'
                      : 'w-1.5 bg-[#e1ddd8] dark:bg-[#3a3f4b]'
                  }`}
                />
              ))}
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="p-2 hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Step content */}
        <div className="max-w-lg mx-auto px-4 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep?.id || currentStepIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
