'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Users,
  Rocket,
  Target,
  BarChart3,
  MessageSquare,
  Compass,
  ArrowRight,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

// Tour step definitions
const TOUR_STEPS = [
  {
    id: 'programs',
    tabValue: 'programs',
    title: 'Create Programs & Masterminds',
    description: 'Build transformation programs with structured content, cohorts, and automated enrollment. Perfect for group coaching.',
    icon: Rocket,
    position: 'bottom',
  },
  {
    id: 'squads',
    tabValue: 'squads',
    title: 'Accountability Squads',
    description: 'Group your clients into small accountability squads. Members support each other and stay engaged.',
    icon: Users,
    position: 'bottom',
  },
  {
    id: 'checkins',
    tabValue: 'checkins',
    title: 'Daily & Weekly Check-ins',
    description: 'Set up recurring check-ins to keep clients accountable. Morning intentions, evening reflections, and custom flows.',
    icon: Target,
    position: 'bottom',
  },
  {
    id: 'funnels',
    tabValue: 'funnels',
    title: 'Lead Capture Funnels',
    description: 'Build beautiful landing pages to attract new clients. Collect emails, process payments, and automate enrollment.',
    icon: Compass,
    position: 'bottom',
  },
  {
    id: 'channels',
    tabValue: 'channels',
    title: 'Chat & Communication',
    description: 'Connect with clients through group chats and direct messages. Build community around your programs.',
    icon: MessageSquare,
    position: 'bottom',
  },
  {
    id: 'analytics',
    tabValue: 'analytics',
    title: 'Track Your Progress',
    description: 'Monitor engagement, completion rates, and revenue. See what\'s working and optimize your coaching business.',
    icon: BarChart3,
    position: 'bottom',
  },
];

interface FeatureTourProps {
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function FeatureTour({ isActive, onComplete, onSkip }: FeatureTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [availableSteps, setAvailableSteps] = useState<typeof TOUR_STEPS>([]);
  const observerRef = useRef<MutationObserver | null>(null);

  // Check which tabs actually exist in the DOM
  const detectAvailableTabs = useCallback(() => {
    const available = TOUR_STEPS.filter(step => {
      // Radix UI renders value prop as data-value attribute
      const tab = document.querySelector(`[data-state][data-value="${step.tabValue}"]`);
      return !!tab;
    });
    return available;
  }, []);

  // Poll for tabs to exist before starting tour
  useEffect(() => {
    if (!isActive) {
      setIsReady(false);
      setCurrentStep(0);
      setAvailableSteps([]);
      return;
    }

    let attempts = 0;
    const maxAttempts = 15; // 3 seconds
    
    const checkTabs = () => {
      attempts++;
      const tabs = detectAvailableTabs();
      
      if (tabs.length > 0) {
        console.log(`[FeatureTour] Found ${tabs.length} tabs after ${attempts} attempts:`, tabs.map(t => t.id));
        setAvailableSteps(tabs);
        setIsReady(true);
        return true;
      }
      
      if (attempts >= maxAttempts) {
        console.warn('[FeatureTour] No tabs found after 3 seconds, skipping tour');
        onSkip();
        return true;
      }
      
      return false;
    };
    
    // Check immediately
    if (checkTabs()) return;
    
    // Then poll every 200ms
    const interval = setInterval(() => {
      if (checkTabs()) {
        clearInterval(interval);
      }
    }, 200);
    
    return () => clearInterval(interval);
  }, [isActive, detectAvailableTabs, onSkip]);

  // Current step based on available steps
  const step = availableSteps[currentStep];
  const isLastStep = currentStep === availableSteps.length - 1;

  // Find and highlight the target tab element
  const updateTargetPosition = useCallback(() => {
    if (!step) return;

    // Find the tab trigger by its value (Radix renders value as data-value)
    const tabTrigger = document.querySelector(`[data-state][data-value="${step.tabValue}"]`);
    
    if (tabTrigger) {
      const rect = tabTrigger.getBoundingClientRect();
      setTargetRect(rect);
      
      // Scroll into view if needed
      tabTrigger.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [step]);

  // Update position on step change and window events
  useEffect(() => {
    if (!isActive || !isReady) return;

    updateTargetPosition();

    // Listen for window resize and scroll
    const handleResize = () => updateTargetPosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    // Watch for DOM changes that might affect tab positions
    observerRef.current = new MutationObserver(updateTargetPosition);
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      observerRef.current?.disconnect();
    };
  }, [isActive, isReady, currentStep, updateTargetPosition]);

  // Click the tab to show its content
  useEffect(() => {
    if (!isActive || !isReady || !step) return;

    const tabTrigger = document.querySelector(`[data-state][data-value="${step.tabValue}"]`) as HTMLElement;
    if (tabTrigger) {
      // Small delay to let the highlight appear first
      const timer = setTimeout(() => {
        tabTrigger.click();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isActive, isReady, step]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    setIsExiting(true);
    
    // Save tour completion status
    try {
      await fetch('/api/coach/onboarding-state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourCompleted: true }),
      });
    } catch (err) {
      console.error('Failed to save tour completion:', err);
    }

    setTimeout(() => {
      onComplete();
    }, 300);
  };

  const handleSkip = async () => {
    setIsExiting(true);
    
    // Save tour as skipped
    try {
      await fetch('/api/coach/onboarding-state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourCompleted: true, tourSkipped: true }),
      });
    } catch (err) {
      console.error('Failed to save tour skip:', err);
    }

    setTimeout(() => {
      onSkip();
    }, 300);
  };

  // Don't render anything if not active
  if (!isActive) return null;

  // Show loading state while waiting for tabs
  if (!isReady) {
    return createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center"
      >
        <div className="bg-white dark:bg-[#1a1e26] rounded-2xl p-6 shadow-2xl flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFD036]" />
          <span className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            Preparing tour...
          </span>
        </div>
      </motion.div>,
      document.body
    );
  }

  // No steps available
  if (!step) return null;

  const StepIcon = step.icon;

  return createPortal(
    <AnimatePresence>
      {!isExiting && (
        <>
          {/* Overlay with spotlight cutout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] pointer-events-none"
            style={{
              background: targetRect
                ? `radial-gradient(ellipse 200px 100px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 0%, rgba(0,0,0,0.7) 100%)`
                : 'rgba(0,0,0,0.7)',
            }}
          />

          {/* Clickable backdrop */}
          <div className="fixed inset-0 z-[91]" onClick={handleSkip} />

          {/* Highlight ring around target */}
          {targetRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed z-[92] pointer-events-none"
              style={{
                left: targetRect.left - 4,
                top: targetRect.top - 4,
                width: targetRect.width + 8,
                height: targetRect.height + 8,
              }}
            >
              <div className="absolute inset-0 rounded-lg border-2 border-[#FFD036] shadow-[0_0_20px_rgba(255,208,54,0.5)]" />
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-lg border-2 border-[#FFD036]/50"
              />
            </motion.div>
          )}

          {/* Tooltip */}
          {targetRect && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed z-[93] w-[360px]"
              style={{
                left: Math.max(16, Math.min(
                  targetRect.left + targetRect.width / 2 - 180,
                  window.innerWidth - 376
                )),
                top: targetRect.bottom + 16,
              }}
            >
              <div className="bg-white dark:bg-[#1a1e26] rounded-2xl shadow-2xl border border-[#e1ddd8] dark:border-[#313746] overflow-hidden">
                {/* Header with icon */}
                <div className="px-5 pt-5 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFD036]/20 flex items-center justify-center flex-shrink-0">
                      <StepIcon className="w-5 h-5 text-brand-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-albert text-lg font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {step.title}
                      </h3>
                      <p className="mt-1 font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress and actions */}
                <div className="px-5 py-4 bg-[#f9f8f7] dark:bg-[#171b22] border-t border-[#e1ddd8] dark:border-[#313746]">
                  {/* Progress dots */}
                  <div className="flex items-center justify-center gap-1.5 mb-4">
                    {availableSteps.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentStep(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentStep
                            ? 'bg-brand-accent w-6'
                            : index < currentStep
                            ? 'bg-brand-accent/50'
                            : 'bg-[#e1ddd8] dark:bg-[#313746]'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3">
                    {currentStep > 0 && (
                      <button
                        onClick={handlePrevious}
                        className="flex-1 py-2.5 px-4 border border-[#e1ddd8] dark:border-[#313746] rounded-xl font-sans text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-white dark:hover:bg-[#1e222a] transition-colors"
                      >
                        Previous
                      </button>
                    )}
                    <button
                      onClick={handleNext}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#FFD036] hover:bg-[#f5c520] text-[#1a1a1a] rounded-xl font-sans text-sm font-bold transition-colors"
                    >
                      {isLastStep ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Get Started
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Skip link */}
                  <button
                    onClick={handleSkip}
                    className="w-full mt-3 py-1 font-sans text-xs text-[#a7a39e] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] transition-colors"
                  >
                    Skip tour
                  </button>
                </div>
              </div>

              {/* Arrow pointing to tab */}
              <div
                className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-[#1a1e26] border-l border-t border-[#e1ddd8] dark:border-[#313746] rotate-45"
                style={{
                  left: Math.max(40, Math.min(
                    targetRect.left + targetRect.width / 2 - (targetRect.left + targetRect.width / 2 - 180) + 180,
                    320
                  )),
                }}
              />
            </motion.div>
          )}

          {/* Close button in corner */}
          <button
            onClick={handleSkip}
            className="fixed top-4 right-4 z-[94] p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Step counter in corner */}
          <div className="fixed top-4 left-4 z-[94] px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
            <span className="font-sans text-sm text-white">
              {currentStep + 1} of {availableSteps.length}
            </span>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
