'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TutorialStep } from '@/hooks/useHomeTutorial';

// ============================================================================
// TYPES
// ============================================================================

interface HomeTutorialOverlayProps {
  isActive: boolean;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => Promise<void>;
  onExit: () => Promise<void>;
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom' | 'left' | 'right';
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ============================================================================
// EXIT CONFIRMATION MODAL
// ============================================================================

interface ExitModalProps {
  isOpen: boolean;
  onContinue: () => void;
  onExit: () => void;
}

function ExitConfirmationModal({ isOpen, onContinue, onExit }: ExitModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onContinue}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-[#171b22] rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        <h3 className="font-albert text-[22px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] mb-3">
          Exit tutorial?
        </h3>
        <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-relaxed mb-6">
          Are you sure you want to exit the tutorial now?
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={onContinue}
            className="flex-1 py-3 px-4 bg-[#2c2520] dark:bg-brand-accent text-white rounded-xl font-sans font-semibold text-[14px] hover:bg-[#1a1a1a] dark:hover:bg-brand-accent/90 transition-colors"
          >
            Continue tutorial
          </button>
          <button
            onClick={onExit}
            className="flex-1 py-3 px-4 bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] rounded-xl font-sans font-semibold text-[14px] hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HomeTutorialOverlay({
  isActive,
  currentStep,
  currentStepIndex,
  totalSteps,
  onNext,
  onPrev,
  onComplete,
  onExit,
}: HomeTutorialOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number>(0);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate tooltip position based on target element and preferred position
  const calculateTooltipPosition = useCallback((targetRect: DOMRect, preferredPosition?: string, dynamicHeight?: number) => {
    const tooltipWidth = 320;
    // Use measured height if available, otherwise fallback to estimate
    const tooltipHeight = dynamicHeight && dynamicHeight > 0 ? dynamicHeight : 180;
    const margin = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth < 640;

    let top = 0;
    let left = 0;
    let arrowPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

    // On mobile, only use vertical positions to avoid covering the target element
    // Try preferred position first, then fall back to best fit
    const positions = isMobile
      ? (preferredPosition === 'top' || preferredPosition === 'bottom' 
          ? [preferredPosition, preferredPosition === 'top' ? 'bottom' : 'top']
          : ['bottom', 'top'])
      : (preferredPosition 
          ? [preferredPosition, 'bottom', 'top', 'right', 'left']
          : ['bottom', 'top', 'right', 'left']);

    let foundFit = false;

    for (const pos of positions) {
      let fits = false;

      switch (pos) {
        case 'bottom':
          top = targetRect.bottom + margin;
          left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
          arrowPosition = 'top';
          fits = top + tooltipHeight < viewportHeight && left > 0 && left + tooltipWidth < viewportWidth;
          break;

        case 'top':
          top = targetRect.top - tooltipHeight - margin;
          left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
          arrowPosition = 'bottom';
          fits = top > 0 && left > 0 && left + tooltipWidth < viewportWidth;
          break;

        case 'right':
          top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
          left = targetRect.right + margin;
          arrowPosition = 'left';
          fits = left + tooltipWidth < viewportWidth && top > 0 && top + tooltipHeight < viewportHeight;
          break;

        case 'left':
          top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
          left = targetRect.left - tooltipWidth - margin;
          arrowPosition = 'right';
          fits = left > 0 && top > 0 && top + tooltipHeight < viewportHeight;
          break;
      }

      if (fits) {
        foundFit = true;
        break;
      }
    }

    // If no position fits perfectly, choose the side with more space (top vs bottom)
    if (!foundFit) {
      const spaceAbove = targetRect.top;
      const spaceBelow = viewportHeight - targetRect.bottom;

      if (spaceBelow >= spaceAbove) {
        // Place below
        top = targetRect.bottom + margin;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        arrowPosition = 'top';
      } else {
        // Place above
        top = targetRect.top - tooltipHeight - margin;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        arrowPosition = 'bottom';
      }
    }

    // Clamp to viewport
    left = Math.max(margin, Math.min(left, viewportWidth - tooltipWidth - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipHeight - margin));

    setTooltipPosition({ top, left, arrowPosition });
  }, []);

  // Calculate positions when step changes or on scroll
  const calculatePositions = useCallback((skipScroll: boolean = false, dynamicHeight?: number) => {
    if (!currentStep) {
      setHighlightRect(null);
      setTooltipPosition(null);
      return;
    }

    const targetElement = document.querySelector(currentStep.target);
    
    if (!targetElement) {
      console.warn(`[HomeTutorial] Target element not found: ${currentStep.target}`);
      // Skip to next step if element is missing
      setHighlightRect(null);
      setTooltipPosition(null);
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const padding = 8; // Padding around the highlight

    // Use viewport-relative positioning (fixed), not document-relative
    const highlight: HighlightRect = {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };
    setHighlightRect(highlight);

    // Scroll element into view if needed (only on step change, not during scroll)
    if (!skipScroll) {
      const viewportHeight = window.innerHeight;
      
      if (rect.top < 100 || rect.bottom > viewportHeight - 100) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        // Recalculate after scroll animation completes
        setTimeout(() => {
          const newRect = targetElement.getBoundingClientRect();
          const newHighlight: HighlightRect = {
            top: newRect.top - padding,
            left: newRect.left - padding,
            width: newRect.width + padding * 2,
            height: newRect.height + padding * 2,
          };
          setHighlightRect(newHighlight);
          calculateTooltipPosition(newRect, currentStep.position, dynamicHeight);
        }, 350);
        return;
      }
    }

    calculateTooltipPosition(rect, currentStep.position, dynamicHeight);
  }, [currentStep, calculateTooltipPosition]);

  // Measure tooltip height after render (for dynamic positioning)
  useLayoutEffect(() => {
    if (tooltipRef.current && isActive && currentStep) {
      const height = tooltipRef.current.offsetHeight;
      if (height > 0 && height !== measuredHeight) {
        setMeasuredHeight(height);
      }
    }
  }, [isActive, currentStep, currentStepIndex, measuredHeight]);

  // Recalculate position once we have measured height
  useEffect(() => {
    if (isActive && currentStep && measuredHeight > 0) {
      calculatePositions(false, measuredHeight);
    }
  }, [measuredHeight, isActive, currentStep, calculatePositions]);

  // Recalculate on step change (initial pass without measured height)
  useEffect(() => {
    if (isActive && currentStep) {
      // Reset measured height when step changes to force re-measurement
      setMeasuredHeight(0);
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => calculatePositions(false), 100);
      return () => clearTimeout(timer);
    }
  }, [isActive, currentStep, calculatePositions]);

  // Recalculate on resize and scroll
  useEffect(() => {
    if (!isActive) return;

    const handleResize = () => {
      calculatePositions(true, measuredHeight);
    };

    const handleScroll = () => {
      // Recalculate positions on scroll to keep highlight following the element
      calculatePositions(true, measuredHeight);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isActive, calculatePositions, measuredHeight]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowExitModal(true);
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStepIndex === totalSteps - 1) {
          onComplete();
        } else {
          onNext();
        }
      } else if (e.key === 'ArrowLeft') {
        onPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStepIndex, totalSteps, onNext, onPrev, onComplete]);

  const handleExitClick = () => {
    setShowExitModal(true);
  };

  const handleConfirmExit = async () => {
    setShowExitModal(false);
    await onExit();
  };

  const handleContinue = () => {
    setShowExitModal(false);
  };

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  if (!mounted || !isActive) return null;

  const overlayContent = (
    <>
      {/* Dark overlay using box-shadow approach - highlighted element stays bright */}
      <div className="fixed inset-0 z-[9999] pointer-events-auto">
        {/* Highlight box with box-shadow creates the dark overlay around it */}
        {highlightRect ? (
          <div
            className="fixed bg-transparent rounded-2xl transition-all duration-150 ease-out"
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
            }}
          >
            {/* Highlight ring */}
            <div className="absolute inset-0 rounded-2xl ring-4 ring-brand-accent dark:ring-brand-accent ring-offset-4 ring-offset-transparent" />
          </div>
        ) : (
          /* Fallback: full dark overlay when no highlight target */
          <div className="absolute inset-0 bg-black/75" />
        )}
      </div>

      {/* Tooltip - render invisibly first to measure, then show with position */}
      {currentStep && (
        <div
          ref={tooltipRef}
          className={`fixed z-[10000] w-[320px] bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl p-5 ${
            tooltipPosition && measuredHeight > 0 
              ? 'animate-in fade-in zoom-in-95 duration-200' 
              : 'opacity-0 pointer-events-none'
          }`}
          style={{
            top: tooltipPosition?.top ?? 0,
            left: tooltipPosition?.left ?? 0,
          }}
        >
          {/* Close button */}
          <button
            onClick={handleExitClick}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-[#f3f1ef] dark:bg-[#262b35] hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors"
            aria-label="Exit tutorial"
          >
            <X className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStepIndex
                    ? 'w-6 bg-brand-accent'
                    : i < currentStepIndex
                    ? 'w-1.5 bg-brand-accent/50 dark:bg-brand-accent/50'
                    : 'w-1.5 bg-[#e1ddd8] dark:bg-[#262b35]'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <h3 className="font-albert text-[20px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] mb-2">
            {currentStep.title}
          </h3>
          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-relaxed mb-4">
            {currentStep.body}
          </p>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={onPrev}
              disabled={isFirstStep}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg font-sans text-[13px] font-medium transition-colors ${
                isFirstStep
                  ? 'opacity-40 cursor-not-allowed text-text-muted'
                  : 'text-text-secondary dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={isLastStep ? onComplete : onNext}
              className="flex items-center gap-1 px-5 py-2.5 bg-[#2c2520] dark:bg-brand-accent text-white rounded-xl font-sans text-[13px] font-semibold hover:bg-[#1a1a1a] dark:hover:bg-brand-accent/90 transition-colors"
            >
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Arrow pointer - only show when positioned */}
          {tooltipPosition && (
            <div
              className={`absolute w-3 h-3 bg-white dark:bg-[#171b22] transform rotate-45 ${
                tooltipPosition.arrowPosition === 'top'
                  ? '-top-1.5 left-1/2 -translate-x-1/2'
                  : tooltipPosition.arrowPosition === 'bottom'
                  ? '-bottom-1.5 left-1/2 -translate-x-1/2'
                  : tooltipPosition.arrowPosition === 'left'
                  ? 'top-1/2 -left-1.5 -translate-y-1/2'
                  : 'top-1/2 -right-1.5 -translate-y-1/2'
              }`}
            />
          )}
        </div>
      )}

      {/* Exit confirmation modal */}
      <ExitConfirmationModal
        isOpen={showExitModal}
        onContinue={handleContinue}
        onExit={handleConfirmExit}
      />
    </>
  );

  return createPortal(overlayContent, document.body);
}

export default HomeTutorialOverlay;

