'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  User, 
  CreditCard, 
  ArrowRight, 
  Loader2,
  Check,
  Sparkles
} from 'lucide-react';

interface CoachOnboardingOverlayProps {
  state: 'needs_profile' | 'needs_plan';
  onComplete?: () => void;
}

/**
 * Coach Onboarding Overlay
 * 
 * Non-dismissible sticky overlay for new coaches:
 * - needs_profile: Complete your profile setup
 * - needs_plan: Select a plan to continue
 * 
 * Cannot be dismissed until the step is completed
 */
export function CoachOnboardingOverlay({ state, onComplete }: CoachOnboardingOverlayProps) {
  const router = useRouter();
  
  const steps = [
    { 
      id: 'profile', 
      label: 'Complete profile', 
      icon: User,
      description: 'Tell us about your coaching practice'
    },
    { 
      id: 'plan', 
      label: 'Choose a plan', 
      icon: CreditCard,
      description: 'Start your 7-day free trial'
    },
  ];
  
  const currentStepIndex = state === 'needs_profile' ? 0 : 1;
  const currentStep = steps[currentStepIndex];
  
  const handleContinue = () => {
    if (state === 'needs_profile') {
      router.push('/coach/onboarding/profile');
    } else {
      router.push('/coach/onboarding/plans');
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
    >
      <div className="max-w-2xl mx-auto px-4 pb-6">
        <div className="pointer-events-auto bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl shadow-black/20 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-[#f3f1ef] dark:bg-[#1e222a]">
            <div 
              className="h-full bg-gradient-to-r from-[#a07855] to-[#b8896a] transition-all duration-500"
              style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
          
          <div className="p-5">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#a07855]/20 to-[#b8896a]/10 dark:from-[#b8896a]/20 dark:to-[#a07855]/10 flex items-center justify-center flex-shrink-0">
                <currentStep.icon className="w-6 h-6 text-[#a07855] dark:text-[#b8896a]" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-albert font-medium text-[#a07855] dark:text-[#b8896a] uppercase tracking-wide">
                    Step {currentStepIndex + 1} of {steps.length}
                  </span>
                </div>
                <h3 className="font-albert text-[18px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {currentStep.label}
                </h3>
                <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                  {currentStep.description}
                </p>
              </div>
              
              {/* CTA */}
              <button
                onClick={handleContinue}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-xl font-albert text-[14px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Step indicators */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#e1ddd8]/30 dark:border-[#313746]/30">
              {steps.map((step, i) => {
                const isCompleted = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;
                
                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      isCompleted 
                        ? 'bg-emerald-100 dark:bg-emerald-950/50' 
                        : isCurrent
                          ? 'bg-[#a07855]/20 dark:bg-[#b8896a]/20'
                          : 'bg-[#f3f1ef] dark:bg-[#1e222a]'
                    }`}>
                      {isCompleted ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <step.icon className={`w-3.5 h-3.5 ${
                          isCurrent 
                            ? 'text-[#a07855] dark:text-[#b8896a]' 
                            : 'text-[#a7a39e] dark:text-[#7d8190]'
                        }`} />
                      )}
                    </div>
                    <span className={`font-sans text-[13px] ${
                      isCompleted 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : isCurrent
                          ? 'text-[#1a1a1a] dark:text-[#f5f5f8] font-medium'
                          : 'text-[#a7a39e] dark:text-[#7d8190]'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

